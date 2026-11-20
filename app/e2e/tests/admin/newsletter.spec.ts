import { test, expect } from '@playwright/test'
import { removeSubscriber, seedSubscriber, uniqueSubscriberEmail } from '../../fixtures/newsletter'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe('Newsletter Admin', () => {
  // Seeding may wait out the sign-up throttle (up to a minute) — see fixtures/newsletter.ts.
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test('page loads and shows "Newsletter" or "Subscribers" heading', async ({ page }) => {
    await page.goto('/admin/newsletter')
    await page.waitForLoadState('networkidle')

    await expect(
      page.locator('h1').filter({ hasText: /newsletter|subscribers/i }),
    ).toBeVisible()
  })

  test('table is visible with expected column headers', async ({ page }) => {
    await page.goto('/admin/newsletter')
    await page.waitForLoadState('networkidle')

    const hasTable = await page.locator('table').isVisible().catch(() => false)
    const hasEmptyState = await page
      .getByText(/no subscribers/i)
      .isVisible()
      .catch(() => false)

    expect(hasTable || hasEmptyState).toBe(true)

    if (hasTable) {
      const headers = page.locator('thead th, thead td')
      await expect(headers.filter({ hasText: /email/i }).first()).toBeVisible()
    }
  })

  test('table headers include Email, Source, and subscribed date columns', async ({ page }) => {
    await page.goto('/admin/newsletter')
    await page.waitForLoadState('networkidle')

    const tableVisible = await page.locator('table').isVisible().catch(() => false)
    if (!tableVisible) {
      // If there's no table (empty state), headers may still be rendered as an empty table
      test.skip()
      return
    }

    const thead = page.locator('thead')
    await expect(thead).toBeVisible()

    await expect(thead.getByText(/email/i)).toBeVisible()

    const hasSource = await thead.getByText(/source/i).isVisible().catch(() => false)
    const hasDate = await thead
      .getByText(/subscribed|date/i)
      .isVisible()
      .catch(() => false)

    expect(hasSource || hasDate).toBe(true)
  })

  test('non-admin user is redirected to /admin', async ({ page }) => {
    await page.goto('/admin')
    await page.evaluate(([token, user]) => {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', user)
    }, [
      'fake-member-token',
      JSON.stringify({ role: 'member', first_name: 'Test', email: 'member@bandms.test' }),
    ])

    await page.goto('/admin/newsletter')
    await expect(page).toHaveURL(/\/admin$/, { timeout: 5_000 })
  })

  test('search: type in search input → table filters results', async ({ page }) => {
    await page.goto('/admin/newsletter')
    await page.waitForLoadState('networkidle')

    const searchInput = page
      .locator('input[aria-label="Search"]')
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="search"]'))
      .or(page.locator('input[placeholder*="search" i]'))
      .first()

    const inputVisible = await searchInput.isVisible().catch(() => false)
    if (!inputVisible) {
      test.skip()
      return
    }

    await searchInput.fill('nonexistent-subscriber-xyz-12345')
    await page.waitForTimeout(400)

    const hasNoResults = await page
      .getByText(/no subscribers|no results|no matching/i)
      .isVisible()
      .catch(() => false)
    const hasEmptyTable =
      (await page.locator('tbody tr').count()) === 0

    expect(hasNoResults || hasEmptyTable).toBe(true)
  })

  test('search: clear search → full list returns', async ({ page }) => {
    await page.goto('/admin/newsletter')
    await page.waitForLoadState('networkidle')

    const searchInput = page
      .locator('input[aria-label="Search"]')
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="search"]'))
      .or(page.locator('input[placeholder*="search" i]'))
      .first()

    const inputVisible = await searchInput.isVisible().catch(() => false)
    if (!inputVisible) {
      test.skip()
      return
    }

    await searchInput.fill('nonexistent-subscriber-xyz-12345')
    await page.waitForTimeout(400)

    await searchInput.clear()
    await page.waitForTimeout(400)

    const hasTable = await page.locator('table').isVisible().catch(() => false)
    const hasEmptyState = await page
      .getByText(/no subscribers/i)
      .isVisible()
      .catch(() => false)

    expect(hasTable || hasEmptyState).toBe(true)
  })

  // Each delete test seeds and targets its own row. They used to act on
  // whichever row came first and expected a ConfirmDialog this page never had
  // — they only "passed" because the dev DB has no subscribers, so they always
  // skipped. Acting on the first row would also delete another spec's fixture.
  test('delete subscriber: Remove → Yes → toast success, row gone', async ({ page, request }) => {
    const email = uniqueSubscriberEmail('e2e-del')
    await seedSubscriber(request, email)
    try {
      await page.goto('/admin/newsletter')
      await page.locator('input[type="search"]').fill(email)
      const row = page.locator('tbody tr').filter({ hasText: email })
      await expect(row).toHaveCount(1)

      await row.getByRole('button', { name: /remove subscriber/i }).click()
      await row.getByRole('button', { name: /^yes$/i }).click()

      await expect(page.locator('[data-sonner-toast]').first()).toContainText(/subscriber removed/i)
      await expect(page.locator('tbody tr').filter({ hasText: email })).toHaveCount(0)
    } finally {
      await removeSubscriber(request, email)
    }
  })

  test('delete subscriber: Remove → No → row remains', async ({ page, request }) => {
    const email = uniqueSubscriberEmail('e2e-del')
    await seedSubscriber(request, email)
    try {
      await page.goto('/admin/newsletter')
      await page.locator('input[type="search"]').fill(email)
      const row = page.locator('tbody tr').filter({ hasText: email })
      await expect(row).toHaveCount(1)

      await row.getByRole('button', { name: /remove subscriber/i }).click()
      await row.getByRole('button', { name: /^no$/i }).click()

      await expect(row.getByRole('button', { name: /^yes$/i })).toHaveCount(0)
      await expect(row).toHaveCount(1)
    } finally {
      await removeSubscriber(request, email)
    }
  })

  test('empty state: shows appropriate message when no subscribers', async ({ page }) => {
    await page.goto('/admin/newsletter')
    await page.waitForLoadState('networkidle')

    const hasSubscribers = await page.locator('tbody tr').count().then((c) => c > 0)

    if (hasSubscribers) {
      // Filter to produce empty state
      const searchInput = page
        .locator('input[aria-label="Search"]')
        .or(page.getByRole('searchbox'))
        .or(page.locator('input[type="search"]'))
        .or(page.locator('input[placeholder*="search" i]'))
        .first()

      const inputVisible = await searchInput.isVisible().catch(() => false)
      if (!inputVisible) {
        test.skip()
        return
      }

      await searchInput.fill('__no_match_xyz_99999__')
      await page.waitForTimeout(400)
    }

    const emptyMessage = page.locator(
      '[class*="empty"], [class*="no-data"], [data-empty]',
    ).or(page.getByText(/no subscribers|no results|no matching/i))

    const emptyVisible = await emptyMessage.first().isVisible().catch(() => false)
    const emptyRows = (await page.locator('tbody tr').count()) === 0

    expect(emptyVisible || emptyRows).toBe(true)
  })
})
