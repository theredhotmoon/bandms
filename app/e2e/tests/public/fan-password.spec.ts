import { anonymousVisitor } from '../../fixtures/visitor'
import { test, expect, type Page } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { seedFanSession, type SeededFanSession } from '../../fixtures/seed'

/**
 * Signing in with a password: under a news post (the FanSignIn island) and on
 * /account (the SPA's FanLoginForm and FanSignInOptions).
 *
 * The seeded fan is a real account with a real password hash, so sign-in goes
 * to the real API. Only account creation is stubbed — it would mail a stranger
 * — and its request is inspected instead. Like post-comments.spec.ts this needs
 * no rebuild: it opens a post that is already built. The fans are e2e-…, so the
 * teardown purge removes them and the comment the first test writes.
 *
 * The two forms are different components with different test ids: the post's is
 * fan-signin-*, the account page's is fan-login-* (its `fan-signin-options` is
 * the password-settings section).
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'
const PASSWORD = 'correct horse battery'

test.use({ storageState: anonymousVisitor() })

/** See post-comments.spec.ts: the built News page's first article that is not another spec's fixture. */
async function firstArticleUrl(page: Page, section: string): Promise<string | null> {
  await page.goto(`${WEB}/en/${section}/`)
  const links = await page.locator('a.nf-featured, a.nf-card').evaluateAll((as) =>
    [...new Set(as.map((a) => a.getAttribute('href')).filter((h): h is string => !!h))])
  const own = links.find((h) => !/\/e2e-/i.test(h))
  return own ? new URL(own, WEB).href : null
}

/** The account page's own session, as the SPA stores it. */
async function storeSession(page: Page, fan: SeededFanSession) {
  await page.addInitScript(([token, profile]) => {
    localStorage.setItem('fan_token', token)
    localStorage.setItem('fan', profile)
  }, [fan.token, JSON.stringify({ id: fan.fan_id, email: fan.email, name: fan.name })] as const)
}

/** A fan the API never heard of, for specs that stub every answer about them. */
function cannedFan(id: number, email: string) {
  return {
    id, email, name: email, display_name: null as string | null, newsletter_subscribed: false, comments_blocked: false,
    has_password: false, password_needs_current: false,
  }
}

/** Signs the browser in once, so a later reload of the page keeps what the test did since. */
async function startSession(page: Page, token: string, fan: ReturnType<typeof cannedFan>) {
  await page.addInitScript(([value, profile]) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('fan_token', value)
    localStorage.setItem('fan', profile)
  }, [token, JSON.stringify(fan)] as const)
}

/** Answers every request about the two fans by the token that asked. */
async function stubFans(page: Page, fans: Record<string, ReturnType<typeof cannedFan>>) {
  await page.route('**/api/fan/me', (route) => {
    const token = (route.request().headers().authorization ?? '').replace('Bearer ', '')
    return fans[token] ? route.fulfill({ json: fans[token] }) : route.fulfill({ status: 401, json: { message: 'expired' } })
  })
  await page.route('**/api/fan/auth/logout', (route) => route.fulfill({ json: {} }))
}

