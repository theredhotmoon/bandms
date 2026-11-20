import { test, expect, type Page } from '@playwright/test'

/**
 * The newsletter section is superadmin-only. The E2E admin *is* a superadmin
 * (newsletter.spec.ts and newsletter-edit.spec.ts cover that side), so the
 * plain-admin side is reproduced here without a second account: the stored
 * user's flag is flipped for the nav, and the API's 403 is served for the
 * page. The server-side 403 itself is pinned by NewsletterTest (Pest).
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

async function storeSuperadminFlag(page: Page, value: boolean | undefined) {
  await page.addInitScript((flag) => {
    const raw = localStorage.getItem('auth_user')
    if (!raw) return
    const user = JSON.parse(raw) as Record<string, unknown>
    if (flag === null) delete user.is_superadmin
    else user.is_superadmin = flag
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, value ?? null)
}

/** What GET /api/user answers — the refresh the admin shell runs on load. */
async function serveCurrentUser(page: Page, superadmin: boolean) {
  await page.route('**/api/user', async route => {
    const res = await route.fetch()
    const body = await res.json() as Record<string, unknown>
    await route.fulfill({ response: res, json: { ...body, is_superadmin: superadmin } })
  })
}

test.describe('Newsletter — superadmin only', () => {
  test('a superadmin sees the Newsletter link', async ({ page }) => {
    await page.goto('/admin')
    await page.getByRole('button', { name: /content|treści/i }).first().click()
    await expect(page.getByTestId('nav-newsletter')).toBeVisible()
  })

  test('an admin who is not a superadmin has no Newsletter link', async ({ page }) => {
    await storeSuperadminFlag(page, false)
    await serveCurrentUser(page, false)
    await page.goto('/admin')
    await page.getByRole('button', { name: /content|treści/i }).first().click()
    // A sibling in the same group is there, so the group did open.
    await expect(page.locator(`a[href$="/pitch"]`).first()).toBeVisible()
    await expect(page.getByTestId('nav-newsletter')).toHaveCount(0)
  })

  test('someone promoted since they signed in gets the link without signing in again', async ({ page }) => {
    await storeSuperadminFlag(page, false)
    await serveCurrentUser(page, true)
    await page.goto('/admin')
    await page.getByRole('button', { name: /content|treści/i }).first().click()
    await expect(page.getByTestId('nav-newsletter')).toBeVisible()
  })

  test('a session stored before the flag existed still shows the link', async ({ page }) => {
    await storeSuperadminFlag(page, undefined)
    // The refresh failing must leave the stored copy alone.
    await page.route('**/api/user', route => route.fulfill({ status: 500, json: { message: 'down' } }))
    await page.goto('/admin')
    await page.getByRole('button', { name: /content|treści/i }).first().click()
    await expect(page.getByTestId('nav-newsletter')).toBeVisible()
  })

  test('opening the page as a plain admin explains the 403 instead of a table', async ({ page }) => {
    await page.route('**/api/newsletter-subscribers*', route =>
      route.fulfill({ status: 403, json: { message: 'Only a superadmin can do this.' } }))

    await page.goto('/admin/newsletter')

    await expect(page.getByTestId('newsletter-forbidden')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('table')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /export csv|eksportuj/i })).toHaveCount(0)
  })
})
