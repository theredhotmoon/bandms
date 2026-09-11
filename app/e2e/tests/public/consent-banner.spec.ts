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

// Fresh, anonymous visitor for every test in this file — no prior consent choice.
test.use({ storageState: { cookies: [], origins: [] } })

async function siteIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe('Cookie consent banner', () => {
  failOnPageError()

  test.beforeEach(async ({ request, page }) => {
    test.skip(!(await siteIsUp(request)), `${WEB}/en unavailable`)
  })

  test('shows on first visit and GA does not load until a choice is made', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const banner = page.getByRole('region', { name: /privacy|prywatności/i })
    const isConfigured = await banner.count() > 0
    test.skip(!isConfigured, 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    await expect(banner).toBeVisible()
    expect(await page.locator('#ga4-tag').count()).toBe(0)
  })

  test('Accept hides the banner, loads GA, and persists across reload', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const banner = page.getByRole('region', { name: /privacy|prywatności/i })
    test.skip((await banner.count()) === 0, 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    await page.getByRole('button', { name: 'Accept' }).click()
    await expect(banner).toBeHidden()

    // grantConsent() → loadGoogleAnalytics() injects a <script id="ga4-tag">
    // and pushes a 'config' call onto window.dataLayer — see web/src/lib/analytics.ts.
    await expect(page.locator('#ga4-tag')).toHaveCount(1)
    const dataLayer = await page.evaluate(() => (window as unknown as { dataLayer?: unknown[][] }).dataLayer ?? [])
    expect(dataLayer.some(entry => entry[0] === 'config')).toBe(true)

    await page.reload()
    await expect(banner).toBeHidden()
    await expect(page.locator('#ga4-tag')).toHaveCount(1)
  })

  test('Reject hides the banner, never loads GA, and persists across reload', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const banner = page.getByRole('region', { name: /privacy|prywatności/i })
    test.skip((await banner.count()) === 0, 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    await page.getByRole('button', { name: 'Reject' }).click()
    await expect(banner).toBeHidden()
    expect(await page.locator('#ga4-tag').count()).toBe(0)

    await page.reload()
    await expect(banner).toBeHidden()
    expect(await page.locator('#ga4-tag').count()).toBe(0)
  })

  test('the footer\'s "Cookie settings" link reopens the banner', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const banner = page.getByRole('region', { name: /privacy|prywatności/i })
    test.skip((await banner.count()) === 0, 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    await page.getByRole('button', { name: 'Accept' }).click()
    await expect(banner).toBeHidden()

    await page.getByRole('button', { name: 'Cookie settings' }).click()
    await expect(banner).toBeVisible()
  })

  test('reopening after Accept and choosing Reject actually stops GA, not just future loads', async ({ page, context }) => {
    await page.goto(`${WEB}/en`)

    const banner = page.getByRole('region', { name: /privacy|prywatności/i })
    test.skip((await banner.count()) === 0, 'PUBLIC_GA_MEASUREMENT_ID not configured on this stack')

    await page.getByRole('button', { name: 'Accept' }).click()
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

    await page.getByRole('button', { name: 'Reject' }).click()
    await expect(banner).toBeHidden()
    await expect
      .poll(() => page.evaluate(id => (window as Record<string, unknown>)[`ga-disable-${id}`], measurementId))
      .toBe(true)

    // disableGoogleAnalytics() expires every _ga-prefixed cookie.
    const gaCookies = (await context.cookies()).filter(c => c.name.startsWith('_ga'))
    expect(gaCookies).toEqual([])
  })
})
