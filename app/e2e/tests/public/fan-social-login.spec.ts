import { anonymousVisitor } from '../../fixtures/visitor'
import { test, expect, type Page } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * Signing in with Google or Facebook: the buttons under a news post (the
 * FanSignIn island's ProviderButtons) and on /account (FanProviderButtons,
 * FanSignInOptions and the notices the callback leaves in the URL).
 *
 * Nothing here reaches a provider, and the dev stack has no keys. The list of
 * configured providers is served through page.route, and the redirect the
 * buttons lead to is stubbed so the test can read the address it was sent to.
 * Like post-comments.spec.ts this opens a post that is already built, so it
 * needs no rebuild.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: anonymousVisitor() })

/** See post-comments.spec.ts: the built News page's first article that is not another spec's fixture. */
async function firstArticleUrl(page: Page, section: string): Promise<string | null> {
  await page.goto(`${WEB}/en/${section}/`)
  const links = await page.locator('a.nf-featured, a.nf-card').evaluateAll((as) =>
    [...new Set(as.map((a) => a.getAttribute('href')).filter((h): h is string => !!h))])
  const own = links.find((h) => !/\/e2e-/i.test(h))
  return own ? new URL(own, WEB).href : null
}

function providers(page: Page, list: string[]) {
  return page.route('**/api/fan/auth/providers', (route) => route.fulfill({ json: { providers: list } }))
}

async function openComments(page: Page, url: string) {
  await page.goto(url)
  const block = page.getByTestId('post-comments')
  await block.scrollIntoViewIfNeeded()
  await expect(block).toHaveAttribute('data-loaded', 'true')
}

