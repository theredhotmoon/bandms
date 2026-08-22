import { test, expect } from '@playwright/test'
import { seedTicket, type SeededTicket } from '../../fixtures/seed'

test.use({ storageState: 'e2e/.auth/admin.json' })

/*
 * The door check is the one screen where a wrong answer costs someone their
 * evening, and it had no coverage at all. It is also the screen whose flow
 * changed most in the ticket-platform merge: detection now runs the read-only
 * doorCheck endpoint, and marking a ticket used is a separate, deliberate press.
 *
 * These specs drive it through the manual-entry path rather than the camera —
 * a headless browser has no camera, and BarcodeDetector only feeds the same
 * check() the input does.
 */

let seeded: SeededTicket

test.describe('Door Check', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    seeded = seedTicket(2)
  })

  test('page loads with the code entry visible', async ({ page }) => {
    await page.goto('/admin/door')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Door Check' })).toBeVisible()
    await expect(page.locator('.code-input')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check' })).toBeVisible()
  })

  test('an unknown code is reported invalid', async ({ page }) => {
    await page.goto('/admin/door')
    await page.waitForLoadState('networkidle')

    await page.locator('.code-input').fill('00000000-0000-4000-8000-000000000000')
    await page.getByRole('button', { name: 'Check' }).click()

    await expect(page.locator('.status-text')).toContainText('INVALID TICKET', { timeout: 10_000 })

    // An invalid result must not offer the button that burns a ticket.
    await expect(page.getByRole('button', { name: /Mark as Scanned/ })).toHaveCount(0)
  })

  test('a valid ticket shows its details without being marked used', async ({ page }) => {
    await page.goto('/admin/door')
    await page.waitForLoadState('networkidle')

    await page.locator('.code-input').fill(seeded.ticket_uuid)
    await page.getByRole('button', { name: 'Check' }).click()

    await expect(page.locator('.status-text')).toContainText('VALID — ALLOW ENTRY', { timeout: 10_000 })

    const info = page.locator('.info-grid')
    await expect(info).toContainText(seeded.ticket_type)
    await expect(info).toContainText(seeded.venue_name)

    // The whole point of the two-step flow: looking is not entering.
    await expect(page.getByRole('button', { name: /Mark as Scanned/ })).toBeVisible()
  })

  test('checking the same ticket again still reads valid — a look does not consume it', async ({ page }) => {
    await page.goto('/admin/door')
    await page.waitForLoadState('networkidle')

    await page.locator('.code-input').fill(seeded.ticket_uuid)
    await page.getByRole('button', { name: 'Check' }).click()

    await expect(page.locator('.status-text')).toContainText('VALID — ALLOW ENTRY', { timeout: 10_000 })
  })

  test('marking a ticket scanned admits it, and a re-check reports it already used', async ({ page }) => {
    await page.goto('/admin/door')
    await page.waitForLoadState('networkidle')

    await page.locator('.code-input').fill(seeded.ticket_uuid)
    await page.getByRole('button', { name: 'Check' }).click()
    await expect(page.locator('.status-text')).toContainText('VALID — ALLOW ENTRY', { timeout: 10_000 })

    await page.getByRole('button', { name: /Mark as Scanned/ }).click()
    await expect(page.locator('.status-text')).toContainText('ALREADY SCANNED', { timeout: 10_000 })

    // Re-check from a clean slate: the ticket must stay burned.
    await page.getByRole('button', { name: 'Reset' }).click()
    await page.locator('.code-input').fill(seeded.ticket_uuid)
    await page.getByRole('button', { name: 'Check' }).click()

    await expect(page.locator('.status-text')).toContainText('ALREADY SCANNED', { timeout: 10_000 })
  })

  test('a second ticket from the same order is unaffected by the first being scanned', async ({ page }) => {
    // Per-unit tickets are the reason the platform mints a row per seat rather
    // than one code per order line — scanning one must not admit the other.
    await page.goto('/admin/door')
    await page.waitForLoadState('networkidle')

    await page.locator('.code-input').fill(seeded.ticket_uuids[1])
    await page.getByRole('button', { name: 'Check' }).click()

    await expect(page.locator('.status-text')).toContainText('VALID — ALLOW ENTRY', { timeout: 10_000 })
  })

  test('the scan log records what came through the door', async ({ page }) => {
    await page.goto('/admin/door')
    await page.waitForLoadState('networkidle')

    await page.locator('.code-input').fill(seeded.ticket_uuids[1])
    await page.getByRole('button', { name: 'Check' }).click()
    await expect(page.locator('.status-text')).toBeVisible({ timeout: 10_000 })

    const log = page.locator('.scan-log')
    await expect(log).toBeVisible()
    await expect(log.locator('.log-entry').first()).toContainText(seeded.ticket_uuids[1].slice(0, 8))
  })
})
