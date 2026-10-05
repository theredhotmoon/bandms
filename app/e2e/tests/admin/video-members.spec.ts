import fs from 'node:fs'
import { test, expect } from '../../fixtures/test-base'

/**
 * "Who's in it" on a music video, through the shared MemberPicker: two
 * members linked by hand, saved, and read back from the API. Seeds its own
 * video and members, and deletes them after.
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
const title = `E2E Member Video ${stamp}`
let videoId: number | null = null
const memberIds: number[] = []

test.beforeEach(async ({ request, baseURL }) => {
  for (const first of ['Ania', 'Bartek']) {
    const res = await request.post(`${baseURL}/api/band-profile/members`, { headers: headers(), data: { first_name: first, last_name: `Vid${stamp}` } })
    expect(res.status(), await res.text()).toBe(201)
    memberIds.push((await res.json()).data.id)
  }
  const video = await request.post(`${baseURL}/api/music-videos`, {
    headers: headers(),
    data: { title, video_url: `https://www.youtube.com/watch?v=e2e${stamp.slice(-8)}` },
  })
  expect(video.status(), await video.text()).toBe(201)
  videoId = (await video.json()).data.id
})

// afterEach, not `finally`: a timed-out test's request context is closed by then.
test.afterEach(async ({ request, baseURL }) => {
  if (videoId !== null) await request.delete(`${baseURL}/api/music-videos/${videoId}`, { headers: headers() })
  for (const id of memberIds) await request.delete(`${baseURL}/api/band-profile/members/${id}`, { headers: headers() })
})

test('links two members to a music video and both persist', async ({ page, request, baseURL }) => {
  await page.goto('/admin/music-videos')
  await page.waitForLoadState('networkidle')
  await page.locator('tr').filter({ hasText: title }).getByRole('button', { name: /edit/i }).click()

  const modal = page.locator('.modal-overlay')
  const picker = modal.getByTestId('video-members')
  for (const first of ['Ania', 'Bartek']) {
    await picker.locator('.checkbox-item').filter({ hasText: `${first} Vid${stamp}` }).locator('input').check()
  }
  await modal.getByRole('button', { name: /save|update/i }).click()
  await expect(page.locator('[data-sonner-toast]')).toContainText('Music video updated', { timeout: 8000 })

  const list = (await (await request.get(`${baseURL}/api/music-videos`, { headers: headers() })).json()).data
  const saved = list.find((v: { id: number }) => v.id === videoId)
  expect([...saved.member_ids].sort()).toEqual([...memberIds].sort())
})
