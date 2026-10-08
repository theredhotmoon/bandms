import { test, expect } from '@playwright/test'
import { primaryLocale } from '../../fixtures/admin-api'

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
    await modal.locator('select').selectOption('EP')

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

    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Release deleted', { timeout: 8000 })
    await expect(page.getByRole('cell', { name: editedTitle })).not.toBeVisible({ timeout: 8000 })
  })

  // useDirtyGuard disables "Create release" on a blank, untouched form — the
  // button can't even be clicked, let alone reach HTML5 validation, which is
  // arguably a stronger guarantee than relying on `required` alone. To still
  // prove the underlying rule ("no release without a title") through a path
  // compatible with dirty-gating, this types into a non-title field first so
  // the form is genuinely dirty and Create becomes enabled, then leaves the
  // title blank and confirms the browser's native `required` validation still
  // blocks the submit.
  // The release form reports its dirty state to AdminModal through
  // useModalGuard, so every way out asks first once something was typed.
  test('discard guard: Escape, backdrop and Cancel ask before dropping a dirty form', async ({ page }) => {
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '+ Add release' }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // Pristine: Escape closes at once.
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()

    await page.getByRole('button', { name: '+ Add release' }).click()
    await modal.locator('input[placeholder="Release title"]').fill('Unsaved release')
    const discard = page.getByRole('dialog', { name: 'Discard changes?' })

    await page.keyboard.press('Escape')
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Cancel' }).click()
    await expect(discard).toHaveCount(0)
    await expect(modal.locator('input[placeholder="Release title"]')).toHaveValue('Unsaved release')

    // The backdrop is the full overlay with the panel centred over it, so
    // click a corner the panel cannot cover.
    await modal.locator('.modal-backdrop').click({ position: { x: 5, y: 5 } })
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Cancel' }).click()
    await expect(discard).toHaveCount(0)
    await expect(modal.locator('input[placeholder="Release title"]')).toHaveValue('Unsaved release')

    await modal.getByRole('button', { name: 'Cancel' }).click()
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Discard' }).click()
    await expect(modal).not.toBeVisible()
    await expect(page.getByRole('cell', { name: 'Unsaved release' })).toHaveCount(0)
  })

  test('validation: submit without title → browser required constraint fires', async ({ page, request }) => {
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add release' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const createBtn = modal.getByRole('button', { name: /Create release/i })
    await expect(createBtn).toBeDisabled()

    // Dirty-gate via a non-title field, leaving the title itself blank.
    await modal.locator('select').first().selectOption('EP')
    await expect(createBtn).toBeEnabled()

    // Leave title empty, click submit
    await createBtn.click()

    // The title input has `required`; the form should not have submitted (modal stays open)
    await expect(modal).toBeVisible()

    // `required` sits on the title input of the band's *first* content
    // language, not on the English one — a Polish-first band (the prod-synced
    // dev DB) requires the Polish title and leaves "Release title" optional.
    const titleInput = modal.locator(`.trans-row[data-locale="${await primaryLocale(request)}"] input`).first()
    await expect(titleInput).toHaveAttribute('required', '')
    const isValid = await titleInput.evaluate((el: HTMLInputElement) => el.validity.valid)
    expect(isValid).toBe(false)

    await modal.locator('button[aria-label="Close"], button:has(svg)').first().click()
    // The form is dirty (a type was picked), so the X asks before closing.
    const discard = page.getByRole('dialog', { name: 'Discard changes?' })
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Discard' }).click()
    await expect(modal).not.toBeVisible()
  })

  test('validation: type field — default is preselected so no empty-type error; verify type options exist', async ({ page }) => {
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add release' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // Type select is the first <select> in the form
    const typeSelect = modal.locator('select').first()
    await expect(typeSelect).toBeVisible()

    // All four type options must be present
    for (const opt of ['LP', 'EP', 'single', 'compilation']) {
      await expect(modal.locator(`option[value="${opt}"]`)).toHaveCount(1)
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
    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })
    await confirmDialog.getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Release deleted' })).toBeVisible({ timeout: 8000 })
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
    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })
    await confirmDialog.getByRole('button', { name: 'Delete' }).click()
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Release deleted' })).toBeVisible({ timeout: 8000 })
  })
})
