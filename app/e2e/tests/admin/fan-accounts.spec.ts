import { test, expect } from '@playwright/test'
import { seedTicket, type SeededTicket } from '../../fixtures/seed'

test.use({ storageState: 'e2e/.auth/admin.json' })

let seeded: SeededTicket

test.describe('Fan Accounts — admin', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(() => {
    seeded = seedTicket(2)
  })

  test('lists the fan account created alongside the tickets', async ({ page }) => {
    await page.goto('/admin/fan-accounts')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Fan Accounts' })).toBeVisible()

    const row = page.locator('.table-row').filter({ hasText: seeded.fan_email })
    await expect(row).toBeVisible()
    await expect(row).toContainText(seeded.fan_name)
  })

  test('reports how many tickets the fan holds', async ({ page }) => {
    await page.goto('/admin/fan-accounts')
    await page.waitForLoadState('networkidle')

    const row = page.locator('.table-row').filter({ hasText: seeded.fan_email })
    // Two tickets were minted against this account.
    await expect(row.locator('.td').nth(2)).toHaveText('2')
  })

  test('is closed to non-admins', async ({ browser }) => {
    // The fan list carries names and email addresses, so the role guard on it
    // is the point rather than an incidental detail.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()

    await page.goto('/admin/fan-accounts')
    // Bounced to the panel root, which renders the sign-in form — there is no
    // /login route to land on any more.
    await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()

    await ctx.close()
  })
})
