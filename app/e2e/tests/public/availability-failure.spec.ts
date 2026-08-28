import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * How the availability calendar behaves when the API will not answer.
 *
 * This path shipped broken twice. First it presented every day as `open` and
 * selectable after a failed fetch — the same "reports dates it never checked"
 * defect as the server bug, moved to the client. The fix for that was itself a
 * regression: `failed` was one global flag while `cache` is per month, and
 * `load()` returns early for a cached month before it could reset the flag, so
 * one failed month left every already-loaded month unselectable for the rest of
 * the session.
 *
 * Neither was caught by a test, because neither had one. `page.route` makes the
 * failure reproducible, so both are pinned here.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

const RANGE = '**/api/band-profile/calendar/availability-range*'

test.use({ storageState: { cookies: [], origins: [] } })

async function contactIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en/contact`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

async function openCalendar(page: import('@playwright/test').Page) {
  await page.goto(`${WEB}/en/contact`)
  await page.locator('button.ct-card[data-open-availability]').scrollIntoViewIfNeeded()
  await page.waitForFunction(
    () => {
      const island = document.querySelector('astro-island[component-url*="AvailabilityModal"]')
      return Boolean(island) && !island!.hasAttribute('ssr')
    },
    undefined,
    { timeout: 10_000 },
  )
  await page.locator('button.ct-card[data-open-availability]').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 8000 })
  return dialog
}

test.describe('Availability calendar — failed fetch', () => {
  failOnPageError()

  test.beforeEach(async ({ request, page }) => {
    test.skip(!(await contactIsUp(request)), `${WEB}/en/contact unavailable`)
  })

  test('a failed month offers no selectable days', async ({ page }) => {
    // Fail every range call, including the first.
    await page.route(RANGE, (route) => route.fulfill({ status: 429, body: '{}' }))

    const dialog = await openCalendar(page)

    // The banner alone is not enough: a grid of apparently-open days invites a
    // request for a date the API declined to answer for.
    await expect(dialog.locator('.am-warn')).toBeVisible({ timeout: 8000 })
    await expect(dialog.locator('.am-day.is-open')).toHaveCount(0)

    const unknown = dialog.locator('.am-day.is-unknown')
    expect(await unknown.count()).toBeGreaterThan(0)
    await expect(unknown.first()).toBeDisabled()

    await expect(dialog.getByRole('button', { name: /Request this date/i })).toBeDisabled()
  })

  test('a month that loaded stays usable after a later month fails', async ({ page }) => {
    const dialog = await openCalendar(page)

    // The opening month must have loaded for this to mean anything.
    await expect(dialog.locator('.am-day.is-open').first()).toBeVisible({ timeout: 8000 })
    const openInFirstMonth = await dialog.locator('.am-day.is-open').count()
    const firstMonth = await dialog.locator('.am-month').textContent()

    // Now break the API and move forward: that month fails.
    await page.route(RANGE, (route) => route.fulfill({ status: 429, body: '{}' }))
    await dialog.getByRole('button', { name: 'Next month' }).click()
    await expect(dialog.locator('.am-warn')).toBeVisible({ timeout: 8000 })

    // Back to the month that loaded fine. Its statuses are cached, so it must
    // render exactly as before — banner gone, days selectable again.
    await dialog.getByRole('button', { name: 'Previous month' }).click()
    await expect(dialog.locator('.am-month')).toHaveText(firstMonth ?? '')

    await expect(dialog.locator('.am-warn')).toHaveCount(0)
    await expect(dialog.locator('.am-day.is-open')).toHaveCount(openInFirstMonth)
    await expect(dialog.locator('.am-day.is-unknown')).toHaveCount(0)
  })

  test('a date can still be picked in a month that loaded', async ({ page }) => {
    const dialog = await openCalendar(page)
    await expect(dialog.locator('.am-day.is-open').first()).toBeVisible({ timeout: 8000 })

    await page.route(RANGE, (route) => route.fulfill({ status: 429, body: '{}' }))
    await dialog.getByRole('button', { name: 'Next month' }).click()
    await expect(dialog.locator('.am-warn')).toBeVisible({ timeout: 8000 })
    await dialog.getByRole('button', { name: 'Previous month' }).click()

    // The regression made this impossible for the rest of the session.
    await dialog.locator('.am-day.is-open').first().click()
    await expect(dialog.getByRole('button', { name: /Request this date/i })).toBeEnabled()
  })
})
