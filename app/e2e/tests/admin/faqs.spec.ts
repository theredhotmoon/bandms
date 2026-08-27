import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const QUESTION_EN = `e2e-faq-${Date.now()}`
const QUESTION_PL = `${QUESTION_EN}-pl`
const EDITED_EN = `${QUESTION_EN}-edited`

test.describe('FAQ Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads with the contact subpage selected and its seeded questions', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'FAQ', exact: true })).toBeVisible()

    // The create_faqs_table migration seeds four Contact questions, so this
    // list is never empty on a migrated database.
    await expect(page.getByText('How far ahead should we book you?')).toBeVisible({ timeout: 8000 })
  })

  test('create: fills both locales and the row appears', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add question' }).click()

    await page.locator('#faq-q-en').fill(QUESTION_EN)
    await page.locator('#faq-q-pl').fill(QUESTION_PL)
    await page.locator('#faq-a-en').fill('An answer in English.')
    await page.locator('#faq-a-pl').fill('Odpowiedz po polsku.')

    await page.getByRole('button', { name: /^Save$/ }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Question added', { timeout: 8000 })
    await expect(page.getByText(QUESTION_EN, { exact: true })).toBeVisible({ timeout: 8000 })
  })

  test('edit: renaming the question updates the row', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    // Scope to the row card. A bare `div` filter also matches every ancestor
    // that contains the text, and .last() then lands on an inner text wrapper
    // that holds no buttons.
    const row = page.locator('div.rounded-xl').filter({ hasText: QUESTION_EN })
    await row.getByRole('button', { name: /^Edit question/ }).click()

    const input = page.locator('#faq-q-en')
    await expect(input).toHaveValue(QUESTION_EN)
    await input.fill(EDITED_EN)

    await page.getByRole('button', { name: /^Save$/ }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Question saved', { timeout: 8000 })
    await expect(page.getByText(EDITED_EN, { exact: true })).toBeVisible({ timeout: 8000 })
  })

  test('publish toggle flips the badge between Live and Draft', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    const row = page.locator('div.rounded-xl').filter({ hasText: EDITED_EN })
    const badge = row.getByRole('button', { name: /^(Live|Draft)$/ })

    await expect(badge).toHaveText('Live')
    await badge.click()
    await expect(badge).toHaveText('Draft', { timeout: 8000 })

    // Put it back so the delete test operates on a published row.
    await badge.click()
    await expect(badge).toHaveText('Live', { timeout: 8000 })
  })

  test('switching subpage tabs filters the list', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(EDITED_EN, { exact: true })).toBeVisible({ timeout: 8000 })

    // Any tab other than Contact. Concerts ships with no questions, so the
    // empty state is the assertion.
    const otherTab = page.getByRole('button', { name: /^Concerts/ })
    if (await otherTab.isVisible().catch(() => false)) {
      await otherTab.click()
      await expect(page.getByText(EDITED_EN, { exact: true })).not.toBeVisible()
    }
  })

  test('delete: confirming removes the row', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    page.on('dialog', (d) => d.accept())

    const row = page.locator('div.rounded-xl').filter({ hasText: EDITED_EN })
    await row.getByRole('button', { name: /^Delete question/ }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Question deleted', { timeout: 8000 })
    await expect(page.getByText(EDITED_EN, { exact: true })).not.toBeVisible({ timeout: 8000 })
  })

  test('is closed to non-admins', async ({ browser }) => {
    // newContext() alone inherits the admin storageState from test.use above,
    // so the session has to be cleared explicitly for this to mean anything.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()

    await page.goto('/admin/faqs')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })

    await ctx.close()
  })
})
