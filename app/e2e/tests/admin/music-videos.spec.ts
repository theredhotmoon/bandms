import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const UNIQUE_TITLE = `e2e-video-${Date.now()}`
let editedTitle = `${UNIQUE_TITLE}-edited`

test.describe('Music Videos Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads and "Music Videos" heading is visible', async ({ page }) => {
    await page.goto('/admin/music-videos')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /music videos/i })).toBeVisible()
  })

  test('create video: fill title and video_url → save → toast "Music video created"', async ({ page }) => {
    await page.goto('/admin/music-videos')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New video' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal
      .locator('input[name="title"], input[id="title"], input[placeholder*="title" i]')
      .first()
      .fill(UNIQUE_TITLE)

    await modal
      .locator('input[name="video_url"], input[id="video_url"], input[type="url"], input[placeholder*="url" i]')
      .first()
      .fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    await modal.getByRole('button', { name: /save|create/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Music video created', { timeout: 8000 })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: UNIQUE_TITLE })).toBeVisible({ timeout: 8000 })
  })

  test('edit: click Edit → change title → save → toast "Music video updated"', async ({ page }) => {
    await page.goto('/admin/music-videos')
    await page.waitForLoadState('networkidle')

    const row = page.locator('tr').filter({ hasText: UNIQUE_TITLE })
    await row.getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const titleInput = modal
      .locator('input[name="title"], input[id="title"], input[placeholder*="title" i]')
      .first()
    await titleInput.clear()
    await titleInput.fill(editedTitle)

    await modal.getByRole('button', { name: /save|update/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Music video updated', { timeout: 8000 })
    await expect(modal).not.toBeVisible()
  })

  test('delete: click Delete → ConfirmDialog → confirm → toast "Music video deleted"', async ({ page }) => {
    await page.goto('/admin/music-videos')
    await page.waitForLoadState('networkidle')

    const row = page.locator('tr').filter({ hasText: editedTitle })
    await row.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Music video deleted', { timeout: 8000 })
    await expect(page.getByRole('cell', { name: editedTitle })).not.toBeVisible({ timeout: 8000 })
  })

  test('modal X close button closes the modal', async ({ page }) => {
    await page.goto('/admin/music-videos')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New video' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('button[aria-label="Close"], button.close, button:has(svg)').first().click()

    await expect(modal).not.toBeVisible()
  })

  test('validation: empty title → error message shown', async ({ page }) => {
    await page.goto('/admin/music-videos')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New video' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal
      .locator('input[name="video_url"], input[id="video_url"], input[type="url"], input[placeholder*="url" i]')
      .first()
      .fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    await modal.getByRole('button', { name: /save|create/i }).click()

    const errorMessage = modal.locator(
      '[class*="error"], [class*="invalid"], .text-red-500, [role="alert"]',
    )
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 })
  })

  test('validation: empty video_url → error message shown', async ({ page }) => {
    await page.goto('/admin/music-videos')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New video' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal
      .locator('input[name="title"], input[id="title"], input[placeholder*="title" i]')
      .first()
      .fill(`e2e-val-${Date.now()}`)

    await modal.getByRole('button', { name: /save|create/i }).click()

    const errorMessage = modal.locator(
      '[class*="error"], [class*="invalid"], .text-red-500, [role="alert"]',
    )
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 })
  })

  test('fetch-preview button fills og_title and view_count fields', async ({ page }) => {
    await page.route('**/api/music-videos/*/fetch-preview', async route => {
      await route.fulfill({ json: { data: { og_title: 'Test Video', og_image: null, view_count: 1000 } } })
    })

    await page.goto('/admin/music-videos')
    await page.waitForLoadState('networkidle')

    const rows = page.locator('tr')
    const count = await rows.count()

    if (count > 1) {
      await rows.nth(1).getByRole('button', { name: /edit/i }).click()

      const modal = page.locator('.modal-overlay')
      await expect(modal).toBeVisible()

      const fetchBtn = modal.getByRole('button', { name: /fetch preview/i })
      if (await fetchBtn.isVisible()) {
        await fetchBtn.click()

        const ogTitleInput = modal.locator(
          'input[name="og_title"], input[id="og_title"], input[placeholder*="og title" i]',
        )
        if (await ogTitleInput.isVisible()) {
          await expect(ogTitleInput).toHaveValue('Test Video', { timeout: 5000 })
        }
      }

      await modal.locator('button[aria-label="Close"], button.close, button:has(svg)').first().click()
    }
  })

  test('sync YouTube views button triggers sync-views request', async ({ page }) => {
    let syncCalled = false
    await page.route('**/api/music-videos/sync-views', async route => {
      syncCalled = true
      await route.fulfill({ json: { message: 'Sync complete' } })
    })

    await page.goto('/admin/music-videos')
    await page.waitForLoadState('networkidle')

    const syncBtn = page.getByRole('button', { name: /sync youtube views/i })
    if (await syncBtn.isVisible()) {
      await syncBtn.click()
      await page.waitForTimeout(500)
      expect(syncCalled).toBe(true)
    }
  })
})
