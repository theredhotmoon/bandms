import fs from 'node:fs'
import { test, expect, expectToast, searchTable } from '../../fixtures/test-base'

/**
 * "Who played" on a concert: members are linked explicitly, with a shortcut
 * for the current line-up. Seeds its own concert and two members, and
 * deletes them after.
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
const concertName = `E2E Who Played ${stamp}`
let concertId: number | null = null
const memberIds: number[] = []

test.beforeEach(async ({ request, baseURL }) => {
  for (const first of ['Ania', 'Bartek']) {
    const res = await request.post(`${baseURL}/api/band-profile/members`, {
      headers: headers(),
      data: { first_name: first, last_name: `Gig${stamp}`, is_current: true },
    })
    expect(res.status(), await res.text()).toBe(201)
    memberIds.push((await res.json()).data.id)
  }
  const venues = ((await (await request.get(`${baseURL}/api/venues`, { headers: headers() })).json()).data ?? []) as { id: number }[]
  test.skip(venues.length === 0, 'No venue to hold a concert')
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  const month = String(1 + Math.floor(Math.random() * 9)).padStart(2, '0')
  const concert = await request.post(`${baseURL}/api/concerts`, {
    headers: headers(),
    data: { venue_id: venues[0].id, date: `2097-${month}-${day}`, name: { en: concertName } },
  })
  expect(concert.status(), await concert.text()).toBe(201)
  concertId = (await concert.json()).data.id
})

// afterEach, not `finally`: a timed-out test's request context is closed by then.
test.afterEach(async ({ request, baseURL }) => {
  if (concertId !== null) await request.delete(`${baseURL}/api/concerts/${concertId}`, { headers: headers() })
  for (const id of memberIds) await request.delete(`${baseURL}/api/band-profile/members/${id}`, { headers: headers() })
})

test('the current line-up shortcut links every current member, and it persists', async ({ page, request, baseURL }) => {
  await page.goto('/admin/concerts')
  await page.waitForLoadState('networkidle')
  await searchTable(page, concertName)
  await page.locator('tbody tr').filter({ hasText: concertName }).getByRole('button', { name: /edit/i }).click()

  const section = page.getByTestId('concert-members')
  await section.getByTestId('concert-members-current').click()
  for (const first of ['Ania', 'Bartek']) {
    await expect(section.locator('.checkbox-item').filter({ hasText: `${first} Gig${stamp}` }).locator('input')).toBeChecked()
  }
  // The shortcut is a starting point, not the answer: untick one.
  await section.locator('.checkbox-item').filter({ hasText: `Bartek Gig${stamp}` }).locator('input').uncheck()

  await page.locator('.modal-overlay').getByRole('button', { name: /update|save/i }).click()
  await expectToast(page, 'Concert updated')

  const saved = (await (await request.get(`${baseURL}/api/concerts/${concertId}`, { headers: headers() })).json()).data
  expect(saved.member_ids).toContain(memberIds[0])
  expect(saved.member_ids).not.toContain(memberIds[1])
})
