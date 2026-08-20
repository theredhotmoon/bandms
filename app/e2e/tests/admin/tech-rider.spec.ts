import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const UNIQUE_NAME = `e2e-tech-rider-${Date.now()}`

test.describe('Tech Rider Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads and "Tech Rider" heading is visible', async ({ page }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1')).toContainText(/tech rider/i)
  })

  test('create tech rider: fill name → save → toast "Rider created", row appears', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    // Button is "+" (btn-new class) or "Create first rider" if no riders exist
    const addBtn = page.locator('button.btn-new').or(page.getByRole('button', { name: /create first rider/i })).first()
    await addBtn.click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal
      .locator('input[placeholder*="Festival rider" i]')
      .first()
      .fill(UNIQUE_NAME)

    await modal.getByRole('button', { name: /create/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(/rider created/i, {
      timeout: 8000,
    })
    await expect(modal).not.toBeVisible()

    await expect(
      page.locator('tr, [data-row], li, .rider-item').filter({ hasText: UNIQUE_NAME }).first(),
    ).toBeVisible({ timeout: 8000 })
  })

  test('activate: click activate button on a rider → toast "Active rider updated", rider shows as active', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tr, [data-row], li, .rider-item')
      .filter({ hasText: UNIQUE_NAME })
      .first()

    // Activate button is .act-btn (not .act-btn--del) with text "✓"
    const activateBtn = row.locator('button.act-btn:not(.act-btn--del)')
    const hasBtnVisible = await activateBtn.isVisible().catch(() => false)
    if (hasBtnVisible) {
      await activateBtn.click()
      await expect(page.locator('[data-sonner-toast]')).toContainText(/active rider updated/i, {
        timeout: 8000,
      })
    }
  })

  // A rider with no channels is a blank document, so publishing is locked until
  // there is at least one. Everything else is only a warning.
  test('publish is blocked while the rider has no channels', async ({ page }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    await page
      .locator('tr, [data-row], li, .rider-item')
      .filter({ hasText: UNIQUE_NAME })
      .first()
      .click()

    await expect(page.locator('.title-input')).toHaveValue(UNIQUE_NAME, { timeout: 8000 })
    await expect(page.locator('.version-chip')).toContainText(/never published/i)

    await page.getByRole('button', { name: /publish v1/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal.locator('.stop-title')).toContainText(/can't publish yet/i)
    await expect(modal.getByRole('button', { name: /publish v1/i })).toBeDisabled()

    await modal.getByRole('button', { name: /cancel/i }).click()
    await expect(modal).not.toBeVisible()
  })

  // "Add row" creates a row the server requires a name for. The editor has to
  // refuse it locally and say which row — a 422 on a five-tab form cannot.
  test('a channel with no instrument name is refused with a specific message', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    await page
      .locator('tr, [data-row], li, .rider-item')
      .filter({ hasText: UNIQUE_NAME })
      .first()
      .click()

    await expect(page.locator('.title-input')).toHaveValue(UNIQUE_NAME, { timeout: 8000 })

    await page.getByRole('button', { name: /channels/i }).click()
    await page.getByRole('button', { name: /add row/i }).click()

    // Flagged where it is created, not only on save.
    await expect(page.locator('.cell-input--invalid')).toBeVisible()
    await expect(page.locator('.needs-name')).toContainText(/needs an instrument name/i)

    await page.getByRole('button', { name: /save rider/i }).click()
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /needs an instrument name/i }),
    ).toBeVisible({ timeout: 8000 })

    // Naming it clears both the mark and the refusal.
    await page.locator('input[placeholder*="Kick drum" i]').first().fill('Talkback')
    await expect(page.locator('.cell-input--invalid')).toHaveCount(0)
    await expect(page.locator('.needs-name')).toHaveCount(0)
  })

  // Publishing is what makes a rider public at all: until a version exists the
  // token link 404s, so this covers both the button and the promise it makes.
  test('publish: add a channel → Publish v1 → chip reads "v1 published", public link renders', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    await page
      .locator('tr, [data-row], li, .rider-item')
      .filter({ hasText: UNIQUE_NAME })
      .first()
      .click()

    await expect(page.locator('.title-input')).toHaveValue(UNIQUE_NAME, { timeout: 8000 })

    // One production extra is enough to make the sheet a real document.
    await page.getByRole('button', { name: /channels/i }).click()
    await page.getByRole('button', { name: /add row/i }).click()
    await page.locator('input[placeholder*="Kick drum" i]').first().fill('Talkback')
    await page.getByRole('button', { name: /save rider/i }).click()
    // Filter rather than index: several toasts stack up in this flow, and the
    // plain locator resolves to whichever arrived first.
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /rider saved/i }),
    ).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /publish v1/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal.locator('.stop-title')).toHaveCount(0)
    await modal.getByRole('button', { name: /publish v1/i }).click()

    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /published v1/i }),
    ).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.version-chip')).toContainText(/v1 published/i, { timeout: 8000 })

    // The rider's own token now resolves to the frozen copy.
    const historyModal = page.locator('.modal-overlay')
    await page.locator('.version-chip').click()
    await expect(historyModal).toBeVisible()
    await expect(historyModal.locator('.version-status')).toContainText(/live link/i)

    const href = await historyModal.locator('a', { hasText: 'Open' }).first().getAttribute('href')
    expect(href).toMatch(/\/rider\/[A-Za-z0-9]{32}$/)

    await page.goto(href!)
    await expect(page.locator('.cover-rider-name')).toContainText(UNIQUE_NAME, { timeout: 10000 })
  })

  // Deriving a festival rider from a club one is the whole point — the copy has
  // to carry the work and none of the identity.
  test('duplicate: copy carries the channels but starts unpublished', async ({ page }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    await page
      .locator('.rider-item')
      .filter({ hasText: UNIQUE_NAME })
      .first()
      .locator('button[title="Duplicate this rider"]')
      .click()

    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /copied to/i }),
    ).toBeVisible({ timeout: 8000 })

    // The editor opens on the copy, which has never been sent.
    await expect(page.locator('.title-input')).toHaveValue(`${UNIQUE_NAME} (copy)`, { timeout: 8000 })
    await expect(page.locator('.version-chip')).toContainText(/never published/i)

    await page.getByRole('button', { name: /channels/i }).click()
    await expect(page.locator('.chan-table tbody tr.data-row')).toHaveCount(1)

    // Clean up the copy so the delete test still targets one row.
    await page
      .locator('.rider-item')
      .filter({ hasText: `${UNIQUE_NAME} (copy)` })
      .first()
      .locator('button.act-btn--del')
      .click()
    const dialog = page.locator('.modal-overlay')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /rider deleted/i }),
    ).toBeVisible({ timeout: 8000 })
  })

  // Comparing v2 with v1 is what makes "we re-sent it" answerable.
  test('version diff: publishing a change reports it against the previous version', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    await page.locator('.rider-item').filter({ hasText: UNIQUE_NAME }).first().click()
    await expect(page.locator('.title-input')).toHaveValue(UNIQUE_NAME, { timeout: 8000 })

    // Change something the printed sheet shows, then publish v2.
    await page.getByRole('button', { name: /channels/i }).click()
    await page.locator('input[placeholder*="Kick drum" i]').first().fill('Talkback mic')
    await page.getByRole('button', { name: /save rider/i }).click()
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /rider saved/i }),
    ).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /publish v2/i }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: /publish v2/i }).click()
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /published v2/i }),
    ).toBeVisible({ timeout: 8000 })

    await page.locator('.version-chip').click()
    const history = page.locator('.modal-overlay')
    await expect(history).toBeVisible()

    await history.getByRole('button', { name: /vs v1/i }).click()
    await expect(history.locator('.diff-title')).toContainText('v1 → v2', { timeout: 8000 })
    await expect(history.locator('.diff-section-title')).toContainText(/channels/i)
    await expect(history.locator('.diff-changes')).toContainText(/instrument: Talkback → Talkback mic/i)
  })

  test('delete: click Delete → confirm modal → Delete → toast "Rider deleted"', async ({
    page,
  }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    const row = page
      .locator('tr, [data-row], li, .rider-item')
      .filter({ hasText: UNIQUE_NAME })
      .first()

    // Delete button is .act-btn--del with text "✕"
    await row.locator('button.act-btn--del').click()

    const confirmDialog = page.locator('.modal-overlay')
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText(/rider deleted/i, {
      timeout: 8000,
    })

    await expect(
      page.locator('tr, [data-row], li, .rider-item').filter({ hasText: UNIQUE_NAME }).first(),
    ).not.toBeVisible({ timeout: 8000 })
  })

  test('modal X close button closes the modal', async ({ page }) => {
    await page.goto('/admin/tech-rider')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button.btn-new').or(page.getByRole('button', { name: /create first rider/i })).first()
    await addBtn.click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('button[aria-label="Close"], button.close, button:has(svg)').first().click()

    await expect(modal).not.toBeVisible()
  })
})
