import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The GA4 cookie-consent banner (web/src/components/ConsentBanner.vue).
 *
 * Entirely gated on PUBLIC_GA_MEASUREMENT_ID being baked into the running
 * `web` image — unset in most local/dev stacks, since it defaults to empty in
 * docker-compose.yml. Every test skips rather than fails when the banner
 * isn't there, the same data-dependent-guard pattern footer.spec.ts uses for
 * CMS-configured copy.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

/** GA4's measurement endpoint, on whichever regional host gtag.js picks. */
const GA_COLLECT = /google-analytics\.com\/(.*\/)?collect/

// Fresh, anonymous visitor for every test in this file — no prior consent choice.
test.use({ storageState: { cookies: [], origins: [] } })

async function siteIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

/** The island is in the page only when PUBLIC_GA_MEASUREMENT_ID was baked in. */
const hasConsent = async (page: import('@playwright/test').Page) =>
  (await page.locator('astro-island[component-url*="ConsentBanner"]').count()) > 0

test.describe('Cookie consent banner', () => {
  failOnPageError()

  test.beforeEach(async ({ request, page }) => {
    test.skip(!(await siteIsUp(request)), `${WEB}/en unavailable`)

    // A dev stack usually carries the production measurement ID, so a hit
    // that left the browser would be a test run counted as a visitor.
    // gtag.js itself still loads from Google: it is the thing under test.
    await page.route(GA_COLLECT, route => route.fulfill({ status: 204, body: '' }))
  })

  test('shows as a card on first visit and GA does not load until a choice is made', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const banner = page.getByRole('dialog')
    const isConfigured = await hasConsent(page)
    test.skip(!isConfigured, 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    await expect(banner).toBeVisible()
    expect(await page.locator('#ga4-tag').count()).toBe(0)
  })

  test('Accept hides the banner, sends a page view, and persists across reload', async ({ page, context }) => {
    await page.goto(`${WEB}/en`)

    const banner = page.getByRole('dialog')
    test.skip(!(await hasConsent(page)), 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    // A loaded tag is not a sending tag: production loaded this one on every
    // page from Sep to Nov 2026 and it never sent a hit. The request is the
    // only thing that tells the two apart.
    const firstHit = page.waitForRequest(GA_COLLECT)
    await page.getByTestId('consent-allow').click()
    await expect(banner).toBeHidden()
    expect((await firstHit).url()).toContain('en=page_view')

    // grantConsent() → loadGoogleAnalytics() injects a <script id="ga4-tag">
    // and pushes a 'config' call onto window.dataLayer — see web/src/lib/analytics.ts.
    await expect(page.locator('#ga4-tag')).toHaveCount(1)
    const dataLayer = await page.evaluate(() => (window as unknown as { dataLayer?: unknown[][] }).dataLayer ?? [])
    expect(dataLayer.some(entry => entry[0] === 'config')).toBe(true)

    const clientId = async () => (await context.cookies()).find(c => c.name === '_ga')?.value
    await expect.poll(clientId).toBeTruthy()
    const before = await clientId()

    const secondHit = page.waitForRequest(GA_COLLECT)
    await page.reload()
    await expect(banner).toBeHidden()
    await expect(page.locator('#ga4-tag')).toHaveCount(1)
    await secondHit

    // The same visitor on the next page. The banner once treated the moment
    // before it had read the stored Accept as a withdrawal, which set GA's
    // kill switch and cleared these cookies on every page load.
    expect(await clientId()).toBe(before)
  })

  test('Reject hides the banner, never loads GA, and persists across reload', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const banner = page.getByRole('dialog')
    test.skip(!(await hasConsent(page)), 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    await page.getByTestId('consent-reject').click()
    await expect(banner).toBeHidden()
    expect(await page.locator('#ga4-tag').count()).toBe(0)

    await page.reload()
    await expect(banner).toBeHidden()
    expect(await page.locator('#ga4-tag').count()).toBe(0)
  })

  test('the footer\'s "Cookie settings" link reopens the banner', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const banner = page.getByRole('dialog')
    test.skip(!(await hasConsent(page)), 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    await page.getByTestId('consent-allow').click()
    await expect(banner).toBeHidden()

    await page.getByRole('button', { name: 'Cookie settings' }).click()
    await expect(banner).toBeVisible()
  })

  test('reopening after Accept and choosing Reject actually stops GA, not just future loads', async ({ page, context }) => {
    await page.goto(`${WEB}/en`)

    const banner = page.getByRole('dialog')
    test.skip(!(await hasConsent(page)), 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    await page.getByTestId('consent-allow').click()
    await expect(page.locator('#ga4-tag')).toHaveCount(1)

    const measurementId = await page.evaluate(() => {
      const src = document.getElementById('ga4-tag')?.getAttribute('src') ?? ''
      return new URL(src, window.location.href).searchParams.get('id')
    })
    expect(measurementId).toBeTruthy()

    // Reopening the banner withdraws consent immediately — before any further
    // click — so ConsentBanner's watcher on `consentStatus` disables GA the
    // moment status leaves 'granted', not only on an explicit Reject.
    await page.getByRole('button', { name: 'Cookie settings' }).click()
    await expect(banner).toBeVisible()
    await expect
      .poll(() => page.evaluate(id => (window as Record<string, unknown>)[`ga-disable-${id}`], measurementId))
      .toBe(true)

    await page.getByTestId('consent-reject').click()
    await expect(banner).toBeHidden()
    await expect
      .poll(() => page.evaluate(id => (window as Record<string, unknown>)[`ga-disable-${id}`], measurementId))
      .toBe(true)

    // disableGoogleAnalytics() expires every _ga-prefixed cookie.
    // Polled: gtag.js loads asynchronously and may still be starting when
    // Reject is clicked.
    await expect
      .poll(async () => (await context.cookies()).filter(c => c.name.startsWith('_ga')).map(c => c.name))
      .toEqual([])
  })
  test('Allow and No thanks are the same size', async ({ page }) => {
    await page.goto(`${WEB}/en`)
    const card = page.getByRole('dialog')
    test.skip(!(await hasConsent(page)), 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    const allow = await page.getByTestId('consent-allow').boundingBox()
    const reject = await page.getByTestId('consent-reject').boundingBox()
    expect(allow && reject).toBeTruthy()
    expect(Math.abs(allow!.width - reject!.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(allow!.height - reject!.height)).toBeLessThanOrEqual(1)
  })

  test('the card cannot be dismissed with Esc and traps Tab', async ({ page }) => {
    await page.goto(`${WEB}/en`)
    const card = page.getByRole('dialog')
    test.skip(!(await hasConsent(page)), 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    await expect(card).toHaveAttribute('aria-modal', 'true')
    await page.keyboard.press('Escape')
    await expect(card).toBeVisible()
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    await page.keyboard.press('Shift+Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
  })

  test('shows as a non-blocking strip on the privacy page', async ({ page }) => {
    await page.goto(`${WEB}/en`)
    test.skip(!(await hasConsent(page)), 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    const res = await page.goto(`${WEB}/en/privacy`)
    test.skip(!res || !res.ok(), 'privacy page is switched off')
    await expect(page.getByRole('region', { name: /privacy|prywatności/i })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('the strip offers both answers at the same size, in the card order', async ({ page }) => {
    await page.goto(`${WEB}/en`)
    test.skip(!(await hasConsent(page)), 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    const res = await page.goto(`${WEB}/en/privacy`)
    test.skip(!res || !res.ok(), 'privacy page is switched off')
    const strip = page.getByRole('region', { name: /privacy|prywatności/i })
    await expect(strip).toBeVisible()

    const allow = await strip.getByTestId('consent-allow').boundingBox()
    const reject = await strip.getByTestId('consent-reject').boundingBox()
    expect(allow && reject).toBeTruthy()
    expect(Math.abs(allow!.width - reject!.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(allow!.height - reject!.height)).toBeLessThanOrEqual(1)
    // Allow first, as in the card.
    expect(allow!.x).toBeLessThan(reject!.x)
  })

  test('with storage unavailable the choice cannot persist, so it is the strip, not the card', async ({ page }) => {
    // Writes refused, reads allowed — Safari's old private mode, or a full
    // quota. The banner probes with a write, so this is what it must survive.
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError') }
    })
    // failOnPageError(): a page that throws on the missing storage fails here too.
    await page.goto(`${WEB}/en`)
    test.skip(!(await hasConsent(page)), 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    await expect(page.getByRole('region', { name: /privacy|prywatności/i })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
