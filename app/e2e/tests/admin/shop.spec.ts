import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const ITEM_NAME = `e2e-shop-item-${Date.now()}`
const CAT_NAME  = `e2e-cat-${Date.now()}`
let editedItemName = `${ITEM_NAME}-edited`

test.describe('Shop Admin', () => {
  test.describe.configure({ mode: 'serial' })

  // ── Page loads ─────────────────────────────────────────────────────────────

  test('page loads and shows shop header', async ({ page }) => {
    await page.goto('/admin/shop')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /shop/i })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Add item' })).toBeVisible()
    await expect(page.getByRole('button', { name: /categories/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /currencies/i })).toBeVisible()
  })

  // ── Currency setup (required before items can have prices) ─────────────────

  test('currencies: open modal, add USD, save', async ({ page }) => {
    await page.goto('/admin/shop')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /currencies/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const currencyInput = modal.locator('input[placeholder="USD"]')
    await currencyInput.fill('USD')
    await modal.getByRole('button', { name: 'Add' }).click()

    await expect(modal.locator('.currency-chip').filter({ hasText: 'USD' })).toBeVisible()

    await modal.getByRole('button', { name: 'Save' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Currencies saved', { timeout: 8000 })
    await expect(modal).not.toBeVisible()
  })

  // ── Categories CRUD ─────────────────────────────────────────────────────────

  test('categories: open modal and shows empty state or list', async ({ page }) => {
    await page.goto('/admin/shop')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /categories/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: /shop categories/i })).toBeVisible()
  })

  test('categories: create a new category', async ({ page }) => {
    await page.goto('/admin/shop')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /categories/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const nameInput = modal.locator('input[placeholder*="Limited Editions" i], input[placeholder*="name" i]').first()
    await nameInput.fill(CAT_NAME)

    await modal.getByRole('button', { name: /^create$/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Category created', { timeout: 8000 })
    await expect(modal.locator('.cat-name').filter({ hasText: CAT_NAME })).toBeVisible({ timeout: 8000 })
  })

  test('categories: delete the category', async ({ page }) => {
    await page.goto('/admin/shop')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /categories/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const catRow = modal.locator('.cat-row').filter({ hasText: CAT_NAME })
    await catRow.locator('.cat-del').click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Category deleted', { timeout: 8000 })
    await expect(catRow).not.toBeVisible({ timeout: 8000 })
  })

  // ── Shop item CRUD ─────────────────────────────────────────────────────────

  test('create item: modal opens, fill name + price, save → toast and row appear', async ({ page }) => {
    await page.goto('/admin/shop')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add item' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText('New shop item')

    await modal.locator('input[placeholder*="Debut LP" i], input[placeholder*="name" i]').first().fill(ITEM_NAME)

    // Fill price for USD
    const priceInput = modal.locator('input[placeholder*="Amount in USD" i]')
    await expect(priceInput).toBeVisible()
    await priceInput.fill('19.99')

    await modal.getByRole('button', { name: /create item/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Item created', { timeout: 8000 })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: ITEM_NAME })).toBeVisible({ timeout: 8000 })
  })

  test('search: type item name → matching row shown', async ({ page }) => {
    await page.goto('/admin/shop')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(ITEM_NAME)

    await expect(page.getByRole('cell', { name: ITEM_NAME })).toBeVisible({ timeout: 8000 })
  })

  test('edit item: modal opens with current name, change name, save → toast', async ({ page }) => {
    await page.goto('/admin/shop')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(ITEM_NAME)

    const row = page.locator('tr').filter({ hasText: ITEM_NAME })
    await row.getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const nameInput = modal.locator('input[placeholder*="Debut LP" i], input[placeholder*="name" i]').first()
    await nameInput.clear()
    await nameInput.fill(editedItemName)

    await modal.getByRole('button', { name: /save changes/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Item updated', { timeout: 8000 })
    await expect(modal).not.toBeVisible()
  })

  test('delete item: confirm dialog → confirm delete → toast and row gone', async ({ page }) => {
    await page.goto('/admin/shop')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(editedItemName)

    const row = page.locator('tr').filter({ hasText: editedItemName })
    await row.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Item deleted', { timeout: 8000 })
    await expect(page.getByRole('cell', { name: editedItemName })).not.toBeVisible({ timeout: 8000 })
  })

  // ── Modal close ────────────────────────────────────────────────────────────

  test('modal: open create modal then close with X → modal closes', async ({ page }) => {
    await page.goto('/admin/shop')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add item' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('button[aria-label="Close"], button.close, button:has(svg)').first().click()

    await expect(modal).not.toBeVisible()
  })

  // ── Validation ─────────────────────────────────────────────────────────────

  test('validation: submit empty name → error shown', async ({ page }) => {
    await page.goto('/admin/shop')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add item' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.getByRole('button', { name: /create item/i }).click()

    const errorMessage = modal.locator('[class*="error"], [class*="invalid"], .field-error, [role="alert"]')
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 })
  })
})