test.describe.serial('Public — fan sign-in with Google or Facebook, under a post', () => {
  failOnPageError()

  let article: string

  test.beforeAll(async ({ browser, request }) => {
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.posts === false, 'News module is off')
    const section = config?.module_config?.posts?.slug || 'posts'

    const page = await browser.newPage()
    const url = await firstArticleUrl(page, section)
    await page.close()
    test.skip(url === null, 'Needs a published post that is not an E2E fixture')
    article = url!
  })

  // Fails if ProviderButtons renders its divider/wrapper without a provider (the v-if on providers.length).
  test('no provider configured: no buttons and no divider under a post', async ({ page }) => {
    await providers(page, [])
    await openComments(page, article)

    await expect(page.getByTestId('fan-signin')).toBeVisible()
    await expect(page.getByTestId('fan-providers')).toHaveCount(0)
    await expect(page.getByTestId('fan-provider-google')).toHaveCount(0)
    await expect(page.getByTestId('fan-signin-email')).toBeVisible()
    await expect(page.getByTestId('fan-signin-password')).toBeVisible()
  })

  // Fails if the click handler stops sending lang/return_to/claim_hash, or stops
  // storing the claim and return path the callback's link is later matched against.
  test('google configured: the button leads to the redirect with lang, return_to and a claim_hash', async ({ page }) => {
    await providers(page, ['google'])
    const seen: string[] = []
    await page.route('**/api/fan/auth/google/redirect**', (route) => {
      seen.push(route.request().url())
      return route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' })
    })
    await openComments(page, article)

    await expect(page.getByTestId('fan-provider-google')).toBeVisible()
    await expect(page.getByTestId('fan-provider-facebook')).toHaveCount(0)
    await page.getByTestId('fan-provider-google').click()
    await expect.poll(() => seen.length).toBeGreaterThan(0)

    const params = new URL(seen[0]).searchParams
    expect(params.get('lang')).toBe('en')
    expect(params.get('return_to')).toBe(new URL(article).pathname + '#comments')
    const hash = params.get('claim_hash') ?? ''
    expect(hash).toMatch(/^[a-f0-9]{64}$/)

    // The browser keeps the secret the hash was made from, and where to come back to.
    const stored = await page.evaluate(() => ({
      claim: localStorage.getItem('fan_claim'),
      back: localStorage.getItem('fan_return_to'),
    }))
    expect(stored.claim).toMatch(/^[a-f0-9]{64}$/)
    expect(stored.claim).not.toBe(hash)
    expect(stored.back).toBe(new URL(article).pathname + '#comments')
  })

  // Fails if a navigation that never happens (Stop on a slow connection) leaves dead buttons,
  // or a second press forgets the claim the first one replaced.
  test('a button works again when the page is still there, and keeps the earlier claim aside', async ({ page }) => {
    await providers(page, ['google'])
    let asked = 0
    await page.route('**/api/fan/auth/google/redirect**', (route) => {
      asked++
      return route.fulfill({ status: 204 })
    })
    await openComments(page, article)
    await page.evaluate(() => localStorage.setItem('fan_claim', 'the registration'))

    const button = page.getByTestId('fan-provider-google')
    await button.click()
    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(button).not.toHaveAttribute('aria-disabled', 'true', { timeout: 8000 })
    await button.click()
    await expect.poll(() => asked).toBe(2)

    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('fan_claim_kept') ?? 'null'))
    expect(kept).toEqual({
      own: await page.evaluate(() => localStorage.getItem('fan_claim')),
      earlier: 'the registration',
    })
  })

  // Fails if the link's plain href starts carrying a claim, or loses rel="nofollow".
  test('a plain href (middle click, no JS) carries no claim_hash and is rel=nofollow', async ({ page }) => {
    await providers(page, ['google', 'facebook'])
    await openComments(page, article)

    for (const p of ['google', 'facebook']) {
      const link = page.getByTestId(`fan-provider-${p}`)
      await expect(link).toHaveAttribute('rel', 'nofollow')
      const href = (await link.getAttribute('href'))!
      const url = new URL(href, WEB)
      expect(url.pathname).toBe(`/api/fan/auth/${p}/redirect`)
      expect(url.searchParams.get('lang')).toBe('en')
      expect(url.searchParams.get('return_to')).toBe(new URL(article).pathname + '#comments')
      expect(url.searchParams.has('claim_hash')).toBe(false)
    }
    // Looking at the links made no claim.
    expect(await page.evaluate(() => localStorage.getItem('fan_claim'))).toBeNull()
  })

  // Fails if a failed providers request starts hiding or breaking the password form.
  test('a providers endpoint answering 500 leaves the password form usable with no buttons', async ({ page }) => {
    await page.route('**/api/fan/auth/providers', (route) => route.fulfill({ status: 500, json: { message: 'boom' } }))
    await openComments(page, article)

    await expect(page.getByTestId('fan-providers')).toHaveCount(0)
    await page.getByTestId('fan-signin-email').fill('e2e-nobody@bandms.test')
    await page.getByTestId('fan-signin-password').fill('not a real password')
    await expect(page.getByTestId('fan-signin-submit')).toBeEnabled()
    await page.getByTestId('fan-signin-submit').click()
    // The form answered (a refusal), rather than being absent or inert.
    await expect(page.getByTestId('fan-signin-error')).toBeVisible()
  })
})

