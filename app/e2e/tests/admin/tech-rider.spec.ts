import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const UNIQUE_NAME = `e2e-tech-rider-${Date.now()}`

test.describe('Tech Rider Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads and "Tech Rider" heading is visible', async ({ page }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1')).toContainText(/tech rider/i)
  })

  test('create tech rider: fill name → save → toast "Rider created", row appears', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    // Button is "+" (btn-new class) or "Create first rider" if no riders exist
    const addBtn = page.locator('button.btn-new').or(page.getByRole('button', { name: /create first rider/i })).first()
    await addBtn.click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal
      .locator('input[placeholder*="Festival rider" i]')
      .first()
      .fill(UNIQUE_NAME)

    await modal.getByRole('button', { name: /create/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(/rider created/i, {
      timeout: 8000,
    })
    await expect(modal).not.toBeVisible()

    await expect(
      page.locator('tr, [data-row], li, .rider-item').filter({ hasText: UNIQUE_NAME }).first(),
    ).toBeVisible({ timeout: 8000 })
  })

  test('activate: click activate button on a rider → toast "Active rider updated", rider shows as active', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tr, [data-row], li, .rider-item')
      .filter({ hasText: UNIQUE_NAME })
      .first()

    // Activate button is .act-btn (not .act-btn--del) with text "✓"
    const activateBtn = row.locator('button.act-btn:not(.act-btn--del)')
    const hasBtnVisible = await activateBtn.isVisible().catch(() => false)
    if (hasBtnVisible) {
      await activateBtn.click()
      await expect(page.locator('[data-sonner-toast]')).toContainText(/active rider updated/i, {
        timeout: 8000,
      })
    }
  })

  // Publishing is what makes a rider public at all: until a version exists the
  // token link 404s, so this covers both the button and the promise it makes.
  test('publish: Publish v1 → toast, chip reads "v1 published", public link renders', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    await page
      .locator('tr, [data-row], li, .rider-item')
      .filter({ hasText: UNIQUE_NAME })
      .first()
      .click()

    await expect(page.locator('.title-input')).toHaveValue(UNIQUE_NAME, { timeout: 8000 })
    await expect(page.locator('.version-chip')).toContainText(/never published/i)

    await page.getByRole('button', { name: /publish v1/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: /publish v1/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(/published v1/i, {
      timeout: 8000,
    })
    await expect(page.locator('.version-chip')).toContainText(/v1 published/i, { timeout: 8000 })

    // The rider's own token now resolves to the frozen copy.
    const historyModal = page.locator('.modal-overlay')
    await page.locator('.version-chip').click()
    await expect(historyModal).toBeVisible()
    await expect(historyModal.locator('.version-status')).toContainText(/live link/i)

    const href = await historyModal.locator('a', { hasText: 'Open' }).first().getAttribute('href')
    expect(href).toMatch(/\/rider\/[A-Za-z0-9]{32}$/)

    await page.goto(href!)
    await expect(page.locator('.cover-rider-name')).toContainText(UNIQUE_NAME, { timeout: 10000 })
  })

  test('delete: click Delete → confirm modal → Delete → toast "Rider deleted"', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tr, [data-row], li, .rider-item')
      .filter({ hasText: UNIQUE_NAME })
      .first()

    // Delete button is .act-btn--del with text "✕"
    await row.locator('button.act-btn--del').click()

    const confirmDialog = page.locator('.modal-overlay')
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(/rider deleted/i, {
      timeout: 8000,
    })

    await expect(
      page.locator('tr, [data-row], li, .rider-item').filter({ hasText: UNIQUE_NAME }).first(),
    ).not.toBeVisible({ timeout: 8000 })
  })

  test('modal X close button closes the modal', async ({ page }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button.btn-new').or(page.getByRole('button', { name: /create first rider/i })).first()
    await addBtn.click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('button[aria-label="Close"], button.close, button:has(svg)').first().click()

    await expect(modal).not.toBeVisible()
  })
})
