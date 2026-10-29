import { test, expect } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

// A tab opened before a deploy asks for route chunks the deploy deleted. The
// dev server has no hashed chunks, so failing the view's module request is
// the same failure: "Failed to fetch dynamically imported module".
const PHOTOS_MODULE = '**/src/views/admin/PhotosAdminView.vue*'

test.describe('Admin — a route chunk missing after a deploy', () => {
  test('reloads into the clicked page instead of rendering nothing', async ({ page }) => {
    let failed = 0
    await page.route(PHOTOS_MODULE, (route) => {
      if (failed++ === 0) return route.abort()
      return route.continue()
    })

    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    const reload = page.waitForEvent('load')

    await page.locator('a.nav-item[href="/admin/photos"]').click()

    await reload
    await expect(page).toHaveURL(/\/admin\/photos$/)
    await expect(page.locator('h1')).toContainText('Photo Albums')
    expect(failed).toBeGreaterThanOrEqual(2)
  })

  test('reloads only once when the chunk is still missing afterwards', async ({ page }) => {
    await page.route(PHOTOS_MODULE, (route) => route.abort())

    let loads = 0
    page.on('load', () => loads++)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')

    await page.locator('a.nav-item[href="/admin/photos"]').click()
    await page.waitForURL(/\/admin\/photos$/)
    await page.waitForLoadState('networkidle')
    // The reloaded page fails the same import; it must stay put, not loop.
    await page.waitForTimeout(1500)

    expect(loads).toBe(2)
  })
})
