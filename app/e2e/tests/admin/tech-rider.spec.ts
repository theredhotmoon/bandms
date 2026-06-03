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

  test('create tech rider: fill name → save → toast "Tech rider created", row appears', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New tech rider' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal
      .locator('input[name="name"], input[id="name"], input[placeholder*="name" i]')
      .first()
      .fill(UNIQUE_NAME)

    await modal.getByRole('button', { name: /save|create/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(/tech rider created/i, {
      timeout: 8000,
    })
    await expect(modal).not.toBeVisible()

    await expect(
      page.locator('tr, [data-row], li').filter({ hasText: UNIQUE_NAME }).first(),
    ).toBeVisible({ timeout: 8000 })
  })

  test('activate: click "Activate" on a rider → toast "activated" (or similar), rider shows as active', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tr, [data-row], li')
      .filter({ hasText: UNIQUE_NAME })
      .first()

    const activateBtn = row.getByRole('button', { name: /activate/i })
    await activateBtn.click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(/activated/i, {
      timeout: 8000,
    })

    await page.waitForLoadState('networkidle')

    const updatedRow = page
      .locator('tr, [data-row], li')
      .filter({ hasText: UNIQUE_NAME })
      .first()

    await expect(
      updatedRow.locator(
        '[class*="active"], [data-active], .badge, span, td',
      ).filter({ hasText: /active/i }).first(),
    ).toBeVisible({ timeout: 8000 })
  })

  test('delete: click Delete → ConfirmDialog → Delete → toast "Tech rider deleted"', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tr, [data-row], li')
      .filter({ hasText: UNIQUE_NAME })
      .first()

    await row.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: /confirm|delete/i })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(/tech rider deleted/i, {
      timeout: 8000,
    })

    await expect(
      page.locator('tr, [data-row], li').filter({ hasText: UNIQUE_NAME }).first(),
    ).not.toBeVisible({ timeout: 8000 })
  })

  test('modal X close button closes the modal', async ({ page }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ New tech rider' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('button[aria-label="Close"], button.close, button:has(svg)').first().click()

    await expect(modal).not.toBeVisible()
  })
})
