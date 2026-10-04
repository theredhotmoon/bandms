import fs from 'node:fs'
import { test, expect } from '../../fixtures/test-base'

/**
 * Tagging band members on a photo, from the album's photo grid. A photo can
 * show several members, so this tags two on one photo and checks both stick.
 * Seeds its own album and members; deletes them after.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

/** A 1×1 PNG — a real image to Laravel's `image` rule. */
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

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
const title = `E2E Tags ${stamp}`
let albumId: number | null = null
const memberIds: number[] = []

test.beforeEach(async ({ request, baseURL }) => {
  for (const first of ['Ania', 'Bartek']) {
    const res = await request.post(`${baseURL}/api/band-profile/members`, {
      headers: headers(),
      data: { first_name: first, last_name: `Tag${stamp}` },
    })
    expect(res.status(), await res.text()).toBe(201)
    memberIds.push((await res.json()).data.id)
  }
  const album = await request.post(`${baseURL}/api/albums/batch`, {
    headers: headers(),
    timeout: 90_000,
    multipart: { title, 'files[]': { name: 'p.png', mimeType: 'image/png', buffer: TEST_PNG }, 'captions[]': '' },
  })
  expect(album.status(), await album.text()).toBe(201)
  albumId = (await album.json()).data.id
})

// afterEach, not `finally`: a timed-out test's request context is closed by then.
test.afterEach(async ({ request, baseURL }) => {
  if (albumId !== null) await request.delete(`${baseURL}/api/albums/${albumId}`, { headers: headers() })
  for (const id of memberIds) await request.delete(`${baseURL}/api/band-profile/members/${id}`, { headers: headers() })
})

test('tags two members on one photo and both persist', async ({ page, request, baseURL }) => {
  test.setTimeout(120_000)
  await page.goto('/admin/photos')
  await page.waitForLoadState('networkidle')

  const row = page.locator('tbody tr').filter({ hasText: title })
  await row.locator('.photo-count-btn').click()
  const modal = page.locator('.modal-overlay')
  const tags = modal.getByTestId('photo-member-tags').first()

  await tags.locator('.pmt-toggle').click()
  for (const first of ['Ania', 'Bartek']) {
    const saved = page.waitForResponse((r) => /\/api\/photos\/\d+\/members$/.test(r.url()) && r.request().method() === 'PUT')
    await page.getByTestId('photo-member-tags-list').locator('.pmt-option').filter({ hasText: `${first} Tag${stamp}` }).locator('input').check()
    expect((await saved).ok()).toBeTruthy()
  }
  await expect(tags.locator('.pmt-toggle')).toContainText('2')

  // The server holds both, and a fresh page shows both.
  const album = (await (await request.get(`${baseURL}/api/albums/${albumId}`, { headers: headers() })).json()).data
  expect([...album.photos[0].member_ids].sort()).toEqual([...memberIds].sort())

  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.locator('tbody tr').filter({ hasText: title }).locator('.photo-count-btn').click()
  await expect(page.locator('.modal-overlay').getByTestId('photo-member-tags').first().locator('.pmt-toggle')).toContainText('2')
})
