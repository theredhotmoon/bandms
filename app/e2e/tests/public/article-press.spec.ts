import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * Press coverage on the Article page.
 *
 * The design shows press only as context inside a story — a pull quote in the
 * body and an "In the press" list after Related — never as a standalone index.
 * These specs check both, and that they stay absent when a post has no coverage.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

/** The first post that has press coverage, or null. */
async function findPostWithPress(request: import('@playwright/test').APIRequestContext) {
  try {
    const list = await request.get(`${API}/api/posts?lang=en`, { timeout: 5000 })
    if (!list.ok()) return null

    const posts = ((await list.json()) as { data?: { id: number }[] }).data ?? []
    for (const post of posts) {
      const detail = await request.get(`${API}/api/posts/${post.id}?lang=en`, { timeout: 5000 })
      if (!detail.ok()) continue
      const data = ((await detail.json()) as { data?: { press_releases?: unknown[] } }).data
      if ((data?.press_releases ?? []).length > 0) return post.id
    }
    return null
  } catch {
    return null
  }
}

async function newsIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en/news`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe('Article — press coverage', () => {
  failOnPageError()

  test.beforeEach(async ({ request, page }) => {
    test.skip(
      !(await newsIsUp(request)),
      `${WEB}/en/news unavailable — site down, or the posts module is off`,
    )

  })

  test('the first piece of coverage becomes the pull quote', async ({ page, request }) => {
    const id = await findPostWithPress(request)
    test.skip(id === null, 'No post with press coverage on this instance')

    await page.goto(`${WEB}/en/news/${id}`)

    const quote = page.locator('.art-pull-quote')
    await expect(quote).toBeVisible()
    await expect(quote).toHaveText(/\S/)

    // Attribution matters: a quote with no source reads as the band quoting
    // itself, which is why `site` falls back to the URL host server-side.
    await expect(page.locator('.art-pull-cite')).toHaveText(/^—\s*\S/)
  })

  test('the pull quote repeats the first In-the-press headline', async ({ page, request }) => {
    const id = await findPostWithPress(request)
    test.skip(id === null, 'No post with press coverage on this instance')

    await page.goto(`${WEB}/en/news/${id}`)

    const quote = (await page.locator('.art-pull-quote').textContent())?.trim()
    const firstHeadline = (await page.locator('.art-press-title').first().textContent())?.trim()

    expect(quote).toBe(firstHeadline)
  })

  test('every In-the-press row links out with a publication name', async ({ page, request }) => {
    const id = await findPostWithPress(request)
    test.skip(id === null, 'No post with press coverage on this instance')

    await page.goto(`${WEB}/en/news/${id}`)

    const rows = page.locator('.art-press')
    expect(await rows.count()).toBeGreaterThan(0)

    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i)
      expect(await row.getAttribute('href')).toMatch(/^https?:\/\//)
      expect(await row.getAttribute('target')).toBe('_blank')
      expect(await row.getAttribute('rel')).toContain('noopener')

      await expect(row.locator('.art-press-site')).toHaveText(/\S/)
      await expect(row.locator('.art-press-title')).toHaveText(/\S/)
    }
  })

  test('press blocks are absent from a post with no coverage', async ({ page, request }) => {
    const list = await request.get(`${API}/api/posts?lang=en`)
    test.skip(!list.ok(), 'Posts API unreachable')

    const posts = ((await list.json()) as { data?: { id: number }[] }).data ?? []

    let bare: number | null = null
    for (const post of posts) {
      const detail = await request.get(`${API}/api/posts/${post.id}?lang=en`)
      if (!detail.ok()) continue
      const data = ((await detail.json()) as { data?: { press_releases?: unknown[] } }).data
      if ((data?.press_releases ?? []).length === 0) {
        bare = post.id
        break
      }
    }
    test.skip(bare === null, 'Every post has press coverage on this instance')

    await page.goto(`${WEB}/en/news/${bare}`)

    await expect(page.locator('.art-pull')).toHaveCount(0)
    await expect(page.locator('.art-press-sec')).toHaveCount(0)
  })

  test('the section heading is translated', async ({ page, request }) => {
    const id = await findPostWithPress(request)
    test.skip(id === null, 'No post with press coverage on this instance')

    // The article view was hardcoded in English while being served under /pl/.
    await page.goto(`${WEB}/en/news/${id}`)
    await expect(page.locator('.art-press-sec .art-related-title')).toHaveText('In the press')

    await page.goto(`${WEB}/pl/news/${id}`)
    await expect(page.locator('.art-press-sec .art-related-title')).toHaveText('W mediach')
  })
})
