import { test, expect } from '@playwright/test'
import { expectToast, searchTable } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

const BAND_NAME = `E2E Band ${Date.now()}`
const BAND_NAME_UPDATED = `${BAND_NAME} Updated`

test.describe.serial('Admin Bands', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/bands')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with Bands heading visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Other Bands/i })).toBeVisible()
  })

  test('create band: fill name → save → toast "Band created" → row in table', async ({ page }) => {
    await page.getByRole('button', { name: /add band/i }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(page.locator('.modal-title')).toContainText('New band')

    await page.locator('input[placeholder="Band name"]').fill(BAND_NAME)
    await page.getByRole('button', { name: /Create/i }).click()

    await expectToast(page, 'Band created')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
    await expect(page.getByRole('cell', { name: BAND_NAME })).toBeVisible()
  })

  test('search: type band name → row visible', async ({ page }) => {
    await searchTable(page, BAND_NAME)
    await expect(page.getByRole('cell', { name: BAND_NAME })).toBeVisible()
  })

  test('edit: click Edit → change name → save → toast "Band updated"', async ({ page }) => {
    await searchTable(page, BAND_NAME)

    const row = page.locator('tr').filter({ hasText: BAND_NAME })
    await row.getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(page.locator('.modal-title')).toContainText('Edit band')

    const nameInput = page.locator('input[placeholder="Band name"]')
    await nameInput.clear()
    await nameInput.fill(BAND_NAME_UPDATED)
    await page.getByRole('button', { name: /Update/i }).click()

    await expectToast(page, 'Band updated')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
    await expect(page.getByRole('cell', { name: BAND_NAME_UPDATED })).toBeVisible()
  })

  test('delete: click Delete → ConfirmDialog → Delete → toast "Band deleted"', async ({ page }) => {
    await searchTable(page, BAND_NAME_UPDATED)

    const row = page.locator('tr').filter({ hasText: BAND_NAME_UPDATED })
    await row.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Confirm deletion')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).last().click()

    await expectToast(page, 'Band deleted')
    await expect(page.getByRole('cell', { name: BAND_NAME_UPDATED })).not.toBeVisible()
  })

  test('modal X close works', async ({ page }) => {
    await page.getByRole('button', { name: /add band/i }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    await page.locator('button[aria-label="Close"]').click()
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('validation: empty name → HTML5 required prevents submit', async ({ page }) => {
    await page.getByRole('button', { name: /add band/i }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    const nameInput = page.locator('input[placeholder="Band name"]')
    await nameInput.fill('')
    await page.getByRole('button', { name: /Create/i }).click()

    // HTML5 required validation keeps modal open and no toast fires
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(page.locator('[data-sonner-toast]')).not.toBeVisible()
  })
})
