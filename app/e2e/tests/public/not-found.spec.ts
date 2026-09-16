import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * An unknown URL on the public site.
 *
 * Astro built src/pages/404.astro to dist/404.html and nginx copied it into
 * place on every start — and then never served it. No `error_page` directive
 * meant every `=404` in nginx.conf answered with nginx's own bare
 * "404 Not Found" stub, in production too, while the designed page sat beside
 * it on disk. The status was right, so nothing failed; only a person looking
 * at the page would notice.
 *
 * The page is now per locale — /en/404/ and /pl/404/ — and nginx picks one:
 * by URL prefix when the miss is under /en/ or /pl/ (the URL's language wins
 * over the browser's), and by Accept-Language for an unprefixed miss, through
 * the same $preferred_locale map that drives the root redirect.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

const COPY = {
  en: { lang: 'en', heading: 'Page not found', title: 'Page not found', home: '/en/' },
  pl: { lang: 'pl', heading: 'Nie znaleziono strony', title: 'Nie znaleziono strony', home: '/pl/' },
} as const

test.use({ storageState: { cookies: [], origins: [] } })

async function siteIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

async function bandName(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.get(`${API}/api/band-profile?lang=en`)
  expect(res.ok(), `GET /api/band-profile → ${res.status()}`).toBe(true)
  const { data } = (await res.json()) as { data: { name: string } }
  expect(data.name).toMatch(/\S/)
  return data.name
}

test.describe('Unknown URL', () => {
  failOnPageError()

  test.beforeEach(async ({ request }) => {
    test.skip(!(await siteIsUp(request)), `${WEB}/en unavailable`)
  })

  for (const c of [COPY.en, COPY.pl]) {
    test(`/${c.lang}/… answers 404 with the ${c.lang} not-found page, not nginx's stub`, async ({ page, request }) => {
      const name = await bandName(request)
      const res = await page.goto(`${WEB}/${c.lang}/this-page-does-not-exist-${Date.now()}`)

      // The status must stay 404 — a designed page served as 200 would be a
      // soft 404 that crawlers index.
      expect(res?.status()).toBe(404)

      // And the body must be the Astro page in the URL's language: site chrome,
      // the layout's title suffix, a home link into the same locale.
      await expect(page.locator('html')).toHaveAttribute('lang', c.lang)
      await expect(page.locator('h1')).toHaveText(c.heading)
      await expect(page.locator('header')).toBeVisible()
      await expect(page).toHaveTitle(`${c.title} — ${name}`)
      await expect(page.locator('main a').first()).toHaveAttribute('href', c.home)
    })
  }

  test('the URL prefix wins over the browser language', async ({ browser }) => {
    // A Polish browser hitting an English URL that does not exist gets the
    // English page — the locale is a property of the URL, not the visitor.
    const ctx = await browser.newContext({ locale: 'pl-PL', extraHTTPHeaders: { 'Accept-Language': 'pl-PL,pl;q=0.9' } })
    const page = await ctx.newPage()
    const res = await page.goto(`${WEB}/en/nope-${Date.now()}`)
    expect(res?.status()).toBe(404)
    await expect(page.locator('h1')).toHaveText(COPY.en.heading)
    await ctx.close()
  })

  for (const [accept, c] of [['pl-PL,pl;q=0.9', COPY.pl], ['en-GB,en;q=0.9', COPY.en], ['', COPY.en]] as const) {
    test(`an unprefixed miss follows Accept-Language "${accept || '(none)'}"`, async ({ request }) => {
      const res = await request.get(`${WEB}/nope-${Date.now()}`, { headers: { 'Accept-Language': accept } })
      expect(res.status()).toBe(404)
      const html = await res.text()
      expect(html).toContain(`<html lang="${c.lang}"`)
      expect(html).toContain(c.heading)
    })
  }

  for (const path of ['/en/404', '/en/404/', '/en/404/index.html', '/pl/404', '/pl/404/', '/pl/404/index.html', '/404']) {
    test(`${path} requested directly is a 404 with the page, not a 200`, async ({ request }) => {
      // The error pages are reachable only through error_page. The bare
      // forms are the ones to watch: try_files' `$uri/index.html` and
      // `$uri.html` steps serve a file in place, bypassing any `internal`
      // guard on the file itself — and /404 is the target of the legacy
      // pages' Astro.redirect('/404') for a disabled module, so a 200 there
      // was a soft 404 for every switched-off section.
      //
      // Sent with an English Accept-Language on purpose: a prefixed path must
      // still come back in the *URL's* language, which is what a guard that
      // fell through to the Accept-Language rule would get wrong for /pl/404.
      const res = await request.get(`${WEB}${path}`, { headers: { 'Accept-Language': 'en-GB,en;q=0.9' } })
      expect(res.status(), path).toBe(404)
      const c = path.startsWith('/pl/') ? COPY.pl : COPY.en
      const html = await res.text()
      expect(html, path).toContain(`<html lang="${c.lang}"`)
      expect(html, path).toContain(c.heading)
    })
  }

  test('a missing built asset also 404s rather than looping or serving a page as a script', async ({ request }) => {
    const res = await request.get(`${WEB}/_astro/does-not-exist-${Date.now()}.js`)
    expect(res.status()).toBe(404)
  })
})
