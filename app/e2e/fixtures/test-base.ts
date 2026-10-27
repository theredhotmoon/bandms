import { test as base, expect, type Page } from '@playwright/test'

// Re-export expect so spec files only need one import
export { expect }

// Helper: wait for toast with given text
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: text }))
    .toBeVisible({ timeout: 8000 })
}

// Helper: open modal by clicking a button, wait for it to appear
export async function openModal(page: Page, triggerText: string | RegExp) {
  await page.getByRole('button', { name: triggerText }).click()
  await expect(page.locator('.modal-overlay')).toBeVisible()
}

// Helper: close modal via X button
export async function closeModal(page: Page) {
  await page.locator('button[aria-label="Close"]').click()
  await expect(page.locator('.modal-overlay')).not.toBeVisible()
}

// Helper: confirm delete dialog
export async function confirmDelete(page: Page) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete' }).click()
}

// Helper: fill search and wait
export async function searchTable(page: Page, query: string) {
  const input = page.getByRole('searchbox').or(page.locator('input[aria-label="Search"]'))
  await input.fill(query)
  await page.waitForTimeout(300)
}

// Helper: set localStorage auth for fast auth bypass in tests that need a different role
export async function setAdminAuth(page: Page, role: 'admin' | 'member' = 'admin') {
  const token = process.env.E2E_ADMIN_TOKEN ?? 'test-token'
  const user = JSON.stringify({ role, first_name: 'Test', email: 'test@bandms.test' })
  await page.evaluate(([t, u]) => {
    localStorage.setItem('auth_token', t)
    localStorage.setItem('auth_user', u)
  }, [token, user])
}

export const test = base

/**
 * Fill what every post needs before it saves — an intro and at least one tag
 * (drafts included). The intro input that is `required` is the band's first
 * content language's, whichever that is; the first listed tag will do.
 */
export async function fillPostRequired(page: Page) {
  const modal = page.locator('.modal-overlay').first()
  const intro = modal.locator('textarea[required]').first()
  if (await intro.count()) await intro.fill('E2E intro')
  const tags = modal.getByTestId('relations-tags')
  if (!(await tags.locator('.checkbox-item').count())) await tags.locator('.assoc-toggle').click()
  const box = tags.locator('.checkbox-item input[type="checkbox"]').first()
  if (!(await box.isChecked())) await box.check()
}
