import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The release detail page.
 *
 * This is the page the Music PR missed: its discography linked straight here
 * while it was still on the pre-theme layout, so a visitor crossed from a 2-Tone
 * page to an unported one in one click. These specs check the port and, more
 * usefully, that the seam is closed — that arriving from the Music page lands on
 * a page built the same way.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

async function firstReleaseId(request: import('@playwright/test').APIRequestContext) {
  try {
    const res = await request.get(`${API}/api/releases?lang=en`, { timeout: 5000 })
    if (!res.ok()) return null
    const data = ((await res.json()) as { data?: { id: number }[] }).data ?? []
    return data[0]?.id ?? null
  } catch {
    return null
  }
}

async function musicPageIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en/releases`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

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

test.describe('Release detail page', () => {
  failOnPageError()

  test.beforeEach(async ({ request, page }) => {
    test.skip(
      !(await musicPageIsUp(request)),
      `${WEB}/en/releases unavailable — site down, or the releases module is off`,
    )
  })

  test('renders the hero with breadcrumb, meta and title', async ({ request, page }) => {
    const id = await firstReleaseId(request)
    test.skip(id === null, 'No releases on this instance')

    await page.goto(`${WEB}/en/releases/${id}`)

    await expect(page.locator('h1.rd-h1')).toHaveText(/\S/)
    await expect(page.locator('.rd-crumb a')).toHaveText(/\S/)
    await expect(page.locator('.rd-artist')).toHaveText(/\S/)
  })

  test('the breadcrumb goes back to the Music page', async ({ request, page }) => {
    const id = await firstReleaseId(request)
    test.skip(id === null, 'No releases on this instance')

    await page.goto(`${WEB}/en/releases/${id}`)
    await page.locator('.rd-crumb a').click()

    await expect(page.getByRole('heading', { level: 1, name: 'Music' })).toBeVisible({ timeout: 8000 })
  })

  test('carries no pre-theme layout classes in the rendered output', async ({ request, page }) => {
    const id = await firstReleaseId(request)
    test.skip(id === null, 'No releases on this instance')

    await page.goto(`${WEB}/en/releases/${id}`)

    // Scoped to <main>: this asserts about the page, not the site chrome.
    // Footer.astro is still on the old layout — a separate gap, tracked in
    // TODO.md — and judging it here would fail this spec for someone else's file.
    const stray = await page.evaluate(() => {
      const bad = /\b(?:max-w-4xl|font-black|text-3xl|text-4xl|accent-line)\b|\b(?:text|bg|border)-(?:zinc|gray|neutral)-\d{2,3}\b/
      return [...document.querySelectorAll('main [class]')]
        .map((el) => el.getAttribute('class') ?? '')
        .filter((c) => bad.test(c))
    })
    expect(stray).toEqual([])
  })

  test('shows a tracklist when the release has tracks', async ({ request, page }) => {
    const id = await firstReleaseId(request)
    test.skip(id === null, 'No releases on this instance')

    await page.goto(`${WEB}/en/releases/${id}`)

    const rows = page.locator('.tl-row')
    test.skip((await rows.count()) === 0, 'This release has no tracks')

    // Numbers are zero-padded and durations right-aligned in monospace, so a
    // missing duration must not collapse the row.
    await expect(rows.first().locator('.tl-n')).toHaveText(/^\d{2}$/)
    await expect(rows.first().locator('.tl-title')).toHaveText(/\S/)
  })

  test('lyrics stay scoped to this release', async ({ request, page }) => {
    const id = await firstReleaseId(request)
    test.skip(id === null, 'No releases on this instance')

    await page.goto(`${WEB}/en/releases/${id}`)

    const picks = page.locator('.ly-pick')
    test.skip((await picks.count()) === 0, 'This release has no lyrics')
    await hydrated(page, '.ly-pick')

    // Every song offered must belong to the release on screen — the Music page
    // pools lyrics across the catalogue, a detail page must not.
    const releaseTitle = (await page.locator('.rd-h1').textContent())?.trim()
    const labels = await page.locator('.ly-pick-release').allTextContents()
    for (const label of labels) expect(label.trim()).toBe(releaseTitle)
  })

  test('the tracklist lyrics button selects that song', async ({ request, page }) => {
    const id = await firstReleaseId(request)
    test.skip(id === null, 'No releases on this instance')

    await page.goto(`${WEB}/en/releases/${id}`)

    const jump = page.locator('.tl-lyric').first()
    test.skip((await jump.count()) === 0, 'No tracks with lyrics on this release')
    await hydrated(page, '.tl-lyric')
    await hydrated(page, '.ly-pick')

    await jump.click()
    await expect(page.locator('.ly-sheet-title')).toBeVisible({ timeout: 8000 })
  })

  test('platform links open safely', async ({ request, page }) => {
    const id = await firstReleaseId(request)
    test.skip(id === null, 'No releases on this instance')

    await page.goto(`${WEB}/en/releases/${id}`)

    const links = page.locator('.rd-plat, .rd-cta')
    test.skip((await links.count()) === 0, 'This release has no platform links')

    for (let i = 0; i < (await links.count()); i++) {
      expect(await links.nth(i).getAttribute('href')).toMatch(/^https?:\/\//)
      expect(await links.nth(i).getAttribute('target')).toBe('_blank')
      expect(await links.nth(i).getAttribute('rel')).toContain('noopener')
    }
  })

  test('the Music page discography links here and lands on a ported page', async ({ request, page }) => {
    test.skip((await firstReleaseId(request)) === null, 'No releases on this instance')

    await page.goto(`${WEB}/en/releases`)

    const detailLink = page.locator('.dg-detail').first()
    test.skip((await detailLink.count()) === 0, 'No non-featured releases to open')

    await hydrated(page, '.dg-toggle')
    await page.locator('.dg-toggle').first().click()
    await detailLink.click()

    // The seam this PR closes: arriving from Music must land on the new layout.
    await expect(page.locator('.rd-hero')).toBeVisible({ timeout: 8000 })
  })

  test('the legacy unlocalised route still works', async ({ request, page }) => {
    const id = await firstReleaseId(request)
    test.skip(id === null, 'No releases on this instance')

    const res = await page.goto(`${WEB}/releases/${id}`)
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator('h1.rd-h1')).toHaveText(/\S/)
  })

  test('every internal link resolves', async ({ request, page }) => {
    const id = await firstReleaseId(request)
    test.skip(id === null, 'No releases on this instance')

    await page.goto(`${WEB}/en/releases/${id}`)

    const hrefs = await page.locator('main a[href^="/"]').evaluateAll((els) =>
      [...new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''))].filter(Boolean),
    )

    for (const href of hrefs) {
      if (href.startsWith('/storage/')) continue
      const res = await request.get(`${WEB}${href}`)
      expect(res.status(), `${href} should not 404`).toBeLessThan(400)
    }
  })
})
