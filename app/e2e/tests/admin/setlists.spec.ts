import { test, expect } from '@playwright/test'
import { expectToast, openModal, confirmDelete, searchTable } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

const SETLIST_NAME = `E2E Setlist ${Date.now()}`
const SETLIST_NAME_UPDATED = `${SETLIST_NAME} Updated`

// ---------------------------------------------------------------------------
// Read-only / isolated
// ---------------------------------------------------------------------------

test.describe('Admin Setlists — read-only', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/setlists')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with "Setlists" heading visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Setlists' })).toBeVisible()
  })

  test('setlist.fm import button or section is visible on the page', async ({ page }) => {
    const importTrigger = page
      .getByRole('button', { name: /setlist\.fm|import/i })
      .or(page.locator('button').filter({ hasText: /setlist\.fm/i }))
      .or(page.locator('[data-testid="setlistfm-import"]'))
      .or(page.getByText(/setlist\.fm/i).first())

    await expect(importTrigger.first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Serial CRUD flow
// ---------------------------------------------------------------------------

test.describe.serial('Admin Setlists — CRUD flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/setlists')
    await page.waitForLoadState('networkidle')
  })

  // -------------------------------------------------------------------------
  // 1. Create
  // -------------------------------------------------------------------------
  test('create setlist: click "+ New setlist" → fill name → Save → toast "Setlist created"', async ({
    page,
  }) => {
    await openModal(page, '+ New setlist')

    await expect(page.locator('.modal-overlay')).toBeVisible()

    const nameInput = page
      .locator('.modal-overlay')
      .locator('input[name="name"], input[id="name"], input[placeholder*="name" i]')
      .first()
    await nameInput.fill(SETLIST_NAME)

    await page.locator('.modal-overlay').getByRole('button', { name: /save|create/i }).click()

    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 8000 })
    await expectToast(page, 'Setlist created')

    await expect(
      page.locator('tbody tr').filter({ hasText: SETLIST_NAME }).first(),
    ).toBeVisible({ timeout: 8000 })
  })

  // -------------------------------------------------------------------------
  // 2. Edit
  // -------------------------------------------------------------------------
  test('edit: click Edit on setlist → change name → Save → toast "Setlist updated"', async ({
    page,
  }) => {
    await searchTable(page, SETLIST_NAME)

    const row = page.locator('tbody tr').filter({ hasText: SETLIST_NAME }).first()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /edit/i }).click()

    await expect(page.locator('.modal-overlay')).toBeVisible()

    const nameInput = page
      .locator('.modal-overlay')
      .locator('input[name="name"], input[id="name"], input[placeholder*="name" i]')
      .first()
    await nameInput.clear()
    await nameInput.fill(SETLIST_NAME_UPDATED)

    await page.locator('.modal-overlay').getByRole('button', { name: /save|update/i }).click()

    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 8000 })
    await expectToast(page, 'Setlist updated')

    await searchTable(page, SETLIST_NAME_UPDATED)
    await expect(
      page.locator('tbody tr').filter({ hasText: SETLIST_NAME_UPDATED }).first(),
    ).toBeVisible({ timeout: 8000 })
  })

  // -------------------------------------------------------------------------
  // 3. Delete
  // -------------------------------------------------------------------------
  test('delete: click Delete → ConfirmDialog → Delete → toast "Setlist deleted"', async ({
    page,
  }) => {
    await searchTable(page, SETLIST_NAME_UPDATED)

    const row = page.locator('tbody tr').filter({ hasText: SETLIST_NAME_UPDATED }).first()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /delete/i }).click()

    await confirmDelete(page)

    await expectToast(page, 'Setlist deleted')

    await expect(
      page.locator('tbody tr').filter({ hasText: SETLIST_NAME_UPDATED }),
    ).toHaveCount(0, { timeout: 8000 })
  })

  // -------------------------------------------------------------------------
  // 4. Modal X close
  // -------------------------------------------------------------------------
  test('modal X close works', async ({ page }) => {
    await openModal(page, '+ New setlist')

    await expect(page.locator('.modal-overlay')).toBeVisible()

    await page
      .locator('.modal-overlay')
      .locator('button[aria-label="Close"], button.close, button:has(svg)')
      .first()
      .click()

    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Role guard
// ---------------------------------------------------------------------------

test.describe('Admin Setlists — role guard', () => {
  test('non-admin (member) role is redirected to /admin when accessing /admin/setlists', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.evaluate(([token, user]) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', user)
    }, [
      'fake-member-token',
      JSON.stringify({ role: 'member', first_name: 'Test', email: 'member@bandms.test' }),
    ])

    await page.goto('/admin/setlists')
    await expect(page).toHaveURL(/\/admin$/, { timeout: 5000 })
  })
})
