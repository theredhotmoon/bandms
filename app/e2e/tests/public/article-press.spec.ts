import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * Press coverage on the Article page.
 *
 * The design shows press only as context inside a story — a pull quote in the
 * body, then any further coverage as plain link rows — never as a standalone
 * index. These specs check both, and that they stay absent when a post has no
 * coverage.
 */
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
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed press coverage')
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
 * `since` guards against post-blocks.spec.ts's beforeAll racing this one in
 * the other Playwright worker: a completed build is only accepted if its
 * startedAt is at or after our own seed, otherwise it read the database
 * before this file's posts existed and a fresh rebuild is triggered instead.
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

async function newsIsUp(request: APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en/news`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

// Serial, not just parallel-safe: with fullyParallel and workers > 1, Playwright
// can run beforeAll once per worker rather than once overall when a describe
// block's tests are split across workers — which seeded press coverage twice
// concurrently, producing both a slug collision and a MySQL deadlock on the
// resulting simultaneous post_blocks inserts.
test.describe.serial('Article — press coverage', () => {
  failOnPageError()

  let postId: number
  let barePostId: number
  const pressIds: number[] = []

  test.beforeAll(async ({ request }) => {
    // A real Astro build (~9s) plus a possible second one if this worker's
    // rebuild trigger loses the race to post-blocks.spec.ts's — comfortably
    // past Playwright's 30s default hook timeout under any load.
    test.setTimeout(180_000)

    // No newsIsUp() gate here: unlike the old version, this hook now seeds
    // data and drives its own rebuild — a false reading (the `web` docroot is
    // briefly empty mid rm-rf/cp during a concurrent worker's rebuild) would
    // silently skip seeding entirely, leaving postId/barePostId undefined for
    // every test in the file with no error. beforeEach's check still skips
    // the tests themselves if the site is genuinely down.
    const first = await api(request, 'post', '/api/press-releases', {
      url: `https://gazeta-ska.example/e2e-${Date.now()}`,
      og_title: 'The most exciting brass on the scene',
      og_site_name: 'Gazeta Ska',
    })
    const second = await api(request, 'post', '/api/press-releases', {
      url: `https://brassbass.example/e2e-${Date.now()}`,
      og_title: 'An all-analog revival',
      og_site_name: 'Brass Bass',
    })
    pressIds.push((await first.json()).data.id, (await second.json()).data.id)

    const post = await api(request, 'post', '/api/posts', {
      title: { en: `E2E Press ${Date.now()}` },
      published_at: new Date().toISOString(),
      blocks: [
        { type: 'ref', payload: { entity: 'press_release', id: pressIds[0] } },
        { type: 'ref', payload: { entity: 'press_release', id: pressIds[1] } },
      ],
    })
    postId = (await post.json()).data.id

    const bare = await api(request, 'post', '/api/posts', {
      title: { en: `E2E No Press ${Date.now()}` },
      published_at: new Date().toISOString(),
      blocks: [{ type: 'text', payload: { body: { en: '<p>No coverage here.</p>' } } }],
    })
    barePostId = (await bare.json()).data.id

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    if (postId) await api(request, 'delete', `/api/posts/${postId}`)
    if (barePostId) await api(request, 'delete', `/api/posts/${barePostId}`)
    for (const id of pressIds) await api(request, 'delete', `/api/press-releases/${id}`)
  })

  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await newsIsUp(request)),
      `${WEB}/en/news unavailable — site down, or the posts module is off`,
    )
  })

  test('the first piece of coverage becomes the pull quote', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${postId}`)

    const quote = page.locator('.art-pull-quote')
    await expect(quote).toBeVisible()
    await expect(quote).toHaveText(/\S/)

    // Attribution matters: a quote with no source reads as the band quoting
    // itself, which is why `site` falls back to the URL host server-side.
    await expect(page.locator('.art-pull-cite')).toHaveText(/^—\s*\S/)
  })

  test('the pull quote repeats the first press reference\'s headline', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${postId}`)

    const quote = (await page.locator('.art-pull-quote').textContent())?.trim()
    expect(quote).toBe('The most exciting brass on the scene')
  })

  test('every further reference links out with a publication name', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${postId}`)

    const rows = page.locator('.art-press')
    expect(await rows.count()).toBeGreaterThan(0)

    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i)
      expect(await row.getAttribute('href')).toMatch(/^https?:\/\//)
      expect(await row.getAttribute('target')).toBe('_blank')
      expect(await row.getAttribute('rel')).toContain('noopener')

      await expect(row.locator('.art-press-site')).toHaveText(/\S/)
      await expect(row.locator('.art-press-title')).toHaveText(/\S/)
    }
  })

  test('press blocks are absent from a post with no coverage', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${barePostId}`)

    await expect(page.locator('.art-pull')).toHaveCount(0)
    await expect(page.locator('.art-press')).toHaveCount(0)
  })
})