test.describe('Public — fan sign-in with Google or Facebook, on /account', () => {
  failOnPageError()

  // Fails if FanAccountView stops reading auth_error / auth_notice, or leaves them in the URL.
  for (const [query, testId, words] of [
    ['auth_error=cancelled', 'fan-auth-error', 'cancelled'],
    ['auth_error=no_email', 'fan-auth-error', 'email address'],
    ['auth_error=failed', 'fan-auth-error', 'Could not sign you in'],
    ['auth_notice=confirm_email', 'fan-auth-notice', 'Open it in this browser'],
  ] as const) {
    test(`/account shows a worded message for ${query} and cleans the URL`, async ({ page }) => {
      await providers(page, [])
      await page.goto(`/account?lang=en&${query}`)

      await expect(page.getByTestId(testId)).toContainText(words)
      await expect(page.getByTestId('fan-login')).toBeVisible()
      await expect.poll(() => new URL(page.url()).search).not.toContain('auth_')
      expect(new URL(page.url()).searchParams.get('lang')).toBe('en')
    })
  }

  // Fails if the notice path starts consuming (or clearing) the claim, or keeps Facebook's #_=_.
  test('?auth_notice=confirm_email leaves fan_claim untouched and #_=_ is dropped', async ({ page }) => {
    await providers(page, [])
    await page.goto('/account?lang=en')
    await page.evaluate(() => localStorage.setItem('fan_claim', 'e2e-claim'))

    await page.goto('/account?lang=en&auth_notice=confirm_email#_=_')
    await expect(page.getByTestId('fan-auth-notice')).toBeVisible()
    await expect.poll(() => new URL(page.url()).hash).toBe('')
    await expect.poll(() => new URL(page.url()).search).not.toContain('auth_notice')
    expect(await page.evaluate(() => localStorage.getItem('fan_claim'))).toBe('e2e-claim')
  })

  /** A fan the API never heard of, every answer about them stubbed. */
  async function stubFan(page: Page, linked: string[]) {
    const fan = {
      id: 900001, email: 'e2e-linked@bandms.test', name: 'e2e-linked', display_name: null,
      newsletter_subscribed: false, comments_blocked: false, has_password: false,
      password_needs_current: false, providers: linked,
    }
    await page.route('**/api/fan/me', (route) => route.fulfill({ json: fan }))
    await page.route('**/api/fan/tickets', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/fan/orders', (route) => route.fulfill({ json: [] }))
    return fan
  }

  async function signedIn(page: Page, linked: string[]) {
    const fan = await stubFan(page, linked)
    await page.addInitScript(([token, profile]) => {
      localStorage.setItem('fan_token', token)
      localStorage.setItem('fan', profile)
    }, ['linked-token', JSON.stringify(fan)] as const)
  }

  // Fails if a pressed provider button costs a registration its claim: the mail already
  // sent would then activate no password.
  test('a cancelled provider sign-in gives the registration its claim back', async ({ page }) => {
    await providers(page, ['google', 'facebook'])
    await page.route('**/api/fan/auth/register', (route) => route.fulfill({ json: { message: 'Check your email.' } }))
    const redirects: string[] = []
    await page.route('**/api/fan/auth/*/redirect**', (route) => {
      redirects.push(route.request().url())
      return route.fulfill({ status: 200, contentType: 'text/html', body: 'the provider' })
    })
    const claim = () => page.evaluate(() => localStorage.getItem('fan_claim'))

    await page.goto('/account?lang=en')
    await page.getByTestId('fan-login-mode').click()
    await page.getByTestId('fan-login-email').fill('e2e-newcomer@bandms.test')
    await page.getByTestId('fan-login-password').fill('a long password')
    await page.getByTestId('fan-login-submit').click()
    await expect(page.getByTestId('fan-login-notice')).toBeVisible()
    const registration = await claim()
    expect(registration).toMatch(/^[a-f0-9]{64}$/)

    // Twice: the second press must not take the first one's claim for the registration's.
    for (const provider of ['google', 'facebook']) {
      await page.goto('/account?lang=en')
      await page.getByTestId(`fan-provider-${provider}`).click()
      await expect(page.getByText('the provider')).toBeVisible()
    }
    expect(redirects).toHaveLength(2)
    expect(await page.evaluate(() => localStorage.getItem('fan_claim'))).not.toBe(registration)

    await page.goto('/account?lang=en&auth_error=cancelled')
    await expect(page.getByTestId('fan-auth-error')).toBeVisible()
    expect(await claim()).toBe(registration)
    expect(await page.evaluate(() => localStorage.getItem('fan_claim_kept'))).toBeNull()
  })

  // Fails if the kept claim is not settled by the other two ways a provider sign-in ends.
  for (const [end, expected] of [
    ['auth_notice=confirm_email', 'the press'],
    ['token=e2e-social-token', 'the registration'],
  ] as const) {
    test(`after ${end} the claim left is that of ${expected}`, async ({ page }) => {
      await providers(page, [])
      const fan = await stubFan(page, ['google'])
      await page.route('**/api/fan/auth/verify**', (route) =>
        route.fulfill({ json: { token: 'new-session', fan, password_set: false, linked: null } }))
      await page.addInitScript(() => {
        if (sessionStorage.getItem('seeded')) return
        sessionStorage.setItem('seeded', '1')
        localStorage.setItem('fan_claim', 'the press')
        localStorage.setItem('fan_claim_kept', JSON.stringify({ own: 'the press', earlier: 'the registration' }))
      })

      await page.goto(`/account?lang=en&${end}`)
      await expect.poll(() => page.evaluate(() => localStorage.getItem('fan_claim_kept'))).toBeNull()
      expect(await page.evaluate(() => localStorage.getItem('fan_claim'))).toBe(expected)
    })
  }

  // Fails if the button sends the browser's language: it would come back as ?lang= and be
  // stored as if the fan had chosen it.
  test('a provider button carries a language only when the fan chose one', async ({ page }) => {
    await providers(page, ['google'])
    const lang = async () =>
      new URL((await page.getByTestId('fan-provider-google').getAttribute('href'))!, 'http://x').searchParams.get('lang')

    await page.goto('/account')
    expect(await lang()).toBeNull()
    await page.goto('/account?lang=pl')
    expect(await lang()).toBe('pl')
    await page.goto('/account')
    expect(await lang()).toBe('pl')
  })

  // Fails if the page's own 401 takes the message of the sign-in that just failed with it.
  test('a lapsed session does not take the sign-in message with it; trying a password does', async ({ page }) => {
    await signedIn(page, [])
    await providers(page, [])
    await page.route('**/api/fan/me', (route) => route.fulfill({ status: 401, json: { message: 'expired' } }))
    await page.route('**/api/fan/auth/login', (route) =>
      route.fulfill({ status: 422, json: { message: 'Wrong.', code: 'login_failed' } }))

    await page.goto('/account?lang=en&auth_error=cancelled')
    await expect(page.getByTestId('fan-login')).toBeVisible()
    await expect(page.getByTestId('fan-auth-error')).toBeVisible()

    await page.getByTestId('fan-login-email').fill('e2e-nobody@bandms.test')
    await page.getByTestId('fan-login-password').fill('not a real password')
    await page.getByTestId('fan-login-submit').click()
    await expect(page.getByTestId('fan-login-error')).toBeVisible()
    await expect(page.getByTestId('fan-auth-error')).toHaveCount(0)
  })

  // Fails if a navigation that never happens (Stop on a slow connection) leaves dead buttons.
  test('a provider button works again when the page is still there', async ({ page }) => {
    await providers(page, ['google'])
    let asked = 0
    // A 204 is an answer the browser stays on the page for, as it does after Stop.
    await page.route('**/api/fan/auth/google/redirect**', (route) => {
      asked++
      return route.fulfill({ status: 204 })
    })
    await page.goto('/account?lang=en')
    const button = page.getByTestId('fan-provider-google')
    await button.click()
    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(button).not.toHaveAttribute('aria-disabled', 'true', { timeout: 8000 })
    await button.click()
    await expect.poll(() => asked).toBe(2)
  })

  // Fails if FanSignInOptions stops listing the providers the fan has linked.
  test('/account lists linked providers', async ({ page }) => {
    await signedIn(page, ['google'])
    await providers(page, ['google', 'facebook'])

    await page.goto('/account?lang=en')
    const line = page.getByTestId('fan-linked-providers')
    await expect(line).toContainText('Google')
    await expect(line).not.toContainText('Facebook')
  })

  // Fails if the "nothing connected" line names a provider the band has no keys for.
  for (const [list, lang, words, absent] of [
    [['google'], 'en', 'No Google account is connected yet', 'Facebook'],
    [['facebook'], 'pl', 'połączonego konta Facebook.', 'Google'],
    [['google', 'facebook'], 'en', 'No Google or Facebook account', null],
    [['google', 'facebook'], 'pl', 'konta Google lub Facebook.', null],
  ] as const) {
    test(`/account says what could be connected: ${list.join(' and ')}, ${lang}`, async ({ page }) => {
      await signedIn(page, [])
      await providers(page, [...list])

      await page.goto(`/account?lang=${lang}`)
      const line = page.getByTestId('fan-linked-providers')
      await expect(line).toContainText(words)
      if (absent) await expect(line).not.toContainText(absent)
    })
  }

  // Fails if the exchange of a token that came with Facebook's #_=_ stops, or the page
  // stops naming the account it connected.
  test('a token arriving with #_=_ signs in and says which account was connected', async ({ page }) => {
    await providers(page, ['facebook'])
    const fan = await stubFan(page, ['facebook'])
    const asked: string[] = []
    await page.route('**/api/fan/auth/verify**', (route) => {
      asked.push(new URL(route.request().url()).searchParams.get('token') ?? '')
      return route.fulfill({ json: { token: 'new-session', fan, password_set: false, linked: 'facebook' } })
    })

    await page.goto('/account?lang=en&token=e2e-social-token#_=_')
    await expect(page.getByTestId('fan-linked-now')).toContainText('Facebook')
    await expect(page.getByTestId('fan-linked-providers')).toContainText('Facebook')
    expect(asked).toEqual(['e2e-social-token'])

    const url = new URL(page.url())
    expect(url.hash).toBe('')
    expect(url.searchParams.has('token')).toBe(false)
    expect(await page.evaluate(() => localStorage.getItem('fan_token'))).toBe('new-session')
  })

  // Fails if the page goes back to having no CSS: borderless fields against the screen's edge.
  test('/account draws its fields and buttons, and keeps off the edge of a phone', async ({ page }) => {
    await providers(page, ['google', 'facebook'])
    await page.setViewportSize({ width: 400, height: 900 })
    await page.goto('/account?lang=en')
    await expect(page.getByTestId('fan-provider-facebook')).toBeVisible()

    for (const id of ['fan-login-email', 'fan-login-password', 'fan-login-submit', 'fan-provider-google']) {
      const el = page.getByTestId(id)
      const box = (await el.boundingBox())!
      expect(box.height, `${id} height`).toBeGreaterThanOrEqual(44)
      expect(box.x, `${id} left`).toBeGreaterThanOrEqual(16)
      expect(box.x + box.width, `${id} right`).toBeLessThanOrEqual(400 - 16)
      const border = await el.evaluate((node) => parseFloat(getComputedStyle(node).borderTopWidth))
      expect(border, `${id} border`).toBeGreaterThan(0)
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    const submit = await page.getByTestId('fan-login-submit').evaluate((node) => getComputedStyle(node).backgroundColor)
    expect(submit).toBe('rgb(18, 18, 18)')
  })

  // Fails if FanLoginForm stops rendering FanProviderButtons for what the API lists.
  test('/account offers a button for each configured provider', async ({ page }) => {
    await providers(page, ['google', 'facebook'])
    await page.goto('/account?lang=en')
    await expect(page.getByTestId('fan-provider-google')).toBeVisible()
    await expect(page.getByTestId('fan-provider-facebook')).toBeVisible()
    const href = (await page.getByTestId('fan-provider-google').getAttribute('href'))!
    expect(new URL(href, 'http://x').searchParams.has('claim_hash')).toBe(false)
    expect(new URL(href, 'http://x').searchParams.has('return_to')).toBe(false)
  })
})

test.describe('Public — fan sign-in with Google or Facebook, the real API', () => {
  // Fails if the providers list leaks an unconfigured provider, or the redirect answers a
  // browser without a key with anything but the account page.
  test('with no keys set the API lists no providers and the redirect goes to /account', async ({ request }) => {
    const list = await request.get(`${API}/api/fan/auth/providers`)
    expect(list.status()).toBe(200)
    const body = (await list.json()) as { providers: string[] }
    test.skip(body.providers.length > 0, `Keys are set locally (${body.providers.join(', ')})`)
    expect(body).toEqual({ providers: [] })

    const redirect = await request.get(`${API}/api/fan/auth/google/redirect?lang=pl`, { maxRedirects: 0 })
    expect(redirect.status()).toBe(302)
    const target = new URL(redirect.headers().location)
    expect(target.pathname).toBe('/account')
    expect(target.searchParams.get('auth_error')).toBe('failed')
    expect(target.searchParams.get('lang')).toBe('pl')
  })
})

test.describe('Public — the privacy page covers social sign-in', () => {
  // Fails if the default paragraph is removed from the privacy copy registry.
  for (const [lang, words] of [
    ['en', 'If you sign in with Google or Facebook'],
    ['pl', 'Jeśli logujesz się przez Google lub Facebooka'],
  ] as const) {
    test(`/${lang}/privacy carries the paragraph`, async ({ page, request }) => {
      const config = await (await request.get(`${API}/api/site-config?lang=${lang}`)).json()
      const data = config.data ?? config
      test.skip(data?.modules?.privacy === false, 'Privacy module is off')
      test.skip(!!data?.module_config?.privacy?.settings?.socialSignInBody, 'The band wrote their own text')

      const response = await page.goto(`${WEB}/${lang}/privacy/`)
      expect(response?.status()).toBe(200)
      await expect(page.getByText(words, { exact: false })).toBeVisible()
    })
  }
})
