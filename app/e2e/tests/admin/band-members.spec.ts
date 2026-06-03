import { test, expect } from '@playwright/test'
import { expectToast, openModal, closeModal, confirmDelete } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

const FIRST_NAME = `E2E${Date.now()}`
const LAST_NAME = 'Testmember'
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
  // ---------------------------------------------------------------------------
  test('create member: fill required fields → save → toast → member appears', async ({ page }) => {
    await openModal(page, /\+ new member/i)

    await expect(page.locator('.modal-overlay')).toBeVisible()

    // first_name
    const firstNameInput = page
      .locator('.modal-overlay')
      .locator('input[name="first_name"], input[id="first_name"], input[placeholder*="first" i]')
      .first()
    await firstNameInput.fill(FIRST_NAME)

    // last_name
    const lastNameInput = page
      .locator('.modal-overlay')
      .locator('input[name="last_name"], input[id="last_name"], input[placeholder*="last" i]')
      .first()
    await lastNameInput.fill(LAST_NAME)

    // role
    const roleInput = page
      .locator('.modal-overlay')
      .locator('input[name="role"], input[id="role"], input[placeholder*="role" i]')
      .first()
    const roleVisible = await roleInput.isVisible().catch(() => false)
    if (roleVisible) {
      await roleInput.fill(ROLE_INITIAL)
    }

    await page.locator('.modal-overlay').getByRole('button', { name: /save|create/i }).click()

    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 8000 })
    await expectToast(page, /member created/i)

    // Member row should be visible
    await expect(
      page.locator('tr, [data-testid="member-card"], li').filter({ hasText: FIRST_NAME }),
    ).toBeVisible({ timeout: 8000 })
  })

  // ---------------------------------------------------------------------------
  // 3. Edit member
  // ---------------------------------------------------------------------------
  test('edit member: click Edit → change role → save → toast success', async ({ page }) => {
    const memberRow = page
      .locator('tr, [data-testid="member-card"], li')
      .filter({ hasText: FIRST_NAME })

    await expect(memberRow).toBeVisible()
    await memberRow.getByRole('button', { name: /edit/i }).click()

    await expect(page.locator('.modal-overlay')).toBeVisible()

    const roleInput = page
      .locator('.modal-overlay')
      .locator('input[name="role"], input[id="role"], input[placeholder*="role" i]')
      .first()
    const roleVisible = await roleInput.isVisible().catch(() => false)
    if (roleVisible) {
      await roleInput.clear()
      await roleInput.fill(ROLE_UPDATED)
    }

    await page.locator('.modal-overlay').getByRole('button', { name: /save|update/i }).click()

    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 8000 })
    await expectToast(page, /member updated/i)
  })

  // ---------------------------------------------------------------------------
  // 4. Delete member
  // ---------------------------------------------------------------------------
  test('delete member: click Delete → ConfirmDialog → Delete → toast "Member deleted"', async ({
    page,
  }) => {
    const memberRow = page
      .locator('tr, [data-testid="member-card"], li')
      .filter({ hasText: FIRST_NAME })

    await expect(memberRow).toBeVisible()
    await memberRow.getByRole('button', { name: /delete/i }).click()

    await confirmDelete(page)

    await expectToast(page, /member deleted/i)

    await expect(
      page.locator('tr, [data-testid="member-card"], li').filter({ hasText: FIRST_NAME }),
    ).toHaveCount(0, { timeout: 8000 })
  })

  // ---------------------------------------------------------------------------
  // 5. Modal X close works
  // ---------------------------------------------------------------------------
  test('modal X close button closes modal without saving', async ({ page }) => {
    await openModal(page, /\+ new member/i)
    await expect(page.locator('.modal-overlay')).toBeVisible()

    await closeModal(page)
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // 6. Validation: empty first_name
  // ---------------------------------------------------------------------------
  test('validation: empty first_name → error shown, modal stays open', async ({ page }) => {
    await openModal(page, /\+ new member/i)
    await expect(page.locator('.modal-overlay')).toBeVisible()

    // Leave first_name empty, fill last_name so only first_name is missing
    const lastNameInput = page
      .locator('.modal-overlay')
      .locator('input[name="last_name"], input[id="last_name"], input[placeholder*="last" i]')
      .first()
    await lastNameInput.fill(LAST_NAME)

    // Ensure first_name is empty
    const firstNameInput = page
      .locator('.modal-overlay')
      .locator('input[name="first_name"], input[id="first_name"], input[placeholder*="first" i]')
      .first()
    await firstNameInput.fill('')

    await page.locator('.modal-overlay').getByRole('button', { name: /save|create/i }).click()

    // Modal must remain open
    await expect(page.locator('.modal-overlay')).toBeVisible()

    // Check for inline error message or HTML5 native validation
    const inlineError = page
      .locator('.modal-overlay')
      .locator('[class*="error"], [class*="invalid"], .text-red-500, [role="alert"], [aria-invalid="true"]')
      .first()

    const inputInvalid = await firstNameInput
      .evaluate((el: HTMLInputElement) => !el.validity.valid)
      .catch(() => false)

    const errorVisible = await inlineError.isVisible().catch(() => false)

    expect(errorVisible || inputInvalid).toBe(true)

    // Clean up
    await page.locator('.modal-overlay').locator('button[aria-label="Close"]').click()
  })

  // ---------------------------------------------------------------------------
  // 7. is_current checkbox defaults to checked for new member
  // ---------------------------------------------------------------------------
  test('is_current checkbox defaults to checked when opening new member modal', async ({
    page,
  }) => {
    await openModal(page, /\+ new member/i)
    await expect(page.locator('.modal-overlay')).toBeVisible()

    const isCurrentCheckbox = page
      .locator('.modal-overlay')
      .locator(
        'input[name="is_current"][type="checkbox"], input[id="is_current"][type="checkbox"]',
      )
      .first()

    const checkboxVisible = await isCurrentCheckbox.isVisible().catch(() => false)
    if (checkboxVisible) {
      await expect(isCurrentCheckbox).toBeChecked()
    }

    // Clean up
    await page.locator('.modal-overlay').locator('button[aria-label="Close"]').click()
  })
})
