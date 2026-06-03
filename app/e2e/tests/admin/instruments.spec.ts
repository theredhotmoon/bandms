import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const UNIQUE_INSTRUMENT = `e2e-instrument-${Date.now()}`
let editedInstrumentName = `${UNIQUE_INSTRUMENT}-edited`

test.describe('Instruments Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads and "Instruments" heading is visible', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /instruments/i })).toBeVisible()
  })

  test('create instrument: modal opens, fill name and category, save → toast and row appear', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New instrument' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('input[name="name"], input[id="name"], input[placeholder*="name" i]').first().fill(UNIQUE_INSTRUMENT)

    const categoryField = modal.locator('select[name="category"], select[id="category"], input[name="category"], input[id="category"]').first()
    const tagName = await categoryField.evaluate((el) => el.tagName.toLowerCase())
    if (tagName === 'select') {
      await categoryField.selectOption('strings')
    } else {
      await categoryField.fill('strings')
    }

    await modal.getByRole('button', { name: /save|create/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Instrument created', { timeout: 8000 })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: UNIQUE_INSTRUMENT })).toBeVisible({ timeout: 8000 })
  })

  test('search: type instrument name → matching row is shown', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(UNIQUE_INSTRUMENT)

    await expect(page.getByRole('cell', { name: UNIQUE_INSTRUMENT })).toBeVisible({ timeout: 8000 })
  })

  test('edit instrument: modal opens, change name, save → toast "Instrument updated"', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(UNIQUE_INSTRUMENT)

    const row = page.locator('tr').filter({ hasText: UNIQUE_INSTRUMENT })
    await row.getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const nameInput = modal.locator('input[name="name"], input[id="name"], input[placeholder*="name" i]').first()
    await nameInput.clear()
    await nameInput.fill(editedInstrumentName)

    await modal.getByRole('button', { name: /save|update/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Instrument updated', { timeout: 8000 })
    await expect(modal).not.toBeVisible()
  })

  test('delete instrument: confirm dialog appears, confirm delete → toast and row gone', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(editedInstrumentName)

    const row = page.locator('tr').filter({ hasText: editedInstrumentName })
    await row.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Instrument deleted', { timeout: 8000 })
    await expect(page.getByRole('cell', { name: editedInstrumentName })).not.toBeVisible({ timeout: 8000 })
  })

  test('modal: open modal then click X close button → modal closes', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New instrument' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('button[aria-label="Close"], button.close, button:has(svg)').first().click()

    await expect(modal).not.toBeVisible()
  })

  test('validation: submit empty name → error message shown', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New instrument' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.getByRole('button', { name: /save|create/i }).click()

    const errorMessage = modal.locator(
      '[class*="error"], [class*="invalid"], .text-red-500, [role="alert"]',
    )
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 })
  })
})
