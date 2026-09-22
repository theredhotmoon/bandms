import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * The chrome language. Deliberately asserts that the *content* language is
 * untouched: both axes hold the same two values, so a mix-up produces working
 * code that is simply wrong, and nothing else in the suite would see it.
 *
 * Writes only localStorage, scoped to this browser context. test.use() loads
 * the stored auth state but never writes back to it, so the shared
 * e2e/.auth/admin.json cannot end up pinned to Polish.
 */
test.describe('Admin UI language', () => {
  test.describe.configure({ mode: 'serial' })

  test('switching to Polish translates the sidebar and survives a reload', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    const switcher = page.getByTestId('ui-lang-switcher')
    await expect(switcher).toBeVisible()

    // Baseline: English chrome, and <html lang> follows it.
    await expect(page.locator('nav.sidebar-nav')).toContainText('Dashboard')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await switcher.selectOption('pl')

    await expect(page.locator('nav.sidebar-nav')).toContainText('Pulpit')
    await expect(page.locator('nav.sidebar-nav')).not.toContainText('Dashboard')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl')

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('nav.sidebar-nav')).toContainText('Pulpit')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
  })

  test('the chrome language does not disturb the content language', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    const before = await page.evaluate(() => localStorage.getItem('site_lang'))

    await page.getByTestId('ui-lang-switcher').selectOption('pl')
    await expect(page.locator('nav.sidebar-nav')).toContainText('Pulpit')

    const after = await page.evaluate(() => localStorage.getItem('site_lang'))
    expect(after).toBe(before)
    expect(await page.evaluate(() => localStorage.getItem('admin_ui_lang'))).toBe('pl')
  })

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('admin_ui_lang'))
  })
})
