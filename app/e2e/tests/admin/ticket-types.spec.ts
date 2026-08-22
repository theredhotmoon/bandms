import { test, expect, type Page } from '@playwright/test'
import { expectToast } from '../../fixtures/test-base'
import { seedTicket, type SeededTicket } from '../../fixtures/seed'

test.use({ storageState: 'e2e/.auth/admin.json' })

/*
 * Ticket types and their price tiers are edited in ConcertTicketsManager, which
 * opens in a modal from the Tickets button on a concert row.
 *
 * The seeded venue name is unique per run, so the concerts search narrows the
 * table to exactly the concert we created rather than depending on whatever
 * else happens to be in the database.
 *
 * Deletes go through window.confirm. An unanswered dialog blocks the page and
 * every later assertion times out, so the handler is registered before the click.
 */

const TYPE_NAME = `e2e-type-${Date.now()}`
const TIER_NAME = `e2e-tier-${Date.now()}`

let seeded: SeededTicket

async function openTicketsFor(page: Page, venueName: string) {
  await page.goto('/admin/concerts')
  await page.waitForLoadState('networkidle')

  await page.locator('input.search-input').fill(venueName)
  const row = page.locator('tbody tr').filter({ hasText: venueName })
  await expect(row).toHaveCount(1)

  await row.getByRole('button', { name: 'Tickets' }).click()
  await expect(page.locator('.modal-overlay')).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Add type' })).toBeVisible()
}

test.describe('Concert ticket types', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    seeded = seedTicket(1)
  })

  test('the tickets modal lists the concert’s existing types', async ({ page }) => {
    await openTicketsFor(page, seeded.venue_name)

    const card = page.locator('.type-card').filter({ hasText: seeded.ticket_type })
    await expect(card).toHaveCount(1)
    // Seeded with a tier priced in the current window, so it reads as on sale.
    await expect(card.locator('.badge')).toContainText(/On sale/)
  })

  test('creates a ticket type', async ({ page }) => {
    await openTicketsFor(page, seeded.venue_name)

    await page.getByRole('button', { name: '+ Add type' }).click()

    const form = page.locator('.form-panel')
    await expect(form).toBeVisible()
    await form.locator('input.inp').first().fill(TYPE_NAME)
    await form.getByRole('button', { name: 'Save' }).click()

    await expectToast(page, 'Ticket type created')
    await expect(page.locator('.type-card').filter({ hasText: TYPE_NAME })).toHaveCount(1)
  })

  test('a type with no tiers is not on sale', async ({ page }) => {
    await openTicketsFor(page, seeded.venue_name)

    const card = page.locator('.type-card').filter({ hasText: TYPE_NAME })
    await expect(card.locator('.tier-empty')).toContainText('No price tiers yet')
    await expect(card.locator('.badge')).toContainText('Not on sale')
  })

  test('adds a price tier, which puts the type on sale', async ({ page }) => {
    await openTicketsFor(page, seeded.venue_name)

    const card = page.locator('.type-card').filter({ hasText: TYPE_NAME })
    await card.getByRole('button', { name: '+ Add tier' }).click()

    const form = page.locator('.form-panel')
    await expect(form).toBeVisible()
    await form.getByPlaceholder('e.g. Early Bird').fill(TIER_NAME)
    await form.locator('input[type="number"]').first().fill('15.00')
    await form.getByRole('button', { name: 'Save' }).click()

    await expectToast(page, 'Tier created')

    const updated = page.locator('.type-card').filter({ hasText: TYPE_NAME })
    await expect(updated.locator('.tier-row').filter({ hasText: TIER_NAME })).toHaveCount(1)
    await expect(updated.locator('.badge')).toContainText(/On sale/)
  })

  test('deletes the ticket type', async ({ page }) => {
    await openTicketsFor(page, seeded.venue_name)

    page.on('dialog', d => d.accept())

    const card = page.locator('.type-card').filter({ hasText: TYPE_NAME })
    await card.getByRole('button', { name: 'Delete' }).click()

    await expectToast(page, 'Ticket type deleted')
    await expect(page.locator('.type-card').filter({ hasText: TYPE_NAME })).toHaveCount(0)
  })
})
