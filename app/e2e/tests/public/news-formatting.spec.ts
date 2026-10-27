import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { adminHeaders, postRequiredFields, rebuildAndWait } from '../../fixtures/admin-api'

/**
 * A news article as a visitor reads it:
 *
 * - text blocks keep their formatting: bold, links, list bullets, paragraph
 *   spacing — and a block written as plain text keeps its line breaks. Rules
 *   in a component's scoped <style> never reached set:html markup, so the
 *   bullets and spacing were silently dropped;
 * - tags sit below the hero and link to the news list filtered to them;
 * - a linked concert opens in a dialog from the header's event date and from
 *   the card at the end of the article;
 * - on the news list a card shows all its tags on a single line.
 *
 * Seeds one published post via the API, rebuilds, and deletes it afterwards.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'
const TITLE = `E2E Formatting ${Date.now()}`

test.use({ storageState: { cookies: [], origins: [] } })

let postId: number | null = null
let postUrl = ''
let newsUrl = ''
let tagCount = 0

test.describe.serial('Public — news article formatting, tags and linked concert', () => {
  failOnPageError()

  test.beforeAll(async ({ request }) => {
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.posts === false, 'News module is off')
    const concerts = (await (await request.get(`${API}/api/concerts?lang=en`)).json()).data as { id: number }[]
    const tags = (await (await request.get(`${API}/api/tags`, { headers: adminHeaders() })).json()).data as { id: number }[]
    test.skip(concerts.length === 0, 'No concert to link')

    // Every tag there is — enough, on most instances, to overflow one card line.
    const tagIds = tags.slice(0, 8).map(t => t.id)
    tagCount = tagIds.length
    const res = await request.post(`${API}/api/posts`, {
      headers: adminHeaders(),
      data: {
        ...(await postRequiredFields(request, API)),
        title: { en: TITLE },
        tag_ids: tagIds,
        concert_ids: [concerts[0].id],
        published_at: new Date(Date.now() - 3_600_000).toISOString(),
        blocks: [
          { type: 'text', payload: { body: { en: '<p><strong>Bold words</strong> and <a href="https://example.com/e2e">a link</a></p><ul><li>First item</li><li>Second item</li></ul><p>Closing paragraph</p>' } } },
          { type: 'text', payload: { body: { en: 'Plain line one\nPlain line two\n\nPlain second paragraph' } } },
        ],
      },
    })
    if (!res.ok()) throw new Error(`Seeding the post failed: ${res.status()} ${await res.text()}`)
    const post = (await res.json()).data as { id: number; slug: string }
    postId = post.id
    const section = config?.module_config?.posts?.slug ?? 'news'
    newsUrl = `${WEB}/en/${section}`
    postUrl = `${newsUrl}/${post.slug}`
    await rebuildAndWait(request, Date.now(), API)
  })

  test.afterAll(async ({ request }) => {
    if (postId !== null) await request.delete(`${API}/api/posts/${postId}`, { headers: adminHeaders() })
  })

  test('a text block keeps bold, links, bullets and paragraph spacing', async ({ page }) => {
    await page.goto(postUrl)
    const prose = page.locator('.art-prose').first()

    await expect(prose.locator('strong')).toHaveText('Bold words')
    await expect(prose.getByRole('link', { name: 'a link' })).toHaveAttribute('href', 'https://example.com/e2e')
    expect(await prose.locator('ul').evaluate(el => getComputedStyle(el).listStyleType)).toBe('disc')
    const gap = await prose.locator('p').first().evaluate(el => parseFloat(getComputedStyle(el).marginBottom))
    expect(gap).toBeGreaterThan(0)
  })

  test('a plain-text block keeps its line breaks and paragraphs', async ({ page }) => {
    await page.goto(postUrl)
    const plain = page.locator('.art-prose').nth(1)
    await expect(plain.locator('p')).toHaveCount(2)
    await expect(plain.locator('p').first().locator('br')).toHaveCount(1)
  })

  test('tags sit below the hero and link to the filtered news list', async ({ page }) => {
    test.skip(tagCount === 0, 'No tags on this instance')
    await page.goto(postUrl)

    const tags = page.getByTestId('post-tags')
    const heroBottom = await page.locator('.art-hero').evaluate(el => el.getBoundingClientRect().bottom)
    const tagsTop = await tags.evaluate(el => el.getBoundingClientRect().top)
    expect(tagsTop).toBeGreaterThanOrEqual(heroBottom)
    await expect(page.locator('.art-hero .art-stamp')).toHaveCount(0)

    const first = tags.locator('a').first()
    const name = (await first.textContent())!.trim()
    await first.click()
    await expect(page).toHaveURL(/\?tag=/)
    await expect(page.locator('.nf-tag-btn.active')).toHaveText(name)
  })

  test('the linked concert opens in a dialog from the header and from the card', async ({ page }) => {
    await page.goto(postUrl)
    const dialog = page.getByTestId('post-concert-dialog')

    await page.getByTestId('post-event-trigger').click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()

    await page.getByTestId('post-concert-card').click()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.pc-facts')).toBeVisible()
  })

  test('a news card shows all its tags on one line', async ({ page }) => {
    test.skip(tagCount < 2, 'Needs at least two tags')
    await page.goto(newsUrl)
    const card = page.locator('a', { hasText: TITLE }).first()
    const row = card.getByTestId('news-card-tags')
    await expect(row.locator('.nf-chip')).toHaveCount(tagCount)
    const tops = await row.locator('.nf-chip').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)
    // Tags on the list are labels, not links.
    await expect(row.locator('a')).toHaveCount(0)
  })
})

test.describe('Public — FAQ', () => {
  failOnPageError()

  test('an open answer spans the accordion, not half of it', async ({ page, request }) => {
    const [faqs, config] = await Promise.all([
      request.get(`${API}/api/faqs?lang=en`).then(r => r.json()),
      request.get(`${API}/api/site-config?lang=en`).then(r => r.json()),
    ])
    const faq = (faqs.data as { module_slug: string; answer: string }[]).find(f => f.answer.length > 120)
    test.skip(!faq, 'No FAQ with a long answer on this instance')
    const section = config?.module_config?.[faq!.module_slug]?.slug ?? faq!.module_slug
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto(`${WEB}/en/${section}`)

    await page.locator('.faq-q').first().click()
    const answer = page.locator('.faq-a').first()
    await expect(answer).toBeVisible()
    const [a, row] = await Promise.all([
      answer.evaluate(el => el.getBoundingClientRect().width),
      page.locator('.faq').first().evaluate(el => el.getBoundingClientRect().width),
    ])
    expect(a).toBeGreaterThan(row * 0.9)
  })
})
