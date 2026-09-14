import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe('Band Profile Admin', () => {
  // Bio-name, Career-level and Contacts-email below all perform a real save
  // against the single shared `band_profiles` row — the form always resends
  // every field, not a diff (see the About-bio-variant note further down).
  // Serial mode keeps those three saves from interleaving with each other
  // inside this file; see the report for the pre-existing, out-of-scope risk
  // of interleaving with *other* spec files that also touch this row.
  test.describe.configure({ mode: 'serial' })

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
    //
    // useDirtyGuard disables Save until the form actually differs from what
    // was loaded. Filling the name with its own current dev-DB value (it used
    // to be a hardcoded "Test Band Name") leaves the form clean and Save
    // stays disabled — so this appends a timestamp to guarantee a real
    // change, the same collision-avoidance pattern SeedE2eTicket uses, and
    // restores the original name at the end since this writes to shared dev
    // content (see "E2E specs that write to the dev database must restore
    // it" in the root CLAUDE.md).
    test('update band name, save, shows "Profile saved" toast', async ({ page }) => {
      const nameInput = page.locator('input[placeholder="Your band name"]')
      const saveBtn = page.locator('form button[type="submit"]')
      const original = await nameInput.inputValue()

      await nameInput.fill(`${original}-e2e-${Date.now()}`)
      await expect(saveBtn).toBeEnabled()

      await saveBtn.click()
      await expect(page.getByRole('button', { name: /Saving/ })).toBeVisible()
      await expect(page.getByRole('button', { name: /Saved/ })).toBeVisible()
      await expect(page.locator('[data-sonner-toast]').last()).toContainText('Profile saved')

      // Restore the dev DB's original band name.
      await nameInput.fill(original)
      await expect(saveBtn).toBeEnabled()
      await saveBtn.click()
      await expect(page.locator('[data-sonner-toast]').last()).toContainText('Profile saved')
      await expect(nameInput).toHaveValue(original)
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

    // 5. About-page bio variant selector — wiring only, no save.
    //
    // "Save profile" resends all four bio_* fields from whatever the form
    // last loaded, not just the one field a test changed — every other test
    // in this describe block relies on that being harmless because nothing
    // else is writing to bio_* concurrently. e2e/tests/public/about-bio-variant.spec.ts
    // does write to bio_* (seeding content to prove the public page renders
    // the selected variant), and runs in a different worker process, so a
    // save here can race it and stomp its seeded data mid-run. Persistence
    // through a real save is already covered — by BandProfileTest.php at the
    // API level, and by the public spec's own PUT-then-read round trip — so
    // this only needs to prove the control renders and updates locally.
    test('About-page bio variant selector offers all four lengths and updates on selection', async ({ page }) => {
      const variantSelect = page.locator('#about-bio-variant')
      await expect(variantSelect).toBeVisible()

      const optionValues = await variantSelect.locator('option').evaluateAll(
        (opts) => opts.map((o) => (o as HTMLOptionElement).value),
      )
      expect(optionValues).toEqual(['short', 'medium', 'long', 'full'])

      await variantSelect.selectOption('full')
      await expect(variantSelect).toHaveValue('full')
    })
  })

  // ── Career tab ──────────────────────────────────────────────────────────

  test.describe('Career tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Career' }).click()
    })

    // 5. Click "Local Band" career level card, active class, save
    //
    // The dev DB currently has career_level = Local Band already, so clicking
    // it is a no-op for useDirtyGuard and Save stays disabled. Detect whether
    // that's the case and, if so, dirty-gate through a different card and
    // save it first — the "click Local Band, save" below then both proves
    // the real assertion and lands back on the original value. If the dev DB
    // ever holds a different level instead, the branch below restores it
    // after, so this file never leaves career_level changed either way.
    test('click "Local Band" card gives it active class and save succeeds', async ({ page }) => {
      const saveBtn = page.locator('form button[type="submit"]')
      const cardFor = (name: string) => page.locator('.career-level-card', { hasText: name })
      const CARD_NAMES = ['Garage Band', 'Local Band', 'Pro Band', 'Custom']

      let originalCard: string | null = null
      for (const name of CARD_NAMES) {
        const cls = (await cardFor(name).getAttribute('class')) ?? ''
        if (cls.includes('career-level-card--active')) { originalCard = name; break }
      }

      if (originalCard === 'Local Band') {
        await cardFor('Garage Band').click()
        await expect(cardFor('Garage Band')).toHaveClass(/career-level-card--active/)
        await expect(saveBtn).toBeEnabled()
        await saveBtn.click()
        await expect(page.locator('[data-sonner-toast]').last()).toContainText('Profile saved')
      }

      const localBandCard = cardFor('Local Band')
      await localBandCard.click()
      await expect(localBandCard).toHaveClass(/career-level-card--active/)

      await expect(saveBtn).toBeEnabled()
      await saveBtn.click()
      await expect(page.locator('[data-sonner-toast]').last()).toContainText('Profile saved')

      // If the dev DB started on some other level, put it back — this test
      // must not leave career_level changed in shared dev content.
      if (originalCard && originalCard !== 'Local Band') {
        await cardFor(originalCard).click()
        await expect(saveBtn).toBeEnabled()
        await saveBtn.click()
        await expect(page.locator('[data-sonner-toast]').last()).toContainText('Profile saved')
      }
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
    //
    // Same useDirtyGuard trap as the band-name test above: the dev DB already
    // holds "booking@testband.com", so filling that exact value leaves the
    // form clean and Save disabled. Mutate it with a `+e2e<timestamp>` tag
    // (still a valid email, so HTML5 type="email" validation doesn't block
    // it) and restore the original afterward.
    test('update booking email and save shows "Profile saved" toast', async ({ page }) => {
      const bookingEmailInput = page.locator('input[type="email"]').first()
      const saveBtn = page.locator('form button[type="submit"]')
      const original = await bookingEmailInput.inputValue()
      const updated = original.includes('@')
        ? original.replace('@', `+e2e${Date.now()}@`)
        : `booking-e2e-${Date.now()}@testband.com`

      await bookingEmailInput.fill(updated)
      await expect(saveBtn).toBeEnabled()

      await saveBtn.click()
      await expect(page.locator('[data-sonner-toast]').last()).toContainText('Profile saved')

      // Restore the dev DB's original booking email.
      await bookingEmailInput.fill(original)
      await expect(saveBtn).toBeEnabled()
      await saveBtn.click()
      await expect(page.locator('[data-sonner-toast]').last()).toContainText('Profile saved')
      await expect(bookingEmailInput).toHaveValue(original)
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
