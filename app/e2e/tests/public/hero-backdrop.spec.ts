import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The public half of hero background images.
 *
 * The admin spec (tests/admin/hero-images.spec.ts) covers choosing and saving
 * pictures; this covers what a visitor actually gets, which is the point of the
 * feature and was the half with no coverage.
 *
 * Two things are asserted separately because they fail independently:
 *
 *  1. Every section page renders the *shared* page header. Seven of them used to
 *     hand-roll their own, and the backdrop only reaches a page that goes
 *     through PageHero — so a page that regressed to its own markup would
 *     silently stop showing hero pictures with a completely green build.
 *
 *  2. The backdrop mechanism itself: candidates ship in the markup and an inline
 *     script picks exactly one before paint.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

test.use({ storageState: { cookies: [], origins: [] } })

/** Module key → the URL slug it is served under in English. */
const SECTION_PAGES = [
  { slug: 'about', module: 'about' },
  { slug: 'concerts', module: 'concerts' },
  { slug: 'contact', module: 'contact' },
  { slug: 'news', module: 'posts' },
  { slug: 'photos', module: 'photos' },
  { slug: 'releases', module: 'releases' },
  { slug: 'shop', module: 'merch' },
  { slug: 'videos', module: 'videos' },
  { slug: 'press', module: 'press' },
  { slug: 'epk', module: 'epk' },
  { slug: 'newsletter', module: 'newsletter' },
] as const

async function pageIsUp(request: import('@playwright/test').APIRequestContext, path: string) {
  try {
    return (await request.get(`${WEB}${path}`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe('Public hero backdrop', () => {
  failOnPageError()

  test.describe('every page renders the shared header', () => {
    for (const { slug, module } of SECTION_PAGES) {
      test(`${slug} uses PageHero`, async ({ request, page }) => {
        test.skip(
          !(await pageIsUp(request, `/en/${slug}`)),
          `${WEB}/en/${slug} unavailable — site down, or the ${module} module is off`,
        )

        await page.goto(`${WEB}/en/${slug}`)

        // .ph-title is PageHero's own H1 class. A page that regressed to a
        // hand-rolled header would still show a heading, so assert the shared
        // one specifically — that is what carries the backdrop.
        await expect(page.locator('.ph-title')).toHaveCount(1)
        await expect(page.locator('h1')).toHaveCount(1)
      })
    }
  })

  test('the homepage hero is present', async ({ request, page }) => {
    test.skip(!(await pageIsUp(request, '/en/')), `${WEB}/en/ unavailable`)

    await page.goto(`${WEB}/en/`)
    await expect(page.locator('.hero')).toHaveCount(1)
  })

  test('an empty aside does not open a phantom column', async ({ request, page }) => {
    test.skip(
      !(await pageIsUp(request, '/en/contact')),
      `${WEB}/en/contact unavailable — site down, or the contact module is off`,
    )

    await page.goto(`${WEB}/en/contact`)

    // Contact passes no aside at all. Astro registers a named slot even when the
    // caller wrapped it in a false condition, so PageHero renders the slot and
    // tests it for content rather than trusting Astro.slots.has() — without
    // that, this page would carry an empty 40px grid column.
    await expect(page.locator('.ph-aside')).toHaveCount(0)
  })

  test('picks exactly one of the candidate pictures, before paint', async ({ request, page }) => {
    test.skip(!(await pageIsUp(request, '/en/')), `${WEB}/en/ unavailable`)

    await page.goto(`${WEB}/en/`)

    const backdrop = page.locator('.hero-backdrop[data-hero-urls]').first()

    // Data-dependent by design: with no hero pictures configured the component
    // renders nothing at all, which is the correct behaviour and is asserted by
    // the unit tests rather than here.
    test.skip(
      (await backdrop.count()) === 0,
      'no hero images configured — nothing to choose between',
    )

    const raw = await backdrop.getAttribute('data-hero-urls')
    const candidates: string[] = JSON.parse(raw ?? '[]')
    expect(candidates.length).toBeGreaterThan(0)

    // The inline script is synchronous, so the background is set by the time the
    // page is interactive — no flash of the bare ink panel.
    const applied = await backdrop.evaluate(el => (el as HTMLElement).style.backgroundImage)
    expect(applied).not.toBe('')

    const chosen = applied.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')
    expect(candidates).toContain(chosen)
  })
})

const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

/** A 1×1 transparent PNG — small enough to embed, real enough for Laravel's `image` rule. */
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

/**
 * storageState replays cookies only, and e2e/.auth/admin.json holds none — an
 * API context built from it is anonymous. Path is relative to the Playwright
 * cwd (app/): these spec files are ESM, so __dirname does not exist.
 */
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed hero images')
  return entry.value
}

async function authedFetch(request: import('@playwright/test').APIRequestContext, method: 'post' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { multipart: data as Record<string, string | { name: string; mimeType: string; buffer: Buffer }> } : {}),
  })
  return res
}

