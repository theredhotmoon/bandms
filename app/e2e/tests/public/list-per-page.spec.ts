import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { adminHeaders, postRequiredFields, rebuildAndWait, TEST_PNG } from '../../fixtures/admin-api'

/**
 * Website Modules → Items per page cuts a public list short, with a
 * "Show more" button for the rest. It was saved and served for months while
 * no page read it.
 *
 * Three mechanisms implement it, and this spec drives each on a real page:
 * - News fetches every batch after the first from the API
 *   (`web/src/lib/postFeed.ts`), and so do its tag filter and search — the
 *   site will hold far more posts than one page should carry. Its top post is
 *   the one highlighted in the admin, and stays whatever is filtered;
 * - a Vue island (`useShowMore` + ShowMoreButton) — the past-shows archive;
 * - static markup (`pagedAttrs` + ShowMore.astro) — the upcoming-shows list.
 * Photos and videos are islands, press and merch static lists, on the same
 * two code paths as the last two.
 *
 * Outside News every item stays in the baked HTML, only hidden, so crawlers
 * and visitors without JS keep a link to each one — asserted here too.
 *
 * Seeds a venue, seven future and seven past gigs at it, a tag, and eight
 * posts (four tagged), so every list holds more than one batch whatever the
 * database has; highlights the oldest seeded post; sets per_page on News and
 * Shows and rebuilds. Restores all three, deletes the seeds and rebuilds
 * afterwards. The values are baked into the served pages, which is why this
 * runs in its own project after the parallel pool (`list-per-page` in
 * playwright.config.ts): a list held to six would hide items other specs look
 * for.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'
const PER_PAGE = 6
const STAMP = `${Date.now()}${Math.floor(Math.random() * 1000)}`
const MODULES = ['posts', 'concerts'] as const

test.use({ storageState: { cookies: [], origins: [] } })

const original: Partial<Record<(typeof MODULES)[number], number | null>> = {}
const concertIds: number[] = []
const postIds: number[] = []
let venueId: number | null = null
let tagId: number | null = null
/** The post that was highlighted before this spec pinned its own, if any. */
let previouslyHighlighted: number | null = null
const TAG = `E2E Per page tag ${STAMP}`
const title = (i: number) => `E2E Per page ${STAMP} #${i}`
const section: Record<string, string> = {}

