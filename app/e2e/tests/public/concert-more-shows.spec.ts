import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { rebuildAndWait } from '../../fixtures/admin-api'

/**
 * The bottom of a concert page: the "more shows" cards and the prev/next pair.
 *
 * The selection rule itself is pinned with fixed dates in
 * `web/src/lib/moreShows.test.ts`; this spec checks the built page follows it.
 *
 * Writes nothing — the expectations are derived from `/api/concerts` the same
 * way `ConcertDetail.astro` derives them, so the spec runs against whatever the
 * dev database holds. It does rebuild the public site first: other specs seed
 * and delete concerts, and a site baked around one of theirs would disagree
 * with the API on every page.
 *
 * - The cards are the next three upcoming gigs whenever any are left, else the
 *   three most recently played, and they share the row equally (1 → full,
 *   2 → halves, 3 → thirds).
 * - Prev/next name their gig (name, or the venue when it has none) and date.
 * - There is no "All shows" back button.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1400, height: 900 } })

interface ApiConcert { id: number; slug: string; name: string | null; date: string; venue: { name: string } }

// Mirrors `isUpcoming()` in web/src/lib/i18n.ts.
const isUpcoming = (date: string) => new Date(date) >= new Date()

test.describe.serial('Public — concert page: more shows and prev/next', () => {
  failOnPageError()

  let concerts: ApiConcert[] = []
  let section = 'concerts'

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    await rebuildAndWait(request, Date.now(), API)
    concerts = ((await (await request.get(`${API}/api/concerts?lang=en`)).json()).data ?? []) as ApiConcert[]
    const cfg = (await (await request.get(`${API}/api/site-config?lang=en`)).json()).data
    test.skip(cfg?.modules?.concerts === false, 'Concerts module is switched off')
    section = cfg?.module_config?.concerts?.slug || 'concerts'
  })

  test('cards follow the upcoming-first rule and share the row equally', async ({ page }) => {
    test.skip(concerts.length < 2, 'Needs at least two concerts')
    // One page load per concert; a prod-synced database has dozens.
    test.setTimeout(30_000 + concerts.length * 5_000)

    // A page whose expectation differs by count is covered best by checking
    // every concert — there are few, and each is a cheap static page.
    for (const [i, current] of concerts.entries()) {
      const others = concerts.filter((_, j) => j !== i)
      const upcoming = others.filter((c) => isUpcoming(c.date))
      const expected = (upcoming.length > 0 ? upcoming : others.filter((c) => !isUpcoming(c.date)).reverse())
        .slice(0, 3)
        .map((c) => `/en/${section}/${c.slug}`)

      await page.goto(`${WEB}/en/${section}/${current.slug}/`)
      await expect(page.locator('.back-btn')).toHaveCount(0)

      const grid = page.getByTestId('more-shows')
      const cards = grid.locator('.more-card')
      await expect(cards).toHaveCount(expected.length)
      const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('href')))
      expect(hrefs, `cards on ${current.slug}`).toEqual(expected)

      await expect(grid).toHaveAttribute('data-count', String(expected.length))
      await expect(grid).toHaveAttribute('data-kind', upcoming.length > 0 ? 'upcoming' : 'past')
      const gridWidth = (await grid.boundingBox())!.width
      for (const card of await cards.all()) {
        const w = (await card.boundingBox())!.width
        // gap is 16px; each card is (grid - gaps) / n
        const want = (gridWidth - 16 * (expected.length - 1)) / expected.length
        expect(Math.abs(w - want), `card width on ${current.slug}`).toBeLessThan(2)
      }
    }
  })

  test('prev/next name the neighbouring gig and its date', async ({ page }) => {
    test.skip(concerts.length < 3, 'Needs a concert with both neighbours')
    const prev = concerts[0], current = concerts[1], next = concerts[2]

    await page.goto(`${WEB}/en/${section}/${current.slug}/`)

    const prevBtn = page.getByTestId('prev-show')
    await expect(prevBtn).toHaveAttribute('href', `/en/${section}/${prev.slug}`)
    await expect(prevBtn.locator('.pn-city')).toHaveText(prev.name || prev.venue.name)
    await expect(prevBtn.locator('.pn-meta')).toContainText(prev.date.slice(0, 4))

    const nextBtn = page.getByTestId('next-show')
    await expect(nextBtn).toHaveAttribute('href', `/en/${section}/${next.slug}`)
    await expect(nextBtn.locator('.pn-city')).toHaveText(next.name || next.venue.name)
    await expect(nextBtn.locator('.pn-meta')).toContainText(next.date.slice(0, 4))
  })
})
