import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

/**
 * The fan surfaces pick their own language.
 *
 * These are the only two visitor-facing routes still served by the SPA
 * (/account and /tickets/claim/:token — see "The SPA is the admin panel" in
 * the root CLAUDE.md), so unlike the rest of this folder they run against the
 * default baseURL rather than the Astro site.
 *
 * What they used to do is render in `admin_ui_lang` — a key a fan has no way
 * to set and no reason to know about. In practice that meant English, and in
 * the worst case a language the fan does not read because an admin had used
 * that browser. The page and the API also disagreed: `SetLocale` answers from
 * the browser's own `Accept-Language`, so a Polish heading could sit above an
 * English validation message.
 *
 * Both halves are pinned below: the chrome, and the header the fan API now
 * sends so the server resolves to the same language the page is showing.
 */
/**
 * A throwaway address for the sign-in test.
 *
 * `requestMagicLink` creates the account when the email is unknown, so there is
 * nothing to seed — which matters because `seedTicket` shells into the backend
 * container, and one `docker exec` that times out under load fails every test
 * in whatever block it runs in. The `e2e-` prefix is what
 * `PurgeE2eFixtures` matches, so the row it creates is reaped by the teardown
 * that already runs; the suffix keeps parallel workers from colliding.
 */
const fanEmail = () => `e2e-fan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@bandms.test`

test.describe('fan-facing locale', () => {
  failOnPageError()

  // Set the admin's chrome language to English on every navigation. Every
  // assertion that follows is Polish, so a fan page reading this key instead
  // of its own would fail the test rather than merely look plausible.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('admin_ui_lang', 'en'))
  })

  test('?lang= wins, and the admin key is left alone', async ({ page }) => {
    await page.goto('/account?lang=pl')

    await expect(page.getByRole('heading', { name: 'Moje konto' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
    expect(await page.evaluate(() => localStorage.getItem('admin_ui_lang'))).toBe('en')
  })

  test('the choice survives a navigation with no query', async ({ page }) => {
    await page.goto('/account?lang=pl')
    await expect(page.getByRole('heading', { name: 'Moje konto' })).toBeVisible()

    await page.goto('/account')

    await expect(page.getByRole('heading', { name: 'Moje konto' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('fan_lang'))).toBe('pl')
  })

  test('a later ?lang= overrides the stored choice', async ({ page }) => {
    await page.goto('/account?lang=pl')
    await expect(page.getByRole('heading', { name: 'Moje konto' })).toBeVisible()

    await page.goto('/account?lang=en')

    await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('an unsupported ?lang= does not cost the fan their stored language', async ({ page }) => {
    await page.goto('/account?lang=pl')
    await expect(page.getByRole('heading', { name: 'Moje konto' })).toBeVisible()

    await page.goto('/account?lang=de')

    await expect(page.getByRole('heading', { name: 'Moje konto' })).toBeVisible()
  })

  test('a claim link renders its failure in the fan language, and sends it to the API', async ({ page }) => {
    // The claim state machine reads its branch off the response *status*. It
    // used to read it out of `err.message.startsWith('404')`, which only
    // worked because the message was seeded with an English reason phrase —
    // the very thing that leaked "500: Internal Server Error" onto a Polish
    // page. Asserting the Polish failure text pins both ends of that change.
    // Wait on the *response*, not the request: the heading only appears once
    // the round trip lands, and a 5s assertion racing a loaded Vite proxy
    // reports "element not found" when the page is still on "Odbieranie
    // biletu…". Matching the POST also matters — the page's own URL contains
    // /tickets/claim/ too, and that document request carries the browser's
    // Accept-Language rather than the one the SPA sets.
    const claim = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/tickets/claim/'),
    )

    await page.goto('/tickets/claim/definitely-not-a-real-token?lang=pl')

    const res = await claim
    expect(res.request().headers()['accept-language']).toBe('pl')
    expect(res.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Nieprawidłowy link' }))
      .toBeVisible({ timeout: 15_000 })
  })

  test('the magic-link request reaches the API and confirms in Polish', async ({ page }) => {
    // Every fan endpoint was reached at `${API_BASE}/fan/...`, one segment
    // short of `/api/fan/...`, so the whole portal talked to the SPA's own
    // router: sign-in, tickets, orders, transfer and claim all 404'd or 405'd.
    // The surface had no spec of any kind, which is how that survived. This
    // asserts the response, not just the rendered copy — the old URL would
    // have returned a page rather than an error and could still look right.
    const sent = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/fan/auth/magic-link'),
    )

    await page.goto('/account?lang=pl')
    await page.getByLabel('Adres e-mail').fill(fanEmail())
    await page.getByRole('button', { name: 'Wyślij link do logowania' }).click()

    expect((await sent).status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Sprawdź swoją skrzynkę' })).toBeVisible()
  })

  test('the authenticated fan endpoints answer where the SPA now asks for them', async ({ request }) => {
    // The rest of the portal — /fan/me, tickets, orders, transfer — needs a fan
    // session, and a session needs the dev link, which the API only returns
    // under APP_DEBUG. The running backend is built with it off, so that flow
    // is not reachable from here. What *is* reachable is the thing that was
    // actually wrong: the path. 401 means the route exists and wants a token;
    // 404 is what every one of these calls used to get.
    expect((await request.get(`${API}/api/fan/me`)).status()).toBe(401)
    expect((await request.get(`${API}/fan/me`)).status()).toBe(404)
  })
})
