import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const UNIQUE_TITLE = `e2e-press-release-${Date.now()}`
const EDITED_TITLE = `${UNIQUE_TITLE}-edited`

test.describe('Press Releases Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads and shows "Press Releases" heading', async ({ page }) => {
    await page.goto('/admin/press-releases')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1')).toContainText('Press Releases')
  })

  test('create via manual entry: modal opens, fill fields, save → toast and row appear', async ({
    page,
  }) => {
    await page.route('**/api/press-releases/fetch-meta', async (route) => {
      await route.fulfill({
        json: {
          og_title: UNIQUE_TITLE,
          og_description: 'E2E test description',
          og_image: null,
          og_site_name: 'Test Site',
        },
      })
    })

    await page.goto('/admin/press-releases')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add press release' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const urlInput = modal
      .locator('input[name="url"], input[id="url"], input[type="url"], input[placeholder*="http" i]')
      .first()
    await urlInput.fill('https://example.com/test-article')

    const fetchButton = modal.getByRole('button', { name: /fetch metadata/i })
    if (await fetchButton.isVisible()) {
      await fetchButton.click()
    }

    const titleInput = modal
      .locator(
        'input[name="og_title"], input[id="og_title"], input[placeholder="Article headline"], input[name="title"]',
      )
      .first()
    await titleInput.fill(UNIQUE_TITLE)

    await modal.getByRole('button', { name: /save|create|add/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(/press release added/i, {
      timeout: 8000,
    })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: UNIQUE_TITLE })).toBeVisible({ timeout: 8000 })
  })

  test('edit: click Edit on row → change title → save → toast success', async ({ page }) => {
    await page.goto('/admin/press-releases')
    await page.waitForLoadState('networkidle')

    const row = page.locator('tr').filter({ hasText: UNIQUE_TITLE })
    await row.getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const titleInput = modal
      .locator(
        'input[name="og_title"], input[id="og_title"], input[placeholder="Article headline"], input[name="title"]',
      )
      .first()
    await titleInput.clear()
    await titleInput.fill(EDITED_TITLE)

    await modal.getByRole('button', { name: /save|update/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(/press release updated/i, {
      timeout: 8000,
    })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: EDITED_TITLE })).toBeVisible({ timeout: 8000 })
  })

  test('featured toggle: open edit modal, check "Feature on EPK" → save → toast success', async ({ page }) => {
    await page.goto('/admin/press-releases')
    await page.waitForLoadState('networkidle')

    const row = page.locator('tr').filter({ hasText: EDITED_TITLE })
    await row.getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // Toggle the "Feature on EPK" checkbox inside the form
    const featuredCheckbox = modal.locator('input[type="checkbox"]').first()
    await featuredCheckbox.click()

    await modal.getByRole('button', { name: /save|update/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 8000 })
  })

  test('delete: click Delete → ConfirmDialog → confirm → toast "Press release deleted"', async ({
    page,
  }) => {
    await page.goto('/admin/press-releases')
    await page.waitForLoadState('networkidle')

    const row = page.locator('tr').filter({ hasText: EDITED_TITLE })
    await row.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: /confirm|delete/i })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(/deleted/i, {
      timeout: 8000,
    })
    await expect(page.getByRole('cell', { name: EDITED_TITLE })).not.toBeVisible({ timeout: 8000 })
  })
})
