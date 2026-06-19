import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const UNIQUE_TOUR = `e2e-tour-${Date.now()}`
let editedTourName = `${UNIQUE_TOUR}-edited`

test.describe('Tours Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads and shows "Tours" heading', async ({ page }) => {
    await page.goto('/admin/tours')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1')).toContainText('Tours')
  })

  test('create tour: fill name, dates → save → toast "Tour created" and row appears', async ({ page }) => {
    await page.goto('/admin/tours')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add tour' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal
      .locator('input[placeholder*="Skanking Tour" i]')
      .first()
      .fill(UNIQUE_TOUR)

    const startDateInput = modal
      .locator('input[name="start_date"], input[id="start_date"], input[type="date"]')
      .first()
    await startDateInput.fill('2026-07-01')

    const endDateInput = modal
      .locator('input[name="end_date"], input[id="end_date"], input[type="date"]')
      .nth(1)
    await endDateInput.fill('2026-07-31')

    await modal.getByRole('button', { name: /save|create/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Tour created', { timeout: 8000 })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: UNIQUE_TOUR })).toBeVisible({ timeout: 8000 })
  })

  test('created tour row appears in table', async ({ page }) => {
    await page.goto('/admin/tours')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('cell', { name: UNIQUE_TOUR })).toBeVisible({ timeout: 8000 })
  })

  test('edit tour: change name → save → toast "Tour updated"', async ({ page }) => {
    await page.goto('/admin/tours')
    await page.waitForLoadState('networkidle')

    const row = page.locator('tr').filter({ hasText: UNIQUE_TOUR })
    await row.getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const nameInput = modal
      .locator('input[placeholder*="Skanking Tour" i]')
      .first()
    await nameInput.clear()
    await nameInput.fill(editedTourName)

    await modal.getByRole('button', { name: /save|update/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Tour updated', { timeout: 8000 })
    await expect(modal).not.toBeVisible()
  })

  test('delete tour: confirm dialog appears, confirm delete → toast "Tour deleted" and row gone', async ({ page }) => {
    await page.goto('/admin/tours')
    await page.waitForLoadState('networkidle')

    const row = page.locator('tr').filter({ hasText: editedTourName })
    await row.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Tour deleted', { timeout: 8000 })
    await expect(page.getByRole('cell', { name: editedTourName })).not.toBeVisible({ timeout: 8000 })
  })

  test('modal: open then click X close button → modal closes', async ({ page }) => {
    await page.goto('/admin/tours')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add tour' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('button[aria-label="Close"], button.close, button:has(svg)').first().click()

    await expect(modal).not.toBeVisible()
  })

  test('validation: submit empty name → error message shown', async ({ page }) => {
    await page.goto('/admin/tours')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add tour' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.getByRole('button', { name: /save|create/i }).click()

    // name input has required — browser HTML5 validation fires, not a DOM error element
    const nameInput = modal.locator('input[required]').first()
    const isInvalid = await nameInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBe(true)
  })
})
