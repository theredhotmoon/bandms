import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * An unknown URL on the public site.
 *
 * Astro builds src/pages/404.astro to dist/404.html and nginx copied it into
 * place on every start — and then never served it. No `error_page` directive
 * meant every `=404` in nginx.conf answered with nginx's own bare
 * "404 Not Found" stub, in production too, while the designed page sat beside
 * it on disk. The status was right, so nothing failed; only a person looking
 * at the page would notice.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

test.use({ storageState: { cookies: [], origins: [] } })

async function siteIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe('Unknown URL', () => {
  failOnPageError()

  test.beforeEach(async ({ request }) => {
    test.skip(!(await siteIsUp(request)), `${WEB}/en unavailable`)
  })

  test('answers 404 with the site\'s own not-found page, not nginx\'s stub', async ({ page }) => {
    const res = await page.goto(`${WEB}/en/this-page-does-not-exist-${Date.now()}`)

    // The status must stay 404 — a designed page served as 200 would be a soft
    // 404 that crawlers index.
    expect(res?.status()).toBe(404)

    // And the body must be the Astro page: it carries the site chrome and the
    // layout's title suffix, neither of which nginx's stub has.
    await expect(page.locator('h1')).toHaveText('Page not found')
    await expect(page.locator('header')).toBeVisible()
    await expect(page).toHaveTitle(/^Page not found — \S/)
  })

  test('a missing built asset also 404s rather than looping or serving a page as a script', async ({ request }) => {
    const res = await request.get(`${WEB}/_astro/does-not-exist-${Date.now()}.js`)
    expect(res.status()).toBe(404)
  })
})
