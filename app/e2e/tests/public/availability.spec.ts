import { test, expect } from '@playwright/test'

/**
 * The public Astro site, not the SPA.
 *
 * The suite's baseURL points at the Vue dev server on :5173, so these navigate
 * by absolute URL to the `web` container instead. That container is not part of
 * the Playwright webServer config, so every test here skips when it is not up —
 * the alternative is a whole spec file that fails for environmental reasons.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

test.use({ storageState: { cookies: [], origins: [] } })

async function publicSiteIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    const res = await request.get(`${WEB}/en/contact`, { timeout: 5000 })
    return res.ok()
  } catch {
    return false
  }
}

test.describe('Availability calendar — public contact page', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await publicSiteIsUp(request)), `Astro site not reachable at ${WEB}`)
  })

  test('opens from the hero button', async ({ page }) => {
    await page.goto(`${WEB}/en/contact`)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: /Book us/i }).first().click()

    await expect(dialog).toBeVisible({ timeout: 8000 })
    await expect(dialog).toContainText('Check our availability')
  })

  test('opens from the promoters card', async ({ page }) => {
    await page.goto(`${WEB}/en/contact`)

    await page.locator('button.ct-card[data-open-availability]').click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 })
  })

  test('renders a month grid and moves between months', async ({ page }) => {
    await page.goto(`${WEB}/en/contact`)
    await page.getByRole('button', { name: /Book us/i }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })

    // Every month has at least 28 day cells.
    await expect(dialog.locator('.am-day')).toHaveCount(await dialog.locator('.am-day').count())
    expect(await dialog.locator('.am-day').count()).toBeGreaterThanOrEqual(28)

    const month = dialog.locator('.am-month')
    const first = await month.textContent()

    await dialog.getByRole('button', { name: 'Next month' }).click()
    await expect(month).not.toHaveText(first ?? '', { timeout: 8000 })

    // Previous is disabled on the current month, so this cannot walk into the past.
    await dialog.getByRole('button', { name: 'Previous month' }).click()
    await expect(month).toHaveText(first ?? '', { timeout: 8000 })
    await expect(dialog.getByRole('button', { name: 'Previous month' })).toBeDisabled()
  })

  test('picking an open date enables the request button', async ({ page }) => {
    await page.goto(`${WEB}/en/contact`)
    await page.getByRole('button', { name: /Book us/i }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })

    const request = dialog.getByRole('button', { name: /Request this date/i })
    await expect(request).toBeDisabled()

    await dialog.locator('.am-day.is-open').first().click()
    await expect(request).toBeEnabled()
  })

  // The point of the whole feature: the calendar collects no name or email, so
  // it hands the date to the contact form rather than submitting anything.
  test('requesting a date pre-fills the booking form and closes the modal', async ({ page }) => {
    await page.goto(`${WEB}/en/contact`)
    await page.getByRole('button', { name: /Book us/i }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })

    await dialog.locator('.am-day.is-open').first().click()
    await dialog.getByRole('button', { name: /Request this date/i }).click()

    await expect(dialog).toBeHidden({ timeout: 8000 })

    await expect(page.locator('#cf-subject')).toHaveValue(/Booking request —/, { timeout: 8000 })
    await expect(page.getByRole('button', { name: 'Booking', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('closes on Escape', async ({ page }) => {
    await page.goto(`${WEB}/en/contact`)
    await page.getByRole('button', { name: /Book us/i }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 8000 })
  })

  /**
   * Opens the calendar and walks forward until a day in `state` turns up,
   * because whether one exists at all depends entirely on the seeded data —
   * a check that quietly finds nothing is not a check.
   *
   * Returns the dialog and the located day, or null when the bookable window
   * holds no such day.
   */
  async function findDay(page: import('@playwright/test').Page, state: string) {
    await page.goto(`${WEB}/en/contact`)
    await page.getByRole('button', { name: /Book us/i }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })

    for (let i = 0; i <= 5; i++) {
      const cells = dialog.locator(`.am-day.${state}`)
      if (await cells.count()) return { dialog, day: cells.first() }

      const next = dialog.getByRole('button', { name: 'Next month' })
      if (await next.isDisabled()) break
      await next.click()
      await expect(dialog.locator('.am-grid')).not.toHaveClass(/is-loading/, { timeout: 8000 })
    }
    return null
  }

  test('a booked day can be picked, and warns before handing off', async ({ page }) => {
    const found = await findDay(page, 'is-booked')
    test.skip(!found, 'No booked day within the bookable window')
    const { dialog, day } = found!

    // The day stays visibly taken — selectable is not the same as available.
    await expect(day).toBeEnabled()
    await day.click()
    await expect(day).toHaveClass(/is-picked/)

    // No warning until the request is actually made.
    await expect(dialog.locator('.am-confirm')).toHaveCount(0)

    await dialog.getByRole('button', { name: /Request this date/i }).click()

    // Second confirmation: the request is held, not sent onward.
    await expect(dialog.locator('.am-confirm')).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Ask anyway/i })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Choose another/i })).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  test('choosing another date dismisses the warning without handing off', async ({ page }) => {
    const found = await findDay(page, 'is-booked')
    test.skip(!found, 'No booked day within the bookable window')
    const { dialog, day } = found!

    await day.click()
    await dialog.getByRole('button', { name: /Request this date/i }).click()
    await expect(dialog.locator('.am-confirm')).toBeVisible()

    await dialog.getByRole('button', { name: /Choose another/i }).click()

    // Back to the grid, selection cleared, calendar still open and usable.
    await expect(dialog.locator('.am-confirm')).toHaveCount(0)
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.am-day.is-picked')).toHaveCount(0)
  })

  test('asking anyway pre-fills a subject that flags the clash', async ({ page }) => {
    const found = await findDay(page, 'is-booked')
    test.skip(!found, 'No booked day within the bookable window')
    const { dialog, day } = found!

    await day.click()
    await dialog.getByRole('button', { name: /Request this date/i }).click()
    await dialog.getByRole('button', { name: /Ask anyway/i }).click()

    await expect(dialog).toBeHidden()

    // The band must be able to tell from the enquiry itself that this date
    // was already spoken for, without cross-checking their own calendar.
    const subject = page.locator('#cf-subject')
    await expect(subject).toHaveValue(/booking/i)
    await expect(subject).toHaveValue(/busy|booked/i)
  })

  test('an open day hands off with no confirmation step', async ({ page }) => {
    const found = await findDay(page, 'is-open')
    test.skip(!found, 'No open day within the bookable window')
    const { dialog, day } = found!

    await day.click()
    await dialog.getByRole('button', { name: /Request this date/i }).click()

    // Straight through — the extra friction is for unavailable dates only.
    await expect(dialog.locator('.am-confirm')).toHaveCount(0)
    await expect(dialog).toBeHidden()

    const subject = page.locator('#cf-subject')
    await expect(subject).toHaveValue(/booking/i)
    await expect(subject).not.toHaveValue(/busy|booked/i)
  })

  test('past days in the current month are never selectable', async ({ page }) => {
    await page.goto(`${WEB}/en/contact`)
    await page.getByRole('button', { name: /Book us/i }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })

    const past = dialog.locator('.am-day.is-past')
    // Only the 1st of a month has none behind it.
    if (await past.count()) await expect(past.first()).toBeDisabled()
  })
})
