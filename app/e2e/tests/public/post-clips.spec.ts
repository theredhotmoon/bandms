import { anonymousVisitor } from '../../fixtures/visitor'
import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { adminHeaders, postRequiredFields, rebuildAndWait, moduleSectionSlug } from '../../fixtures/admin-api'

/**
 * Videos linked to a news post (admin → Link to… → Videos) are listed at the
 * foot of the article — except one a reference block already embeds in the
 * text, which shows where the band placed it and never a second time.
 *
 * Seeds two clips and a published post that links both and embeds the
 * second, rebuilds, checks, then deletes everything and rebuilds.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: anonymousVisitor() })

test.describe.serial('Public — videos linked from a news post', () => {
  failOnPageError()

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const footTitle = `E2E Foot Clip ${stamp}`
  const inlineTitle = `E2E Inline Clip ${stamp}`
  const postTitle = `E2E Clips Post ${stamp}`
  const clipIds: number[] = []
  let postId: number | null = null
  let postSlug = ''
  let postsSection: string | null = null
  let enabledPosts = false

  test.beforeAll(async ({ request }) => {
    test.setTimeout(300_000)
    const modules = (await (await request.get(`${API}/api/admin/modules`, { headers: adminHeaders() })).json())
      .data as { slug: string; enabled: boolean }[]
    if (modules.find(m => m.slug === 'posts')?.enabled === false) {
      const on = await request.put(`${API}/api/admin/modules/posts`, { headers: adminHeaders(), data: { enabled: true } })
      expect(on.ok(), await on.text()).toBeTruthy()
      enabledPosts = true
    }
    postsSection = await moduleSectionSlug(request, 'posts', 'en', API)

    for (const [title, v] of [[footTitle, 'aaa'], [inlineTitle, 'bbb']]) {
      const clip = await request.post(`${API}/api/clips`, {
        headers: adminHeaders(),
        data: { url: `https://vimeo.com/${Date.now() % 1e8}${v === 'aaa' ? 1 : 2}`, title: { en: title }, category: 'live' },
      })
      expect(clip.status(), await clip.text()).toBe(201)
      clipIds.push((await clip.json()).data.id)
    }

    const post = await request.post(`${API}/api/posts`, {
      headers: adminHeaders(),
      data: {
        ...(await postRequiredFields(request, API)),
        title: { en: postTitle },
        published_at: new Date(Date.now() - 3_600_000).toISOString().slice(0, 16),
        clip_ids: clipIds,
        blocks: [{ type: 'ref', payload: { entity: 'clip', id: clipIds[1] } }],
      },
    })
    expect(post.status(), await post.text()).toBe(201)
    const body = (await post.json()).data
    postId = body.id
    postSlug = body.translations?.slug?.en ?? body.slug

    await rebuildAndWait(request, Date.now(), API)
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    if (postId !== null) await request.delete(`${API}/api/posts/${postId}`, { headers: adminHeaders() })
    for (const id of clipIds) await request.delete(`${API}/api/clips/${id}`, { headers: adminHeaders() })
    if (enabledPosts) {
      await request.put(`${API}/api/admin/modules/posts`, { headers: adminHeaders(), data: { enabled: false } })
    }
    await rebuildAndWait(request, Date.now(), API)
  })

  test('lists linked videos at the foot, skipping one already embedded in the text', async ({ page }) => {
    await page.goto(`${WEB}/en/${postsSection}/${postSlug}`)

    const foot = page.getByTestId('post-clips')
    await expect(foot.getByRole('heading', { name: 'Videos' })).toBeVisible()
    await expect(foot.locator('.clips-item')).toHaveCount(1)
    await expect(foot).toContainText(footTitle)
    await expect(foot).not.toContainText(inlineTitle)

    // The embedded one is still on the page — once, in the article text.
    await expect(page.getByText(inlineTitle)).toHaveCount(1)
  })
})
