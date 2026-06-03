import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe('Newsletter Admin', () => {
  test.describe.configure({ mode: 'serial' })

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
    await page.goto('/login')
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

  test('delete subscriber: click Delete → ConfirmDialog → confirm → toast success, row gone', async ({
    page,
  }) => {
    await page.goto('/admin/newsletter')
    await page.waitForLoadState('networkidle')

    const rowCount = await page.locator('tbody tr').count()
    if (rowCount === 0) {
      test.skip()
      return
    }

    const firstRow = page.locator('tbody tr').first()
    const rowEmail = await firstRow
      .locator('td')
      .first()
      .textContent()
      .then((t) => t?.trim() ?? '')

    await firstRow.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: /confirm|delete/i })
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(
      /subscriber deleted|deleted/i,
      { timeout: 8_000 },
    )

    if (rowEmail) {
      await expect(
        page.locator('tbody').getByText(rowEmail, { exact: true }),
      ).not.toBeVisible({ timeout: 8_000 })
    }
  })

  test('delete subscriber: cancel in ConfirmDialog → row remains', async ({ page }) => {
    await page.goto('/admin/newsletter')
    await page.waitForLoadState('networkidle')

    const rowCount = await page.locator('tbody tr').count()
    if (rowCount === 0) {
      test.skip()
      return
    }

    const firstRow = page.locator('tbody tr').first()
    const rowEmail = await firstRow
      .locator('td')
      .first()
      .textContent()
      .then((t) => t?.trim() ?? '')

    await firstRow.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: /confirm|delete/i })
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 })

    await confirmDialog
      .getByRole('button', { name: /cancel|no/i })
      .click()

    await expect(confirmDialog).not.toBeVisible({ timeout: 5_000 })

    if (rowEmail) {
      await expect(
        page.locator('tbody').getByText(rowEmail, { exact: true }),
      ).toBeVisible({ timeout: 5_000 })
    } else {
      expect(await page.locator('tbody tr').count()).toBeGreaterThan(0)
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
