import { anonymousVisitor } from '../../fixtures/visitor'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { adminHeaders, moduleSectionSlug, postRequiredFields, rebuildAndWait } from '../../fixtures/admin-api'

/**
 * The dates an article gives search engines and link previews.
 *
 * Two posts, published on the same past day: the text of one is edited
 * afterwards; only the settings of the other are, which moves its `updated_at`.
 * (Pinning does too, but the pinned post is one shared slot — PostContentUpdatedAtTest
 * covers that.)
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

test.use({ storageState: anonymousVisitor() })

const PUBLISHED = '2026-03-04'

async function send(request: APIRequestContext, method: 'post' | 'put' | 'delete', path: string, data?: unknown) {
  const res = await request[method](path, { headers: adminHeaders(), ...(data ? { data } : {}) })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()} ${await res.text()}`)
  return res.status() === 204 ? null : (await res.json()).data
}

test.describe.serial('Public — article date signals', () => {
  const stamp = Date.now()
  const created: number[] = []
  let section: string
  let edited: { id: number; slug: string }
  let untouched: { id: number; slug: string }
  /** The server's day, from the API: the test machine may be on another one. */
  let editDay: string

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    const slug = await moduleSectionSlug(request, 'posts', 'en')
    test.skip(slug === null, 'News is off')
    section = slug!
    const required = await postRequiredFields(request)
    const seed = async (title: string) => {
      const post = await send(request, 'post', '/api/posts', {
        ...required,
        title: { en: title },
        // Late in the evening: the day must not depend on a time zone.
        published_at: `${PUBLISHED}T23:55:00Z`,
        blocks: [{ type: 'text', payload: { body: { en: '<p>As published.</p>' } } }],
      })
      created.push(post.id)
      return post as { id: number; slug: string }
    }
    edited = await seed(`E2E Dates edited ${stamp}`)
    untouched = await seed(`E2E Dates settings ${stamp}`)

    const saved = await send(request, 'put', `/api/posts/${edited.id}`, {
      ...required,
      title: { en: `E2E Dates edited ${stamp}` },
      published_at: `${PUBLISHED}T23:55:00Z`,
      blocks: [{ type: 'text', payload: { body: { en: '<p>Edited later.</p>' } } }],
    })
    editDay = saved.content_updated_at.slice(0, 10)
    expect(editDay > PUBLISHED).toBe(true)

    await send(request, 'put', `/api/posts/${untouched.id}`, { ...required, title: { en: `E2E Dates settings ${stamp}` }, comments_enabled: false })

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    if (created.length === 0) return
    // Every delete is tried before any failure is reported, and the served site
    // is rebuilt, or the fixtures stay on it and in its sitemap.
    const results = await Promise.allSettled(created.map(id => send(request, 'delete', `/api/posts/${id}`)))
    await rebuildAndWait(request, Date.now())
    expect(results.filter(r => r.status === 'rejected')).toEqual([])
  })

  async function article(request: APIRequestContext, slug: string) {
    const res = await request.get(`${WEB}/en/${section}/${slug}/`)
    expect(res.status(), slug).toBe(200)
    const html = await res.text()
    const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)
    return {
      type: html.match(/property="og:type"\s+content="([^"]*)"/)?.[1],
      published: html.match(/property="article:published_time" content="([^"]*)"/)?.[1],
      modified: html.match(/property="article:modified_time" content="([^"]*)"/)?.[1],
      ld: JSON.parse(json![1]!) as { datePublished?: string; dateModified?: string },
    }
  }

  async function lastmod(request: APIRequestContext, slug: string) {
    const xml = await (await request.get(`${WEB}/sitemap-0.xml`)).text()
    const entry = xml.match(new RegExp(`<url><loc>[^<]*/en/${section}/${slug}/</loc>(.*?)</url>`))
    expect(entry, `${slug} is in the sitemap`).not.toBeNull()
    return entry![1]!.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1]
  }

  test('an edited article says when it was published and when it changed', async ({ request }) => {
    expect(await article(request, edited.slug)).toMatchObject({
      type: 'article',
      published: PUBLISHED,
      modified: editDay,
      ld: { datePublished: PUBLISHED, dateModified: editDay },
    })
    expect(await lastmod(request, edited.slug)).toBe(editDay)
  })

  test('changing only the settings of a post is not an edit', async ({ request }) => {
    const head = await article(request, untouched.slug)
    expect(head).toMatchObject({ type: 'article', published: PUBLISHED, ld: { datePublished: PUBLISHED } })
    expect(head.modified).toBeUndefined()
    expect(head.ld.dateModified).toBeUndefined()
    expect(await lastmod(request, untouched.slug)).toBe(PUBLISHED)
  })

  test('the date a reader sees is marked up with the same day', async ({ page }) => {
    await page.goto(`${WEB}/en/${section}/${edited.slug}/`)
    const time = page.locator('.art-meta-date time')
    await expect(time).toHaveAttribute('datetime', PUBLISHED)
    await expect(time).toHaveText('4 March 2026')
  })

  test('a page that is not an article claims no dates', async ({ request }) => {
    const html = await (await request.get(`${WEB}/en/`)).text()
    expect(html).toMatch(/property="og:type"\s+content="website"/)
    expect(html).not.toContain('article:published_time')
  })
})
