import { test, expect, type Locator, type Page } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * Post dates on the public News surfaces.
 *
 * `posts.published_at` / `created_at` are full ISO timestamps, not date-only
 * strings. Every news surface used to run them through a date-only parser
 * (`new Date(iso + 'T00:00:00')`) and hand-format the result, which rendered
 * "NaN undefined NaN" in place of every date — on the homepage rows, the list
 * (featured + cards) and the article header. `astro build` was green the whole
 * time: an Invalid Date throws nothing. Only the rendered page shows it.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

/** A real date: no NaN/undefined anywhere, and a four-digit year present. */
async function expectRealDates(dates: Locator) {
  const texts = (await dates.allTextContents()).map(t => t.trim())
  expect(texts.length).toBeGreaterThan(0)
  for (const t of texts) {
    expect(t).not.toMatch(/NaN|undefined|Invalid/)
    expect(t).toMatch(/\b(19|20|21)\d{2}\b/)
  }
}

async function newsSlug(request: import('@playwright/test').APIRequestContext, lang: 'en' | 'pl') {
  const res = await request.get(`${API}/api/site-config?lang=${lang}`)
  if (!res.ok()) return null
  const cfg = await res.json()
  const c = cfg.data ?? cfg
  if (c.modules?.posts === false) return null
  return c.module_config?.posts?.slug ?? 'posts'
}

async function openNewsList(page: Page, request: import('@playwright/test').APIRequestContext, lang: 'en' | 'pl') {
  const slug = await newsSlug(request, lang)
  test.skip(slug === null, 'posts module off or site-config unreachable')
  const res = await page.goto(`${WEB}/${lang}/${slug}/`)
  test.skip(!res?.ok(), `${WEB}/${lang}/${slug}/ unavailable`)
  const cards = page.locator('.nf-card, .nf-featured')
  test.skip((await cards.count()) === 0, 'no published posts to date')
}

test.describe('News dates', () => {
  failOnPageError()

  test('homepage news rows show a real day, month and year', async ({ page }) => {
    const res = await page.goto(`${WEB}/en/`)
    test.skip(!res?.ok(), `${WEB}/en/ unavailable`)
    const rows = page.locator('.post-row .post-date')
    test.skip((await rows.count()) === 0, 'no news rows on the homepage')
    await expectRealDates(rows)
  })

  test('list: featured post and cards each carry a real date', async ({ page, request }) => {
    await openNewsList(page, request, 'en')
    await expectRealDates(page.locator('.nf-meta-date, .nf-card-date'))
  })

  test('article header and "more from the blog" rows carry real dates', async ({ page, request }) => {
    await openNewsList(page, request, 'en')
    await page.locator('.nf-featured, .nf-card').first().click()
    await expect(page.locator('.art-title')).toBeVisible()
    await expectRealDates(page.locator('.art-meta-date').first())
    const more = page.locator('.art-more-date')
    if (await more.count()) await expectRealDates(more)
  })

  // The hand-rolled formatters also hardcoded English month names, so the
  // Polish list read "14 Sep 2026". The shared helpers are locale-aware.
  test('Polish list shows Polish month names', async ({ page, request }) => {
    await openNewsList(page, request, 'pl')
    const dates = page.locator('.nf-meta-date, .nf-card-date')
    await expectRealDates(dates)
    const texts = await dates.allTextContents()
    const english = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/
    expect(texts.filter(t => english.test(t))).toEqual([])
  })
})
