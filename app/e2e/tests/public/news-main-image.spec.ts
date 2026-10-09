import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { adminHeaders, contentLocaleOrder, moduleSectionSlug, rebuildAndWait, TEST_PNG } from '../../fixtures/admin-api'

/**
 * A post's main image on the news *list* and on the article's "More from the
 * blog" cards.
 *
 * The article page always showed it as its hero. The list never did: the
 * list query selected an explicit column set without `image`, the summary
 * resource had no field for it, and the list island drew a striped
 * placeholder on every card whatever the post held. `astro build` and
 * `vue-tsc` were both green — nothing read a field that did not exist. Only
 * the rendered page shows the gap, which is why this is an E2E spec.
 *
 * No post in the dev database has a main image, so this seeds two: the newer
 * becomes the featured card, the older a grid card, and each appears on the
 * other's article under "More from the blog".
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

/** The main image is stored as a data URL — exactly what the admin's upload field emits. */
const IMAGE = `data:image/png;base64,${TEST_PNG.toString('base64')}`

test.describe.serial('Public — news main image', () => {
  failOnPageError()

  const stamp = Date.now()
  const newerTitle = `E2E Picture newer ${stamp}`
  const olderTitle = `E2E Picture older ${stamp}`
  const ids: number[] = []
  let listUrl = ''

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    const slug = await moduleSectionSlug(request, 'posts', 'en', API)
    test.skip(slug === null, 'posts module off or site-config unreachable')
    listUrl = `${WEB}/en/${slug}/`

    // Titled in every content language: the English list serves an empty
    // title for a Polish-only post, and the cards are located by title.
    const locales = await contentLocaleOrder(request)
    for (const [title, minutesAgo] of [[olderTitle, 2], [newerTitle, 1]] as const) {
      const res = await request.post(`${API}/api/posts`, {
        headers: adminHeaders(),
        data: {
          title: Object.fromEntries(locales.map((l) => [l, title])),
          image: IMAGE,
          published_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
        },
      })
      expect(res.status(), await res.text()).toBe(201)
      ids.push((await res.json()).data.id)
    }

    await rebuildAndWait(request, Date.now(), API)
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    for (const id of ids) await request.delete(`${API}/api/posts/${id}`, { headers: adminHeaders() })
    // The served site is what the next spec (and a visitor) sees, not the row.
    if (ids.length) await rebuildAndWait(request, Date.now(), API)
  })

  /**
   * Which post is featured is "newest first", and five other public specs
   * seed posts published *now* in parallel — so the seeded pair is not
   * reliably at the top of the unfiltered list. The island's search box
   * filters client-side and features the first match, which makes the
   * layout deterministic: narrow the list to this run's stamp and the newer
   * post is the featured card, the older one a grid card.
   */
  async function openFiltered(page: Page) {
    await page.goto(listUrl)
    const search = page.locator('input.nf-search')
    const featured = page.locator('.nf-featured')
    // The island is client:idle; a value typed before hydration is wiped
    // when Vue binds the input, so type until the filter visibly applies.
    await expect(async () => {
      await search.fill(String(stamp))
      await expect(featured).toContainText(newerTitle, { timeout: 2_000 })
    }).toPass({ timeout: 30_000 })
  }

  test('the featured card shows the post’s main image', async ({ page }) => {
    await openFiltered(page)
    const featured = page.locator('.nf-featured', { hasText: newerTitle })
    await expect(featured).toHaveCount(1)
    await expect(featured.locator('img.nf-img')).toHaveAttribute('src', /^data:image\/png;base64,/)
    await expect(featured.locator('.nf-placeholder')).toHaveCount(0)
  })

  test('a grid card shows the post’s main image', async ({ page }) => {
    await openFiltered(page)
    const card = page.locator('.nf-card', { hasText: olderTitle })
    await expect(card).toHaveCount(1)
    await expect(card.locator('img.nf-img')).toHaveAttribute('src', /^data:image\/png;base64,/)
    await expect(card.locator('.nf-placeholder')).toHaveCount(0)
  })

  test('the article’s "More from the blog" card shows the other post’s main image', async ({ page }) => {
    await openFiltered(page)
    await page.locator('.nf-featured', { hasText: newerTitle }).click()
    await expect(page.locator('.art-title')).toContainText(newerTitle)

    // "More" is the three newest *other* posts over the whole archive, and
    // the article page has no search box to narrow it. The older seeded post
    // is two minutes old, so three posts seeded "now" by parallel specs push
    // it out — a data-dependent skip rather than a flake. It runs in isolation.
    const more = page.locator('.art-more-card', { hasText: olderTitle })
    await expect(page.locator('.art-more-card').first()).toBeVisible()
    test.skip((await more.count()) === 0, 'newer posts from parallel specs filled the three "more" slots')
    await expect(more.locator('.art-more-img img')).toHaveAttribute('src', /^data:image\/png;base64,/)
  })
})
