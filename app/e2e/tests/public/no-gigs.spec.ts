import { test, expect, type APIRequestContext } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * With no gigs announced, the concerts page and the homepage offer
 * "Subscribe" and "Book us". "Book us" opens the availability calendar, and
 * since those pages have no contact form, a picked date travels to the
 * contact page in the URL (`?booking=YYYY-MM-DD`).
 *
 * The URL half runs everywhere. The buttons need a site with no upcoming
 * concerts, which the dev database never is (its seed has a 2099 show) — that
 * half was checked against a build served no concerts, and runs here only
 * when the instance really has none.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

async function publicSiteIsUp(request: APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en/contact`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe('Public — no gigs announced', () => {
  failOnPageError()

  test.beforeEach(async ({ request }) => {
    test.skip(!(await publicSiteIsUp(request)), `Astro site not reachable at ${WEB}`)
  })

  test('a date carried in the URL pre-fills the contact form, then leaves the URL', async ({ page }) => {
    await page.goto(`${WEB}/en/contact?booking=2099-05-05#contact-form`)

    await expect(page.locator('#cf-subject')).toHaveValue(/Booking request —/, { timeout: 8000 })
    await expect(page.getByRole('button', { name: 'Booking', exact: true })).toHaveAttribute('aria-pressed', 'true')
    // Consumed once: a reload or a shared link must not prefill it again.
    await expect(page).toHaveURL(`${WEB}/en/contact#contact-form`)
  })

  test('a malformed date in the URL is ignored', async ({ page }) => {
    await page.goto(`${WEB}/en/contact?booking=not-a-date`)
    await expect(page.locator('#cf-subject')).toHaveValue('')
  })

  test('the homepage offers Subscribe and Book us, and Book us reaches the contact form', async ({ page, request }) => {
    const concerts = (await (await request.get(`${API}/api/concerts?lang=en`)).json()).data as { date: string }[]
    const today = new Date().toISOString().slice(0, 10)
    test.skip(concerts.some((c) => c.date >= today), 'This instance has upcoming concerts, so the empty state is not built')

    await page.goto(`${WEB}/en`)
    const empty = page.getByTestId('home-no-gigs')
    await expect(empty.getByTestId('no-gigs-subscribe')).toBeVisible()
    await empty.getByTestId('no-gigs-book').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })
    await dialog.locator('.am-day.is-open').first().click()
    await dialog.getByRole('button', { name: /Request this date/i }).click()

    await expect(page).toHaveURL(/\/en\/[^/]+(\/)?#contact-form$/, { timeout: 8000 })
    await expect(page.locator('#cf-subject')).toHaveValue(/Booking request —/, { timeout: 8000 })
  })
})
