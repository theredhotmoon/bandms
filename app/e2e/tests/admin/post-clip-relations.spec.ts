import { test, expect } from '@playwright/test'
import { expectToast, searchTable } from '../../fixtures/test-base'
import { adminHeaders, postRequiredFields } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

/**
 * "Link to… → Videos" on a post: tick a library clip, save, and the API
 * stores it as `clip_ids` — the list the article shows at its foot. Then the
 * clip's own form, which has no post picker, must send that link back on
 * save rather than dropping it (its `attach` is the full owner list).
 *
 * Seeds a draft post and a clip through the API and deletes both.
 */
test.describe.serial('Admin — linking videos to a post', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const postTitle = `E2E Post Videos ${stamp}`
  const clipTitle = `E2E Post Clip ${stamp}`
  let postId: number | undefined
  let clipId: number | undefined

  const storedClipIds = async (request: import('@playwright/test').APIRequestContext): Promise<number[]> =>
    ((await (await request.get(`${API}/api/admin/posts/${postId}`, { headers: adminHeaders() })).json()) as
      { data: { clip_ids: number[] } }).data.clip_ids

  test.beforeAll(async ({ request }) => {
    const clip = await request.post(`${API}/api/clips`, {
      headers: adminHeaders(),
      data: { url: `https://www.youtube.com/watch?v=e2e${stamp.replace(/\W/g, '').slice(-8)}`, title: { en: clipTitle }, category: 'live' },
    })
    expect(clip.status(), await clip.text()).toBe(201)
    clipId = (await clip.json()).data.id

    // No published_at: a draft — /admin/posts lists it, the public build ignores it.
    const post = await request.post(`${API}/api/posts`, {
      headers: adminHeaders(),
      data: { ...(await postRequiredFields(request, API)), title: { en: postTitle }, blocks: [] },
    })
    expect(post.status(), await post.text()).toBe(201)
    postId = (await post.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    if (postId) await request.delete(`${API}/api/posts/${postId}`, { headers: adminHeaders() })
    if (clipId) await request.delete(`${API}/api/clips/${clipId}`, { headers: adminHeaders() })
  })

  test('a post links a clip, and the form shows it ticked when reopened', async ({ page, request }) => {
    await page.goto(`/admin/posts?edit=${postId}`)
    const modal = page.locator('.modal-overlay')
    const section = modal.getByTestId('relations-clips')
    await section.locator('.assoc-toggle').click()
    await section.locator('.checkbox-item').filter({ hasText: clipTitle }).locator('input[type="checkbox"]').check()

    await modal.getByRole('button', { name: /^(Save|Update)/ }).click()
    await expect.poll(() => storedClipIds(request)).toEqual([clipId])

    await page.goto(`/admin/posts?edit=${postId}`)
    const reopened = page.locator('.modal-overlay').getByTestId('relations-clips')
    await expect(reopened.locator('.assoc-summary')).toContainText(clipTitle)
  })

  test('saving the clip from the Videos page keeps its post link', async ({ page, request }) => {
    await page.goto('/admin/clips')
    await searchTable(page, clipTitle)
    await page.locator('tbody tr', { hasText: clipTitle }).getByRole('button', { name: 'Edit' }).click()
    const form = page.getByTestId('clip-form')
    await form.getByTestId('trans-input-clip.title-en').fill(`${clipTitle} edited`)
    await form.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Video updated')

    expect(await storedClipIds(request)).toEqual([clipId])
  })
})
