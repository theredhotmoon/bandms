import { test, expect, searchTable } from '../../fixtures/test-base'
import type { Locator, Page } from '@playwright/test'
import { adminHeaders, contentLocaleOrder, postRequiredFields } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Every admin surface names a tag in the band's FIRST content language
 * (useTagLabel), the language TagForm leads with. The API's `name` follows
 * the request language — English here, since Playwright's Chromium sends
 * en-US — so a surface printing `t.name` showed a Polish-first band the
 * English name of a tag it had just renamed in Polish. The tag below has a
 * different name in every language, so only the right one can match; each
 * test fails if its surface goes back to `t.name`.
 */
const STAMP = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
const names: Record<string, string> = { en: `e2e-tl-${STAMP}-en`, pl: `e2e-tl-${STAMP}-pl` }
const postTitle = `E2E Tag Label Post ${STAMP}`
let order: string[] = []
let shown = ''
let hidden: string[] = []
let tagId = 0
let postId = 0

/** The tag is named right in `scope`, and no other language of it appears. */
async function expectNamed(scope: Locator) {
  await expect(scope.locator('.checkbox-item').filter({ hasText: shown })).toBeVisible()
  for (const other of hidden) await expect(scope.getByText(other, { exact: true })).toHaveCount(0)
}

async function openModal(page: Page, path: string, add: string): Promise<Locator> {
  await page.goto(path)
  await page.getByRole('button', { name: add }).click()
  const modal = page.locator('.modal-overlay')
  await expect(modal).toBeVisible()
  return modal
}

test.describe('Tag labels', () => {
  test.beforeAll(async ({ request }) => {
    order = await contentLocaleOrder(request)
    shown = names[order.find(l => names[l])!]
    hidden = Object.values(names).filter(n => n !== shown)

    const tag = await request.post('/api/tags', { headers: adminHeaders(), data: { name: names } })
    expect(tag.ok(), `POST /api/tags → ${tag.status()} ${await tag.text()}`).toBe(true)
    tagId = (await tag.json()).data.id

    const post = await request.post('/api/posts', { headers: adminHeaders(), data: { ...(await postRequiredFields(request)), title: { en: postTitle }, tag_ids: [tagId] } })
    expect(post.ok(), `POST /api/posts → ${post.status()} ${await post.text()}`).toBe(true)
    postId = (await post.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    const failed: string[] = []
    if (postId) {
      const res = await request.delete(`/api/posts/${postId}`, { headers: adminHeaders() })
      if (!res.ok()) failed.push(`post ${postId} → ${res.status()}`)
    }
    if (tagId) {
      const res = await request.delete(`/api/tags/${tagId}`, { headers: adminHeaders() })
      if (!res.ok()) failed.push(`tag ${tagId} → ${res.status()}`)
    }
    expect(failed, 'cleanup').toEqual([])
  })

  for (const { path, add } of [
    { path: '/admin/concerts', add: '+ Add concert' },
    { path: '/admin/venues', add: '+ Add venue' },
    { path: '/admin/photos', add: '+ New Album' },
  ]) {
    test(`${path} "${add}" picker names the tag in the band's first language`, async ({ page }) => {
      await expectNamed(await openModal(page, path, add))
    })
  }

  test('the album edit picker names the tag in the band\'s first language', async ({ page }) => {
    await page.goto('/admin/photos')
    const rows = page.locator('tbody tr')
    await expect(rows.first().or(page.locator('.empty-state'))).toBeVisible()
    test.skip((await rows.count()) === 0, 'No albums to open — read-only check skipped')

    await rows.first().getByRole('button', { name: 'Edit' }).click()
    await expectNamed(page.locator('.modal-overlay'))
  })

  test('the post editor\'s relations panel names the tag in the band\'s first language', async ({ page }) => {
    const modal = await openModal(page, '/admin/posts', '+ Add post')
    const tags = modal.getByTestId('relations-tags')
    await tags.locator('.assoc-toggle').click()
    await expectNamed(tags)
  })

  test('the posts list shows the tag pill in the band\'s first language, and finds it in any', async ({ page }) => {
    await page.goto('/admin/posts')
    await searchTable(page, postTitle)
    const row = page.locator('tbody tr').filter({ hasText: postTitle })
    await expect(row.locator('.pill--tag')).toHaveText(shown)

    // Search covers every language of a tag's name, not only the one shown.
    for (const other of hidden) {
      await searchTable(page, other)
      await expect(page.locator('tbody tr').filter({ hasText: postTitle })).toBeVisible()
    }
  })

  test('pickers list tags in the order of the names they show', async ({ page }) => {
    const modal = await openModal(page, '/admin/concerts', '+ Add concert')
    const labels = (await modal.locator('.checkbox-list').filter({ hasText: shown })
      .locator('.checkbox-item').allInnerTexts()).map(s => s.trim())
    expect(labels.length).toBeGreaterThan(1)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, order[0])))
  })
})
