import { test, expect } from '@playwright/test'
import { expectToast, searchTable } from '../../fixtures/test-base'
import { adminHeaders } from '../../fixtures/admin-api'

/**
 * A gig whose guest band has a play time can be opened and saved.
 *
 * The API returns pivot times as `HH:mm:ss` (a MySQL TIME column) and validates
 * them as `H:i`. The form trimmed the gig's own times on load but not the guest
 * bands', so saving any edit of such a gig — reordering the lineup — failed with
 * "The bands.0.play_time field must match the format H:i."
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe.serial('Admin Concerts — guest band play time', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const concertName = `E2E PlayTime ${stamp}`
  let venueId: number | null = null
  let bandId: number | null = null
  let concertId: number | null = null

  test.beforeAll(async ({ request }) => {
    // Its own venue, so the spec never skips on a database that has none.
    const venue = await request.post('/api/venues', { headers: adminHeaders(), data: { name: `E2E PlayTime Venue ${stamp}` } })
    expect(venue.status(), await venue.text()).toBe(201)
    venueId = (await venue.json()).data.id

    const band = await request.post('/api/bands', { headers: adminHeaders(), data: { name: `E2E Support ${stamp}` } })
    expect(band.status(), await band.text()).toBe(201)
    bandId = (await band.json()).data.id

    const concert = await request.post('/api/concerts', {
      headers: adminHeaders(),
      data: {
        name: { en: concertName },
        venue_id: venueId,
        date: '2099-03-03',
        start_time: '20:00',
        own_sort_order: 2,
        bands: [{ id: bandId, sort_order: 1, play_time: '21:00' }],
      },
    })
    expect(concert.status(), await concert.text()).toBe(201)
    concertId = (await concert.json()).data.id
  })

  // Concert first: it references the band and the venue. Each delete is
  // asserted, so a leftover fixture fails the run instead of piling up in the
  // dev database (and on the next public build).
  test.afterAll(async ({ request }) => {
    for (const path of [
      concertId && `/api/concerts/${concertId}`,
      bandId && `/api/bands/${bandId}`,
      venueId && `/api/venues/${venueId}`,
    ]) {
      if (!path) continue
      const res = await request.delete(path, { headers: adminHeaders() })
      expect(res.ok(), `DELETE ${path} → ${res.status()}`).toBe(true)
    }
  })

  test('opening the gig does not mark it edited', async ({ page }) => {
    // The other half of the same bug: the lineup's own-band row loaded the
    // untrimmed start time, a watcher rewrote it to HH:mm, and every opened
    // gig read as dirty — Save enabled, "Discard changes?" on a clean close.
    await page.goto('/admin/concerts')
    await page.waitForLoadState('networkidle')
    await searchTable(page, concertName)
    await page.locator('tbody tr').filter({ hasText: concertName }).getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal.getByRole('heading', { name: /edit concert/i })).toBeVisible()
    await expect(modal.locator('.play-time-input')).toHaveValue('21:00')
    await expect(modal.getByRole('button', { name: /update|save/i })).toBeDisabled()
  })

  test('reordering the lineup saves, and keeps the band at 21:00', async ({ page, request }) => {
    await page.goto('/admin/concerts')
    await page.waitForLoadState('networkidle')
    await searchTable(page, concertName)
    await page.locator('tbody tr').filter({ hasText: concertName }).getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal.getByRole('heading', { name: /edit concert/i })).toBeVisible()
    await expect(modal.locator('select').first().locator('option:not([disabled])')).not.toHaveCount(0, { timeout: 10000 })

    // The guest band plays first (sort 1), us second. Drag us above them —
    // the edit that surfaced the 422.
    const items = modal.locator('.lineup-item')
    await expect(items.first()).not.toHaveClass(/is-main/)
    await modal.locator('.lineup-item.is-main').dragTo(items.first())
    await expect(items.first()).toHaveClass(/is-main/)

    const saved = page.waitForResponse((r) => r.url().includes(`/api/concerts/${concertId}`) && r.request().method() !== 'GET')
    await modal.getByRole('button', { name: /update|save/i }).click()
    const res = await saved
    expect(res.status(), await res.text()).toBeLessThan(300)

    await expect(modal).not.toBeVisible({ timeout: 8000 })
    await expectToast(page, 'Concert updated')

    const after = (await (await request.get(`/api/concerts/${concertId}`, { headers: adminHeaders() })).json()).data
    expect(after.own_sort_order).toBe(1)
    expect(after.bands.map((b: { sort_order: number; play_time: string | null }) => [b.sort_order, b.play_time?.slice(0, 5)]))
      .toEqual([[2, '21:00']])
  })
})
