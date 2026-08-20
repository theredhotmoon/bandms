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
      const nameInput = page.locator('input[placeholder="Your band name"]')
      await nameInput.fill('Test Band Name')

      await page.getByRole('button', { name: 'Save profile' }).click()
      await expect(page.getByRole('button', { name: /Saving/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Saved/ })).toBeVisible()

      await expect(page.locator('[data-sonner-toast]')).toContainText('Profile saved')
    })

    // 3. Clear name, save → validation error
    test('clear band name and save shows validation error', async ({ page }) => {
      const nameInput = page.locator('input[placeholder="Your band name"]')
      await nameInput.fill('')

      await page.getByRole('button', { name: 'Save profile' }).click()

      // input[required] with empty value — browser HTML5 validation fires
      const isInvalid = await nameInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
      expect(isInvalid).toBe(true)
    })

    // 4. One-liner char counter
    test('One-liner char counter updates as user types', async ({ page }) => {
      await page.getByRole('button', { name: 'One-liner' }).click()

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

  test.describe('Social tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin/band-profile')
      await page.waitForLoadState('networkidle')
      await page.getByRole('tab', { name: 'Social' }).click()
    })

    // 6. Fill a platform URL and save — toast "Social links saved"
    test('fill Spotify URL and save shows "Social links saved" toast', async ({ page }) => {
      const spotifyInput = page.getByLabel('Spotify')
      await spotifyInput.fill('https://open.spotify.com/artist/testband')

      await page.getByRole('button', { name: 'Save social links' }).click()

      await expect(page.locator('[data-sonner-toast]')).toContainText('Social links saved')
    })

    // 7. Clear a URL and save — still shows success toast
    test('clear all URLs and save shows "Social links saved" toast', async ({ page }) => {
      const spotifyInput = page.getByLabel('Spotify')
      await spotifyInput.fill('')

      await page.getByRole('button', { name: 'Save social links' }).click()

      await expect(page.locator('[data-sonner-toast]')).toContainText('Social links saved')
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

      // HTML5 type="email" validation fires before submit — check validity API
      const isInvalid = await bookingEmailInput.evaluate(
        (el: HTMLInputElement) => !el.validity.valid,
      )
      expect(isInvalid).toBe(true)
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

      const modal = page.locator('.modal-overlay').first()
      await expect(modal).toBeVisible()
      await expect(modal).toContainText('Create EPK Snapshot')
    })

    // 12. Modal Cancel closes it
    test('EPK modal Cancel button closes the modal', async ({ page }) => {
      await page.getByRole('button', { name: 'Create EPK snapshot' }).click()

      const modal = page.locator('.modal-overlay').first()
      await expect(modal).toBeVisible()

      await modal.getByRole('button', { name: 'Cancel' }).click()

      await expect(modal).not.toBeVisible()
    })
  })
})