/**
 * `web` bakes the site once at container start; a hero image created via the
 * API never appears until something rebuilds it. Triggers the same rebuild
 * the admin's manual button uses and polls its status rather than sleeping a
 * fixed duration.
 */
async function rebuildAndWait(request: import('@playwright/test').APIRequestContext, since: number) {
  const deadline = Date.now() + 180_000

  while (Date.now() < deadline) {
    const trigger = await request.post(`${API}/api/admin/site/rebuild`, {
      headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    })
    if (!trigger.ok() && trigger.status() !== 409) {
      throw new Error(`POST /api/admin/site/rebuild → ${trigger.status()}`)
    }

    while (Date.now() < deadline) {
      const res = await request.get(`${API}/api/admin/site/rebuild/status`, {
        headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
      })
      const body = await res.json()
      if (body.status === 'error') throw new Error('Public site rebuild failed')
      if (body.status === 'done') {
        if ((body.startedAt ?? 0) >= since) return
        break // stale build finished before our seed — trigger another
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

// Serial: this spec seeds hero_images.contact via the admin API and rebuilds
// the public site, the same reason article-press.spec.ts's block is serial —
// a concurrent worker rebuilding at the same time races this one's `since` check.
test.describe.serial('Public hero backdrop — active filter', () => {
  let activeId: number | undefined
  let inactiveId: number | undefined
  // Laravel's `UploadedFile::store()` writes under a randomised filename —
  // 'active.png'/'inactive.png' never survive into the served URL, whether
  // the row is active or not. Matching by original filename would therefore
  // always fail regardless of whether the active filter works, so identity
  // is tracked instead through the actual generated `url` the upload
  // response returns.
  let activeUrl: string | undefined
  let inactiveUrl: string | undefined

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000)

    const uploaded = await authedFetch(request, 'post', '/api/admin/hero-images/contact', {
      'files[]': { name: 'active.png', mimeType: 'image/png', buffer: Buffer.from(TEST_PNG_BASE64, 'base64') },
    })
    const activeBody = await uploaded.json()
    const activeRow = activeBody.data.contact.at(-1)
    activeId = activeRow.id
    activeUrl = activeRow.url

    const uploadedOff = await authedFetch(request, 'post', '/api/admin/hero-images/contact', {
      'files[]': { name: 'inactive.png', mimeType: 'image/png', buffer: Buffer.from(TEST_PNG_BASE64, 'base64') },
    })
    const offBody = await uploadedOff.json()
    const inactiveRow = offBody.data.contact.at(-1)
    inactiveId = inactiveRow.id
    inactiveUrl = inactiveRow.url

    await request.patch(`${API}/api/admin/hero-images/${inactiveId}`, {
      headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
      data: { active: false },
    })

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(180_000)

    if (activeId) {
      const res = await authedFetch(request, 'delete', `/api/admin/hero-images/${activeId}`)
      expect(res.ok(), `cleanup delete of active picture failed with ${res.status()}`).toBeTruthy()
    }
    if (inactiveId) {
      const res = await authedFetch(request, 'delete', `/api/admin/hero-images/${inactiveId}`)
      expect(res.ok(), `cleanup delete of inactive picture failed with ${res.status()}`).toBeTruthy()
    }

    // The public /en/contact page was already rebuilt (in beforeAll) with
    // data-hero-urls pointing at the two pictures just deleted above — without
    // rebuilding again here, the shared dev site's contact page is left
    // referencing dead files until something else happens to rebuild it. See
    // root CLAUDE.md: restoring/deleting rows is not enough, the public
    // container still holds the stale build.
    await rebuildAndWait(request, Date.now())
  })

  test('an inactive picture never reaches the public candidate list', async ({ request, page }) => {
    test.skip(!(await pageIsUp(request, '/en/contact')), `${WEB}/en/contact unavailable`)

    await page.goto(`${WEB}/en/contact`)

    const backdrop = page.locator('.hero-backdrop[data-hero-urls]').first()
    await expect(backdrop).toHaveCount(1)

    const raw = await backdrop.getAttribute('data-hero-urls')
    const candidates: string[] = JSON.parse(raw ?? '[]')

    expect(candidates).toContain(activeUrl)
    expect(candidates).not.toContain(inactiveUrl)
  })
})
