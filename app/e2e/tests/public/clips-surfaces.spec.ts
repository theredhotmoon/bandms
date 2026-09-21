import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const REASON = `E2E clips-surfaces ${STAMP}`
// Ids no other spec seeds — cleanup deletes by id, but a shared video on a
// shared owner would still collide with a concurrent spec's grid assertions.
const RELEASE_CLIP_URL = 'https://vimeo.com/148751763'
const MERCH_CLIP_URL   = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
const EPK_CLIP_URL     = 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp'

/**
 * storageState replays cookies only, and e2e/.auth/admin.json holds none — an
 * API context built from it is anonymous. The token has to be lifted out and
 * sent explicitly. Path is relative to the Playwright cwd (app/): these spec
 * files are ESM, so __dirname does not exist.
 */
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed clips')
  return entry.value
}

async function api(request: APIRequestContext, method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}: ${await res.text()}`)
  return res
}

/** Same rebuild-and-poll as post-blocks.spec.ts — see the comment there. */
async function rebuildAndWait(request: APIRequestContext, since: number) {
  const deadline = Date.now() + 180_000

  while (Date.now() < deadline) {
    const trigger = await request.post(`${API}/api/admin/site/rebuild`, {
      headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    })
    if (!trigger.ok() && trigger.status() !== 409) {
      throw new Error(`POST /api/admin/site/rebuild → ${trigger.status()}`)
    }

    while (Date.now() < deadline) {
      const res = await api(request, 'get', '/api/admin/site/rebuild/status')
      const body = await res.json()
      if (body.status === 'error') throw new Error('Public site rebuild failed')
      if (body.status === 'done') {
        if ((body.startedAt ?? 0) >= since) return
        break // stale build finished before our seed — trigger another
      }
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

// Section segments are per-locale custom slugs an editor can change in
// /admin/website-modules — the dev DB has merch at /en/shop, for one.
async function sectionSlug(request: APIRequestContext, module: string): Promise<string> {
  const res = await request.get(`${API}/api/site-config?lang=en`, { headers: { Accept: 'application/json' } })
  if (!res.ok()) throw new Error(`GET /api/site-config → ${res.status()}`)
  const body = await res.json()
  return (body.data ?? body).module_config?.[module]?.slug || module
}

interface Version { id: number; status: 'pending' | 'published' | 'archived'; release_reason: string | null }

/**
 * The PR 2 surfaces of the clips library: a clip attached to a release or a
 * merch item renders on that page, and a clip flagged "show in EPK" reaches
 * the EPK — through a *published* version, which is what /epk serves whenever
 * one exists. The previously live version is restored in afterAll.
 */
test.describe.serial('Public clips — release, merch, EPK', () => {
  failOnPageError()

  let releaseId: number
  let shopItemId: number
  let shopSlug: string
  let releasesSection: string
  let merchSection: string
  let epkSection: string
  const clipIds: number[] = []
  let originalLiveEpkId: number | null = null
  let publishedEpkId: number | null = null
  // Modules this spec switched on, to switch off again. A disabled module
  // unbuilds its routes, and the dev DB has all three of these off.
  const enabledByUs: string[] = []

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000)

    ;[releasesSection, merchSection, epkSection] = await Promise.all([
      sectionSlug(request, 'releases'), sectionSlug(request, 'merch'), sectionSlug(request, 'epk'),
    ])

    const modules = (await (await api(request, 'get', '/api/admin/modules')).json()).data as { slug: string; enabled: boolean }[]
    for (const slug of ['releases', 'merch', 'epk']) {
      if (modules.find(m => m.slug === slug)?.enabled === false) {
        await api(request, 'put', `/api/admin/modules/${slug}`, { enabled: true })
        enabledByUs.push(slug)
      }
    }

    const releases = (await (await api(request, 'get', '/api/releases')).json()).data as { id: number }[]
    test.skip(releases.length === 0, 'No release to attach to')
    releaseId = releases[0].id

    // The dev DB has no public merch, so seed one item rather than skip.
    const item = (await (await api(request, 'post', '/api/shop', {
      name: `E2E clip tee ${STAMP}`, is_available: true, prices: [{ currency: 'EUR', amount: 20 }],
    })).json()).data as { id: number; slug_en: string }
    shopItemId = item.id
    shopSlug = item.slug_en

    for (const [url, category, attach, show_in_epk] of [
      [RELEASE_CLIP_URL, 'studio', [{ type: 'release', id: releaseId }], false],
      [MERCH_CLIP_URL, 'other', [{ type: 'shop_item', id: shopItemId }], false],
      [EPK_CLIP_URL, 'live', [], true],
    ] as const) {
      const clip = (await (await api(request, 'post', '/api/clips', {
        url, category, attach, show_in_epk, title: { en: `E2E surface clip ${STAMP} ${category}` },
      })).json()).data as { id: number }
      clipIds.push(clip.id)
    }

    // The EPK serves the published version while one exists, so the flagged
    // clip only reaches the page through a new version — which afterAll can
    // archive and delete once the previous live one is restored. With nothing
    // live (a fresh DB) the live builder already serves the clip, and a
    // version published now could never be deleted, so publish nothing.
    const versions = (await (await api(request, 'get', '/api/epk-versions')).json()).data as Version[]
    const pending = versions.find(v => v.status === 'pending')
    if (pending && !pending.release_reason?.startsWith('E2E ')) {
      throw new Error('A pending EPK version exists — publish or discard it before running this spec')
    }
    if (pending) await api(request, 'delete', `/api/epk-versions/${pending.id}`)
    originalLiveEpkId = versions.find(v => v.status === 'published')?.id ?? null

    if (originalLiveEpkId !== null) {
      const created = (await (await api(request, 'post', '/api/epk-versions', { release_reason: REASON })).json()).data as { id: number }
      publishedEpkId = created.id
      await api(request, 'post', `/api/epk-versions/${publishedEpkId}/publish`)
    }

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(180_000)
    // Every step runs even if an earlier one fails; failures are collected and
    // asserted at the end, because a silent failed restore would leave this
    // spec's EPK version live on the dev site.
    const failures: string[] = []
    const steps: Array<[string, () => Promise<unknown>]> = [
      ['restore live EPK', async () => {
        if (originalLiveEpkId === null) return
        await api(request, 'post', `/api/epk-versions/${originalLiveEpkId}/publish`).catch(e => {
          // 422 "already live": we never got as far as publishing ours.
          // 404: epk-versions.spec.ts, running in parallel, owned that version
          // and has since restored the true original and deleted it.
          if (!/→ (422|404)/.test(String(e.message))) throw e
        })
      }],
      ['delete E2E EPK version', async () => {
        if (publishedEpkId === null) return
        const mine = ((await (await api(request, 'get', '/api/epk-versions')).json()).data as Version[]).find(v => v.id === publishedEpkId)
        // A live version cannot be deleted; only reachable if the restore above failed, which is already recorded.
        if (mine && mine.status !== 'published') await api(request, 'delete', `/api/epk-versions/${publishedEpkId}`)
      }],
      ...clipIds.map((id): [string, () => Promise<unknown>] => [`delete clip ${id}`, () => api(request, 'delete', `/api/clips/${id}`)]),
      ['delete shop item', async () => { if (shopItemId) await api(request, 'delete', `/api/shop/${shopItemId}`) }],
      ...enabledByUs.map((slug): [string, () => Promise<unknown>] => [`disable ${slug} again`, () => api(request, 'put', `/api/admin/modules/${slug}`, { enabled: false })]),
    ]
    for (const [name, step] of steps) {
      await step().catch(e => failures.push(`${name}: ${e.message}`))
    }
    // Restoring the rows is not enough: the built site still carries the
    // pages this spec switched on and the clips it seeded, until something
    // rebuilds it.
    await rebuildAndWait(request, Date.now()).catch(e => failures.push(`final rebuild: ${e.message}`))
    // The webhook's publish step must drop what the new build no longer has:
    // a merge would leave the release page up with its module off.
    if (enabledByUs.includes('releases')) {
      const res = await request.get(`${WEB}/en/${releasesSection}/${releaseId}`)
      if (res.status() !== 404) failures.push(`release page still served after its module was switched off (${res.status()})`)
    }
    expect(failures).toEqual([])
  })

  test('the release page renders its clip under the release module heading', async ({ page }) => {
    await page.goto(`${WEB}/en/${releasesSection}/${releaseId}`)

    const sec = page.getByTestId('release-clips')
    await expect(sec).toBeVisible()
    await expect(sec.locator('.sh-title')).toHaveText('Videos')
    const item = sec.locator('.clips-item').filter({ hasText: `${STAMP} studio` })
    await expect(item.locator('iframe')).toHaveAttribute('src', /player\.vimeo\.com\/video\/148751763/)
    await expect(item.locator('.clips-cat')).toHaveText('Studio')
  })

  test('the merch item page renders its clip', async ({ page }) => {
    await page.goto(`${WEB}/en/${merchSection}/${shopSlug}`)

    const sec = page.getByTestId('merch-clips')
    await expect(sec).toBeVisible()
    await expect(sec.locator('.clips-title')).toHaveText('Videos')
    const item = sec.locator('.clips-item').filter({ hasText: `${STAMP} other` })
    await expect(item.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/jNQXAC9IVRw/)
  })

  test('the EPK renders only the clip flagged for it, from the published snapshot', async ({ page }) => {
    await page.goto(`${WEB}/en/${epkSection}`)

    const sec = page.getByTestId('epk-clips')
    await expect(sec).toBeVisible()
    await expect(sec.locator('.sh-title')).toHaveText('Videos')
    const mine = sec.locator('.clips-item').filter({ hasText: STAMP })
    await expect(mine).toHaveCount(1)
    await expect(mine.locator('.pb-embed--audio iframe')).toHaveAttribute('src', /open\.spotify\.com\/embed\/track\/3n3Ppam7vgaVa1iaRUc9Lp/)
    await expect(mine.locator('.clips-cat')).toHaveText('Live')
  })

  test('the Polish merch page carries the Polish heading and category label', async ({ page }) => {
    await page.goto(`${WEB}/en/${merchSection}/${shopSlug}`)
    const pl = await page.locator('link[hreflang="pl"]').getAttribute('href')
    test.skip(!pl, 'No Polish alternate for this item')

    await page.goto(`${WEB}${new URL(pl!).pathname}`)
    const sec = page.getByTestId('merch-clips')
    await expect(sec.locator('.clips-title')).toHaveText('Nagrania')
    await expect(sec.locator('.clips-item').filter({ hasText: `${STAMP} other` }).locator('.clips-cat')).toHaveText('Inne')
  })
})
