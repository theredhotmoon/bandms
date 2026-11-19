import { anonymousVisitor } from '../../fixtures/visitor'
import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The Gallery page on the public Astro site.
 *
 * Absolute URLs to the `web` container, and every test guards on the data it
 * needs — the page renders what the band actually has.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

test.use({ storageState: anonymousVisitor() })

/**
 * Reachable only while the `photos` module is enabled: a disabled module
 * unbuilds its route, so a 404 means "switched off", not "broken".
 */
async function galleryIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en/photos`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

/**
 * Wait for the island holding `selector` to hydrate.
 *
 * `client:visible` means Astro renders the markup on the server and loads its
 * JavaScript only when the element scrolls into view. Playwright scrolls and
 * clicks in one motion, landing the click on inert markup. Astro removes the
 * `ssr` attribute once the component mounts.
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

test.describe('Gallery page', () => {
  failOnPageError()

  test.beforeEach(async ({ request, page }) => {
    test.skip(
      !(await galleryIsUp(request)),
      `${WEB}/en/photos unavailable — site down, or the photos module is off`,
    )

  })

  test('renders the hero and album cards', async ({ page }) => {
    await page.goto(`${WEB}/en/photos`)

    await expect(page.getByRole('heading', { level: 1, name: 'Gallery' })).toBeVisible()

    const cards = page.locator('.gb-card')
    test.skip((await cards.count()) === 0, 'No published albums on this instance')
    await expect(cards.first().locator('.gb-title')).not.toBeEmpty()
  })

  test('each card shows its photo count', async ({ page }) => {
    await page.goto(`${WEB}/en/photos`)

    const counts = page.locator('.gb-count')
    test.skip((await counts.count()) === 0, 'No published albums on this instance')

    for (let i = 0; i < (await counts.count()); i++) {
      // "3 photos" — a zero here would mean a card leading to an empty album.
      await expect(counts.nth(i)).toHaveText(/[1-9]\d*\s+\S+/)
    }
  })

  test('the category filter narrows the grid', async ({ page }) => {
    await page.goto(`${WEB}/en/photos`)

    const chips = page.locator('.gb-chip')
    test.skip((await chips.count()) < 2, 'No album tags on this instance')
    await hydrated(page, '.gb-chip')

    const total = await page.locator('.gb-card').count()

    // The second chip is the first real category; "All" is synthetic and first.
    await chips.nth(1).click()
    await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true')

    const filtered = await page.locator('.gb-card').count()
    expect(filtered).toBeGreaterThan(0)
    expect(filtered).toBeLessThanOrEqual(total)

    // Filter chips are built from tags actually in use, so no category can be
    // selected into an empty grid.
    await chips.nth(0).click()
    await expect(page.locator('.gb-card')).toHaveCount(total)
  })

  /**
   * Open an album page from the gallery — the first card whose count is at
   * least `minPhotos`. Albums have their own pages now; the lightbox lives
   * there. Skips when the instance has no such album.
   */
  async function openAlbum(page: import('@playwright/test').Page, minPhotos = 1): Promise<string> {
    await page.goto(`${WEB}/en/photos`)
    const cards = page.locator('.gb-card')
    test.skip((await cards.count()) === 0, 'No published albums on this instance')
    for (let i = 0; i < (await cards.count()); i++) {
      const label = (await cards.nth(i).locator('.gb-count').textContent()) ?? ''
      if (Number.parseInt(label, 10) >= minPhotos) {
        const title = ((await cards.nth(i).locator('.gb-title').textContent()) ?? '').trim()
        await cards.nth(i).click()
        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
        await hydrated(page, '.ap-thumb')
        return title
      }
    }
    test.skip(true, `No album with ${minPhotos}+ photos`)
    return ''
  }

  test('a card opens the album page, whose first photo opens the lightbox', async ({ page }) => {
    const title = await openAlbum(page)

    await page.locator('.ap-thumb').first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })
    await expect(dialog).toHaveAttribute('aria-label', title)
    await expect(dialog.locator('.ap-stage img')).toHaveAttribute('src', /.+/)
    await expect(dialog.locator('.ap-counter')).toHaveText(/^1 \/ \d+$/)
  })

  test('lightbox arrows advance and wrap around', async ({ page }) => {
    await openAlbum(page, 2)
    await page.locator('.ap-thumb').first().click()

    const dialog = page.getByRole('dialog')
    const counter = dialog.locator('.ap-counter')
    const total = Number.parseInt((await counter.textContent())!.split('/')[1]!.trim(), 10)

    await expect(counter).toHaveText(`1 / ${total}`)

    await dialog.getByRole('button', { name: 'Next photo' }).click()
    await expect(counter).toHaveText(`2 / ${total}`)

    // Stepping back from the first photo wraps to the last, as the design does.
    await dialog.getByRole('button', { name: 'Previous photo' }).click()
    await expect(counter).toHaveText(`1 / ${total}`)
    await dialog.getByRole('button', { name: 'Previous photo' }).click()
    await expect(counter).toHaveText(`${total} / ${total}`)
  })

  test('arrow keys and Escape drive the lightbox', async ({ page }) => {
    await openAlbum(page)
    await page.locator('.ap-thumb').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })

    const total = Number.parseInt(
      (await dialog.locator('.ap-counter').textContent())!.split('/')[1]!.trim(),
      10,
    )

    if (total > 1) {
      await page.keyboard.press('ArrowRight')
      await expect(dialog.locator('.ap-counter')).toHaveText(`2 / ${total}`)
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 8000 })
  })

  test('the press-ready badge only appears where a photo is flagged', async ({ page }) => {
    await page.goto(`${WEB}/en/photos`)

    const badges = page.locator('.gb-card .gb-epk')
    test.skip((await badges.count()) === 0, 'No press-flagged photos on this instance')

    // The flag exists on the API and had never been surfaced publicly before.
    await expect(badges.first()).toContainText(/press/i)
    expect(await badges.count()).toBeLessThanOrEqual(await page.locator('.gb-card').count())
  })

  test('scrolling is restored after the lightbox closes', async ({ page }) => {
    await openAlbum(page)

    await page.locator('.ap-thumb').first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 })
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 8000 })
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  })
})
