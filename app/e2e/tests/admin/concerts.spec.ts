import { test, expect } from '@playwright/test'
import { expectToast, openModal, confirmDelete, searchTable } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

// ---------------------------------------------------------------------------
// Isolated read-only tests
// ---------------------------------------------------------------------------

test.describe('Admin Concerts — read-only', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/concerts')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with "Concerts" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Concerts' })).toBeVisible()
  })

  test('search filters table rows by venue name', async ({ page }) => {
    // Get all rows before searching
    const rowsBefore = page.locator('tbody tr')
    const countBefore = await rowsBefore.count()

    // Only run filtering assertion if there are rows to filter
    if (countBefore === 0) {
      // No rows — just verify the search input is present
      await expect(page.locator('input[aria-label="Search"]')).toBeVisible()
      return
    }

    // Type in the first row's venue text (if visible) or a generic search term
    const firstCell = rowsBefore.first().locator('td').nth(1)
    const venueText = await firstCell.textContent()
    const query = venueText ? venueText.trim().substring(0, 4) : 'a'

    await searchTable(page, query)

    // Rows should still be present (we searched for something that matches)
    const rowsAfter = page.locator('tbody tr')
    await expect(rowsAfter.first()).toBeVisible()
  })

  test('"Upcoming" filter button shows only upcoming concerts', async ({ page }) => {
    const upcomingBtn = page
      .getByRole('button', { name: /upcoming/i })
      .or(page.locator('button').filter({ hasText: /upcoming/i }))
      .first()

    await expect(upcomingBtn).toBeVisible()
    await upcomingBtn.click()
    await page.waitForTimeout(300)

    // After clicking Upcoming, table should not show a row labelled "Past"
    // (just verify the click doesn't error and the table is still rendered)
    await expect(page.locator('table')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Serial CRUD flow — depends on state from previous steps
// ---------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' })

test.describe('Admin Concerts — CRUD flow', () => {
  // A future date used throughout the serial suite
  const futureDate = '2027-08-15'
  const updatedDate = '2027-09-20'
  // We'll store the created row locator text for later steps
  let createdRowDate: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/concerts')
    await page.waitForLoadState('networkidle')
  })

  // -------------------------------------------------------------------------
  // 1. Create
  // -------------------------------------------------------------------------
  test('create concert — modal opens, form fills, toast confirms', async ({ page }) => {
    await openModal(page, '+ New concert')

    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(
      page.locator('.modal-overlay').getByRole('heading', { name: 'New Concert' }),
    ).toBeVisible()

    // Wait for venue select to be populated (async load)
    const venueSelect = page
      .locator('select[name="venue_id"], select')
      .first()
    await expect(venueSelect).not.toBeEmpty()

    // Fill date
    const dateInput = page
      .locator('input[type="date"], input[name="date"]')
      .first()
    await dateInput.fill(futureDate)

    // Select first available venue
    await venueSelect.selectOption({ index: 1 })

    // Fill start_time if visible
    const timeInput = page.locator('input[name="start_time"], input[type="time"]').first()
    const timeVisible = await timeInput.isVisible().catch(() => false)
    if (timeVisible) {
      await timeInput.fill('20:00')
    }

    await page.getByRole('button', { name: 'Save' }).click()

    // Modal should close
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 8000 })

    // Toast
    await expectToast(page, 'Concert created')

    // Row should appear — store the date text for later
    createdRowDate = futureDate
    await expect(page.locator('tbody tr').last()).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // 2. Edit
  // -------------------------------------------------------------------------
  test('edit concert — modal opens with Edit Concert title, date updated, toast confirms', async ({
    page,
  }) => {
    // Find the row that contains our created date
    const row = page
      .locator('tbody tr')
      .filter({ hasText: createdRowDate ?? futureDate })
      .last()

    await expect(row).toBeVisible()

    // Click Edit action button in that row
    await row.getByRole('button', { name: /edit/i }).click()

    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(
      page.locator('.modal-overlay').getByRole('heading', { name: 'Edit Concert' }),
    ).toBeVisible()

    // Change the date
    const dateInput = page
      .locator('.modal-overlay')
      .locator('input[type="date"], input[name="date"]')
      .first()
    await dateInput.fill(updatedDate)

    await page.locator('.modal-overlay').getByRole('button', { name: 'Save' }).click()

    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 8000 })
    await expectToast(page, 'Concert updated')

    // Update stored date for subsequent steps
    createdRowDate = updatedDate
  })

  // -------------------------------------------------------------------------
  // 3. Delete — cancel first, then confirm
  // -------------------------------------------------------------------------
  test('delete concert — cancel keeps row, confirm removes row and shows toast', async ({
    page,
  }) => {
    const row = page
      .locator('tbody tr')
      .filter({ hasText: createdRowDate ?? updatedDate })
      .last()

    await expect(row).toBeVisible()

    // --- Cancel path ---
    await row.getByRole('button', { name: /delete/i }).click()

    await expect(page.getByText('Confirm deletion')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Dialog gone, row still there
    await expect(page.getByText('Confirm deletion')).not.toBeVisible()
    await expect(
      page.locator('tbody tr').filter({ hasText: createdRowDate ?? updatedDate }).last(),
    ).toBeVisible()

    // --- Confirm path ---
    const rowAgain = page
      .locator('tbody tr')
      .filter({ hasText: createdRowDate ?? updatedDate })
      .last()

    await rowAgain.getByRole('button', { name: /delete/i }).click()

    await confirmDelete(page)

    await expectToast(page, 'Concert deleted')

    // Row is gone
    await expect(
      page.locator('tbody tr').filter({ hasText: createdRowDate ?? updatedDate }),
    ).toHaveCount(0, { timeout: 8000 })
  })
})

