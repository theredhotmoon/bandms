import { test, expect, type Locator } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

/** Mean of the RGB channels of an element's computed background, 0–255. */
async function backgroundLevel(locator: Locator): Promise<number> {
  const bg = await locator.evaluate((el) => getComputedStyle(el).backgroundColor)
  const [r, g, b] = (bg.match(/\d+(\.\d+)?/g) ?? []).map(Number)
  return (r + g + b) / 3
}

/**
 * The dark/light switch. Asserts on computed colours, not just the attribute:
 * the attribute flipping proves the composable works, but only a changed
 * background proves the palette variables are actually wired to it.
 *
 * Writes only localStorage in this browser context, and clears it after.
 */
test.describe('Admin theme', () => {
  test.describe.configure({ mode: 'serial' })

  test('switches the shell to light, survives a reload and switches back', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    const html = page.locator('html')
    const shell = page.locator('.admin-shell')
    const toggle = page.getByTestId('admin-theme-switch')

    // Default is the dark theme the panel always had.
    await expect(html).toHaveAttribute('data-admin-theme', 'dark')
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(await backgroundLevel(shell)).toBeLessThan(40)

    await toggle.click()

    await expect(html).toHaveAttribute('data-admin-theme', 'light')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(await backgroundLevel(shell)).toBeGreaterThan(215)

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(html).toHaveAttribute('data-admin-theme', 'light')
    expect(await backgroundLevel(shell)).toBeGreaterThan(215)

    await page.getByTestId('admin-theme-switch').click()
    await expect(html).toHaveAttribute('data-admin-theme', 'dark')
    expect(await backgroundLevel(shell)).toBeLessThan(40)
  })

  test('a modal teleported outside the shell follows the theme', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    await page.getByTestId('admin-theme-switch').click()
    await expect(page.locator('html')).toHaveAttribute('data-admin-theme', 'light')

    await page.locator('.btn-add-primary').first().click()
    const panel = page.locator('.modal-overlay .modal-panel')
    await expect(panel).toBeVisible()
    expect(await backgroundLevel(panel)).toBeGreaterThan(215)
  })

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('admin_theme'))
  })
})
