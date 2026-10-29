import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe.serial('Admin Authors', () => {
  const stamp = Date.now()
  const firstName = 'E2E'
  const lastName = `Author ${stamp}`
  // The table shows the two stored halves joined, so this is what a row reads.
  const authorName = `${firstName} ${lastName}`
  const authorEmail = `e2e-author-${stamp}@example.com`
  const updatedLastName = `${lastName} Updated`
  const updatedName = `${firstName} ${updatedLastName}`

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/authors')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with Authors heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Authors & Contacts' })).toBeVisible()
  })

  test('create author: fill first name, last name and email → toast "Author added" and row appears', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add author' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: 'Add author / contact' })).toBeVisible()

    await modal.getByLabel('First name').fill(firstName)
    await modal.getByLabel('Last name').fill(lastName)
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

  test('edit author: both halves load back, changing the last name → toast "Author updated"', async ({ page }) => {
    await page.locator('input[aria-label="Search"]').fill(authorName)

    const row = page.locator('tr').filter({ hasText: authorName })
    await row.getByRole('button', { name: 'Edit' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: 'Edit author / contact' })).toBeVisible()

    await expect(modal.getByLabel('First name')).toHaveValue(firstName)
    const lastNameInput = modal.getByLabel('Last name')
    await expect(lastNameInput).toHaveValue(lastName)
    await lastNameInput.fill(updatedLastName)

    await modal.getByRole('button', { name: 'Save' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Author updated', { timeout: 10000 })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: updatedName })).toBeVisible({ timeout: 8000 })
  })

  test('form layout: no stray markup, details · social · relations in three columns', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add author' }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // An i18n-ignore comment inside the phone inputs' attribute lists once
    // leaked into the page as a literal "/>" after each of them.
    await expect(modal.locator('form')).not.toContainText('/>')

    const notesBox     = await modal.getByPlaceholder('Additional context about this contact…').boundingBox()
    const socialBox    = await modal.locator('.social-links-editor').boundingBox()
    const relationsBox = await modal.locator('.assoc-section').first().boundingBox()
    expect(notesBox!.x + notesBox!.width).toBeLessThanOrEqual(socialBox!.x)
    expect(socialBox!.x + socialBox!.width).toBeLessThanOrEqual(relationsBox!.x)
  })

  test('country and contact language: pick, save, reopen → both persisted', async ({ page }) => {
    await page.locator('input[aria-label="Search"]').fill(updatedName)
    await page.locator('tr').filter({ hasText: updatedName }).getByRole('button', { name: 'Edit' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal.getByLabel('Last name')).toHaveValue(updatedLastName)

    const country  = modal.getByLabel('Country')
    const language = modal.getByLabel('Preferred contact language')
    // The full list's length is contactCodes.spec.ts's job; here, that it is populated.
    await expect(country.locator('option[value=""]')).toHaveText('Not set')
    expect(await country.locator('option').count()).toBeGreaterThan(200)
    await country.selectOption('DE')
    await language.selectOption('de')
    await expect(country.locator('option:checked')).toHaveText('Germany')
    await expect(language.locator('option:checked')).toHaveText('German')

    await modal.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Author updated', { timeout: 10000 })
    await expect(modal).not.toBeVisible()

    await page.locator('tr').filter({ hasText: updatedName }).getByRole('button', { name: 'Edit' }).click()
    await expect(modal.getByLabel('Country')).toHaveValue('DE', { timeout: 8000 })
    await expect(modal.getByLabel('Preferred contact language')).toHaveValue('de')
  })

  test('table: shows country and language, and filters by them', async ({ page }) => {
    const search = page.locator('input[aria-label="Search"]')
    const row    = page.locator('tr').filter({ hasText: updatedName })
    const countryCells  = page.getByTestId('author-country')
    const languageCells = page.getByTestId('author-language')

    await search.fill(updatedName)
    await expect(row.getByTestId('author-country')).toHaveText('Germany', { timeout: 8000 })
    await expect(row.getByTestId('author-language')).toHaveText('German')
    await search.fill('')

    // Filters narrow the whole table, not just a searched row.
    const countryFilter  = page.getByRole('combobox', { name: 'Filter by country' })
    const languageFilter = page.getByRole('combobox', { name: 'Filter by language' })
    await countryFilter.selectOption('DE')
    await expect(countryCells.first()).toBeVisible()
    await expect(countryCells.filter({ hasNotText: 'Germany' })).toHaveCount(0)

    await languageFilter.selectOption('de')
    await expect(languageCells.filter({ hasNotText: 'German' })).toHaveCount(0)

    // …and combine with search, so the contact is reachable whatever the page size.
    await search.fill(updatedName)
    await expect(row).toBeVisible()
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

  test('validation: submit with empty first name → browser required error, last name optional', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add author' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.getByRole('button', { name: 'Save' }).click()

    const firstNameInput = modal.getByLabel('First name')
    const validationMessage = await firstNameInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    expect(validationMessage).not.toBe('')
    expect(await modal.getByLabel('Last name').evaluate((el: HTMLInputElement) => el.required)).toBe(false)
  })

  test('validation: invalid email format → browser type error', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add author' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.getByLabel('First name').fill('Test Author Validation')
    await modal.getByPlaceholder('jane@example.com').fill('not-an-email')

    await modal.getByRole('button', { name: 'Save' }).click()

    const emailInput = modal.getByPlaceholder('jane@example.com')
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage)
    expect(validationMessage).not.toBe('')
  })
})