async function api(request: APIRequestContext, method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, { headers: adminHeaders(), data })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()} ${await res.text()}`)
  return res.status() === 204 ? null : res.json()
}

/**
 * The batch contract for one list: the first PER_PAGE items show, each click
 * shows PER_PAGE more, and the button is gone once everything is visible.
 * `items` must match every item, hidden ones included.
 */
async function expectPaged(page: Page, items: Locator, more: Locator) {
  // An island (the archive is client:visible) hydrates once scrolled to; a
  // click before that lands on server markup with no handler. Astro drops the
  // `ssr` attribute from <astro-island> when it hydrates. A static list has
  // no island, so this passes at once.
  await more.scrollIntoViewIfNeeded()
  await expect(page.locator('astro-island[ssr]', { has: more })).toHaveCount(0)
  const total = await items.count()
  expect(total, 'the list needs more than one batch for this to mean anything').toBeGreaterThan(PER_PAGE)
  const visible = () => items.evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent !== null).length)

  await expect.poll(visible).toBe(PER_PAGE)
  await more.click()
  await expect.poll(visible).toBe(Math.min(2 * PER_PAGE, total))
  while (await more.isVisible()) await more.click()
  await expect(more).toHaveCount(0)
  await expect.poll(visible).toBe(total)
}

async function openPage(page: Page, module: string) {
  await page.goto(`${WEB}/en/${section[module]}`)
}

test.describe.serial('Public — Items per page', () => {
  failOnPageError()

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    for (const m of MODULES) {
      test.skip(config?.modules?.[m] === false, `${m} module is off`)
      section[m] = config?.module_config?.[m]?.slug ?? m
      original[m] = config?.module_config?.[m]?.per_page ?? null
    }

    // Eight posts, newest first. #7, the oldest, is highlighted and takes the
    // top slot, outside the grid the batches count; the seven others still
    // outnumber a batch of six. #0–#3 carry the tag; #7 does not, so filtering
    // by it shows whether the highlighted post really stays on top.
    tagId = (await api(request, 'post', '/api/tags', { name: { en: TAG, pl: TAG } })).data.id
    const required = await postRequiredFields(request, API)
    // #7 carries a main image, so the featured card's picture is checked too.
    const upload = await request.post(`${API}/api/posts/image`, {
      headers: adminHeaders(),
      multipart: { image: { name: 'e2e-cover.png', mimeType: 'image/png', buffer: TEST_PNG } },
    })
    if (!upload.ok()) throw new Error(`POST /api/posts/image → ${upload.status()} ${await upload.text()}`)
    const image = (await upload.json()).path as string
    for (let i = 0; i < 8; i++) {
      const post = await api(request, 'post', '/api/posts', {
        ...required,
        title: { en: title(i) },
        published_at: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
        tag_ids: i < 4 ? [...required.tag_ids, tagId] : required.tag_ids,
        ...(i === 7 ? { image } : {}),
        blocks: [{ type: 'text', payload: { body: { en: '<p>Body</p>' } } }],
      })
      postIds.push(post.data.id)
    }
    const admin = await api(request, 'get', '/api/admin/posts')
    previouslyHighlighted = (admin.data as { id: number; is_highlighted?: boolean }[]).find(p => p.is_highlighted)?.id ?? null
    await api(request, 'put', `/api/posts/${postIds[7]}/highlight`, { highlighted: true })

    venueId = (await api(request, 'post', '/api/venues', { name: `E2E Per page venue ${STAMP}` })).data.id
    for (let day = 1; day <= 7; day++) {
      for (const year of [2099, 2001]) {
        const concert = await api(request, 'post', '/api/concerts', { venue_id: venueId, date: `${year}-03-${String(day).padStart(2, '0')}` })
        concertIds.push(concert.data.id)
      }
    }
    for (const m of MODULES) await api(request, 'put', `/api/admin/modules/${m}`, { per_page: PER_PAGE })
    await rebuildAndWait(request, Date.now(), API)
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    const restored = (Object.entries(original) as [string, number | null][])
    for (const [m, value] of restored) await api(request, 'put', `/api/admin/modules/${m}`, { per_page: value })
    for (const id of concertIds) await api(request, 'delete', `/api/concerts/${id}`)
    if (venueId !== null) await api(request, 'delete', `/api/venues/${venueId}`)
    for (const id of postIds) await api(request, 'delete', `/api/posts/${id}`)
    if (previouslyHighlighted !== null) await api(request, 'put', `/api/posts/${previouslyHighlighted}/highlight`, { highlighted: true })
    if (tagId !== null) await api(request, 'delete', `/api/tags/${tagId}`)
    if (restored.length > 0 || postIds.length > 0) await rebuildAndWait(request, Date.now(), API)
  })

  test('News: the highlighted post is on top, and Show more fetches the next batch from the server', async ({ page, request }) => {
    // Only the first batch is baked — the point of fetching the rest.
    const html = await (await request.get(`${WEB}/en/${section.posts}/`)).text()
    expect((html.match(/class="nf-card"/g) ?? []).length).toBe(PER_PAGE)

    await openPage(page, 'posts')
    const featured = page.getByTestId('news-featured')
    await expect(featured).toContainText(title(7))
    await expect(featured.locator('img.nf-img')).toHaveAttribute('src', /^\/storage\/post-images\/.+\.png$/)
    const cards = page.locator('#news-grid .nf-card')
    await expect(cards).toHaveCount(PER_PAGE)

    const more = page.locator('.nf-grid-wrap').getByTestId('show-more')
    await expect(page.locator('astro-island[ssr]', { has: more })).toHaveCount(0)
    const fetched = page.waitForResponse(r => r.url().includes('/api/posts?') && r.url().includes('cursor='))
    await more.click()
    expect((await fetched).ok()).toBe(true)
    await expect.poll(() => cards.count()).toBeGreaterThan(PER_PAGE)
    // Focus lands on the first new card, not on <body>.
    await expect(cards.nth(PER_PAGE)).toBeFocused()

    while (await more.isVisible()) {
      const next = page.waitForResponse(r => r.url().includes('cursor='))
      await more.click()
      await next
    }
    // Every post once, and never the one on top.
    const hrefs = await cards.evaluateAll(els => els.map(e => e.getAttribute('href')))
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(hrefs).not.toContain(await featured.getAttribute('href'))
  })

  test('News: a tag or a search asks the server, and the highlighted post stays on top', async ({ page }) => {
    await openPage(page, 'posts')
    const featured = page.getByTestId('news-featured')
    const cards = page.locator('#news-grid .nf-card')
    const more = page.locator('.nf-grid-wrap').getByTestId('show-more')
    await expect(page.locator('astro-island[ssr]', { has: page.locator('.nf-controls') })).toHaveCount(0)

    const tagged = page.waitForResponse(r => r.url().includes(`tag_id=${tagId}`))
    await page.locator('.nf-tag-btn', { hasText: TAG }).click()
    await tagged
    await expect(cards).toHaveCount(4)
    for (let i = 0; i < 4; i++) await expect(cards.nth(i)).toContainText(title(i))
    await expect(more).toHaveCount(0)
    // #7 has no such tag, and is on top anyway.
    await expect(featured).toContainText(title(7))

    // Back to all: the baked first batch again.
    await page.locator('.nf-tag-btn').first().click()
    await expect(cards).toHaveCount(PER_PAGE)

    const searched = page.waitForResponse(r => r.url().includes('search='))
    await page.locator('.nf-search').fill(title(5))
    await searched
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText(title(5))
    await expect(featured).toContainText(title(7))
  })

  test('News: a failed Show more says so, and the button tries again', async ({ page }) => {
    await openPage(page, 'posts')
    const cards = page.locator('#news-grid .nf-card')
    const more = page.locator('.nf-grid-wrap').getByTestId('show-more')
    await expect(page.locator('astro-island[ssr]', { has: more })).toHaveCount(0)

    const nextBatch = (url: URL) => url.pathname === '/api/posts' && url.searchParams.has('cursor')
    await page.route(nextBatch, route => route.abort())
    await more.click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(cards).toHaveCount(PER_PAGE)

    await page.unroute(nextBatch)
    await more.click()
    await expect.poll(() => cards.count()).toBeGreaterThan(PER_PAGE)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('News: a failed tag filter empties the grid and offers Try again', async ({ page }) => {
    await openPage(page, 'posts')
    const cards = page.locator('#news-grid .nf-card')
    await expect(page.locator('astro-island[ssr]', { has: page.locator('.nf-controls') })).toHaveCount(0)

    const tagged = (url: URL) => url.pathname === '/api/posts' && url.searchParams.get('tag_id') === String(tagId)
    await page.route(tagged, route => route.abort())
    await page.locator('.nf-tag-btn', { hasText: TAG }).click()
    // The unfiltered cards must not stay under the tag, where they read as matches.
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(cards).toHaveCount(0)

    await page.unroute(tagged)
    await page.locator('.nf-grid-wrap').getByTestId('show-more').click()
    await expect(cards).toHaveCount(4)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('Shows: the upcoming list (static markup) shows batches', async ({ page }) => {
    await openPage(page, 'concerts')
    await expectPaged(page, page.locator('.gig-row'), page.locator('.upcoming-sec').getByTestId('show-more'))
  })

  test('Shows: the past-shows archive (island) shows batches, and a year filter resets them', async ({ page }) => {
    await openPage(page, 'concerts')
    const archive = page.locator('.archive-wrap')
    await expectPaged(page, archive.locator('.archive-row'), archive.getByTestId('show-more'))

    // Picking a year and going back to All starts from the first batch.
    await archive.locator('.year-filters button', { hasText: '2001' }).click()
    await archive.locator('.year-filters button').first().click()
    const visible = () => archive.locator('.archive-row').evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent !== null).length)
    await expect.poll(visible).toBe(PER_PAGE)
  })

  test('without JavaScript every item shows, and no button that could do nothing', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await openPage(page, 'concerts')
    const rows = page.locator('.gig-row')
    expect(await rows.count()).toBeGreaterThan(PER_PAGE)
    expect(await rows.evaluateAll(els => els.every(e => (e as HTMLElement).offsetParent !== null))).toBe(true)
    await expect(page.getByTestId('show-more').first()).toBeHidden()
    await context.close()
  })

  // News is the exception — it fetches past its first batch (above). Its
  // posts stay reachable through the sitemap and every article page.
  test('items past the first batch are still linked in the served HTML', async ({ request }) => {
    const html = await (await request.get(`${WEB}/en/${section.concerts}/`)).text()
    const hidden = html.match(/class="gig-row"[^>]*data-more-hidden|data-more-hidden[^>]*class="gig-row"/g) ?? []
    expect(hidden.length).toBeGreaterThan(0)
  })
})
