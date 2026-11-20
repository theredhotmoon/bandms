import { test, expect } from '@playwright/test'
import { removeSubscriber, seedSubscriber, uniqueSubscriberEmail } from '../../fixtures/newsletter'

/**
 * Editing a subscriber from the admin's Newsletter page.
 *
 * The subscriber is created through the public sign-up endpoint, so it starts
 * Pending. The Confirmed → Pending reset on an email change is pinned by the
 * Pest suite (NewsletterTest), which can create a confirmed row directly.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

const ORIGINAL = uniqueSubscriberEmail('e2e-edit')
const CHANGED  = uniqueSubscriberEmail('e2e-edited')

test.describe('Newsletter Admin — edit subscriber', () => {
  // Seeding may wait out the sign-up throttle (up to a minute) — see fixtures/newsletter.ts.
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async ({ request }) => {
    await seedSubscriber(request, ORIGINAL, { name: 'E2E Original' })
  })

  test.afterAll(async ({ request }) => {
    for (const email of [ORIGINAL, CHANGED]) await removeSubscriber(request, email)
  })

  async function openRow(page: import('@playwright/test').Page, email: string) {
    await page.goto('/admin/newsletter')
    await page.locator('input[type="search"]').fill(email)
    const row = page.locator('tbody tr').filter({ hasText: email })
    await expect(row).toHaveCount(1)
    return row
  }

  test('renaming keeps the address and sends no confirmation', async ({ page }) => {
    const row = await openRow(page, ORIGINAL)
    await row.getByTestId('subscriber-edit').click()

    const editRow = page.locator('tbody tr').filter({ has: page.getByTestId('subscriber-email-input') })
    await expect(editRow.getByTestId('subscriber-email-input')).toHaveValue(ORIGINAL)
    await expect(editRow.getByTestId('subscriber-email-hint')).toHaveCount(0)

    await editRow.getByTestId('subscriber-name-input').fill('E2E Renamed')
    await editRow.getByTestId('subscriber-save').click()

    await expect(page.locator('[data-sonner-toast]').first()).toContainText(/subscriber updated\.?$/i)
    const saved = page.locator('tbody tr').filter({ hasText: ORIGINAL })
    await expect(saved).toContainText('E2E Renamed')
  })

  test('changing the email warns first, resends confirmation and shows Pending', async ({ page }) => {
    const row = await openRow(page, ORIGINAL)
    await row.getByTestId('subscriber-edit').click()

    const emailInput = page.getByTestId('subscriber-email-input')
    // A case-only change is the same address — no warning.
    await emailInput.fill(ORIGINAL.toUpperCase())
    await expect(page.getByTestId('subscriber-email-hint')).toHaveCount(0)

    await emailInput.fill(CHANGED)
    await expect(page.getByTestId('subscriber-email-hint')).toContainText(/pending/i)

    await page.getByTestId('subscriber-save').click()

    await expect(page.locator('[data-sonner-toast]').first()).toContainText(CHANGED)

    await page.locator('input[type="search"]').fill(CHANGED)
    const saved = page.locator('tbody tr').filter({ hasText: CHANGED })
    await expect(saved).toHaveCount(1)
    await expect(saved).toContainText(/pending/i)
  })

  test('an email another subscriber already has is rejected inline', async ({ page, request }) => {
    const other = uniqueSubscriberEmail('e2e-taken')
    await seedSubscriber(request, other)

    try {
      const row = await openRow(page, CHANGED)
      await row.getByTestId('subscriber-edit').click()
      await page.getByTestId('subscriber-email-input').fill(other)
      await page.getByTestId('subscriber-save').click()

      await expect(page.locator('.edit-error')).toBeVisible()
      // Still in edit mode, nothing saved.
      await expect(page.getByTestId('subscriber-email-input')).toBeVisible()
      await page.getByRole('button', { name: /cancel/i }).click()
      await expect(page.locator('tbody tr').filter({ hasText: CHANGED })).toHaveCount(1)
    } finally {
      await removeSubscriber(request, other)
    }
  })
})