function cannedComment(id: number, body: string, mine = false) {
  return { id, author_name: 'E2E Fan', body, created_at: '2026-11-24T10:00:00Z', mine }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

async function openComments(page: Page, url: string) {
  await page.goto(url)
  const block = page.getByTestId('post-comments')
  await block.scrollIntoViewIfNeeded()
  await expect(block).toHaveAttribute('data-loaded', 'true')
}

test.describe.serial('Public — fan password sign-in', () => {
  failOnPageError()

  let article: string
  let fan: SeededFanSession
  const text = `E2E password comment ${Date.now()}-${Math.floor(Math.random() * 1000)}`

  test.beforeAll(async ({ browser, request }) => {
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.posts === false, 'News module is off')
    const section = config?.module_config?.posts?.slug || 'posts'

    const page = await browser.newPage()
    const url = await firstArticleUrl(page, section)
    await page.close()
    test.skip(url === null, 'Needs a published post that is not an E2E fixture')
    article = url!

    fan = seedFanSession({ password: PASSWORD, displayName: `E2E Pw Fan ${Math.floor(Math.random() * 100000)}` })
  })

  test('a fan signs in with a password under a post and comments', async ({ page }) => {
    await openComments(page, article)
    await expect(page.getByTestId('comment-form')).toHaveCount(0)

    await page.getByTestId('fan-signin-email').fill(fan.email)
    await page.getByTestId('fan-signin-password').fill(PASSWORD)
    await page.getByTestId('fan-signin-submit').click()

    await expect(page.getByTestId('comment-signed-in')).toContainText(fan.email)
    await expect(page.getByTestId('fan-signin')).toHaveCount(0)
    // The password is never kept in the browser.
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(PASSWORD)

    // The seeded fan already has a public name, so the first-comment prompt is skipped.
    await page.getByTestId('comment-body').fill(text)
    await page.getByTestId('comment-submit').click()
    await expect(page.getByTestId('comment-item').filter({ hasText: text })).toHaveCount(1)
  })

  test('a wrong password says so and offers the email link', async ({ page }) => {
    await openComments(page, article)

    await page.getByTestId('fan-signin-email').fill(fan.email)
    await page.getByTestId('fan-signin-password').fill('definitely not it')
    await page.getByTestId('fan-signin-submit').click()

    await expect(page.getByTestId('fan-signin-error')).toBeVisible()
    await expect(page.getByTestId('fan-signin-link')).toBeVisible()
    await expect(page.getByTestId('comment-signed-in')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('fan_token'))).toBeNull()
  })

  test('creating an account shows "check your email"', async ({ page }) => {
    let body: Record<string, unknown> | null = null
    await page.route('**/api/fan/auth/register', (route) => {
      body = route.request().postDataJSON()
      return route.fulfill({ json: { message: 'Check your email.' } })
    })
    await openComments(page, article)

    await page.getByTestId('fan-signin-register').click()
    await page.getByTestId('fan-signin-email').fill('e2e-newcomer@bandms.test')
    await page.getByTestId('fan-signin-password').fill(PASSWORD)
    await page.getByTestId('fan-signin-submit').click()

    await expect(page.getByTestId('fan-signin-notice')).toBeVisible()
    expect(body).not.toBeNull()
    // The browser proves it asked by sending a hash; the secret itself stays here.
    expect(String(body!.claim_hash)).toMatch(/^[a-f0-9]{64}$/)
    expect(body).not.toHaveProperty('claim')
    expect(body).toMatchObject({ email: 'e2e-newcomer@bandms.test' })
  })

  test('on /account a fan sets a password, signs out and signs back in with it', async ({ page }) => {
    const linkOnly = seedFanSession()
    const password = 'a brand new password'
    await storeSession(page, linkOnly)

    await page.goto('/account?lang=en')
    await expect(page.getByTestId('fan-signin-options')).toBeVisible()
    // No password yet, so no "current password" to ask for.
    await expect(page.getByTestId('fan-new-password')).toBeVisible()
    await expect(page.getByTestId('fan-current-password')).toHaveCount(0)

    await page.getByTestId('fan-new-password').fill(password)
    await page.getByTestId('fan-password-save').click()
    await expect(page.getByTestId('fan-password-saved')).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByTestId('fan-login')).toBeVisible()

    await page.getByTestId('fan-login-email').fill(linkOnly.email)
    await page.getByTestId('fan-login-password').fill(password)
    await page.getByTestId('fan-login-submit').click()

    // The sign-in form is titled "My Account" too, so judge by what only a signed-in page has.
    await expect(page.getByTestId('fan-login')).toHaveCount(0)
    await expect(page.getByText(linkOnly.email)).toBeVisible()
  })

  test('a late answer must not sign a signed-out fan back in', async ({ page }) => {
    const late = seedFanSession()
    await storeSession(page, late)

    // Hold the account page's re-read of the fan until the fan has signed out.
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    let held = 0
    await page.route('**/api/fan/me', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      held++
      await gate
      // A canned 200, not route.continue(): signing out invalidates the session on
      // the server, so the real answer would be a 401 and prove nothing.
      return route.fulfill({
        json: {
          id: late.fan_id, email: late.email, name: late.name,
          newsletter_subscribed: false, has_password: false, password_needs_current: false,
        },
      })
    })

    await page.goto('/account?lang=en')
    await expect.poll(() => held).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByTestId('fan-login')).toBeVisible()

    const answered = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/fan/me')
    release()
    await answered
    // Let the page act on the answer before judging it.
    await page.waitForTimeout(500)

    await expect(page.getByTestId('fan-login')).toBeVisible()
    await expect(page.getByTestId('fan-signin-options')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('fan_token'))).toBeNull()
  })

  test('a sign-in link opened while another fan is signed in ends on the new fan\'s options', async ({ page }) => {
    const old = cannedFan(900001, 'e2e-old@bandms.test')
    const next = cannedFan(900002, 'e2e-next@bandms.test')
    await storeSession(page, { fan_id: old.id, email: old.email, name: old.name, token: 'old-token' } as SeededFanSession)

    const gate = deferred()
    let oldAsked = 0
    await page.route('**/api/fan/me', async (route) => {
      if (route.request().headers().authorization !== 'Bearer old-token') return route.fulfill({ json: next })
      oldAsked++
      await gate.promise
      return route.fulfill({ json: old })
    })
    await page.route('**/api/fan/tickets', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/fan/auth/verify**', async (route) => {
      // The link's answer comes once the old session's re-read is under way.
      await expect.poll(() => oldAsked).toBeGreaterThan(0)
      return route.fulfill({ json: { token: 'next-token', fan: next, password_set: false, linked: null } })
    })

    await page.goto('/account?lang=en&token=e2e-link')
    await expect(page.getByText(next.email)).toBeVisible()
    gate.resolve()

    // Its own re-read answered, so the form shows rather than "Loading…" for good.
    await expect(page.getByTestId('fan-new-password')).toBeVisible()
    await expect(page.getByText(old.email)).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('fan_token'))).toBe('next-token')
  })

  test('a link that never reached the server keeps the password claim; a refused one uses it up', async ({ page }) => {
    await page.goto('/account?lang=en')
    await page.evaluate(() => localStorage.setItem('fan_claim', 'e2e-claim'))

    let presented: string | null = null
    await page.route('**/api/fan/auth/verify**', (route) => {
      presented = new URL(route.request().url()).searchParams.get('claim')
      return route.abort()
    })
    await page.goto('/account?lang=en&token=e2e-link')
    await expect(page.getByTestId('fan-link-error')).toBeVisible()
    expect(presented).toBe('e2e-claim')
    expect(await page.evaluate(() => localStorage.getItem('fan_claim'))).toBe('e2e-claim')

    await page.unroute('**/api/fan/auth/verify**')
    await page.route('**/api/fan/auth/verify**', (route) => route.fulfill({ status: 401, json: { message: 'expired' } }))
    await page.goto('/account?lang=en&token=e2e-link')
    await expect(page.getByTestId('fan-link-error')).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('fan_claim'))).toBeNull()
  })

  for (const late of [200, 401]) {
    test(`under a post, a late ${late} for an old session changes nothing for the fan signed in since`, async ({ page }) => {
      const old = { ...cannedFan(900001, 'e2e-old@bandms.test'), display_name: 'E2E Old' }
      const next = { ...cannedFan(900002, 'e2e-next@bandms.test'), display_name: 'E2E Next' }
      await page.addInitScript((fan) => {
        if (sessionStorage.getItem('seeded')) return
        sessionStorage.setItem('seeded', '1')
        localStorage.setItem('fan_token', 'old-token')
        localStorage.setItem('fan', JSON.stringify(fan))
      }, old)

      const gate = deferred()
      let held = 0
      await page.route('**/api/fan/me', async (route) => {
        const mine = route.request().headers().authorization === 'Bearer old-token' ? old : next
        if (route.request().method() === 'GET') return route.fulfill({ json: mine })
        held++
        await gate.promise
        return late === 200
          ? route.fulfill({ json: { ...old, display_name: 'E2E Renamed' } })
          : route.fulfill({ status: 401, json: { message: 'expired' } })
      })
      await page.route('**/api/fan/auth/logout', (route) => route.fulfill({ json: {} }))
      await page.route('**/api/fan/auth/login', (route) => route.fulfill({ json: { token: 'next-token', fan: next } }))
      await openComments(page, article)

      await page.getByTestId('comment-change-name').click()
      await page.getByTestId('comment-rename').fill('E2E Renamed')
      await page.getByTestId('comment-rename').press('Enter')
      await expect.poll(() => held).toBe(1)

      await page.getByTestId('comment-signout').click()
      await page.getByTestId('fan-signin-email').fill(next.email)
      await page.getByTestId('fan-signin-password').fill(PASSWORD)
      await page.getByTestId('fan-signin-submit').click()
      await expect(page.getByTestId('comment-signed-in')).toContainText(next.email)

      const answered = page.waitForResponse((r) => r.request().method() === 'PUT')
      gate.resolve()
      await answered
      // Let the page act on the answer before judging it.
      await page.waitForTimeout(500)

      await expect(page.getByTestId('comment-signed-in')).toContainText(next.email)
      expect(await page.evaluate(() => localStorage.getItem('fan_token'))).toBe('next-token')
      expect(JSON.parse((await page.evaluate(() => localStorage.getItem('fan')))!)).toMatchObject({ id: next.id, display_name: 'E2E Next' })
    })
  }

  test('a link opened over another fan\'s session never shows that fan\'s tickets or orders', async ({ page }) => {
    const old = cannedFan(900001, 'e2e-old@bandms.test')
    const next = cannedFan(900002, 'e2e-next@bandms.test')
    await startSession(page, 'old-token', old)
    await stubFans(page, { 'old-token': old, 'next-token': next })

    const linkGate = deferred()
    const nextGate = deferred()
    const ticket = (uuid: string, venue: string) => ({
      uuid, status: 'scanned', holder_name: 'E2E', holder_email: null, ticket_type: null, concert_date: null, venue,
    })
    await page.route('**/api/fan/tickets', async (route) => {
      if (route.request().headers().authorization === 'Bearer old-token') return route.fulfill({ json: [ticket('t-old', 'E2E Old Venue')] })
      await nextGate.promise
      return route.fulfill({ json: [ticket('t-next', 'E2E Next Venue')] })
    })
    await page.route('**/api/fan/orders', (route) => route.fulfill({
      json: route.request().headers().authorization === 'Bearer old-token'
        ? [{ uuid: 'o-old', status: 'paid', total: 111, currency: 'PLN', created_at: '2026-11-24T10:00:00Z', items: [] }]
        : [],
    }))
    await page.route('**/api/fan/auth/verify**', async (route) => {
      await linkGate.promise
      return route.fulfill({ json: { token: 'next-token', fan: next, password_set: false, linked: null } })
    })

    await page.goto('/account?lang=en&token=e2e-link')
    // Both lists of the old fan are in the cache before the link's answer comes.
    await page.getByRole('tab', { name: 'Order' }).click()
    await expect(page.getByText('111.00')).toBeVisible()
    await page.getByRole('tab', { name: 'Tickets' }).click()
    await expect(page.getByText('E2E Old Venue')).toBeVisible()

    linkGate.resolve()
    await expect(page.getByText(next.email)).toBeVisible()
    await expect(page.getByText('E2E Old Venue')).toHaveCount(0)
    nextGate.resolve()
    await expect(page.getByText('E2E Next Venue')).toBeVisible()
    await page.getByRole('tab', { name: 'Order' }).click()
    await expect(page.locator('.fol-section')).toBeVisible()
    await expect(page.getByText('111.00')).toHaveCount(0)
  })

  test('a comment posted while the list is on its way stays, once', async ({ page }) => {
    const me = { ...cannedFan(900001, 'e2e-old@bandms.test'), display_name: 'E2E Old' }
    await startSession(page, 'old-token', me)
    await stubFans(page, { 'old-token': me })
    const posted = cannedComment(990002, 'E2E just posted', true)

    const gate = deferred()
    let lists = 0
    await page.route('**/api/posts/*/comments', async (route) => {
      lists++
      // The first list was read before the comment existed, and lands after it.
      if (lists === 1) await gate.promise
      return route.fulfill({ json: { data: lists === 1 ? [] : [cannedComment(990001, 'E2E earlier'), posted], enabled: true } })
    })
    await page.route('**/api/fan/posts/*/comments', (route) => route.fulfill({ status: 201, json: { data: posted } }))

    await page.goto(article)
    await page.getByTestId('post-comments').scrollIntoViewIfNeeded()
    await page.getByTestId('comment-body').fill(posted.body)
    await page.getByTestId('comment-submit').click()
    await expect(page.getByTestId('comment-item')).toHaveCount(1)

    gate.resolve()
    await expect(page.getByTestId('comment-item')).toHaveCount(2)
    await expect(page.getByTestId('comment-item').filter({ hasText: posted.body })).toHaveCount(1)
    expect(lists).toBe(2)
  })

  test('a list asked for before signing out offers no Delete after it', async ({ page }) => {
    const me = { ...cannedFan(900001, 'e2e-old@bandms.test'), display_name: 'E2E Old' }
    await startSession(page, 'old-token', me)
    await stubFans(page, { 'old-token': me })

    const gate = deferred()
    await page.route('**/api/posts/*/comments', async (route) => {
      const mine = route.request().headers().authorization === 'Bearer old-token'
      if (mine) await gate.promise
      return route.fulfill({ json: { data: [cannedComment(990001, 'E2E mine', mine)], enabled: true } })
    })

    await page.goto(article)
    await page.getByTestId('post-comments').scrollIntoViewIfNeeded()
    await page.getByTestId('comment-signout').click()
    await expect(page.getByTestId('fan-signin')).toBeVisible()
    gate.resolve()

    await expect(page.getByTestId('comment-item')).toHaveCount(1)
    await expect(page.getByTestId('comment-delete')).toHaveCount(0)
  })

  test('signing out takes the fan\'s unsent text with it', async ({ page }) => {
    const old = { ...cannedFan(900001, 'e2e-old@bandms.test'), display_name: 'E2E Old' }
    await startSession(page, 'old-token', old)
    // The same fan comes back: for another one the text goes anyway, sign-out or not.
    await stubFans(page, { 'old-token': old, 'next-token': old })
    await page.route('**/api/fan/auth/login', (route) => route.fulfill({ json: { token: 'next-token', fan: old } }))
    await openComments(page, article)

    await page.getByTestId('comment-body').fill('E2E private draft')
    await page.getByTestId('comment-change-name').click()
    await page.getByTestId('comment-rename').fill('E2E private name')
    await page.getByTestId('comment-signout').click()

    await page.getByTestId('fan-signin-email').fill(old.email)
    await page.getByTestId('fan-signin-password').fill(PASSWORD)
    await page.getByTestId('fan-signin-submit').click()
    await expect(page.getByTestId('comment-signed-in')).toContainText(old.email)
    await expect(page.getByTestId('comment-body')).toHaveValue('')
    await expect(page.getByTestId('comment-rename')).toHaveCount(0)
  })

  for (const back of ['the same fan', 'another fan'] as const) {
    test(`a comment refused because the session lapsed is kept for its writer only: ${back} signs in`, async ({ page }) => {
      const old = { ...cannedFan(900001, 'e2e-old@bandms.test'), display_name: 'E2E Old' }
      const next = { ...cannedFan(900002, 'e2e-next@bandms.test'), display_name: 'E2E Next' }
      const signedIn = back === 'the same fan' ? old : next
      await startSession(page, 'old-token', old)
      await stubFans(page, { 'old-token': old, 'next-token': signedIn })
      await page.route('**/api/fan/auth/login', (route) => route.fulfill({ json: { token: 'next-token', fan: signedIn } }))
      await page.route('**/api/fan/posts/*/comments', (route) => route.fulfill({ status: 401, json: { message: 'expired' } }))
      await openComments(page, article)

      await page.getByTestId('comment-body').fill('E2E lapsed draft')
      await page.getByTestId('comment-submit').click()
      await expect(page.getByTestId('fan-signin')).toBeVisible()
      await expect(page.getByTestId('comment-error')).toHaveCount(0)

      await page.getByTestId('fan-signin-email').fill(signedIn.email)
      await page.getByTestId('fan-signin-password').fill(PASSWORD)
      await page.getByTestId('fan-signin-submit').click()
      await expect(page.getByTestId('comment-signed-in')).toContainText(signedIn.email)
      await expect(page.getByTestId('comment-body')).toHaveValue(back === 'the same fan' ? 'E2E lapsed draft' : '')
    })
  }

  test('each sign-in button says what it is doing, and only that one', async ({ page }) => {
    const gate = deferred()
    const hold = (url: string) => page.route(url, async (route) => {
      await gate.promise
      return route.fulfill({ json: { message: 'ok' } })
    })
    await hold('**/api/fan/auth/magic-link')
    await hold('**/api/fan/auth/register')
    await openComments(page, article)

    const submit = page.getByTestId('fan-signin-submit')
    const link = page.getByTestId('fan-signin-link')
    const signIn = (await submit.innerText()).trim()
    const sendLink = (await link.innerText()).trim()
    await page.getByTestId('fan-signin-email').fill('e2e-newcomer@bandms.test')

    await link.click()
    await expect(link).not.toHaveText(sendLink)
    await expect(submit).toHaveText(signIn)

    await openComments(page, article)
    await page.getByTestId('fan-signin-register').click()
    const create = (await submit.innerText()).trim()
    await page.getByTestId('fan-signin-email').fill('e2e-newcomer@bandms.test')
    await page.getByTestId('fan-signin-password').fill(PASSWORD)
    await submit.click()
    await expect(submit).not.toHaveText(create)
    await expect(link).toHaveText(sendLink)

    gate.resolve()
    await expect(page.getByTestId('fan-signin-notice')).toBeVisible()
  })
})
