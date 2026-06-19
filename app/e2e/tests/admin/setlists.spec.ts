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
  // 1. Create (inline form — no modal)
  // -------------------------------------------------------------------------
  test('create setlist: click + → fill name → Create → toast "Setlist created"', async ({
    page,
  }) => {
    await page.locator('button.btn-new-icon').click()
    await expect(page.locator('.new-form')).toBeVisible()

    await page.locator('.new-form input').fill(SETLIST_NAME)
    await page.locator('.new-form button.btn-create').click()

    await expectToast(page, 'Setlist created')

    await expect(
      page.locator('.setlist-name').filter({ hasText: SETLIST_NAME }).first(),
    ).toBeVisible({ timeout: 8000 })
  })

  // -------------------------------------------------------------------------
  // 2. Delete
  // -------------------------------------------------------------------------
  test('delete: click ✕ on setlist → ConfirmDialog → Delete → toast "Setlist deleted"', async ({
    page,
  }) => {
    // Wait for the setlist list to finish loading before looking for the specific item
    await expect(page.locator('.setlist-items, .sidebar-state')).toBeVisible({ timeout: 15000 })
    const item = page.locator('.setlist-item').filter({ hasText: SETLIST_NAME }).first()
    await expect(item).toBeVisible({ timeout: 10000 })
    await item.locator('button.del-btn').click()

    await confirmDelete(page)

    await expectToast(page, 'Setlist deleted')

    await expect(
      page.locator('.setlist-name').filter({ hasText: SETLIST_NAME }),
    ).toHaveCount(0, { timeout: 8000 })
  })

  // -------------------------------------------------------------------------
  // 3. Inline form: Escape key closes the form
  // -------------------------------------------------------------------------
  test('inline form: Escape key closes the form', async ({ page }) => {
    await page.locator('button.btn-new-icon').click()
    await expect(page.locator('.new-form')).toBeVisible()
    // Click the input to ensure it has keyboard focus before pressing Escape
    await page.locator('.new-form input').click()
    await page.keyboard.press('Escape')
    await expect(page.locator('.new-form')).not.toBeVisible()
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
