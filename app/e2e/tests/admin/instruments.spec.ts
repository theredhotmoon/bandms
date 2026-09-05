import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const UNIQUE_INSTRUMENT = `e2e-instrument-${Date.now()}`
let editedInstrumentName = `${UNIQUE_INSTRUMENT}-edited`

test.describe('Instruments Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads and "Instruments" heading is visible', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /instruments/i })).toBeVisible()
  })

  test('create instrument: modal opens, fill name and category, save → toast and row appear', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add instrument' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('input[placeholder*="Guitar" i]').first().fill(UNIQUE_INSTRUMENT)

    const categoryField = modal.locator('input[placeholder*="Strings" i]').first()
    const categoryVisible = await categoryField.isVisible().catch(() => false)
    if (categoryVisible) {
      await categoryField.fill('strings')
    }

    await modal.getByRole('button', { name: /save|create/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Instrument added', { timeout: 8000 })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: UNIQUE_INSTRUMENT })).toBeVisible({ timeout: 8000 })
  })

  test('search: type instrument name → matching row is shown', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(UNIQUE_INSTRUMENT)

    await expect(page.getByRole('cell', { name: UNIQUE_INSTRUMENT })).toBeVisible({ timeout: 8000 })
  })

  test('edit instrument: modal opens, change name, save → toast "Instrument updated"', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(UNIQUE_INSTRUMENT)

    const row = page.locator('tr').filter({ hasText: UNIQUE_INSTRUMENT })
    await row.getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const nameInput = modal.locator('input[placeholder*="Guitar" i]').first()
    await nameInput.clear()
    await nameInput.fill(editedInstrumentName)

    await modal.getByRole('button', { name: /save|update/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Instrument updated', { timeout: 8000 })
    await expect(modal).not.toBeVisible()
  })

  test('delete instrument: confirm dialog appears, confirm delete → toast and row gone', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(editedInstrumentName)

    const row = page.locator('tr').filter({ hasText: editedInstrumentName })
    await row.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Instrument deleted', { timeout: 8000 })
    await expect(page.getByRole('cell', { name: editedInstrumentName })).not.toBeVisible({ timeout: 8000 })
  })

  test('modal: open modal then click X close button → modal closes', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add instrument' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('button[aria-label="Close"], button.close, button:has(svg)').first().click()

    await expect(modal).not.toBeVisible()
  })

  test('validation: submit empty name → error message shown', async ({ page }) => {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add instrument' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.getByRole('button', { name: /save|create/i }).click()

    // name input has required — browser HTML5 validation fires, not a DOM error element
    const nameInput = modal.locator('input[required]').first()
    const isInvalid = await nameInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBe(true)
  })
})

test.describe('Stage plot icon picker', () => {
  test.describe.configure({ mode: 'serial' })

  // Opens the create-instrument modal and the icon picker popover. Never
  // saves, so each test starts from a clean, unselected picker with no DB
  // side effects to clean up.
  async function openPicker(page: import('@playwright/test').Page) {
    await page.goto('/admin/instruments')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add instrument' }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const trigger = modal.locator('button[aria-haspopup="listbox"]')
    await trigger.click()

    const popover = page.locator('[role="listbox"]')
    await expect(popover).toBeVisible()

    return { modal, trigger, popover }
  }

  test('opens on click and shows the icon catalogue', async ({ page }) => {
    const { popover } = await openPicker(page)

    await expect(popover.locator('input[placeholder="Search instruments…"]')).toBeVisible()
    await expect(popover.getByText('Vocals', { exact: true })).toBeVisible()
    await expect(popover.getByRole('option', { name: 'Lead Vocals' })).toBeVisible()
  })

  test('regression: scrolling inside the popover does not close it', async ({ page }) => {
    // The catalogue spans 9 groups / 30+ icons against a fixed-height popover,
    // so it must actually have overflow to scroll before this test means anything.
    const { popover } = await openPicker(page)

    const { scrollHeight, clientHeight } = await popover.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }))
    expect(scrollHeight).toBeGreaterThan(clientHeight)

    await popover.hover()
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(200)

    // The bug: a capture-phase window "scroll" listener meant to close the
    // popover when an *ancestor* scrolls also fired for the popover's own
    // internal scroll, closing it the instant the user tried to scroll it.
    await expect(popover).toBeVisible()
    const scrollTop = await popover.evaluate((el) => el.scrollTop)
    expect(scrollTop).toBeGreaterThan(0)

    // The last group ("Other") must be reachable — proof the picker is
    // actually usable, not just still open.
    await popover.getByRole('option', { name: 'Custom' }).scrollIntoViewIfNeeded()
    await expect(popover.getByRole('option', { name: 'Custom' })).toBeVisible()
  })

  test('search filters the catalogue', async ({ page }) => {
    const { popover } = await openPicker(page)

    await popover.locator('input[placeholder="Search instruments…"]').fill('trumpet')

    await expect(popover.getByRole('option', { name: 'Trumpet' })).toBeVisible()
    await expect(popover.getByRole('option', { name: 'Saxophone' })).not.toBeVisible()
  })

  test('selecting an icon closes the popover and updates the trigger', async ({ page }) => {
    const { trigger, popover } = await openPicker(page)

    await popover.getByRole('option', { name: 'Drum Kit' }).click()

    await expect(popover).not.toBeVisible()
    await expect(trigger).toContainText('Drum Kit')
  })

  test('"— Not mapped —" clears a selection', async ({ page }) => {
    const { trigger, popover } = await openPicker(page)

    await popover.getByRole('option', { name: 'Drum Kit' }).click()
    await expect(trigger).toContainText('Drum Kit')

    await trigger.click()
    await page.locator('[role="listbox"]').getByText('— Not mapped —').click()

    await expect(trigger).toContainText('— Not mapped —')
  })

  test('Escape key closes the popover', async ({ page }) => {
    const { popover } = await openPicker(page)

    await page.keyboard.press('Escape')

    await expect(popover).not.toBeVisible()
  })

  test('clicking outside the popover (but inside the modal) closes it', async ({ page }) => {
    const { modal, popover } = await openPicker(page)

    await modal.locator('.field-label').first().click()

    await expect(popover).not.toBeVisible()
    // Sanity check: that click must not have closed the whole modal too.
    await expect(modal).toBeVisible()
  })
})