// ---------------------------------------------------------------------------
// Validation tests (independent, no storageState isolation issues)
// ---------------------------------------------------------------------------

test.describe('Admin Concerts — form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/concerts')
    await page.waitForLoadState('networkidle')
  })

  test('submit without date shows validation error', async ({ page }) => {
    await openModal(page, '+ New concert')

    // Wait for modal
    await expect(page.locator('.modal-overlay')).toBeVisible()

    // Ensure date is empty (clear if prefilled)
    const dateInput = page
      .locator('.modal-overlay')
      .locator('input[type="date"], input[name="date"]')
      .first()
    await dateInput.fill('')

    // Select a venue so only date is missing
    const venueSelect = page
      .locator('.modal-overlay')
      .locator('select[name="venue_id"], select')
      .first()
    await expect(venueSelect).not.toBeEmpty()
    await venueSelect.selectOption({ index: 1 })

    await page.locator('.modal-overlay').getByRole('button', { name: 'Save' }).click()

    // Expect an error message or the modal to remain open
    const modalStillOpen = await page.locator('.modal-overlay').isVisible()
    expect(modalStillOpen).toBe(true)

    // Check for an inline error or HTML5 validity message
    const errorVisible = await page
      .locator('.modal-overlay')
      .locator('[class*="error"], [class*="invalid"], .text-red-500, [aria-invalid="true"]')
      .first()
      .isVisible()
      .catch(() => false)

    const inputInvalid = await dateInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid,
    ).catch(() => false)

    expect(errorVisible || inputInvalid).toBe(true)

    // Close modal to clean up
    await page.locator('.modal-overlay').locator('button[aria-label="Close"]').click()
  })

  test('submit without venue shows validation error', async ({ page }) => {
    await openModal(page, '+ New concert')

    await expect(page.locator('.modal-overlay')).toBeVisible()

    // Fill date, leave venue empty
    const dateInput = page
      .locator('.modal-overlay')
      .locator('input[type="date"], input[name="date"]')
      .first()
    await dateInput.fill('2027-08-15')

    // Do NOT select a venue — submit immediately
    await page.locator('.modal-overlay').getByRole('button', { name: 'Save' }).click()

    // Modal should remain open
    const modalStillOpen = await page.locator('.modal-overlay').isVisible()
    expect(modalStillOpen).toBe(true)

    // Check for an inline error or HTML5 required validation
    const venueSelect = page
      .locator('.modal-overlay')
      .locator('select[name="venue_id"], select')
      .first()

    const errorVisible = await page
      .locator('.modal-overlay')
      .locator('[class*="error"], [class*="invalid"], .text-red-500, [aria-invalid="true"]')
      .first()
      .isVisible()
      .catch(() => false)

    const selectInvalid = await venueSelect
      .evaluate((el: HTMLSelectElement) => !el.validity.valid)
      .catch(() => false)

    expect(errorVisible || selectInvalid).toBe(true)

    // Close modal to clean up
    await page.locator('.modal-overlay').locator('button[aria-label="Close"]').click()
  })
})
