import { test, expect } from '@playwright/test'
import { expectToast, closeModal, confirmDelete } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

const FIRST_NAME = `E2E${Date.now()}`
const LAST_NAME = 'Testmember'
const EMAIL = `e2e${Date.now()}@bandms.test`
const ROLE_INITIAL = 'Lead Vocals'
const ROLE_UPDATED = 'Rhythm Guitar'

test.describe.serial('Admin Band Members', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/band-members')
    await page.waitForLoadState('networkidle')
  })

  // ---------------------------------------------------------------------------
  // 1. Page load
  // ---------------------------------------------------------------------------
  test('page loads with "Band Members" heading visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /band members/i })).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // 2. Create member
  //    UI: sidebar "+" button → AdminModal with BandMemberForm
  // ---------------------------------------------------------------------------
  test('create member: fill required fields → save → toast → member appears', async ({ page }) => {
    await page.locator('button.btn-new').click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    const modal = page.locator('.modal-overlay')

    // first_name — placeholder "Jane"
    await modal.locator('input[placeholder="Jane"]').fill(FIRST_NAME)

    // last_name — placeholder "Smith"
    await modal.locator('input[placeholder="Smith"]').fill(LAST_NAME)

    // email — required; placeholder "member@example.com"
    await modal.locator('input[placeholder="member@example.com"]').fill(EMAIL)

    // role — optional; placeholder "Vocalist, Guitarist…"
    const roleInput = modal.locator('input[placeholder*="Vocalist"]')
    if (await roleInput.isVisible().catch(() => false)) {
      await roleInput.fill(ROLE_INITIAL)
    }

    await modal.getByRole('button', { name: 'Add member' }).click()

    await expect(modal).not.toBeVisible({ timeout: 8000 })
    await expectToast(page, /member added/i)

    // Member should appear as a sidebar item
    await expect(
      page.locator('.member-item').filter({ hasText: FIRST_NAME }),
    ).toBeVisible({ timeout: 8000 })
  })

  // ---------------------------------------------------------------------------
  // 3. Edit member
  //    UI: click sidebar item → detail pane opens with BandMemberForm inline
  // ---------------------------------------------------------------------------
  test('edit member: click sidebar item → change role → save → toast success', async ({ page }) => {
    // Wait for the query to resolve (member-list only appears when query succeeds)
    await expect(page.locator('.member-list')).toBeVisible({ timeout: 20000 })
    const memberItem = page.locator('.member-item').filter({ hasText: FIRST_NAME })
    await expect(memberItem).toBeVisible({ timeout: 10000 })
    await memberItem.click()

    // Profile form is in the detail pane (not a modal)
    // Email is required but may not be pre-filled from the list API response
    const emailInput = page.locator('.tab-content').locator('input[placeholder="member@example.com"]')
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(EMAIL)
    }

    const roleInput = page.locator('.tab-content').locator('input[placeholder*="Vocalist"]')
    if (await roleInput.isVisible().catch(() => false)) {
      await roleInput.clear()
      await roleInput.fill(ROLE_UPDATED)
    }

    await page.locator('.tab-content').getByRole('button', { name: 'Update member' }).click()

    await expectToast(page, /member updated/i)
  })

  // ---------------------------------------------------------------------------
  // 4. Delete member
  //    UI: click sidebar item → "Remove" button in topbar → ConfirmDialog
  // ---------------------------------------------------------------------------
  test('delete member: click Remove → ConfirmDialog → Delete → toast "Member removed"', async ({
    page,
  }) => {
    await expect(page.locator('.member-list')).toBeVisible({ timeout: 20000 })
    const memberItem = page.locator('.member-item').filter({ hasText: FIRST_NAME })
    await expect(memberItem).toBeVisible({ timeout: 10000 })
    await memberItem.click()

    // "Remove" button lives in the detail-pane topbar
    await page.locator('button.btn-delete').click()

    await confirmDelete(page)

    await expectToast(page, /member removed/i)

    await expect(
      page.locator('.member-item').filter({ hasText: FIRST_NAME }),
    ).toHaveCount(0, { timeout: 8000 })
  })

  // ---------------------------------------------------------------------------
  // 5. Modal X close works
  // ---------------------------------------------------------------------------
  test('modal X close button closes modal without saving', async ({ page }) => {
    await page.locator('button.btn-new').click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    await closeModal(page)
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // 6. Validation: empty first_name
  // ---------------------------------------------------------------------------
  test('validation: empty first_name → error shown or modal stays open', async ({ page }) => {
    await page.locator('button.btn-new').click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // Fill last_name and email; leave first_name empty
    await modal.locator('input[placeholder="Smith"]').fill(LAST_NAME)
    await modal.locator('input[placeholder="member@example.com"]').fill(`empty-test-${Date.now()}@bandms.test`)

    const firstNameInput = modal.locator('input[placeholder="Jane"]')
    await firstNameInput.fill('')

    await modal.getByRole('button', { name: 'Add member' }).click()

    // Modal must remain open (browser required validation prevents submit)
    await expect(modal).toBeVisible()

    // Check HTML5 native validation state
    const inputInvalid = await firstNameInput
      .evaluate((el: HTMLInputElement) => !el.validity.valid)
      .catch(() => false)

    const inlineError = modal.locator('[class*="error"], [class*="invalid"], .field-error, [role="alert"]')
    const errorVisible = await inlineError.first().isVisible().catch(() => false)

    expect(errorVisible || inputInvalid).toBe(true)

    await modal.locator('button[aria-label="Close"]').click()
  })

  // ---------------------------------------------------------------------------
  // 7. is_current toggle defaults to active for new member
  // ---------------------------------------------------------------------------
  test('is_current toggle defaults to active when opening new member modal', async ({
    page,
  }) => {
    await page.locator('button.btn-new').click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // is_current is a toggle button with aria-pressed, not an input[type=checkbox]
    const isCurrentToggle = modal.locator('[aria-pressed]').first()
    const toggleVisible = await isCurrentToggle.isVisible().catch(() => false)
    if (toggleVisible) {
      await expect(isCurrentToggle).toHaveAttribute('aria-pressed', 'true')
    }

    await modal.locator('button[aria-label="Close"]').click()
  })
})
