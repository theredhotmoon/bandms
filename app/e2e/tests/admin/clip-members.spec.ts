import { test, expect, expectToast, searchTable } from '../../fixtures/test-base'
import { adminToken } from '../../fixtures/admin-api'

/**
 * Linking band members to a clip from the clip form's "Link to…" panel. A
 * clip often shows several members, so this links two. Seeds its own clip
 * and members, and deletes them after.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

const headers = () => ({ Accept: 'application/json', Authorization: `Bearer ${adminToken()}` })

const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
const title = `E2E Member Clip ${stamp}`
let clipId: number | null = null
const memberIds: number[] = []

test.beforeEach(async ({ request, baseURL }) => {
  for (const first of ['Ania', 'Bartek']) {
    const res = await request.post(`${baseURL}/api/band-profile/members`, { headers: headers(), data: { first_name: first, last_name: `Clip${stamp}` } })
    expect(res.status(), await res.text()).toBe(201)
    memberIds.push((await res.json()).data.id)
  }
  const clip = await request.post(`${baseURL}/api/clips`, {
    headers: headers(),
    data: { url: `https://vimeo.com/${Date.now() % 100000000}`, title: { en: title } },
  })
  expect(clip.status(), await clip.text()).toBe(201)
  clipId = (await clip.json()).data.id
})

// afterEach, not `finally`: a timed-out test's request context is closed by then.
test.afterEach(async ({ request, baseURL }) => {
  if (clipId !== null) await request.delete(`${baseURL}/api/clips/${clipId}`, { headers: headers() })
  for (const id of memberIds) await request.delete(`${baseURL}/api/band-profile/members/${id}`, { headers: headers() })
})

test('links two members to a clip and both persist', async ({ page, request, baseURL }) => {
  await page.goto('/admin/clips')
  await searchTable(page, title)
  await page.locator('tbody tr', { hasText: title }).getByRole('button', { name: 'Edit' }).click()
  const form = page.getByTestId('clip-form')

  const members = form.getByTestId('relations-members')
  await members.locator('.assoc-toggle').click()
  for (const first of ['Ania', 'Bartek']) {
    await members.locator('.checkbox-item').filter({ hasText: `${first} Clip${stamp}` }).locator('input').check()
  }
  await form.getByRole('button', { name: 'Update' }).click()
  await expectToast(page, 'Clip updated')

  const clips = (await (await request.get(`${baseURL}/api/clips`)).json()).data as { id: number; member_ids: number[] }[]
  expect([...(clips.find((c) => c.id === clipId)?.member_ids ?? [])].sort()).toEqual([...memberIds].sort())
})
