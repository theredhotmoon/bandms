import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe('Band Profile Admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/band-profile')
    await page.waitForLoadState('networkidle')
  })

  // 1. Page loads
  test('page loads with "Band Profile" h1 visible', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Band Profile')
  })

  // ── Bio tab ─────────────────────────────────────────────────────────────

  test.describe('Bio tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Bio' }).click()
    })

    // 2. Update band name, save, toast
    test('update band name, save, shows "Profile saved" toast', async ({ page }) => {
      const nameInput = page.getByLabel('Band name *')
      await nameInput.fill('Test Band Name')

      await page.getByRole('button', { name: 'Save profile' }).click()
      await expect(page.getByRole('button', { name: /Saving/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Saved/ })).toBeVisible()

      await expect(page.locator('[data-sonner-toast]')).toContainText('Profile saved')
    })

    // 3. Clear name, save → validation error
    test('clear band name and save shows validation error', async ({ page }) => {
      const nameInput = page.getByLabel('Band name *')
      await nameInput.fill('')

      await page.getByRole('button', { name: 'Save profile' }).click()

      // Expect a field-level validation error near the name input
      const fieldError = page.locator('text=/required|cannot be empty|name is required/i').first()
      await expect(fieldError).toBeVisible()
    })

    // 4. One-liner char counter
    test('One-liner char counter updates as user types', async ({ page }) => {
      await page.getByRole('tab', { name: 'One-liner' }).click()

      const textarea = page.locator('textarea').first()
      await textarea.fill('')

      const typedText = 'A short one-liner bio'
      await textarea.fill(typedText)

      const counter = page.locator('text=/' + typedText.length.toString() + '\\s*\\/\\s*280/')
      await expect(counter).toBeVisible()
    })
  })

  // ── Career tab ──────────────────────────────────────────────────────────

  test.describe('Career tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Career' }).click()
    })

    // 5. Click "Local Band" career level card, active class, save
    test('click "Local Band" card gives it active class and save succeeds', async ({ page }) => {
      const localBandCard = page.locator('.career-level-card', { hasText: 'Local Band' })
      await localBandCard.click()

      await expect(localBandCard).toHaveClass(/career-level-card--active/)

      await page.getByRole('button', { name: 'Save profile' }).click()
      await expect(page.locator('[data-sonner-toast]')).toContainText('Profile saved')
    })
  })

  // ── Social tab ──────────────────────────────────────────────────────────

  test.describe('Social tab — CRUD', () => {
    test.describe.configure({ mode: 'serial' })

    test.beforeEach(async ({ page }) => {
      await page.goto('/admin/band-profile')
      await page.waitForLoadState('networkidle')
      await page.getByRole('tab', { name: 'Social' }).click()
    })

    // 6. Add a new link
    test('add new social link shows toast "Link added" and link appears in list', async ({ page }) => {
      await page.getByRole('button', { name: '+ Add link' }).click()

      // Select a platform
      const platformSelect = page.locator('select').first()
      await platformSelect.selectOption({ index: 1 })

      // Enter URL
      const urlInput = page.locator('input[type="url"], input[placeholder*="http"], input[placeholder*="URL"]').first()
      await urlInput.fill('https://instagram.com/testband')

      await page.getByRole('button', { name: 'Add' }).click()

      await expect(page.locator('[data-sonner-toast]')).toContainText('Link added')
      await expect(page.locator('text=https://instagram.com/testband')).toBeVisible()
    })

    // 7. Edit existing link
    test('edit existing social link shows toast "Link updated"', async ({ page }) => {
      const firstEditButton = page.getByRole('button', { name: 'Edit' }).first()
      await firstEditButton.click()

      const urlInput = page.locator('input[type="url"], input[placeholder*="http"], input[placeholder*="URL"]').first()
      await urlInput.fill('https://instagram.com/testband-updated')

      await page.getByRole('button', { name: 'Update' }).click()

      await expect(page.locator('[data-sonner-toast]')).toContainText('Link updated')
    })

    // 8. Delete link
    test('delete social link shows toast "Link removed"', async ({ page }) => {
      const firstDeleteButton = page.getByRole('button', { name: '✕' }).first()
      await firstDeleteButton.click()

      await expect(page.locator('[data-sonner-toast]')).toContainText('Link removed')
    })
  })

  // ── Contacts tab ────────────────────────────────────────────────────────

  test.describe('Contacts tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Contacts' }).click()
    })

    // 9. Update booking email, save → toast
    test('update booking email and save shows "Profile saved" toast', async ({ page }) => {
      const bookingEmailInput = page.locator('input[type="email"]').first()
      await bookingEmailInput.fill('booking@testband.com')

      await page.getByRole('button', { name: 'Save profile' }).click()

      await expect(page.locator('[data-sonner-toast]')).toContainText('Profile saved')
    })

    // 10. Invalid email → validation error
    test('invalid booking email shows validation error', async ({ page }) => {
      const bookingEmailInput = page.locator('input[type="email"]').first()
      await bookingEmailInput.fill('not-an-email')

      await page.getByRole('button', { name: 'Save profile' }).click()

      const fieldError = page.locator('text=/invalid|valid email|email format/i').first()
      await expect(fieldError).toBeVisible()
    })
  })

  // ── EPK tab ─────────────────────────────────────────────────────────────

  test.describe('EPK tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'EPK' }).click()
    })

    // 11. "Create EPK snapshot" button opens modal
    test('"Create EPK snapshot" button opens modal with title "Create EPK Snapshot"', async ({ page }) => {
      await page.getByRole('button', { name: 'Create EPK snapshot' }).click()

      const modal = page.locator('[role="dialog"], .modal, [data-modal]').first()
      await expect(modal).toBeVisible()
      await expect(modal).toContainText('Create EPK Snapshot')
    })

    // 12. Modal Cancel closes it
    test('EPK modal Cancel button closes the modal', async ({ page }) => {
      await page.getByRole('button', { name: 'Create EPK snapshot' }).click()

      const modal = page.locator('[role="dialog"], .modal, [data-modal]').first()
      await expect(modal).toBeVisible()

      await modal.getByRole('button', { name: 'Cancel' }).click()

      await expect(modal).not.toBeVisible()
    })
  })
})
