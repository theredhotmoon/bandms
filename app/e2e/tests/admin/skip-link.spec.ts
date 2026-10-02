import { test, expect } from '@playwright/test'

/**
 * App.vue's "Skip to main content" link.
 *
 * It used to be hidden with opacity alone, so at rest it was still a fixed,
 * z-index 10000 link at top centre — invisible, but taking every tap on the
 * middle of the admin's mobile top bar. Hidden must mean out of the way, and
 * focused must still mean visible.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

const TABLET = { width: 800, height: 700 }

test.describe('Skip link', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(TABLET)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
  })

  test('at rest it takes no taps from the top bar', async ({ page }) => {
    const hit = await page.evaluate(
      ({ x }) => {
        const el = document.elementFromPoint(x, 20)
        return { skipLink: Boolean(el?.closest('.skip-link')), topbar: Boolean(el?.closest('.topbar')) }
      },
      { x: TABLET.width / 2 },
    )
    expect(hit.skipLink).toBe(false)
    expect(hit.topbar).toBe(true)
  })

  // Focused directly: App.vue moves focus to #main-content on every route
  // change, so after a navigation the next Tab starts past the link.
  test('focused, it comes on screen', async ({ page }) => {
    const link = page.locator('.skip-link')
    await link.focus()
    await expect(link).toBeInViewport({ ratio: 1 })
    await expect(link).toHaveCSS('opacity', '1')
  })
})
