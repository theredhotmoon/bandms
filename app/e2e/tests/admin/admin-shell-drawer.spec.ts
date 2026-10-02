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

  test('Escape hands focus back to the menu button', async ({ page }) => {
    await open(page, '/admin')

    await page.locator('.topbar-menu').click()
    const navLink = page.locator('.sidebar-nav a').first()
    await navLink.focus()
    await page.keyboard.press('Escape')

    await expect(navLink).toBeHidden()
    await expect(page.locator('.topbar-menu')).toBeFocused()
  })

  test('the menu button stays on top of the open drawer and closes it', async ({ page }) => {
    await open(page, '/admin')

    const button = page.locator('.topbar-menu')
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    // A plain click, no force: it fails if the drawer or scrim covers the button.
    await button.click()
    await expect(page.locator('.sidebar-nav a').first()).toBeHidden()
  })

  test('with reduced motion the drawer opens without a transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, '/admin')

    await page.locator('.topbar-menu').click()
    // App.vue clamps every transition to 0.01ms under reduced motion, so
    // "instant" is anything under 10ms rather than exactly 0.
    const duration = await page.locator('.sidebar').evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(duration.split(',').every((d) => parseFloat(d) < 0.01)).toBe(true)
  })

  test('rebuild settings modal renders above the top bar', async ({ page }) => {
    await open(page, '/admin')

    const gear = page.locator('.rebuild-bar .btn-settings')
    test.skip((await gear.count()) === 0, 'No rebuild bar on this instance')
    await gear.click()

    // A point inside the top bar; the modal's backdrop must win it.
    const onTop = await page.evaluate(
      (x) => document.elementFromPoint(x, 20)?.closest('.modal-backdrop') !== null,
      TABLET.width / 2,
    )
    expect(onTop).toBe(true)
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
