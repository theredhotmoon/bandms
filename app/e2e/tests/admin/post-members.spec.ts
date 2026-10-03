import fs from 'node:fs'
import { test, expect, expectToast, searchTable } from '../../fixtures/test-base'

/**
 * Linking band members to a news post from the post editor's "Link to…"
 * panel. A post can be about several members, so this links two. Seeds its
 * own post and members, and deletes them after.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

function adminToken(): string {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/admin.json', 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}
const headers = () => ({ Accept: 'application/json', Authorization: `Bearer ${adminToken()}` })

const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
const title = `E2E Member News ${stamp}`
let postId: number | null = null
const memberIds: number[] = []

test.beforeEach(async ({ request, baseURL }) => {
  for (const first of ['Ania', 'Bartek']) {
    const res = await request.post(`${baseURL}/api/band-profile/members`, { headers: headers(), data: { first_name: first, last_name: `News${stamp}` } })
    expect(res.status(), await res.text()).toBe(201)
    memberIds.push((await res.json()).data.id)
  }
  const post = await request.post(`${baseURL}/api/posts`, { headers: headers(), data: { title: { en: title } } })
  expect(post.status(), await post.text()).toBe(201)
  postId = (await post.json()).data.id
})

test.afterEach(async ({ request, baseURL }) => {
  if (postId !== null) await request.delete(`${baseURL}/api/posts/${postId}`, { headers: headers() })
  for (const id of memberIds) await request.delete(`${baseURL}/api/band-profile/members/${id}`, { headers: headers() })
})

test('links two members to a post and both persist', async ({ page, request, baseURL }) => {
  await page.goto('/admin/posts')
  await page.waitForLoadState('networkidle')
  await searchTable(page, title)
  await page.locator('tbody tr').filter({ hasText: title }).getByRole('button', { name: 'Edit' }).click()
  await expect(page.locator('input[placeholder="Post title"]')).toHaveValue(title)

  const members = page.getByTestId('relations-members')
  await members.locator('.assoc-toggle').click()
  for (const first of ['Ania', 'Bartek']) {
    await members.locator('.checkbox-item').filter({ hasText: `${first} News${stamp}` }).locator('input').check()
  }
  await expect(members.locator('.assoc-toggle')).toContainText('2')

  await page.getByRole('button', { name: 'Update' }).click()
  await expectToast(page, 'Post updated')

  const saved = (await (await request.get(`${baseURL}/api/admin/posts/${postId}`, { headers: headers() })).json()).data
  expect([...saved.member_ids].sort()).toEqual([...memberIds].sort())
})
