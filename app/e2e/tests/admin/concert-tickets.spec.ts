import { test, expect, type Page } from '@playwright/test'
import { expectToast } from '../../fixtures/test-base'
import { adminHeaders } from '../../fixtures/admin-api'
import { seedTicket, type SeededTicket } from '../../fixtures/seed'

test.use({ storageState: 'e2e/.auth/admin.json' })

/*
 * Tickets are set up in the concert's edit modal only — an external shop URL
 * and our own ticket types, side by side. The list's Tickets button is a
 * read-only report, shown only when there is something to report.
 *
 * The seeded concert has one ticket type and one issued ticket; its venue
 * name is unique per run, so searching for it isolates the row.
 */

const SHOP_URL = `https://tickets.example.com/e2e-${Date.now()}`

let seeded: SeededTicket
let bareConcertId: number | null = null

async function rowFor(page: Page, venueName: string) {
  await page.goto('/admin/concerts')
  await page.waitForLoadState('networkidle')
  await page.locator('input.search-input').fill(venueName)
  const row = page.locator('tbody tr').filter({ hasText: venueName })
  await expect(row.first()).toBeVisible()
  return row
}

test.describe('Concert tickets — set up in the form, reported from the list', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ request }) => {
    seeded = seedTicket(1)
    // A second concert at the same venue with no tickets of any kind.
    const concert = await request.get(`/api/concerts/${seeded.concert_id}`, { headers: adminHeaders() })
    const venueId = ((await concert.json()) as { data: { venue: { id: number } } }).data.venue.id
    const bare = await request.post('/api/concerts', {
      headers: adminHeaders(),
      data: { venue_id: venueId, date: '2099-03-03' },
    })
    if (!bare.ok()) throw new Error(`Seeding the bare concert failed: ${bare.status()} ${await bare.text()}`)
    bareConcertId = ((await bare.json()) as { data: { id: number } }).data.id
  })

  test.afterAll(async ({ request }) => {
    if (bareConcertId !== null) await request.delete(`/api/concerts/${bareConcertId}`, { headers: adminHeaders() })
  })

  test('the Tickets button shows only for a concert that sells tickets', async ({ page }) => {
    const rows = await rowFor(page, seeded.venue_name)
    await expect(rows).toHaveCount(2)
    await expect(rows.getByTestId('concert-tickets-btn')).toHaveCount(1)
    await expect(rows.filter({ hasText: '2099-03-03' }).getByTestId('concert-tickets-btn')).toHaveCount(0)
  })

  test('the overview reports who bought our tickets', async ({ page }) => {
    const rows = await rowFor(page, seeded.venue_name)
    await rows.getByTestId('concert-tickets-btn').click()

    const overview = page.getByTestId('concert-tickets-overview')
    await expect(overview).toBeVisible()
    await expect(overview.getByTestId('tickets-sold-count')).toHaveText('1 sold')
    await expect(overview).toContainText(seeded.fan_email)
    await expect(overview).toContainText('No external shop set.')
  })

  test('an external ticket shop is saved from the edit modal and reported', async ({ page }) => {
    let rows = await rowFor(page, seeded.venue_name)
    await rows.filter({ has: page.getByTestId('concert-tickets-btn') }).getByRole('button', { name: 'Edit' }).click()

    const tickets = page.getByTestId('concert-tickets')
    await expect(tickets).toBeVisible()
    // Our own ticket types are managed in the same section.
    await expect(tickets.locator('.type-card').filter({ hasText: seeded.ticket_type })).toHaveCount(1)

    await tickets.getByLabel('External ticket shop').fill(SHOP_URL)
    await page.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Concert updated')

    rows = await rowFor(page, seeded.venue_name)
    await rows.getByTestId('concert-tickets-btn').click()
    await expect(page.getByTestId('concert-tickets-overview').getByRole('link', { name: SHOP_URL })).toBeVisible()
  })

  test('a new concert explains that tickets come after the first save', async ({ page }) => {
    await page.goto('/admin/concerts')
    await page.getByRole('button', { name: '+ Add concert' }).click()
    const tickets = page.getByTestId('concert-tickets')
    await expect(tickets).toContainText('Save the concert first')
    await expect(tickets.getByRole('button', { name: '+ Add type' })).toHaveCount(0)
    // The external shop can be set straight away.
    await expect(tickets.getByLabel('External ticket shop')).toBeVisible()
  })

  test('the form is laid out in four columns on a wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto('/admin/concerts')
    await page.getByRole('button', { name: '+ Add concert' }).click()

    const cols = ['concert-col-about', 'concert-col-venue', 'concert-col-when', 'concert-col-aside']
    const boxes = []
    for (const id of cols) boxes.push(await page.getByTestId(id).boundingBox())
    // Side by side, left to right, with the poster/tags column the narrow one.
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x)
    expect(boxes[3]!.width).toBeLessThan(boxes[0]!.width / 2)
    // The ticket section sits below all four.
    const ticketsTop = (await page.getByTestId('concert-tickets').boundingBox())!.y
    expect(ticketsTop).toBeGreaterThan(Math.max(...boxes.map(b => b!.y)))
  })
})
