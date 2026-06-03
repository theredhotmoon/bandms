import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe.serial('Admin Authors', () => {
  const authorName = `E2E Author ${Date.now()}`
  const authorEmail = `e2e-author-${Date.now()}@example.com`
  const updatedName = `${authorName} Updated`

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/authors')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with Authors heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Authors & Contacts' })).toBeVisible()
  })

  test('create author: fill name and email → toast "Author added" and row appears', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add author' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: 'Add author / contact' })).toBeVisible()

    await modal.getByPlaceholder('Jane Smith').fill(authorName)
    await modal.getByPlaceholder('jane@example.com').fill(authorEmail)

    await modal.getByRole('button', { name: 'Save' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Author added', { timeout: 10000 })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: authorName })).toBeVisible({ timeout: 8000 })
  })

  test('search: type author name → matching row is shown', async ({ page }) => {
    await page.locator('input[aria-label="Search"]').fill(authorName)

    await expect(page.getByRole('cell', { name: authorName })).toBeVisible({ timeout: 8000 })
  })

  test('edit author: change name → toast "Author updated"', async ({ page }) => {
    await page.locator('input[aria-label="Search"]').fill(authorName)

    const row = page.locator('tr').filter({ hasText: authorName })
    await row.getByRole('button', { name: 'Edit' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: 'Edit author / contact' })).toBeVisible()

    const nameInput = modal.getByPlaceholder('Jane Smith')
    await nameInput.clear()
    await nameInput.fill(updatedName)

    await modal.getByRole('button', { name: 'Save' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Author updated', { timeout: 10000 })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: updatedName })).toBeVisible({ timeout: 8000 })
  })

  test('delete author: ConfirmDialog appears → confirm → toast "Author deleted" and row gone', async ({ page }) => {
    await page.locator('input[aria-label="Search"]').fill(updatedName)

    const row = page.locator('tr').filter({ hasText: updatedName })
    await row.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('heading', { name: 'Confirm deletion' })).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: 'Delete' }).last().click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Author deleted', { timeout: 10000 })
    await expect(page.getByRole('cell', { name: updatedName })).not.toBeVisible({ timeout: 8000 })
  })

  test('modal X close button dismisses modal', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add author' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.getByRole('button', { name: 'Close' }).click()

    await expect(modal).not.toBeVisible()
  })

  test('validation: submit with empty name → browser required error', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add author' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.getByRole('button', { name: 'Save' }).click()

    const nameInput = modal.getByPlaceholder('Jane Smith')
    const validationMessage = await nameInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    expect(validationMessage).not.toBe('')
  })

  test('validation: invalid email format → browser type error', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add author' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.getByPlaceholder('Jane Smith').fill('Test Author Validation')
    await modal.getByPlaceholder('jane@example.com').fill('not-an-email')

    await modal.getByRole('button', { name: 'Save' }).click()

    const emailInput = modal.getByPlaceholder('jane@example.com')
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    expect(validationMessage).not.toBe('')
  })
})
