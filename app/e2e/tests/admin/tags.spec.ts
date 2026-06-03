import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const UNIQUE_TAG = `e2e-tag-${Date.now()}`
let editedTagName = `${UNIQUE_TAG}-edited`

test.describe('Tags Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads and shows tags table or empty state', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    const hasTable = await page.locator('table').isVisible().catch(() => false)
    const hasEmptyState = await page
      .getByText(/no tags/i)
      .isVisible()
      .catch(() => false)

    expect(hasTable || hasEmptyState).toBe(true)
  })

  test('create tag: modal opens, fill name, save → toast and row appear', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New tag' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('input[name="name"], input[id="name"], input[placeholder*="name" i]').first().fill(UNIQUE_TAG)

    await modal.getByRole('button', { name: /save|create/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Tag created', { timeout: 8000 })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: UNIQUE_TAG })).toBeVisible({ timeout: 8000 })
  })

  test('search: type tag name → matching row is shown', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(UNIQUE_TAG)

    await expect(page.getByRole('cell', { name: UNIQUE_TAG })).toBeVisible({ timeout: 8000 })
  })

  test('edit tag: modal opens with "Edit Tag" title, change name, save → toast', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(UNIQUE_TAG)

    const row = page.locator('tr').filter({ hasText: UNIQUE_TAG })
    await row.getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('Edit Tag')

    const nameInput = modal.locator('input[name="name"], input[id="name"], input[placeholder*="name" i]').first()
    await nameInput.clear()
    await nameInput.fill(editedTagName)

    await modal.getByRole('button', { name: /save|update/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Tag updated', { timeout: 8000 })
    await expect(modal).not.toBeVisible()
  })

  test('delete tag: confirm dialog appears, confirm delete → toast and row gone', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(editedTagName)

    const row = page.locator('tr').filter({ hasText: editedTagName })
    await row.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Tag deleted', { timeout: 8000 })
    await expect(page.getByRole('cell', { name: editedTagName })).not.toBeVisible({ timeout: 8000 })
  })

  test('modal: open modal then click X close button → modal closes', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New tag' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('button[aria-label="Close"], button.close, button:has(svg)').first().click()

    await expect(modal).not.toBeVisible()
  })

  test('validation: submit empty name → error message shown', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New tag' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.getByRole('button', { name: /save|create/i }).click()

    const errorMessage = modal.locator(
      '[class*="error"], [class*="invalid"], .text-red-500, [role="alert"]',
    )
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 })
  })
})
