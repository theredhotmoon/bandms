import { test, expect } from '@playwright/test'
import { seedTicket, type SeededTicket } from '../../fixtures/seed'

test.use({ storageState: 'e2e/.auth/admin.json' })

/*
 * /admin/concerts/:id/tickets is the issued-ticket list. It lives on its own
 * path rather than sharing /concerts/:id/tickets with the public ticket-type
 * listing — the two collided during the merge and the admin route silently
 * shadowed the public one, so this spec also pins that they stay distinct.
 */

let seeded: SeededTicket

test.describe('Concert Tickets — admin list', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    seeded = seedTicket(2)
  })

  test('lists the issued tickets for the concert', async ({ page }) => {
    await page.goto(`/admin/concerts/${seeded.concert_id}/tickets`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /Concert Tickets/ })).toBeVisible()

    const rows = page.locator('.table-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText(seeded.fan_email)
    await expect(rows.first()).toContainText(seeded.ticket_type)
  })

  test('filters by holder email', async ({ page }) => {
    await page.goto(`/admin/concerts/${seeded.concert_id}/tickets`)
    await page.waitForLoadState('networkidle')

    await page.getByPlaceholder('Filter by email…').fill('no-such-buyer@example.com')
    await expect(page.locator('.state-msg')).toContainText('No tickets match your filters')

    await page.getByPlaceholder('Filter by email…').fill(seeded.fan_email)
    await expect(page.locator('.table-row')).toHaveCount(2)
  })

  test('the public ticket-type listing stays public — the admin list must not shadow it', async ({ request }) => {
    // Regression guard: both were once registered on the same URI, and Laravel
    // keys routes by method + URI, so the later registration won and the Astro
    // build lost its unauthenticated access to ticket types.
    const publicRes = await request.get(`/api/concerts/${seeded.concert_id}/tickets`, {
      headers: { Accept: 'application/json' },
    })
    expect(publicRes.status()).toBe(200)

    const body = await publicRes.json()
    expect(Array.isArray(body.data)).toBe(true)
  })
})
