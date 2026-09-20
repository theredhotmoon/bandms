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
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed clips')
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
 * `web` bakes the site once at container start; a clip attached via the API
 * never appears until something rebuilds it. Triggers the same rebuild the
 * admin's manual button uses and polls its status rather than sleeping a
 * fixed duration — a full Astro build is not a fixed-cost operation.
 *
 * `since` guards against a second concurrent spec file's beforeAll: two
 * playwright workers can each seed and call this within moments of each
 * other, and a 409 here just means the other worker's rebuild is the one in
 * flight. A completed build is only accepted if its startedAt is at or after
 * the seed; anything older triggers a fresh rebuild instead.
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

/**
 * The public half of the clips library: a clip attached to a concert renders
 * on that concert's page, an audio clip renders at its player's own height,
 * and a post's clip block renders the same iframe with a caption linking back
 * to the show.
 */
test.describe.serial('Public clips', () => {
  failOnPageError()

  let concertId: number
  let concertSlug: string
  let clipId: number
  let audioClipId: number
  let audioTitle: string
  let postId: number
  let postSlug: string

  test.beforeAll(async ({ request }) => {
    // A real Astro build plus a possible second one if this worker's rebuild
    // trigger loses the race to another public spec's — past Playwright's 30s
    // default hook timeout under any load.
    test.setTimeout(180_000)

    const concerts = (await (await api(request, 'get', '/api/concerts')).json()).data as { id: number; slug_en: string }[]
    test.skip(concerts.length === 0, 'No concert to attach to')
    concertId = concerts[0].id
    concertSlug = concerts[0].slug_en

    const clip = (await (await api(request, 'post', '/api/clips', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: { en: `E2E public clip ${Date.now()}` },
      category: 'backstage',
      attach: [{ type: 'concert', id: concertId }],
    })).json()).data
    clipId = clip.id

    audioTitle = `E2E public audio ${Date.now()}`
    const audio = (await (await api(request, 'post', '/api/clips', {
      url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
      title: { en: audioTitle },
      category: 'studio',
      attach: [{ type: 'concert', id: concertId }],
    })).json()).data
    audioClipId = audio.id

    const post = (await (await api(request, 'post', '/api/posts', {
      title: { en: `E2E clip post ${Date.now()}` },
      published_at: new Date().toISOString(),
      blocks: [{ type: 'ref', payload: { entity: 'clip', id: clipId } }],
    })).json()).data
    postId = post.id
    postSlug = post.slug_en

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    // Each delete on its own: one row already gone (a concurrent spec's
    // cleanup, a failed seed) must not leave the others behind.
    for (const path of [postId && `/api/posts/${postId}`, clipId && `/api/clips/${clipId}`, audioClipId && `/api/clips/${audioClipId}`]) {
      if (path) await api(request, 'delete', path).catch(e => console.warn(`cleanup: ${e.message}`))
    }
  })

  test('the concert page lists the clip with its category label', async ({ page }) => {
    await page.goto(`${WEB}/en/concerts/${concertSlug}`)

    const grid = page.getByTestId('clips-grid')
    await expect(grid).toBeVisible()
    const item = grid.locator('.clips-item[data-provider="youtube"]').first()
    await expect(item.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/)
    await expect(item.locator('.clips-cat')).toHaveText('Backstage')
  })

  test('an audio clip renders as a fixed-height player, not a 16:9 box', async ({ page }) => {
    await page.goto(`${WEB}/en/concerts/${concertSlug}`)

    // This run's clip, by title — the concert may carry other audio clips.
    const item = page.getByTestId('clips-grid').locator('.clips-item').filter({ hasText: audioTitle })
    await expect(item).toHaveCount(1)
    const audio = item.locator('.pb-embed--audio')
    await expect(audio.locator('iframe')).toHaveAttribute('src', /open\.spotify\.com\/embed\/track\/4uLU6hMCjMI75M1A2tKUQC/)
    const box = await audio.boundingBox()
    expect(box?.height).toBe(352)
  })

  test('the Polish page uses the Polish category label', async ({ page }) => {
    // Only the route knows the Polish section slug; the EN page's hreflang is
    // the one place it is published, so read it rather than guessing. It is
    // absolute on Astro's production `site`, so keep the path and re-root it.
    await page.goto(`${WEB}/en/concerts/${concertSlug}`)
    const pl = await page.locator('link[hreflang="pl"]').getAttribute('href')
    test.skip(!pl, 'No Polish alternate for this concert')

    await page.goto(`${WEB}${new URL(pl!).pathname}`)
    const item = page.getByTestId('clips-grid').locator('.clips-item[data-provider="youtube"]').first()
    await expect(item.locator('.clips-cat')).toHaveText('Za kulisami')
  })

  test('a post clip block renders the iframe and links to the show', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${postSlug}`)

    const fig = page.locator('.art-body .art-clip')
    await expect(fig.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/)
    await expect(fig.locator('a.art-clip-show')).toHaveAttribute('href', new RegExp(`/en/concerts/${concertSlug}/?$`))
  })
})
