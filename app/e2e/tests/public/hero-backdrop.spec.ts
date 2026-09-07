import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The public half of hero background images.
 *
 * The admin spec (tests/admin/hero-images.spec.ts) covers choosing and saving
 * pictures; this covers what a visitor actually gets, which is the point of the
 * feature and was the half with no coverage.
 *
 * Two things are asserted separately because they fail independently:
 *
 *  1. Every section page renders the *shared* page header. Seven of them used to
 *     hand-roll their own, and the backdrop only reaches a page that goes
 *     through PageHero — so a page that regressed to its own markup would
 *     silently stop showing hero pictures with a completely green build.
 *
 *  2. The backdrop mechanism itself: candidates ship in the markup and an inline
 *     script picks exactly one before paint.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

test.use({ storageState: { cookies: [], origins: [] } })

/** Module key → the URL slug it is served under in English. */
const SECTION_PAGES = [
  { slug: 'about', module: 'about' },
  { slug: 'concerts', module: 'concerts' },
  { slug: 'contact', module: 'contact' },
  { slug: 'news', module: 'posts' },
  { slug: 'photos', module: 'photos' },
  { slug: 'releases', module: 'releases' },
  { slug: 'shop', module: 'merch' },
  { slug: 'videos', module: 'videos' },
  { slug: 'press', module: 'press' },
  { slug: 'epk', module: 'epk' },
  { slug: 'newsletter', module: 'newsletter' },
] as const

async function pageIsUp(request: import('@playwright/test').APIRequestContext, path: string) {
  try {
    return (await request.get(`${WEB}${path}`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe('Public hero backdrop', () => {
  failOnPageError()

  test.describe('every page renders the shared header', () => {
    for (const { slug, module } of SECTION_PAGES) {
      test(`${slug} uses PageHero`, async ({ request, page }) => {
        test.skip(
          !(await pageIsUp(request, `/en/${slug}`)),
          `${WEB}/en/${slug} unavailable — site down, or the ${module} module is off`,
        )

        await page.goto(`${WEB}/en/${slug}`)

        // .ph-title is PageHero's own H1 class. A page that regressed to a
        // hand-rolled header would still show a heading, so assert the shared
        // one specifically — that is what carries the backdrop.
        await expect(page.locator('.ph-title')).toHaveCount(1)
        await expect(page.locator('h1')).toHaveCount(1)
      })
    }
  })

  test('the homepage hero is present', async ({ request, page }) => {
    test.skip(!(await pageIsUp(request, '/en/')), `${WEB}/en/ unavailable`)

    await page.goto(`${WEB}/en/`)
    await expect(page.locator('.hero')).toHaveCount(1)
  })

  test('an empty aside does not open a phantom column', async ({ request, page }) => {
    test.skip(
      !(await pageIsUp(request, '/en/contact')),
      `${WEB}/en/contact unavailable — site down, or the contact module is off`,
    )

    await page.goto(`${WEB}/en/contact`)

    // Contact passes no aside at all. Astro registers a named slot even when the
    // caller wrapped it in a false condition, so PageHero renders the slot and
    // tests it for content rather than trusting Astro.slots.has() — without
    // that, this page would carry an empty 40px grid column.
    await expect(page.locator('.ph-aside')).toHaveCount(0)
  })

  test('picks exactly one of the candidate pictures, before paint', async ({ request, page }) => {
    test.skip(!(await pageIsUp(request, '/en/')), `${WEB}/en/ unavailable`)

    await page.goto(`${WEB}/en/`)

    const backdrop = page.locator('.hero-backdrop[data-hero-urls]').first()

    // Data-dependent by design: with no hero pictures configured the component
    // renders nothing at all, which is the correct behaviour and is asserted by
    // the unit tests rather than here.
    test.skip(
      (await backdrop.count()) === 0,
      'no hero images configured — nothing to choose between',
    )

    const raw = await backdrop.getAttribute('data-hero-urls')
    const candidates: string[] = JSON.parse(raw ?? '[]')
    expect(candidates.length).toBeGreaterThan(0)

    // The inline script is synchronous, so the background is set by the time the
    // page is interactive — no flash of the bare ink panel.
    const applied = await backdrop.evaluate(el => (el as HTMLElement).style.backgroundImage)
    expect(applied).not.toBe('')

    const chosen = applied.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')
    expect(candidates).toContain(chosen)
  })
})
