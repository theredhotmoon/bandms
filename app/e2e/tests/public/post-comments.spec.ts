import { test, expect, type Page } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { seedFanSession, type SeededFanSession } from '../../fixtures/seed'

/**
 * Comments under a news article (PostComments island).
 *
 * The list and every write go to the API from the browser — nothing is baked —
 * so this spec needs no rebuild: it opens a post that is already built and
 * talks to the real API with a seeded fan session. The sign-in mail request is
 * stubbed (page.route). Posting a comment does queue the band's notification
 * mail for real; the dev stack sets no MAIL_MAILER, so it goes to the log.
 * Point the dev mailer at a real server and this spec will mail whoever is a
 * superadmin in the dev database.
 *
 * It only ever adds a comment by its own e2e- fan and deletes it again; the
 * teardown purge removes the fan (and anything a failed run left) by cascade.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * The first article the built News page links to — see post-back-link.spec.ts
 * for why not the API's — that is not another spec's fixture. Parallel specs
 * publish "E2E …" posts and delete them again (admin/comments.spec.ts even
 * switches comments off on its own), so a post slugged e2e-… can vanish or
 * refuse comments mid-test.
 */
async function firstArticleUrl(page: Page, section: string): Promise<string | null> {
  await page.goto(`${WEB}/en/${section}/`)
  const links = await page.locator('a.nf-featured, a.nf-card').evaluateAll((as) =>
    [...new Set(as.map((a) => a.getAttribute('href')).filter((h): h is string => !!h))])
  const own = links.find((h) => !/\/e2e-/i.test(h))
  return own ? new URL(own, WEB).href : null
}

async function signIn(page: Page, fan: SeededFanSession) {
  await page.addInitScript(([token, profile]) => {
    localStorage.setItem('fan_token', token)
    localStorage.setItem('fan', profile)
  }, [fan.token, JSON.stringify({ id: fan.fan_id, email: fan.email, name: fan.name })] as const)
}

