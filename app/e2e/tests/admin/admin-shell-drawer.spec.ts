import { test, expect, type Page } from '@playwright/test'

/**
 * The admin shell below 1024px: a fixed top bar and an off-canvas drawer.
 *
 * Two regressions this pins, both invisible at desktop width:
 * - The closed drawer was only translated off-screen, so its ~30 nav links
 *   stayed in the tab order. Playwright counts a translated element as
 *   visible, which is why the hidden assertion below fails without
 *   `visibility: hidden`.
 * - The top bar pads the content by its height, so views that size
 *   themselves to the viewport (setlists, tech rider) overflowed by that much
 *   and lost their footers below the fold.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

const TABLET = { width: 800, height: 700 }

async function open(page: Page, path: string) {
  await page.setViewportSize(TABLET)
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

test.describe('Admin shell — drawer below 1024px', () => {
  test('closed drawer is hidden and out of the tab order', async ({ page }) => {
    await open(page, '/admin')

    const navLink = page.locator('.sidebar-nav a').first()
    await expect(navLink).toBeHidden()

    // From the menu button, Tab must go to the page, not into the drawer.
    await page.locator('.topbar-menu').focus()
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab')
      const inSidebar = await page.evaluate(() => Boolean(document.activeElement?.closest('.sidebar')))
      expect(inSidebar).toBe(false)
    }
  })

  test('opening the drawer shows its links, and they take focus', async ({ page }) => {
    await open(page, '/admin')

    await page.locator('.topbar-menu').click()
    const navLink = page.locator('.sidebar-nav a').first()
    await expect(navLink).toBeVisible()
    await navLink.focus()
    await expect(navLink).toBeFocused()
  })

  test('desktop sidebar stays visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/admin')
    await expect(page.locator('.sidebar-nav a').first()).toBeVisible()
  })

  for (const [path, selector] of [
    ['/admin/setlists', '.setlists-root'],
    ['/admin/tech-rider', '.rider-shell'],
  ] as const) {
    test(`${path} fits under the top bar`, async ({ page }) => {
      await open(page, path)

      const box = await page.locator(selector).boundingBox()
      expect(box, `${selector} did not render`).not.toBeNull()
      expect(box!.y + box!.height).toBeLessThanOrEqual(TABLET.height + 1)
    })
  }
})
