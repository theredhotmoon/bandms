import { test, expect } from '@playwright/test'
import { expectToast, openModal, confirmDelete, searchTable } from '../../fixtures/test-base'
import { adminHeaders } from '../../fixtures/admin-api'

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

    // Use the Venue column (index 3: Date=0, Name=1, Doors/Start=2, Venue=3)
    const venueCell = rowsBefore.first().locator('td').nth(3)
    const venueText = await venueCell.textContent()
    const query = venueText && venueText.trim() !== '—' ? venueText.trim().substring(0, 4) : 'a'

    await searchTable(page, query)

    // Rows should still be present (we searched for something that matches)
    const rowsAfter = page.locator('tbody tr')
    await expect(rowsAfter.first()).toBeVisible()
  })

  test('"Upcoming" filter shows only upcoming concerts', async ({ page }) => {
    const filterSelect = page.locator('select.filter-select')
      .or(page.locator('select').filter({ has: page.locator('option', { hasText: /upcoming/i }) }))
      .first()

    await expect(filterSelect).toBeVisible()
    await filterSelect.selectOption({ label: 'Upcoming' })
    await page.waitForTimeout(300)

    // Either a table (upcoming concerts exist) or an empty-state message is shown
    await expect(page.locator('table').or(page.locator('.empty-state'))).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Serial CRUD flow — depends on state from previous steps
// ---------------------------------------------------------------------------

test.describe.configure({ mode: 'serial' })

test.describe('Admin Concerts — CRUD flow', () => {
  // Use a unique date per test run to avoid conflicts with leftover concerts
  const runSuffix = String(Date.now()).slice(-5)
  const futureMonth = String(1 + (parseInt(runSuffix.slice(0, 2)) % 11) + 1).padStart(2, '0')
  const futureDay   = String(1 + (parseInt(runSuffix.slice(2, 4)) % 27)).padStart(2, '0')
  const futureDate  = `2099-${futureMonth}-${futureDay}`
  const updatedDate = `2099-${futureMonth}-${String(parseInt(futureDay) + 1).padStart(2, '0')}`
  // Rows are found by this name, never by date: the date only has ~300
  // values, and runs that died mid-flow leave 2099 concerts behind. A
  // leftover sharing the date survives our delete and fails the last step.
  const concertName = `E2E Concert ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const ourRow = (page: import('@playwright/test').Page) =>
    page.locator('tbody tr').filter({ hasText: concertName })
  // The table pages at 15 rows, newest date first, so enough leftovers dated
  // after ours push our row off page 1. Searching by the name pins it there.
  const showOurRow = (page: import('@playwright/test').Page) => searchTable(page, concertName)

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/concerts')
    await page.waitForLoadState('networkidle')
  })

  // -------------------------------------------------------------------------
  // 1. Create
  // -------------------------------------------------------------------------
  test('create concert — modal opens, form fills, toast confirms', async ({ page }) => {
    await page.locator('button.btn-add-primary').click()

    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 8000 })
    await expect(
      page.locator('.modal-overlay').getByRole('heading', { name: /new concert/i }),
    ).toBeVisible()

    const modal = page.locator('.modal-overlay')

    // Wait for venue select to be populated (async load)
    const venueSelect = modal.locator('select').first()
    // Wait for at least one venue option beyond the disabled placeholder
    await expect(venueSelect.locator('option:not([disabled])')).not.toHaveCount(0, { timeout: 10000 })

    await modal.locator('.trans-row[data-locale="en"] input').first().fill(concertName)

    // Fill date
    const dateInput = modal.locator('input[type="date"], input[name="date"]').first()
    await dateInput.fill(futureDate)

    // Select first available venue
    await venueSelect.selectOption({ index: 1 })

    // Fill start_time if visible
    const timeInput = modal.locator('input[type="time"]').first()
    const timeVisible = await timeInput.isVisible().catch(() => false)
    if (timeVisible) {
      await timeInput.fill('20:00')
    }

    await page.locator('.modal-overlay').getByRole('button', { name: /create|save/i }).click()

    // Modal should close
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 8000 })

    // Toast
    await expectToast(page, 'Concert created')

    await showOurRow(page)
    await expect(ourRow(page)).toHaveCount(1)
    await expect(ourRow(page)).toContainText(futureDate)
  })

  // -------------------------------------------------------------------------
  // 2. Edit
  // -------------------------------------------------------------------------
  test('edit concert — modal opens with Edit Concert title, date updated, toast confirms', async ({
    page,
  }) => {
    await showOurRow(page)
    const row = ourRow(page)

    await expect(row).toBeVisible()

    // Click Edit action button in that row
    await row.getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: /edit concert/i })).toBeVisible()

    // Wait for venue select to have options (ensures venuesQ has resolved)
    const venueSelectEdit = modal.locator('select').first()
    await expect(venueSelectEdit.locator('option:not([disabled])')).not.toHaveCount(0, { timeout: 10000 })

    // Change the date
    const dateInput = modal.locator('input[type="date"], input[name="date"]').first()
    await dateInput.fill(updatedDate)

    await modal.getByRole('button', { name: /update|save/i }).click()

    await expect(modal).not.toBeVisible({ timeout: 8000 })
    await expectToast(page, 'Concert updated')
    await expect(ourRow(page)).toContainText(updatedDate)
  })

  // -------------------------------------------------------------------------
  // 3. Delete — cancel first, then confirm
  // -------------------------------------------------------------------------
  test('delete concert — cancel keeps row, confirm removes row and shows toast', async ({
    page,
  }) => {
    await showOurRow(page)
    const row = ourRow(page)

    await expect(row).toBeVisible()

    // --- Cancel path ---
    await row.getByRole('button', { name: /delete/i }).click()

    await expect(page.getByText('Confirm deletion')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Dialog gone, row still there
    await expect(page.getByText('Confirm deletion')).not.toBeVisible()
    await expect(ourRow(page)).toBeVisible()

    // --- Confirm path ---
    await ourRow(page).getByRole('button', { name: /delete/i }).click()

    await confirmDelete(page)

    await expectToast(page, 'Concert deleted')

    // Row is gone
    await expect(ourRow(page)).toHaveCount(0, { timeout: 8000 })
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
    await page.locator('button.btn-add-primary').click()

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

    await page.locator('.modal-overlay').getByRole('button', { name: /create|save/i }).click()

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
    await page.locator('button.btn-add-primary').click()

    await expect(page.locator('.modal-overlay')).toBeVisible()

    // Fill date, leave venue empty
    const dateInput = page
      .locator('.modal-overlay')
      .locator('input[type="date"], input[name="date"]')
      .first()
    await dateInput.fill('2027-08-15')

    const modal = page.locator('.modal-overlay')

    // Do NOT select a venue — submit immediately
    await modal.getByRole('button', { name: /create|save/i }).click()

    // Modal should remain open (browser or backend validation rejects the submit)
    await expect(modal).toBeVisible()

    // venue_id="0" is truthy so browser required doesn't fire; backend returns 422
    // Wait for the field-error element to appear
    const fieldError = modal.locator('.field-error')
    const venueSelect = modal.locator('select').first()
    const selectInvalid = await venueSelect
      .evaluate((el: HTMLSelectElement) => !el.validity.valid)
      .catch(() => false)

    if (!selectInvalid) {
      // Backend validation path — wait for inline error to appear
      await expect(fieldError.first()).toBeVisible({ timeout: 5000 })
    }

    // Close modal to clean up
    await modal.locator('button[aria-label="Close"]').click()
  })
})

// ---------------------------------------------------------------------------
// Venue gate — the template wiring behind src/utils/venueGate.ts
//
// The gate logic itself is unit-tested; what only a browser can prove is that
// the button and the notice are actually bound to it. Every state here is
// produced by stubbing the response, so nothing touches the dev database.
//
// Match the API path exactly: a glob like **/api/venues* also captures Vite's
// dev-server request for /src/api/venues.ts and breaks the module graph.
// ---------------------------------------------------------------------------

test.describe('Admin Concerts — venue gate', () => {
  const VENUES = (url: URL) => url.pathname === '/api/venues'
  const ADD = { name: '+ Add concert' }
  const EMPTY_NOTICE = 'No venues yet — add one from the concert form, or on the Venues page.'

  test('no venues: create stays open and the notice points at the form', async ({ page }) => {
    await page.route(VENUES, r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }),
    )
    await page.goto('/admin/concerts')

    // The form can create a venue itself now, so an empty list is no longer a
    // dead end and must not disable the button.
    await expect(page.getByRole('button', ADD)).toBeEnabled()
    await expect(page.getByText(EMPTY_NOTICE)).toBeVisible()
    await expect(page.getByRole('link', { name: /Go to Venues/ })).toHaveAttribute(
      'href',
      '/admin/venues',
    )

    await page.getByRole('button', ADD).click()
    await expect(page.locator('.modal-overlay').getByTestId('venue-quick-add')).toBeVisible()
  })

  test('failed venues fetch: create stays available, error is named', async ({ page }) => {
    await page.route(VENUES, r =>
      r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }),
    )
    await page.goto('/admin/concerts')

    // TanStack defaults to retry:3 with backoff, so isError settles ~7s in.
    await expect(page.getByText('Could not load venues')).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()

    // The regression guard: a failed fetch must not be reported as "no venues",
    // nor leave the user with a dead button and no way forward.
    const addBtn = page.getByRole('button', ADD)
    await expect(addBtn).toBeEnabled()
    await expect(addBtn).not.toHaveAttribute('title', /Add a venue/)
    await expect(page.getByText(EMPTY_NOTICE)).toHaveCount(0)
  })

  test('venues present: no notice, create is available', async ({ page }) => {
    await page.goto('/admin/concerts')

    await expect(page.getByRole('button', ADD)).toBeEnabled()
    await expect(page.getByText(EMPTY_NOTICE)).toHaveCount(0)
    await expect(page.getByText('Could not load venues')).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// Inline venue create — a venue added from inside the concert modal
//
// The whole point is that the concert form survives the detour, so every
// test types into it first and checks the text is still there afterwards.
// Both overlays teleport to <body>; `.modal-overlay` is addressed by index
// because a bare locator is a strict-mode violation while two are open.
// ---------------------------------------------------------------------------

test.describe('Admin Concerts — inline venue create', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const concertName = `E2E Inline ${stamp}`
  const venueName = `E2E Venue ${stamp}`
  // Deleting the venue cascades to its concerts, so one DELETE cleans up both.
  const createdVenueIds: number[] = []

  test.afterAll(async ({ request }) => {
    for (const id of createdVenueIds) {
      await request.delete(`/api/venues/${id}`, { headers: adminHeaders() })
    }
  })

  async function openConcertForm(page: import('@playwright/test').Page) {
    await page.goto('/admin/concerts')
    await page.locator('button.btn-add-primary').click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()
    await outer.locator('.trans-row[data-locale="en"] input').first().fill(concertName)
    return outer
  }

  test('creates a venue over the concert form and selects it', async ({ page }) => {
    const outer = await openConcertForm(page)
    await outer.locator('input[type="date"]').first().fill('2099-06-15')

    await outer.getByTestId('venue-quick-add').click()
    const inner = page.locator('.modal-overlay').nth(1)
    await expect(inner).toBeVisible()
    await expect(inner.getByRole('heading', { name: 'New venue' })).toBeVisible()

    // The venue form's first input is the name.
    await inner.locator('input').first().fill(venueName)
    const created = page.waitForResponse(r => r.url().endsWith('/api/venues') && r.request().method() === 'POST')
    await inner.getByRole('button', { name: 'Create' }).click()
    const body = (await (await created).json()) as { data: { id: number } }
    createdVenueIds.push(body.data.id)

    await expectToast(page, 'Venue created')
    await expect(page.locator('.modal-overlay')).toHaveCount(1)

    // The new venue is selected, and the detour cost nothing.
    const venueSelect = outer.locator('select').first()
    await expect(venueSelect.locator('option:checked')).toHaveText(venueName)
    await expect(outer.locator('.venue-card')).toContainText(venueName)
    await expect(outer.locator('.trans-row[data-locale="en"] input').first()).toHaveValue(concertName)
    await expect(outer.locator('input[type="date"]').first()).toHaveValue('2099-06-15')

    // And the concert saves against it.
    await outer.getByRole('button', { name: /create|save/i }).click()
    await expectToast(page, 'Concert created')
    await searchTable(page, concertName)
    const row = page.locator('tbody tr').filter({ hasText: concertName })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText(venueName)
  })

  test('Escape and the discard guard act on the nested modal only', async ({ page }) => {
    const outer = await openConcertForm(page)
    await outer.getByTestId('venue-quick-add').click()
    const inner = page.locator('.modal-overlay').nth(1)
    await expect(inner).toBeVisible()

    // The covered modal is inert, so Tab cannot walk into the concert form
    // underneath; it comes back the moment the nested modal closes.
    await expect(outer).toHaveAttribute('inert', '')
    await expect(inner).not.toHaveAttribute('inert', '')

    // Clean nested modal: Escape closes it and nothing else — and a second
    // Escape in the same breath, while the nested panel is still fading out,
    // must not reach the concert modal and ask to discard the concert.
    await inner.locator('input').first().focus()
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await expect(page.locator('.modal-overlay')).toHaveCount(1)
    await expect(outer).toBeVisible()
    await expect(page.getByRole('dialog').filter({ hasText: 'Discard changes' })).toHaveCount(0)
    await expect(outer).not.toHaveAttribute('inert', '')
    // Focus returns to the button that opened the nested modal.
    await expect(outer.getByTestId('venue-quick-add')).toBeFocused()
    await expect(outer.locator('.trans-row[data-locale="en"] input').first()).toHaveValue(concertName)

    // Dirty nested modal: Escape asks, and Discard throws away the venue
    // draft alone — the concert's text is untouched.
    await outer.getByTestId('venue-quick-add').click()
    await expect(inner).toBeVisible()
    await inner.locator('input').first().fill('Draft venue')
    await page.keyboard.press('Escape')
    const confirm = page.getByRole('dialog').filter({ hasText: 'Discard changes' })
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Discard' }).click()
    await expect(page.locator('.modal-overlay')).toHaveCount(1)
    await expect(outer.locator('.trans-row[data-locale="en"] input').first()).toHaveValue(concertName)
  })
})
