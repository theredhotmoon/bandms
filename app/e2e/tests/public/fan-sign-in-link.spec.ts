import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The emailed sign-in link, /account?token=….
 *
 * It used to point at the API's JSON verify endpoint, which consumed the token
 * and showed the fan raw JSON, so no fan could ever sign in outside APP_DEBUG.
 * The account page now exchanges the token itself.
 *
 * A real token needs the debug-only dev link (the running backend has debug
 * off — see fan-locale.spec.ts), so verify is served through page.route. What
 * is under test is the page's half: that it reads the token, sends it, signs
 * the fan in, and drops the single-use token from the URL. The API half is
 * FanAccountTest.
 */
const FAN = { id: 1, email: 'e2e-fan-link@bandms.test', name: 'Link Fan', newsletter_subscribed: false }

test.describe('fan sign-in link', () => {
  failOnPageError()

  test.beforeEach(async ({ page }) => {
    // The signed-in portal loads tickets and orders with the stubbed session.
    await page.route('**/api/fan/tickets*', (r) => r.fulfill({ json: { data: [] } }))
    await page.route('**/api/fan/orders*', (r) => r.fulfill({ json: { data: [] } }))
    // The account page re-reads the fan (password flags go stale) when it mounts.
    await page.route('**/api/fan/me', (r) => r.fulfill({ json: FAN }))
  })

  test('signs the fan in and removes the token from the URL', async ({ page }) => {
    let sent: string | null = null
    await page.route('**/api/fan/auth/verify*', (r) => {
      sent = new URL(r.request().url()).searchParams.get('token')
      return r.fulfill({ json: { token: 'session-token', fan: FAN } })
    })

    await page.goto('/account?token=link-token-123&lang=en')

    await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible()
    await expect(page.getByText(FAN.email)).toBeVisible()
    expect(sent).toBe('link-token-123')
    await expect(page).not.toHaveURL(/token=/)
  })

  test('says so when the link is no longer valid', async ({ page }) => {
    await page.route('**/api/fan/auth/verify*', (r) =>
      r.fulfill({ status: 401, json: { message: 'Invalid or expired token.' } }),
    )

    await page.goto('/account?token=used-token&lang=en')

    await expect(page.getByTestId('fan-link-error')).toHaveText(
      'Sign-in link invalid or expired. Please request a new one.',
    )
    await expect(page).not.toHaveURL(/token=/)
  })

  // A fan who asked to sign in from a news post is sent back to it.
  test('returns the fan to the page they signed in from', async ({ page }) => {
    await page.route('**/api/fan/auth/verify*', (r) =>
      r.fulfill({ json: { token: 'session-token', fan: FAN } }))

    // The comments block notes the path in this browser when the link is requested.
    await page.addInitScript(() => localStorage.setItem('fan_return_to', '/en/news/some-post#comments'))
    await page.goto(`/account?token=link-token-456&lang=en&return=${encodeURIComponent('/en/news/some-post#comments')}`)

    await page.waitForURL('**/en/news/some-post#comments')
    expect(await page.evaluate(() => localStorage.getItem('fan_token'))).toBe('session-token')
  })

  // Someone else's link must not sign you in and whisk you off to a post:
  // a browser that never asked stops on the account page, where it shows whose account this is.
  test('stays on the account page when this browser did not ask to return', async ({ page }) => {
    await page.route('**/api/fan/auth/verify*', (r) =>
      r.fulfill({ json: { token: 'session-token', fan: FAN } }))

    await page.goto(`/account?token=link-token-457&lang=en&return=${encodeURIComponent('/en/news/some-post#comments')}`)

    await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible()
    await expect(page.getByText(FAN.email)).toBeVisible()
    await expect(page).toHaveURL(/\/account/)
  })

  test('ignores a return address that leaves the site', async ({ page }) => {
    await page.route('**/api/fan/auth/verify*', (r) =>
      r.fulfill({ json: { token: 'session-token', fan: FAN } }))

    await page.addInitScript(() => localStorage.setItem('fan_return_to', '//evil.example/x'))
    await page.goto(`/account?token=link-token-789&lang=en&return=${encodeURIComponent('//evil.example/x')}`)

    await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible()
    await expect(page).toHaveURL(/\/account/)
    await expect(page).not.toHaveURL(/return=/)
  })
})
