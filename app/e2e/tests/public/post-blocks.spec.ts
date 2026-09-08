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
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed post blocks')
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

test.describe.serial('Public article — content blocks', () => {
  failOnPageError()

  let postId: number

  test.beforeAll(async ({ request }) => {
    // A real Astro build (~9s) plus a possible second one if this worker's
    // rebuild trigger loses the race to article-press.spec.ts's — comfortably
    // past Playwright's 30s default hook timeout under any load.
    test.setTimeout(180_000)

    const res = await api(request, 'post', '/api/posts', {
      title: { en: `E2E Blocks ${Date.now()}` },
      published_at: new Date().toISOString(),
      blocks: [
        { type: 'text',  payload: { body: { en: '<p>Block zero prose.</p>' } } },
        { type: 'embed', payload: { url: 'https://vimeo.com/76979871' } },
        { type: 'text',  payload: { body: { en: '<p>Block two prose.</p>' } } },
        { type: 'ref',   payload: { entity: 'release', id: 999999 } },
      ],
    })
    postId = (await res.json()).data.id

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    if (postId) await api(request, 'delete', `/api/posts/${postId}`)
  })

  test('renders blocks in the stored order', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${postId}`)

    // Order is the feature. Presence alone passes against a list sorted by id.
    const prose = page.locator('.art-body .art-prose')
    await expect(prose.nth(0)).toContainText('Block zero prose.')
    await expect(prose.nth(1)).toContainText('Block two prose.')

    const embed = page.locator('.art-body .pb-embed iframe')
    await expect(embed).toHaveAttribute('src', /player\.vimeo\.com\/video\/76979871/)
  })

  test('the embed sits between the two paragraphs, not after them', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${postId}`)

    const kinds = await page.locator('.art-body > *').evaluateAll(els =>
      els.map(el => (el.querySelector('iframe') ? 'embed' : el.className.includes('art-prose') ? 'text' : 'other')),
    )
    expect(kinds.filter(k => k !== 'other')).toEqual(['text', 'embed', 'text'])
  })

  test('a ref pointing at a deleted record renders nothing at all', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${postId}`)

    await expect(page.locator('.art-rel-link')).toHaveCount(0)
    await expect(page.locator('.art-body')).not.toContainText('999999')
  })
})
