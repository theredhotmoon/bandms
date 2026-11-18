import { test, expect, type APIRequestContext } from '@playwright/test'
import { adminHeaders, postRequiredFields } from '../../fixtures/admin-api'
import { seedFanSession, type SeededFanSession } from '../../fixtures/seed'

test.use({ storageState: 'e2e/.auth/admin.json' })

/*
 * The Comments moderation page, and the post editor's "Allow comments" switch.
 *
 * Comments are read at runtime, so nothing here needs a rebuild. The comment
 * is written through the real fan API by a seeded e2e- fan. The post it sits under
 * is one this spec creates and deletes — published, because the fan API
 * refuses a draft. The public half is public/post-comments.spec.ts.
 */
const STAMP = `${Date.now()}${Math.floor(Math.random() * 1000)}`
const TITLE = `E2E Comments ${STAMP}`
const BODY = `E2E moderated comment ${STAMP}`

let postId: number | null = null
let fan: SeededFanSession

async function publicComments(request: APIRequestContext): Promise<{ body: string }[]> {
  const res = await request.get(`/api/posts/${postId}/comments`)
  expect(res.ok()).toBe(true)
  return ((await res.json()) as { data: { body: string }[] }).data
}

test.describe.serial('Admin — fan comments', () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/posts', {
      headers: adminHeaders(),
      data: {
        ...(await postRequiredFields(request)),
        title: { en: TITLE },
        published_at: new Date().toISOString(),
        blocks: [{ type: 'text', payload: { body: { en: '<p>Body</p>' } } }],
      },
    })
    if (!res.ok()) throw new Error(`Seeding the post failed: ${res.status()} ${await res.text()}`)
    postId = ((await res.json()) as { data: { id: number } }).data.id

    fan = seedFanSession(`E2E Mod Fan ${STAMP}`)
    const comment = await request.post(`/api/fan/posts/${postId}/comments`, {
      headers: { Authorization: `Bearer ${fan.token}`, Accept: 'application/json' },
      data: { body: BODY },
    })
    if (!comment.ok()) throw new Error(`Seeding the comment failed: ${comment.status()} ${await comment.text()}`)
  })

  test.afterAll(async ({ request }) => {
    // Deleting the post removes its comments; the fan goes with the teardown purge.
    if (postId !== null) await request.delete(`/api/posts/${postId}`, { headers: adminHeaders() })
  })

  test('lists the comment with its post, author and email', async ({ page }) => {
    await page.goto('/admin/comments')

    const row = page.getByTestId('comment-row').filter({ hasText: BODY })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText(TITLE)
    await expect(row).toContainText(`E2E Mod Fan ${STAMP}`)
    await expect(row).toContainText(fan.email)
    await expect(row).toHaveAttribute('data-hidden', 'false')
  })

  test('hides a comment from the public and shows it again', async ({ page, request }) => {
    await page.goto('/admin/comments')
    const row = page.getByTestId('comment-row').filter({ hasText: BODY })

    await row.getByTestId('comment-toggle-hidden').click()
    await expect(row).toHaveAttribute('data-hidden', 'true')
    expect(await publicComments(request)).toEqual([])

    await row.getByTestId('comment-toggle-hidden').click()
    await expect(row).toHaveAttribute('data-hidden', 'false')
    expect((await publicComments(request)).map((c) => c.body)).toEqual([BODY])
  })

  test('blocks the fan, which hides their comments and stops new ones, then unblocks', async ({ page, request }) => {
    await page.goto('/admin/comments')
    const row = page.getByTestId('comment-row').filter({ hasText: BODY })
    const fanHeaders = { Authorization: `Bearer ${fan.token}`, Accept: 'application/json' }

    await row.getByTestId('comment-toggle-block').click()
    await expect(row).toHaveAttribute('data-blocked', 'true')
    expect(await publicComments(request)).toEqual([])
    const refused = await request.post(`/api/fan/posts/${postId}/comments`, { headers: fanHeaders, data: { body: 'nope' } })
    expect(refused.status()).toBe(403)

    await row.getByTestId('comment-toggle-block').click()
    await expect(row).toHaveAttribute('data-blocked', 'false')
    expect((await publicComments(request)).map((c) => c.body)).toEqual([BODY])
  })

  test('the post editor switches comments off and on again', async ({ page, request }) => {
    const enabled = async () =>
      ((await (await request.get(`/api/admin/posts/${postId}`, { headers: adminHeaders() })).json()) as
        { data: { comments_enabled: boolean } }).data.comments_enabled

    // The Comments page links a post title to its editor through ?edit=.
    await page.goto(`/admin/posts?edit=${postId}`)
    const box = page.getByTestId('post-comments-enabled')
    await expect(box).toBeChecked()

    await box.uncheck()
    await page.locator('.modal-overlay').getByRole('button', { name: /^(Save|Update)/ }).click()
    await expect.poll(enabled).toBe(false)
    expect(await (await request.get(`/api/posts/${postId}/comments`)).json()).toEqual({ data: [], enabled: false })

    await page.goto(`/admin/posts?edit=${postId}`)
    await expect(box).not.toBeChecked()
    await box.check()
    await page.locator('.modal-overlay').getByRole('button', { name: /^(Save|Update)/ }).click()
    await expect.poll(enabled).toBe(true)
  })

  test('sets how many comments one fan may post in a period', async ({ page, request }) => {
    const read = async () =>
      ((await (await request.get('/api/admin/comment-settings', { headers: adminHeaders() })).json()) as
        { data: { max: number; minutes: number } }).data
    const original = await read()
    // Away from whatever is stored, so the save is a real change.
    const next = { max: original.max === 7 ? 8 : 7, minutes: original.minutes === 30 ? 45 : 30 }

    try {
      await page.goto('/admin/comments')
      const form = page.getByTestId('comment-limit')
      await expect(form.getByTestId('comment-limit-max')).toHaveValue(String(original.max))
      await expect(form.getByTestId('comment-limit-save')).toBeDisabled()

      await form.getByTestId('comment-limit-max').fill(String(next.max))
      await form.getByTestId('comment-limit-minutes').fill(String(next.minutes))
      await form.getByTestId('comment-limit-save').click()

      await expect.poll(read).toEqual(next)
      await page.reload()
      await expect(page.getByTestId('comment-limit-minutes')).toHaveValue(String(next.minutes))
    } finally {
      // A shared setting: the public comment spec posts under it in parallel.
      const res = await request.put('/api/admin/comment-settings', { headers: adminHeaders(), data: original })
      expect(res.ok(), 'restoring the comment limit').toBe(true)
    }
  })

  test('deletes a comment on the second click', async ({ page, request }) => {
    await page.goto('/admin/comments')
    const row = page.getByTestId('comment-row').filter({ hasText: BODY })
    const del = row.getByTestId('comment-delete')

    await del.click()
    await expect(del).toHaveText('Click again to delete')
    await expect(row).toHaveCount(1)
    await del.click()

    await expect(row).toHaveCount(0)
    expect(await publicComments(request)).toEqual([])
  })
})
