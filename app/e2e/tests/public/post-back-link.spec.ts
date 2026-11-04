import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A news article ends with "Back to all news": below the previous/next
 * pair and "More from the blog", the last thing before the footer. It used
 * to sit straight under the article, above prev/next.
 *
 * Read-only: it opens a post that is already built, so it seeds nothing and
 * needs no rebuild. The post is picked from the *built* News page, not from
 * the API. The API's newest post may be one a parallel spec published after
 * the last rebuild, which the site has not built yet, so "API post 0 must
 * be built" 404'd whenever a seed beat the next rebuild. The News page's
 * links come from the same build as the article pages. A linked post that
 * 404s is a failure, not a skip.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Public — news article back link', () => {
  failOnPageError()

  test('sits below previous/next, just above the footer', async ({ page, request }) => {
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.posts === false, 'News module is off')
    // An empty slug means the module key, as the site itself resolves it.
    const section = config?.module_config?.posts?.slug || 'posts'
    await page.goto(`${WEB}/en/${section}/`)
    const links = await page.locator('a.nf-featured, a.nf-card').evaluateAll((as) =>
      [...new Set(as.map((a) => a.getAttribute('href')).filter((h): h is string => !!h))])
    // Two posts at least, so the page has a previous or a next to sit below.
    test.skip(links.length < 2, 'Needs two published posts')

    const res = await page.goto(new URL(links[0], WEB).href)
    expect(res?.status(), `the News page links ${links[0]}, which must be built`).toBe(200)

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
