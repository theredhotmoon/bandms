import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * storageState replays cookies only, and e2e/.auth/admin.json holds none — an
 * API context built from it is anonymous. The token has to be lifted out and
 * sent explicitly. Path is relative to the Playwright cwd (app/): these spec
 * files are ESM, so __dirname does not exist.
 */
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed posts')
  return entry.value
}

async function api(request: APIRequestContext, method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}`)
  return res
}

/**
 * `web` bakes the site once at container start; a post created via the API
 * never appears until something rebuilds it. Triggers the same rebuild the
 * admin's manual button uses and polls its status rather than sleeping a
 * fixed duration — a full Astro build is not a fixed-cost operation.
 *
 * `since` guards against a second concurrent spec file's beforeAll: two
 * playwright workers can each seed a post and call this within moments of
 * each other, and a 409 here just means the other worker's rebuild is the one
 * in flight. Accepting any 'done' would risk reading a build that started
 * (and read the database) before this worker's own seed finished writing —
 * so a completed build is only accepted if its startedAt is at or after the
 * seed, and anything older triggers a fresh rebuild instead.
 */
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

// Section segment is read from the API rather than hardcoded, since it's a
// per-locale custom_slug an editor can change in /admin/website-modules.
async function postsSection(request: APIRequestContext, lang: 'en' | 'pl'): Promise<string> {
  const res = await request.get(`${API}/api/site-config?lang=${lang}`, { headers: { Accept: 'application/json' } })
  if (!res.ok()) throw new Error(`GET /api/site-config?lang=${lang} → ${res.status()}`)
  const body = await res.json()
  return body.module_config?.posts?.slug || 'posts'
}

test.describe.serial('Public news — slug-based routing', () => {
  failOnPageError()

  const stamp = Date.now()
  let sectionEn: string
  let sectionPl: string

  let bilingualId: number
  let bilingualSlugEn: string
  let bilingualSlugPl: string

  let enOnlyId: number
  let enOnlySlugEn: string

  test.beforeAll(async ({ request }) => {
    // A real Astro build (~9s) plus a possible second one if this worker's
    // rebuild trigger loses the race to another spec file's — comfortably
    // past Playwright's 30s default hook timeout under any load.
    test.setTimeout(180_000)

    ;[sectionEn, sectionPl] = await Promise.all([postsSection(request, 'en'), postsSection(request, 'pl')])

    const bilingual = await api(request, 'post', '/api/posts', {
      title: { en: `E2E Slug EN ${stamp}`, pl: `E2E Slug PL ${stamp}` },
      published_at: new Date().toISOString(),
      blocks: [{ type: 'text', payload: { body: { en: '<p>Bilingual post.</p>' } } }],
    })
    const bilingualBody = (await bilingual.json()).data
    bilingualId = bilingualBody.id
    bilingualSlugEn = bilingualBody.slug_en
    bilingualSlugPl = bilingualBody.slug_pl

    const enOnly = await api(request, 'post', '/api/posts', {
      title: { en: `E2E Slug No PL ${stamp}` },
      published_at: new Date().toISOString(),
      blocks: [{ type: 'text', payload: { body: { en: '<p>English-only post.</p>' } } }],
    })
    const enOnlyBody = (await enOnly.json()).data
    enOnlyId = enOnlyBody.id
    enOnlySlugEn = enOnlyBody.slug_en

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    if (bilingualId) await api(request, 'delete', `/api/posts/${bilingualId}`)
    if (enOnlyId) await api(request, 'delete', `/api/posts/${enOnlyId}`)
  })

  test('a bilingual post is served under its own slug in each locale', async ({ page }) => {
    // The point of this fixture: without a real Polish title, slug_pl would be
    // null and this assertion would be meaningless — it must actually differ.
    expect(bilingualSlugPl).toBeTruthy()
    expect(bilingualSlugPl).not.toBe(bilingualSlugEn)

    await page.goto(`${WEB}/en/${sectionEn}/${bilingualSlugEn}`)
    await expect(page.locator('.art-title')).toHaveText(`E2E Slug EN ${stamp}`)

    await page.goto(`${WEB}/pl/${sectionPl}/${bilingualSlugPl}`)
    await expect(page.locator('.art-title')).toHaveText(`E2E Slug PL ${stamp}`)
  })

  test('a post with no Polish title is reachable under /pl/ via its slug_en', async ({ page }) => {
    await page.goto(`${WEB}/pl/${sectionPl}/${enOnlySlugEn}`)
    await expect(page.locator('.art-title')).toHaveText(`E2E Slug No PL ${stamp}`)
  })

  test('the news listing links to a post by slug, not by numeric id', async ({ page }) => {
    await page.goto(`${WEB}/en/${sectionEn}`)

    await expect(page.locator(`a[href="/en/${sectionEn}/${bilingualSlugEn}"]`).first()).toBeVisible()
    await expect(page.locator(`a[href$="/${bilingualId}"]`)).toHaveCount(0)
  })

  /**
   * The homepage builds its own news hrefs rather than reusing the listing's,
   * and it got them wrong — `${p.id}` where the route is emitted at
   * postSlug(p, lang), so every "latest news" row on the landing page 404'd.
   * The listing test above could not see it: two call sites, one covered.
   *
   * Asserts the shape of *every* row rather than looking for the seeded post,
   * so it does not depend on which three posts happen to be newest.
   */
  test('the homepage links to news by slug, not by numeric id', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const rows = page.locator('.posts-list a.post-row')
    await expect(rows.first()).toBeVisible()

    const hrefs = await rows.evaluateAll(els => els.map(e => e.getAttribute('href') ?? ''))
    for (const href of hrefs) {
      expect(href, 'homepage news link must not address a post by numeric id').not.toMatch(/\/\d+$/)
      expect(href.startsWith(`/en/${sectionEn}/`), `unexpected news href: ${href}`).toBe(true)
    }

    // A slug-shaped href pointing at a page nothing built is the same 404, so
    // follow it: only the article page proves the link resolves.
    await rows.first().click()
    await expect(page.locator('.art-title')).toBeVisible()
  })
})
