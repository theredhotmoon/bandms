import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A news article ends with "Back to all news": below the previous/next
 * pair and "More from the blog", the last thing before the footer. It used
 * to sit straight under the article, above prev/next.
 *
 * Read-only: it opens a post that is already built, so it seeds nothing and
 * needs no rebuild. A published post that 404s is a failure, not a skip.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Public — news article back link', () => {
  failOnPageError()

  test('sits below previous/next, just above the footer', async ({ page, request }) => {
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.posts === false, 'News module is off')
    const posts = ((await (await request.get(`${API}/api/posts?lang=en`)).json()).data ?? []) as { slug: string }[]
    // Two posts at least, so the page has a previous or a next to sit below.
    test.skip(posts.length < 2, 'Needs two published posts')

    // An empty slug means the module key, as the site itself resolves it.
    const section = config?.module_config?.posts?.slug || 'posts'
    const res = await page.goto(`${WEB}/en/${section}/${posts[0].slug}/`)
    expect(res?.status(), 'a published post must be built').toBe(200)

    const back = page.locator('.art-back-btn')
    await expect(back).toHaveCount(1)
    await expect(back).toBeVisible()

    // In page order: prev/next, then "more" (when there is one), then back, then the footer.
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.art-prevnext, .art-more-sec, .art-back, footer.ft')].map((el) =>
        el.matches('.art-prevnext') ? 'prevnext' : el.matches('.art-more-sec') ? 'more' : el.matches('.art-back') ? 'back' : 'footer'),
    )
    expect(order[0]).toBe('prevnext')
    expect(order.slice(-2)).toEqual(['back', 'footer'])

    // On the dark ground that runs into the footer, not a paper strip between two dark blocks.
    await expect(page.locator('.art-back-sec')).toHaveCSS('background-color', await page.locator('footer.ft').evaluate((el) => getComputedStyle(el).backgroundColor))
  })
})