test.describe.serial('Public — news comments', () => {
  failOnPageError()

  let article: string
  let fan: SeededFanSession
  const text = `E2E comment ${Date.now()}-${Math.floor(Math.random() * 1000)}\nsecond line`
  const name = `E2E Fan ${Math.floor(Math.random() * 100000)}`

  test.beforeAll(async ({ browser, request }) => {
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.posts === false, 'News module is off')
    const section = config?.module_config?.posts?.slug || 'posts'

    const page = await browser.newPage()
    const url = await firstArticleUrl(page, section)
    await page.close()
    test.skip(url === null, 'Needs a published post that is not an E2E fixture')
    article = url!

    fan = seedFanSession()
  })

  test('a signed-out visitor is asked to sign in, and the link returns to this post', async ({ page }) => {
    let sent: { email?: string; return_to?: string } = {}
    await page.route('**/api/fan/auth/magic-link', (route) => {
      sent = route.request().postDataJSON()
      return route.fulfill({ json: { message: 'Magic link sent to your email.' } })
    })

    const res = await page.goto(article)
    expect(res?.status()).toBe(200)

    const block = page.getByTestId('post-comments')
    await block.scrollIntoViewIfNeeded()
    await expect(block).toHaveAttribute('data-loaded', 'true')
    await expect(block.getByRole('heading', { name: /^Comments/ })).toBeVisible()
    await expect(page.getByTestId('comment-form')).toHaveCount(0)

    const signin = page.getByTestId('comment-signin')
    await signin.getByLabel('Your email').fill('e2e-visitor@bandms.test')
    await signin.getByRole('button', { name: 'Send me a sign-in link' }).click()

    await expect(signin).toContainText('Check your inbox')
    expect(sent.email).toBe('e2e-visitor@bandms.test')
    const returnTo = `${new URL(article).pathname.replace(/\/$/, '')}#comments`
    expect(sent.return_to).toBe(returnTo)
    // Noted in this browser, so the account page will follow the link back here.
    expect(await page.evaluate(() => localStorage.getItem('fan_return_to'))).toBe(returnTo)
  })

  test('a signed-in fan picks a name, comments, sees it at once and after a reload', async ({ page, request }) => {
    await signIn(page, fan)
    const listed = page.waitForResponse((r) => /\/api\/posts\/\d+\/comments$/.test(new URL(r.url()).pathname))
    await page.goto(article)
    await page.getByTestId('post-comments').scrollIntoViewIfNeeded()
    const postId = Number(new URL((await listed).url()).pathname.split('/')[3])

    await expect(page.getByTestId('comment-signin')).toHaveCount(0)
    await expect(page.getByTestId('comment-signed-in')).toContainText(fan.email)

    // First comment: the public name is asked for, never taken from the account.
    await page.getByTestId('comment-name').fill(name)
    await page.getByTestId('comment-body').fill(text)
    await page.getByTestId('comment-submit').click()

    const mine = page.getByTestId('comment-item').filter({ hasText: text.split('\n')[0] })
    await expect(mine).toHaveCount(1)
    await expect(mine).toContainText(name)
    await expect(mine).not.toContainText(fan.email)
    // Line breaks survive, as text — the body is never rendered as HTML.
    await expect(mine.locator('.pc-body')).toHaveCSS('white-space', 'pre-line')
    await expect(page.getByTestId('comment-body')).toHaveValue('')
    // The name is asked once.
    await expect(page.getByTestId('comment-name')).toHaveCount(0)

    // It is public: an anonymous API read has it, under the chosen name only.
    const api = await (await request.get(`${API}/api/posts/${postId}/comments`)).json()
    const row = api.data.find((c: { body: string }) => c.body === text)
    expect(row).toMatchObject({ author_name: name, mine: false })
    expect(JSON.stringify(api)).not.toContain(fan.email)

    await page.reload()
    await page.getByTestId('post-comments').scrollIntoViewIfNeeded()
    await expect(page.getByTestId('comment-item').filter({ hasText: text.split('\n')[0] })).toHaveCount(1)
  })

  test('the fan deletes their own comment with a second click', async ({ page }) => {
    await signIn(page, fan)
    await page.goto(article)
    await page.getByTestId('post-comments').scrollIntoViewIfNeeded()

    const mine = page.getByTestId('comment-item').filter({ hasText: text.split('\n')[0] })
    await expect(mine).toHaveCount(1)
    const del = mine.getByTestId('comment-delete')

    await del.click()
    await expect(del).toHaveText('Click again to delete')
    await expect(mine).toHaveCount(1)
    await del.click()

    await expect(mine).toHaveCount(0)
    await page.reload()
    await page.getByTestId('post-comments').scrollIntoViewIfNeeded()
    await expect(page.getByTestId('post-comments')).toHaveAttribute('data-loaded', 'true')
    await expect(page.getByTestId('comment-item').filter({ hasText: text.split('\n')[0] })).toHaveCount(0)
  })

  test('a lapsed session falls back to the sign-in form instead of an error', async ({ page }) => {
    await signIn(page, { ...fan, token: 'no-such-session' })
    await page.goto(article)
    await page.getByTestId('post-comments').scrollIntoViewIfNeeded()

    await expect(page.getByTestId('comment-signin')).toBeVisible()
    await expect(page.getByTestId('comment-error')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('fan_token'))).toBeNull()
  })

  test('a fan over the comment limit is told when they can comment again', async ({ page }) => {
    const limit = 'You have posted a lot in a short time. You can comment again in 8 minutes.'
    let coded = true
    await page.route(/\/api\/fan\/posts\/\d+\/comments$/, (route) => route.fulfill({
      status: 429,
      // The route throttle's own 429 has no code and a framework message in English.
      json: coded ? { message: limit, code: 'comment_limit' } : { message: 'Too Many Attempts.' },
    }))
    await signIn(page, fan)
    await page.goto(article)
    await page.getByTestId('post-comments').scrollIntoViewIfNeeded()

    await page.getByTestId('comment-body').fill('One more')
    await page.getByTestId('comment-submit').click()
    await expect(page.getByTestId('comment-error')).toHaveText(limit)
    // Nothing was posted, and what the fan typed is still there to send later.
    await expect(page.getByTestId('comment-body')).toHaveValue('One more')

    coded = false
    await page.getByTestId('comment-submit').click()
    await expect(page.getByTestId('comment-error')).toHaveText('Something went wrong. Please try again.')
  })

  test('the block disappears when the API says comments are off for the post', async ({ page }) => {
    await page.route(/\/api\/posts\/\d+\/comments$/, (route) =>
      route.fulfill({ json: { data: [], enabled: false } }))

    await page.goto(article)
    await page.locator('#comments').scrollIntoViewIfNeeded()

    await expect(page.getByTestId('post-comments')).toHaveCount(0)
  })
})
