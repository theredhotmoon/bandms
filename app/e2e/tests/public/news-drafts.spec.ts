import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A post with no published_at is a draft and must not reach the public site.
 *
 * Until Sep 2026 the public endpoints applied no such filter, so the admin's
 * "Draft" label and the visitor's news page disagreed: every draft was built
 * into the static site. The Pest tests cover the API; this covers what the
 * Astro build actually emits, since the build is the thing that decides which
 * pages exist.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed posts')
  return entry.value
}

async function authedFetch(request: import('@playwright/test').APIRequestContext, method: 'get' | 'post' | 'delete', path: string, data?: unknown) {
  return request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
}

async function rebuildAndWait(request: import('@playwright/test').APIRequestContext, since: number) {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    const trigger = await authedFetch(request, 'post', '/api/admin/site/rebuild')
    if (!trigger.ok() && trigger.status() !== 409) throw new Error(`POST /api/admin/site/rebuild → ${trigger.status()}`)
    while (Date.now() < deadline) {
      const body = await (await authedFetch(request, 'get', '/api/admin/site/rebuild/status')).json()
      if (body.status === 'error') throw new Error('Public site rebuild failed')
      if (body.status === 'done') {
        if ((body.startedAt ?? 0) >= since) return
        break
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

test.describe.serial('Public news — drafts are not built', () => {
  failOnPageError()

  const stamp = Date.now()
  let draftId: number, liveId: number
  let draftSlug: string, liveSlug: string
  let newsSlug = 'news'

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000)

    const cfg = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    const c = cfg.data ?? cfg
    test.skip(c.modules?.posts === false, 'posts module is off')
    newsSlug = c.module_config?.posts?.slug ?? 'posts'

    const draft = await (await authedFetch(request, 'post', '/api/posts', {
      title: `E2E Draft Post ${stamp}`, intro: 'Not ready yet.',
    })).json()
    draftId = draft.data.id
    draftSlug = draft.data.slug_en

    const live = await (await authedFetch(request, 'post', '/api/posts', {
      title: `E2E Live Post ${stamp}`, intro: 'Ready.', published_at: new Date().toISOString(),
    })).json()
    liveId = live.data.id
    liveSlug = live.data.slug_en

    await rebuildAndWait(request, stamp)
  })

  test.afterAll(async ({ request }) => {
    if (draftId) await authedFetch(request, 'delete', `/api/posts/${draftId}`)
    if (liveId) await authedFetch(request, 'delete', `/api/posts/${liveId}`)
  })

  test('the API itself hides the draft from anonymous readers', async ({ request }) => {
    expect((await request.get(`${API}/api/posts/${draftId}`)).status()).toBe(404)
    expect((await request.get(`${API}/api/posts/${liveId}`)).ok()).toBe(true)
  })

  test('the news list shows the published post and not the draft', async ({ page }) => {
    await page.goto(`${WEB}/en/${newsSlug}/`)
    await expect(page.locator(`a[href$="/${liveSlug}"]`).first()).toBeVisible()
    await expect(page.locator(`a[href$="/${draftSlug}"]`)).toHaveCount(0)
    await expect(page.getByText(`E2E Draft Post ${stamp}`)).toHaveCount(0)
  })

  test('the draft has no page — its URL 404s like any unknown one', async ({ page }) => {
    const live = await page.goto(`${WEB}/en/${newsSlug}/${liveSlug}/`)
    expect(live?.status()).toBe(200)

    const draft = await page.goto(`${WEB}/en/${newsSlug}/${draftSlug}/`)
    expect(draft?.status()).toBe(404)
  })
})
