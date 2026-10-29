import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { adminHeaders, postRequiredFields, rebuildAndWait } from '../../fixtures/admin-api'

/**
 * Website Modules → Items per page cuts a public list short, with a
 * "Show more" button for the rest. It was saved and served for months while
 * no page read it.
 *
 * Two mechanisms implement it, and this spec drives both on real pages:
 * - a Vue island (`useShowMore` + ShowMoreButton) — the news grid and the
 *   past-shows archive;
 * - static markup (`pagedAttrs` + ShowMore.astro) — the upcoming-shows list.
 * Photos and videos are islands, press and merch static lists, on the same
 * two code paths.
 *
 * Every item stays in the baked HTML, only hidden, so crawlers and visitors
 * without JS keep a link to each one — asserted here too.
 *
 * Seeds a venue, seven future and seven past gigs at it, and eight posts, so
 * every list holds more than one batch whatever the database has; sets
 * per_page on News and Shows and rebuilds. Restores both, deletes the seeds
 * and rebuilds afterwards. The value is baked into the served pages, which is
 * why this runs in its own project after the parallel pool (`list-per-page`
 * in playwright.config.ts): a list held to six would hide items other specs
 * look for.
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
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    for (const m of MODULES) {
      test.skip(config?.modules?.[m] === false, `${m} module is off`)
      section[m] = config?.module_config?.[m]?.slug ?? m
      original[m] = config?.module_config?.[m]?.per_page ?? null
    }

    // Eight posts: one may take the featured slot, which sits outside the grid
    // the batches count, and seven still outnumber a batch of six.
    const required = await postRequiredFields(request, API)
    for (let i = 0; i < 8; i++) {
      const post = await api(request, 'post', '/api/posts', {
        ...required,
        title: { en: `E2E Per page ${STAMP} #${i}` },
        published_at: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
        blocks: [{ type: 'text', payload: { body: { en: '<p>Body</p>' } } }],
      })
      postIds.push(post.data.id)
    }

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
    const restored = (Object.entries(original) as [string, number | null][])
    for (const [m, value] of restored) await api(request, 'put', `/api/admin/modules/${m}`, { per_page: value })
    for (const id of concertIds) await api(request, 'delete', `/api/concerts/${id}`)
    if (venueId !== null) await api(request, 'delete', `/api/venues/${venueId}`)
    for (const id of postIds) await api(request, 'delete', `/api/posts/${id}`)
    if (restored.length > 0 || postIds.length > 0) await rebuildAndWait(request, Date.now(), API)
  })

  test('News: the grid shows batches of grid cards, the featured post on top', async ({ page }) => {
    await openPage(page, 'posts')
    await expect(page.locator('.nf-featured')).toBeVisible()
    await expectPaged(page, page.locator('.nf-card'), page.locator('.nf-grid-wrap').getByTestId('show-more'))
  })

  test('News: a new tag filter starts again from the first batch', async ({ page }) => {
    await openPage(page, 'posts')
    const cards = page.locator('.nf-card')
    const visible = () => cards.evaluateAll(els => els.filter(e => (e as HTMLElement).offsetParent !== null).length)
    const more = page.locator('.nf-grid-wrap').getByTestId('show-more')
    await expect(page.locator('astro-island[ssr]', { has: more })).toHaveCount(0)
    await more.click()
    await expect.poll(visible).toBeGreaterThan(PER_PAGE)

    // A tag, then "All" — two real filter changes, two separate clicks.
    await page.locator('.nf-tag-btn').nth(1).click()
    await page.locator('.nf-tag-btn').first().click()
    await expect.poll(visible).toBe(PER_PAGE)
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

  test('items past the first batch are still linked in the served HTML', async ({ request }) => {
    const html = await (await request.get(`${WEB}/en/${section.concerts}/`)).text()
    const hidden = html.match(/class="gig-row"[^>]*data-more-hidden|data-more-hidden[^>]*class="gig-row"/g) ?? []
    expect(hidden.length).toBeGreaterThan(0)
    const news = await (await request.get(`${WEB}/en/${section.posts}/`)).text()
    expect((news.match(/class="nf-card"/g) ?? []).length).toBeGreaterThan(PER_PAGE)
  })
})
