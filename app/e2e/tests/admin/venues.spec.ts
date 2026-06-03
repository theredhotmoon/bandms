import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe.serial('Admin Venues', () => {
  const venueName = `E2E Venue ${Date.now()}`
  const updatedName = `${venueName} Updated`

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/venues')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with Venues heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Venues' })).toBeVisible()
  })

  test('create venue', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add venue' }).click()

    await expect(page.getByRole('heading', { name: 'New venue' })).toBeVisible()

    await page.getByPlaceholder('Venue name').fill(venueName)
    await page.getByPlaceholder('Kraków').fill('Warsaw')

    await page.getByRole('button', { name: 'Create' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Venue created', { timeout: 10000 })
    await expect(page.getByRole('cell', { name: venueName })).toBeVisible()
  })

  test('search shows venue row', async ({ page }) => {
    await page.locator('input[aria-label="Search"]').fill(venueName)
    await expect(page.getByRole('cell', { name: venueName })).toBeVisible()
  })

  test('edit venue', async ({ page }) => {
    await page.locator('input[aria-label="Search"]').fill(venueName)

    const row = page.locator('tr').filter({ hasText: venueName })
    await row.getByRole('button', { name: 'Edit' }).click()

    await expect(page.getByRole('heading', { name: 'Edit venue' })).toBeVisible()

    const nameInput = page.getByPlaceholder('Venue name')
    await nameInput.clear()
    await nameInput.fill(updatedName)

    await page.getByRole('button', { name: 'Update' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Venue updated', { timeout: 10000 })
    await expect(page.getByRole('cell', { name: updatedName })).toBeVisible()
  })

  test('delete venue', async ({ page }) => {
    await page.locator('input[aria-label="Search"]').fill(updatedName)

    const row = page.locator('tr').filter({ hasText: updatedName })
    await row.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('heading', { name: 'Confirm deletion' })).toBeVisible()

    await page.getByRole('button', { name: 'Delete' }).last().click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Venue deleted', { timeout: 10000 })
    await expect(page.getByRole('cell', { name: updatedName })).not.toBeVisible()
  })

  test('modal close button dismisses modal', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add venue' }).click()

    await expect(page.getByRole('heading', { name: 'New venue' })).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).click()

    await expect(page.getByRole('heading', { name: 'New venue' })).not.toBeVisible()
  })

  test('validation shows error on empty name', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add venue' }).click()

    await expect(page.getByRole('heading', { name: 'New venue' })).toBeVisible()

    await page.getByRole('button', { name: 'Create' }).click()

    const nameInput = page.getByPlaceholder('Venue name')
    await expect(nameInput).toBeFocused()

    const validationMessage = await nameInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage,
    )
    expect(validationMessage).not.toBe('')
  })
})
