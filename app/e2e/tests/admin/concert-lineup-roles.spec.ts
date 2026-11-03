import { test, expect } from '@playwright/test'
import { expectToast, searchTable } from '../../fixtures/test-base'
import { adminHeaders } from '../../fixtures/admin-api'

/**
 * The concert form's billing-roles switch and our band's own stage time.
 *
 * Not every gig is billed headliner + support — a festival slot, a split
 * bill — so the band turns the words off per concert. The switch must load
 * what the API holds and save what the band ticked.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe.serial('Admin Concerts — line-up roles switch', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const concertName = `E2E Roles ${stamp}`
  let venueId: number | null = null
  let concertId: number | null = null

  test.beforeAll(async ({ request }) => {
    const venue = await request.post('/api/venues', { headers: adminHeaders(), data: { name: `E2E Roles Venue ${stamp}` } })
    expect(venue.status(), await venue.text()).toBe(201)
    venueId = (await venue.json()).data.id

    const concert = await request.post('/api/concerts', {
      headers: adminHeaders(),
      data: { name: { en: concertName }, venue_id: venueId, date: '2099-04-04', start_time: '19:00' },
    })
    expect(concert.status(), await concert.text()).toBe(201)
    const body = (await concert.json()).data
    concertId = body.id
    // On by default, so every existing show page keeps its labels.
    expect(body.show_lineup_roles).toBe(true)
  })

  test.afterAll(async ({ request }) => {
    for (const path of [concertId && `/api/concerts/${concertId}`, venueId && `/api/venues/${venueId}`]) {
      if (!path) continue
      const res = await request.delete(path, { headers: adminHeaders() })
      expect(res.ok(), `DELETE ${path} → ${res.status()}`).toBe(true)
    }
  })

  async function openList(page: import('@playwright/test').Page) {
    await page.goto('/admin/concerts')
    await page.waitForLoadState('networkidle')
    await searchTable(page, concertName)
  }

  /** `listOpen`: the list is already loaded and searched — skip a second page load. */
  async function openEditor(page: import('@playwright/test').Page, { listOpen = false } = {}) {
    if (!listOpen) await openList(page)
    await page.locator('tbody tr').filter({ hasText: concertName }).getByRole('button', { name: /edit/i }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal.getByRole('heading', { name: /edit concert/i })).toBeVisible()
    return modal
  }

  test('unticking the switch saves it off, and the form loads it back off', async ({ page, request }) => {
    let modal = await openEditor(page)
    const toggle = modal.getByTestId('concert-show-lineup-roles')
    await expect(toggle).toBeChecked()
    await toggle.uncheck()

    const saved = page.waitForResponse((r) => r.url().includes(`/api/concerts/${concertId}`) && r.request().method() !== 'GET')
    await modal.getByRole('button', { name: /update|save/i }).click()
    const res = await saved
    expect(res.status(), await res.text()).toBeLessThan(300)
    await expect(modal).not.toBeVisible({ timeout: 8000 })
    await expectToast(page, 'Concert updated')

    const after = (await (await request.get(`/api/concerts/${concertId}`, { headers: adminHeaders() })).json()).data
    expect(after.show_lineup_roles).toBe(false)

    modal = await openEditor(page)
    await expect(modal.getByTestId('concert-show-lineup-roles')).not.toBeChecked()
    // Loading the stored value must not count as an edit.
    await expect(modal.getByRole('button', { name: /update|save/i })).toBeDisabled()
  })

  test("our band's line-up row takes its own stage time, apart from the show's start", async ({ page, request }) => {
    // Before: the list says our time is not set (in words, whatever the UI language).
    await openList(page)
    const cell = page.locator('tbody tr').filter({ hasText: concertName }).getByTestId('concert-stage-time')
    await expect(cell.locator('.stage-unset')).toHaveCount(1)
    await expect(cell).not.toContainText('19:00')

    let modal = await openEditor(page, { listOpen: true })
    const own = modal.getByTestId('concert-own-play-time')
    await expect(own).toHaveValue('')
    await own.fill('23:00')

    const saved = page.waitForResponse((r) => r.url().includes(`/api/concerts/${concertId}`) && r.request().method() !== 'GET')
    await modal.getByRole('button', { name: /update|save/i }).click()
    expect((await saved).status()).toBeLessThan(300)
    await expect(modal).not.toBeVisible({ timeout: 8000 })

    const after = (await (await request.get(`/api/concerts/${concertId}`, { headers: adminHeaders() })).json()).data
    expect(after.own_play_time?.slice(0, 5)).toBe('23:00')
    expect(after.start_time?.slice(0, 5)).toBe('19:00')

    // After: the list shows our own time; the start stays in its own column.
    await expect(cell).toHaveText('23:00')
    await expect(cell.locator('.stage-unset')).toHaveCount(0)

    modal = await openEditor(page)
    await expect(modal.getByTestId('concert-own-play-time')).toHaveValue('23:00')
  })
})
