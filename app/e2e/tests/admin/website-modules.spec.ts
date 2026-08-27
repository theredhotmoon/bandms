import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const KICKER = `E2E KICKER ${Date.now()}`

test.describe('Website Modules Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads and lists modules', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Website Modules' })).toBeVisible()
    await expect(page.getByText('Contact', { exact: true }).first()).toBeVisible({ timeout: 8000 })
  })

  test('page copy fields appear only for modules that define them', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')

    // The edit button carries a unique aria-label per module, which is a far
    // steadier hook than filtering rows by text.
    await page.getByRole('button', { name: 'Edit Contact settings' }).click()

    await expect(page.getByText('Page copy')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('#set-kicker-en')).toBeVisible()
    await expect(page.locator('#set-lead-pl')).toBeVisible()
  })

  test('saving a kicker persists it and it survives a reload', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Edit Contact settings' }).click()

    const kicker = page.locator('#set-kicker-en')
    await expect(kicker).toBeVisible({ timeout: 8000 })
    await kicker.fill(KICKER)

    await page.getByRole('button', { name: /^Save$/ }).click()

    // The panel closes on success; a reload proves it round-tripped rather than
    // just clearing the form.
    await expect(page.locator('#set-kicker-en')).not.toBeVisible({ timeout: 8000 })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Edit Contact settings' }).click()
    await expect(page.locator('#set-kicker-en')).toHaveValue(KICKER, { timeout: 8000 })
  })

  // The API merges per locale, so editing English must not blank Polish. This is
  // the same trap the URL slug fields set, and the reason both send explicit
  // nulls rather than omitting a locale.
  test('editing one locale leaves the other intact', async ({ page }) => {
    await page.goto('/admin/website-modules')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Edit Contact settings' }).click()

    const polish = page.locator('#set-kicker-pl')
    await expect(polish).toBeVisible({ timeout: 8000 })

    const before = await polish.inputValue()
    test.skip(before === '', 'No Polish kicker stored to protect')

    await page.locator('#set-kicker-en').fill(`${KICKER}-again`)
    await page.getByRole('button', { name: /^Save$/ }).click()
    await expect(page.locator('#set-kicker-en')).not.toBeVisible({ timeout: 8000 })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Edit Contact settings' }).click()
    await expect(page.locator('#set-kicker-pl')).toHaveValue(before, { timeout: 8000 })
  })

  test('is closed to non-admins', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()

    await page.goto('/admin/website-modules')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })

    await ctx.close()
  })
})
