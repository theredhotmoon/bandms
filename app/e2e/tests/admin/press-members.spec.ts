import fs from 'node:fs'
import { test, expect, expectToast, searchTable } from '../../fixtures/test-base'

/**
 * Linking band members to a press article from the form's "Link to…" panel.
 * An interview can be with several members, so this links two, saves, and
 * reads them back from the show endpoint that seeds the form. Seeds its own
 * article and members, and deletes them after.
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
const title = `E2E Member Press ${stamp}`
let pressId: number | null = null
const memberIds: number[] = []

test.beforeEach(async ({ request, baseURL }) => {
  for (const first of ['Ania', 'Bartek']) {
    const res = await request.post(`${baseURL}/api/band-profile/members`, { headers: headers(), data: { first_name: first, last_name: `Press${stamp}` } })
    expect(res.status(), await res.text()).toBe(201)
    memberIds.push((await res.json()).data.id)
  }
  const pr = await request.post(`${baseURL}/api/press-releases`, {
    headers: headers(),
    data: { url: `https://example.com/e2e-${stamp}`, og_title: title },
  })
  expect(pr.status(), await pr.text()).toBe(201)
  pressId = (await pr.json()).data.id
})

// afterEach, not `finally`: a timed-out test's request context is closed by then.
test.afterEach(async ({ request, baseURL }) => {
  if (pressId !== null) await request.delete(`${baseURL}/api/press-releases/${pressId}`, { headers: headers() })
  for (const id of memberIds) await request.delete(`${baseURL}/api/band-profile/members/${id}`, { headers: headers() })
})

test('links two members to a press article and both persist', async ({ page, request, baseURL }) => {
  await page.goto('/admin/press-releases')
  await searchTable(page, title)
  await page.locator('tbody tr', { hasText: title }).getByRole('button', { name: /edit/i }).click()

  const modal = page.locator('.modal-overlay')
  const members = modal.getByTestId('relations-members')
  await members.locator('.assoc-toggle').click()
  for (const first of ['Ania', 'Bartek']) {
    await members.locator('.checkbox-item').filter({ hasText: `${first} Press${stamp}` }).locator('input').check()
  }
  await modal.getByRole('button', { name: /save|update/i }).click()
  await expectToast(page, 'Press release updated')

  const saved = (await (await request.get(`${baseURL}/api/press-releases/${pressId}`)).json()).data
  expect([...saved.member_ids].sort()).toEqual([...memberIds].sort())
})
