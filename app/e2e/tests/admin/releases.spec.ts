import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const UNIQUE_TITLE = `e2e-release-${Date.now()}`
let editedTitle = `${UNIQUE_TITLE}-edited`

test.describe('Releases Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads and shows Releases heading', async ({ page }) => {
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1')).toContainText('Releases')
  })

  test('create release: modal opens, fill fields, save → toast and row appear', async ({ page }) => {
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add release' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // Fill title
    await modal.locator('input[placeholder="Release title"]').fill(UNIQUE_TITLE)

    // Select type EP
    await modal.locator('select').filter({ has: modal.locator('option[value="EP"]') }).selectOption('EP')

    // Fill release date
    await modal.locator('input[type="date"]').fill('2025-06-01')

    // Submit
    await modal.getByRole('button', { name: /Create release/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Release created', { timeout: 8000 })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: UNIQUE_TITLE })).toBeVisible({ timeout: 8000 })
  })

  test('edit release: click Edit → change title → save → toast "Release updated"', async ({ page }) => {
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')

    // Search so the row is visible
    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(UNIQUE_TITLE)
    await page.waitForTimeout(300)

    const row = page.locator('tr').filter({ hasText: UNIQUE_TITLE })
    await row.getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // Wait for the form to be populated (edit mode fetches full record)
    const titleInput = modal.locator('input[placeholder="Release title"]')
    await expect(titleInput).not.toHaveValue('', { timeout: 8000 })

    await titleInput.clear()
    await titleInput.fill(editedTitle)

    await modal.getByRole('button', { name: /Update release/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Release updated', { timeout: 8000 })
    await expect(modal).not.toBeVisible()
  })

  test('delete release: click Delete → ConfirmDialog → Delete → toast "Release deleted"', async ({ page }) => {
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(editedTitle)
    await page.waitForTimeout(300)

    const row = page.locator('tr').filter({ hasText: editedTitle })
    await row.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page.locator('[role="dialog"], .fixed').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Release deleted', { timeout: 8000 })
    await expect(page.getByRole('cell', { name: editedTitle })).not.toBeVisible({ timeout: 8000 })
  })

  test('validation: submit without title → browser required constraint fires', async ({ page }) => {
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add release' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // Leave title empty, click submit
    await modal.getByRole('button', { name: /Create release/i }).click()

    // The title input has `required`; the form should not have submitted (modal stays open)
    await expect(modal).toBeVisible()

    // Optionally assert the title input is invalid via the validity API
    const titleInput = modal.locator('input[placeholder="Release title"]')
    const isValid = await titleInput.evaluate((el: HTMLInputElement) => el.validity.valid)
    expect(isValid).toBe(false)

    await modal.locator('button[aria-label="Close"], button:has(svg)').first().click()
    await expect(modal).not.toBeVisible()
  })

  test('validation: type field — default is preselected so no empty-type error; verify type options exist', async ({ page }) => {
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add release' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const typeSelect = modal.locator('select').filter({ has: modal.locator('option[value="EP"]') })
    await expect(typeSelect).toBeVisible()

    // All four type options must be present
    for (const opt of ['LP', 'EP', 'single', 'compilation']) {
      await expect(typeSelect.locator(`option[value="${opt}"]`)).toHaveCount(1)
    }

    await modal.locator('button[aria-label="Close"], button:has(svg)').first().click()
    await expect(modal).not.toBeVisible()
  })

  test('search: type release title → table filters to matching row', async ({ page }) => {
    // Re-create a release to search for
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add release' }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const searchTarget = `e2e-search-${Date.now()}`
    await modal.locator('input[placeholder="Release title"]').fill(searchTarget)
    await modal.locator('input[type="date"]').fill('2025-07-01')
    await modal.getByRole('button', { name: /Create release/i }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Release created', { timeout: 8000 })
    await expect(modal).not.toBeVisible()

    // Now search
    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(searchTarget)
    await page.waitForTimeout(300)

    await expect(page.getByRole('cell', { name: searchTarget })).toBeVisible({ timeout: 8000 })

    // Clean up
    const row = page.locator('tr').filter({ hasText: searchTarget })
    await row.getByRole('button', { name: /delete/i }).click()
    const confirmDialog = page.locator('[role="dialog"], .fixed').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })
    await confirmDialog.getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Release deleted', { timeout: 8000 })
  })

  test('add streaming link: open create form, fill Spotify URL, verify it appears', async ({ page }) => {
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add release' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const spotifyTitle = `e2e-streaming-${Date.now()}`
    await modal.locator('input[placeholder="Release title"]').fill(spotifyTitle)
    await modal.locator('input[type="date"]').fill('2025-08-01')

    // Streaming links section — Spotify row
    const spotifyInput = modal.locator('input[placeholder="Spotify URL…"]')
    await expect(spotifyInput).toBeVisible()
    await spotifyInput.fill('https://open.spotify.com/album/test123')

    // Verify it is visible in the links section
    await expect(spotifyInput).toHaveValue('https://open.spotify.com/album/test123')

    // Submit
    await modal.getByRole('button', { name: /Create release/i }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Release created', { timeout: 8000 })
    await expect(modal).not.toBeVisible()

    // Clean up
    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(spotifyTitle)
    await page.waitForTimeout(300)

    const row = page.locator('tr').filter({ hasText: spotifyTitle })
    await row.getByRole('button', { name: /delete/i }).click()
    const confirmDialog = page.locator('[role="dialog"], .fixed').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })
    await confirmDialog.getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Release deleted', { timeout: 8000 })
  })
})
