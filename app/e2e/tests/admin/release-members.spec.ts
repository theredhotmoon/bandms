import fs from 'node:fs'
import { test, expect, searchTable } from '../../fixtures/test-base'

/**
 * "Who played on it" on a release, through the shared MemberPicker: two
 * members linked by hand, saved, and read back from the API. Seeds its own
 * release and members, and deletes them after.
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
const title = `E2E Member Record ${stamp}`
let releaseId: number | null = null
const memberIds: number[] = []

test.beforeEach(async ({ request, baseURL }) => {
  for (const first of ['Ania', 'Bartek']) {
    const res = await request.post(`${baseURL}/api/band-profile/members`, { headers: headers(), data: { first_name: first, last_name: `Rec${stamp}` } })
    expect(res.status(), await res.text()).toBe(201)
    memberIds.push((await res.json()).data.id)
  }
  const release = await request.post(`${baseURL}/api/releases`, { headers: headers(), data: { title: { en: title }, type: 'EP' } })
  expect(release.status(), await release.text()).toBe(201)
  releaseId = (await release.json()).data.id
})

// afterEach, not `finally`: a timed-out test's request context is closed by then.
test.afterEach(async ({ request, baseURL }) => {
  if (releaseId !== null) await request.delete(`${baseURL}/api/releases/${releaseId}`, { headers: headers() })
  for (const id of memberIds) await request.delete(`${baseURL}/api/band-profile/members/${id}`, { headers: headers() })
})

test('links two members to a release and both persist', async ({ page, request, baseURL }) => {
  await page.goto('/admin/releases')
  await page.waitForLoadState('networkidle')
  await searchTable(page, title)
  await page.locator('tr').filter({ hasText: title }).getByRole('button', { name: /edit/i }).click()

  const modal = page.locator('.modal-overlay')
  // Edit mode fetches the full record; wait for it before touching the form.
  await expect(modal.locator('input[placeholder="Release title"]')).toHaveValue(title, { timeout: 8000 })

  const picker = modal.getByTestId('release-members')
  for (const first of ['Ania', 'Bartek']) {
    await picker.locator('.checkbox-item').filter({ hasText: `${first} Rec${stamp}` }).locator('input').check()
  }
  await modal.getByRole('button', { name: /Update release/i }).click()
  await expect(page.locator('[data-sonner-toast]')).toContainText('Release updated', { timeout: 8000 })

  const saved = (await (await request.get(`${baseURL}/api/releases/${releaseId}`)).json()).data
  expect([...saved.member_ids].sort()).toEqual([...memberIds].sort())
})
