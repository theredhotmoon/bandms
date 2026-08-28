import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The Music page on the public Astro site.
 *
 * Absolute URLs to the `web` container, skipped when it is not up — same
 * arrangement as the other public specs. Sections render only when the band has
 * the data for them, so each test guards on what it needs rather than assuming a
 * populated database.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * The Music page is reachable only when the `releases` module is enabled — a
 * disabled module unbuilds its route, so a 404 here means "switched off", not
 * "broken". Either way there is nothing to test, but the distinction matters
 * when reading a skip message.
 */
async function musicPageIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en/releases`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

/**
 * Wait for the island containing `selector` to finish hydrating.
 *
 * These sections use `client:visible`, so Astro server-renders the markup and
 * loads its JavaScript only once the element scrolls into view. Playwright
 * scrolls and clicks in the same breath, which lands the click on inert markup
 * and the test fails as though the component were broken.
 *
 * Astro marks an un-hydrated island with an `ssr` attribute and removes it when
 * the component mounts, so that is the signal to wait on. This is a harness
 * concern, not a reason to switch these islands to `client:load` — the race
 * window is milliseconds for a real visitor, and eager hydration would ship the
 * JavaScript to everyone who never scrolls that far.
 */
async function hydrated(page: import('@playwright/test').Page, selector: string) {
  await page.locator(selector).first().scrollIntoViewIfNeeded()
  await page.waitForFunction(
    (sel) => {
      const island = document.querySelector(sel)?.closest('astro-island')
      return Boolean(island) && !island!.hasAttribute('ssr')
    },
    selector,
    { timeout: 10_000 },
  )
}

test.describe('Music page', () => {
  failOnPageError()

  test.beforeEach(async ({ request, page }) => {
    test.skip(
      !(await musicPageIsUp(request)),
      `${WEB}/en/releases unavailable — site down, or the releases module is off`,
    )

  })

  test('renders the hero and a featured release', async ({ page }) => {
    await page.goto(`${WEB}/en/releases`)

    await expect(page.getByRole('heading', { level: 1, name: 'Music' })).toBeVisible()

    const featured = page.locator('.mu-featured')
    test.skip((await featured.count()) === 0, 'No releases on this instance')
    await expect(featured.locator('.mu-featured-title')).not.toBeEmpty()
  })

  test('discography rows expand to a tracklist and collapse again', async ({ page }) => {
    await page.goto(`${WEB}/en/releases`)

    const toggles = page.locator('.dg-toggle')
    test.skip((await toggles.count()) === 0, 'Fewer than two releases on this instance')
    await hydrated(page, '.dg-toggle')

    const first = toggles.first()
    await expect(first).toHaveAttribute('aria-expanded', 'false')

    await first.click()
    await expect(first).toHaveAttribute('aria-expanded', 'true')

    await first.click()
    await expect(first).toHaveAttribute('aria-expanded', 'false')
  })

  test('only one discography row is open at a time', async ({ page }) => {
    await page.goto(`${WEB}/en/releases`)

    const toggles = page.locator('.dg-toggle')
    test.skip((await toggles.count()) < 2, 'Needs at least two non-featured releases')
    await hydrated(page, '.dg-toggle')

    await toggles.nth(0).click()
    await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'true')

    await toggles.nth(1).click()
    await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'true')
    await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'false')
  })

  test('the lyrics button on a track selects that song in the sheet', async ({ page }) => {
    await page.goto(`${WEB}/en/releases`)

    const jump = page.locator('.tl-lyric').first()
    test.skip((await jump.count()) === 0, 'No tracks with lyrics on this instance')
    await hydrated(page, '.tl-lyric')
    await hydrated(page, '.ly-pick')

    const trackTitle = (await jump.locator('..').textContent())?.trim() ?? ''

    await jump.click()

    // The sheet is the cross-island handoff: the tracklist and the viewer are
    // separate islands talking through a nanostore.
    const sheet = page.locator('.ly-sheet-title')
    await expect(sheet).toBeVisible({ timeout: 8000 })
    expect(trackTitle).toContain((await sheet.textContent())?.trim() ?? '')
  })

  test('lyrics picker switches songs', async ({ page }) => {
    await page.goto(`${WEB}/en/releases`)

    const picks = page.locator('.ly-pick')
    test.skip((await picks.count()) < 2, 'Needs at least two songs with lyrics')
    await hydrated(page, '.ly-pick')

    await picks.nth(1).click()
    await expect(picks.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(picks.nth(0)).toHaveAttribute('aria-pressed', 'false')
  })

  test('lyrics render as separate verses, not one block', async ({ page }) => {
    await page.goto(`${WEB}/en/releases`)

    const sheet = page.locator('.ly-sheet')
    test.skip((await sheet.count()) === 0, 'No lyrics on this instance')

    // Blank lines in the source must become verse breaks.
    expect(await sheet.locator('.ly-verse').count()).toBeGreaterThan(0)
  })

  test('a video card opens the lightbox with an embedded player', async ({ page }) => {
    await page.goto(`${WEB}/en/releases`)

    const card = page.locator('.vg-card').first()
    test.skip((await card.count()) === 0, 'No music videos on this instance')
    await hydrated(page, '.vg-card')

    await card.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })
    await expect(dialog.locator('iframe')).toHaveAttribute('src', /youtube/)

    await page.keyboard.press('Escape')
  })

  test('every platform pill and release link points outward', async ({ page }) => {
    await page.goto(`${WEB}/en/releases`)

    const links = page.locator('.mu-where-pill, .mu-plat')
    test.skip((await links.count()) === 0, 'No platform links on this instance')

    for (let i = 0; i < (await links.count()); i++) {
      const link = links.nth(i)
      expect(await link.getAttribute('href')).toMatch(/^https?:\/\//)
      expect(await link.getAttribute('target')).toBe('_blank')
      expect(await link.getAttribute('rel')).toContain('noopener')
    }
  })

  test('every internal link resolves', async ({ page, request }) => {
    await page.goto(`${WEB}/en/releases`)

    const hrefs = await page.locator('main a[href^="/"]').evaluateAll((els) =>
      [...new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''))].filter(Boolean),
    )

    for (const href of hrefs) {
      const res = await request.get(`${WEB}${href}`)
      expect(res.status(), `${href} should not 404`).toBeLessThan(400)
    }
  })
})
