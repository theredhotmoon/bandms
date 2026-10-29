import { test, expect, type APIRequestContext } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { adminHeaders, postRequiredFields, rebuildAndWait } from '../../fixtures/admin-api'

/**
 * Every card in the news grid is the same width, however many tags it
 * carries. The grid's bare `1fr` columns let a long one-line tag row set its
 * column's minimum, so a tag-heavy card came out wider than its neighbours —
 * and, widened, its row never overflowed, so the hover-scroll that reveals
 * the hidden tags never engaged.
 *
 * Seeds three long tags, one post carrying them and a newer decoy, rebuilds,
 * and deletes the seeds afterwards. Items per page is news-per-page.spec.ts.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'
const STAMP = `${Date.now()}${Math.floor(Math.random() * 1000)}`
const TITLE = `E2E News widths ${STAMP}`

test.use({ storageState: { cookies: [], origins: [] } })

let newsUrl = ''
const postIds: number[] = []
const tagIds: number[] = []

async function api(request: APIRequestContext, method: 'post' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, { headers: adminHeaders(), data })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()} ${await res.text()}`)
  return res.status() === 204 ? null : res.json()
}

test.describe.serial('Public — news grid card widths', () => {
  failOnPageError()

  test.beforeAll(async ({ request }) => {
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.posts === false, 'News module is off')
    newsUrl = `${WEB}/en/${config?.module_config?.posts?.slug ?? 'news'}`

    for (const word of ['Ultraextended', 'Hyperelongated', 'Overstretched']) {
      const tag = await api(request, 'post', '/api/tags', { name: { en: `${word} tag ${STAMP}` } })
      tagIds.push(tag.data.id)
    }
    // The newest post is the featured one, so a decoy an hour newer (one tag; a post needs one)
    // takes that slot and the tagged post lands in the grid.
    const required = await postRequiredFields(request, API)
    for (const [title, tags, ageHours] of [[TITLE, tagIds, 2], [`${TITLE} decoy`, tagIds.slice(0, 1), 1]] as const) {
      const post = await api(request, 'post', '/api/posts', {
        ...required,
        title: { en: title },
        tag_ids: tags,
        published_at: new Date(Date.now() - ageHours * 3_600_000).toISOString(),
        blocks: [{ type: 'text', payload: { body: { en: '<p>Body</p>' } } }],
      })
      postIds.push(post.data.id)
    }
    await rebuildAndWait(request, Date.now(), API)
  })

  test.afterAll(async ({ request }) => {
    for (const id of postIds) await api(request, 'delete', `/api/posts/${id}`)
    for (const id of tagIds) await api(request, 'delete', `/api/tags/${id}`)
  })

  test('every grid card is the same width, and a tag row too wide scrolls on hover', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 })
    await page.goto(newsUrl)
    const card = page.locator('.nf-card', { hasText: TITLE }).filter({ hasNotText: 'decoy' })
    await expect(card).toBeVisible()

    // Visible cards only: one held back by Items per page measures zero.
    const widths = await page.locator('.nf-card').evaluateAll(els => els
      .filter(e => (e as HTMLElement).offsetParent !== null)
      .map(e => Math.round(e.getBoundingClientRect().width)))
    expect(widths.length).toBeGreaterThan(1)
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)

    // The first tags show; the rest are clipped until the card is hovered.
    const row = card.getByTestId('news-card-tags')
    await expect(row).toHaveAttribute('data-overflow', '')
    const rowRight = await row.evaluate(el => el.getBoundingClientRect().right)
    const lastChip = row.locator('.nf-chip').last()
    expect(await lastChip.evaluate(el => el.getBoundingClientRect().left)).toBeGreaterThan(rowRight)

    // The row slides at ~60px/s, so a long one takes seconds: wait for its own
    // --tag-duration (plus the 0.2s delay and some slack), not a fixed guess.
    const duration = await row.evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--tag-duration')) || 1.5)
    await card.hover()
    await expect.poll(() => lastChip.evaluate(el => el.getBoundingClientRect().right), { timeout: (duration + 3) * 1000 })
      .toBeLessThanOrEqual(rowRight + 1)
  })
})
