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

  test('booked and held days cannot be picked', async ({ page }) => {
    await page.goto(`${WEB}/en/contact`)
    await page.getByRole('button', { name: /Book us/i }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })

    // Walk forward until an unavailable day turns up, rather than only checking
    // the current month — whether one exists depends entirely on the data, and
    // a check that quietly finds nothing is not a check.
    let found = false
    for (let i = 0; i <= 5 && !found; i++) {
      for (const state of ['is-booked', 'is-held']) {
        const cells = dialog.locator(`.am-day.${state}`)
        if (await cells.count()) {
          await expect(cells.first()).toBeDisabled()
          found = true
        }
      }
      if (!found) {
        const next = dialog.getByRole('button', { name: 'Next month' })
        if (await next.isDisabled()) break
        await next.click()
        await expect(dialog.locator('.am-grid')).not.toHaveClass(/is-loading/, { timeout: 8000 })
      }
    }

    test.skip(!found, 'No booked or held day within the bookable window')
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
