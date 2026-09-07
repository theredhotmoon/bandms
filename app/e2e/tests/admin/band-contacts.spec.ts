import { test, expect } from '@playwright/test'
import { expectToast, searchTable } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Assigning a person from Authors & Contacts to a band, so the bands table can
 * offer a one-click way to reach them.
 *
 * Serial: the author created in the first test is the one the band points at,
 * and the last two tests put both back.
 */
test.describe.serial('Admin Bands — contact people', () => {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const CONTACT_NAME = `E2E Contact ${stamp}`
  const CONTACT_EMAIL = `e2e-contact-${stamp}@example.com`
  const BAND_NAME = `E2E Contact Band ${stamp}`

  test('setup: create the contact person', async ({ page }) => {
    await page.goto('/admin/authors')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add author' }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.getByPlaceholder('Jane Smith').fill(CONTACT_NAME)
    await modal.getByPlaceholder('jane@example.com').fill(CONTACT_EMAIL)
    await modal.getByRole('button', { name: 'Save' }).click()

    await expectToast(page, 'Author added')
  })

  test('create a band and assign the contact person', async ({ page }) => {
    await page.goto('/admin/bands')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /add band/i }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('input[placeholder="Band name"]').fill(BAND_NAME)

    // The picker lists every author; tick ours.
    const item = modal.locator('.contact-item').filter({ hasText: CONTACT_NAME })
    await expect(item).toBeVisible()
    await item.locator('input[type="checkbox"]').check()

    // A chip confirms the selection before saving.
    await expect(modal.locator('.contact-chip').filter({ hasText: CONTACT_NAME })).toBeVisible()

    await modal.getByRole('button', { name: /Create/i }).click()
    await expectToast(page, 'Band created')
    await expect(modal).not.toBeVisible()
  })

  test('bands table shows the contact with a working mailto link', async ({ page }) => {
    await page.goto('/admin/bands')
    await page.waitForLoadState('networkidle')
    await searchTable(page, BAND_NAME)

    const row = page.locator('tr').filter({ hasText: BAND_NAME })
    await expect(row.locator('.contact-pill-name')).toHaveText(CONTACT_NAME)

    const mailto = row.locator('.contact-action')
    await expect(mailto).toHaveText('Email')
    await expect(mailto).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`)
  })

  test('searching the bands table by contact name finds the band', async ({ page }) => {
    await page.goto('/admin/bands')
    await page.waitForLoadState('networkidle')
    await searchTable(page, CONTACT_NAME)

    await expect(page.getByRole('cell', { name: BAND_NAME })).toBeVisible()
  })

  test('the assignment survives a reopen of the edit form', async ({ page }) => {
    await page.goto('/admin/bands')
    await page.waitForLoadState('networkidle')
    await searchTable(page, BAND_NAME)

    await page.locator('tr').filter({ hasText: BAND_NAME }).getByRole('button', { name: 'Edit' }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const checkbox = modal
      .locator('.contact-item')
      .filter({ hasText: CONTACT_NAME })
      .locator('input[type="checkbox"]')
    await expect(checkbox).toBeChecked()

    await modal.locator('button[aria-label="Close"]').click()
    await expect(modal).not.toBeVisible()
  })

  test('Message addresses the pitch to the assigned person, not the band', async ({ page }) => {
    await page.goto('/admin/bands')
    await page.waitForLoadState('networkidle')
    await searchTable(page, BAND_NAME)

    await page.locator('tr').filter({ hasText: BAND_NAME }).getByRole('button', { name: 'Message' }).click()

    await expect(page.getByRole('heading', { name: 'Pitch Generator' })).toBeVisible()

    // The recipient field is seeded with the band name and swapped for the
    // contact once the bands query lands.
    const recipient = page.locator('input[placeholder="Jane, John, The team…"]')
    await expect(recipient).toHaveValue(CONTACT_NAME)

    // The greeting names the person; the body still names the band.
    const pitch = page.locator('.pitch-text')
    await expect(pitch).toContainText(`Hi ${CONTACT_NAME},`)
    await expect(pitch).toContainText(`with ${BAND_NAME}`)
  })

  test('a typed recipient is not overwritten when the bands query lands', async ({ page }) => {
    await page.goto('/admin/bands')
    await page.waitForLoadState('networkidle')
    await searchTable(page, BAND_NAME)

    await page.locator('tr').filter({ hasText: BAND_NAME }).getByRole('button', { name: 'Message' }).click()
    await expect(page.getByRole('heading', { name: 'Pitch Generator' })).toBeVisible()

    const recipient = page.locator('input[placeholder="Jane, John, The team…"]')
    await recipient.fill('Someone Else')

    await expect(recipient).toHaveValue('Someone Else')
    await expect(page.locator('.pitch-text')).toContainText('Hi Someone Else,')
  })

  test('unassigning the contact clears the table cell', async ({ page }) => {
    await page.goto('/admin/bands')
    await page.waitForLoadState('networkidle')
    await searchTable(page, BAND_NAME)

    await page.locator('tr').filter({ hasText: BAND_NAME }).getByRole('button', { name: 'Edit' }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal
      .locator('.contact-item')
      .filter({ hasText: CONTACT_NAME })
      .locator('input[type="checkbox"]')
      .uncheck()

    await expect(modal.locator('.contact-chip')).toHaveCount(0)

    await modal.getByRole('button', { name: /Update/i }).click()
    await expectToast(page, 'Band updated')

    await searchTable(page, BAND_NAME)
    const row = page.locator('tr').filter({ hasText: BAND_NAME })
    await expect(row.locator('.contact-pill')).toHaveCount(0)
  })

  test('cleanup: delete the band', async ({ page }) => {
    await page.goto('/admin/bands')
    await page.waitForLoadState('networkidle')
    await searchTable(page, BAND_NAME)

    await page.locator('tr').filter({ hasText: BAND_NAME }).getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Confirm deletion')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).last().click()

    await expectToast(page, 'Band deleted')
  })

  test('cleanup: delete the contact person', async ({ page }) => {
    await page.goto('/admin/authors')
    await page.waitForLoadState('networkidle')
    await page.locator('input[aria-label="Search"]').fill(CONTACT_NAME)

    await page.locator('tr').filter({ hasText: CONTACT_NAME }).getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Confirm deletion')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).last().click()

    await expect(page.getByRole('cell', { name: CONTACT_NAME })).not.toBeVisible()
  })
})
