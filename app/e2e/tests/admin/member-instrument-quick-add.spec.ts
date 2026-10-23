import { test, expect } from '@playwright/test'
import { expectToast } from '../../fixtures/test-base'
import { adminHeaders } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * An instrument created from inside the band member form (InstrumentQuickAdd):
 * the instrument form stacks over the member modal, and on save the new
 * instrument is listed and selected as the member's main one without the
 * member form losing what was typed. No member is saved; the instrument is
 * deleted afterwards through the API.
 *
 * Both overlays teleport to <body>; `.modal-overlay` is addressed by index
 * because a bare locator is a strict-mode violation while two are open.
 */
test.describe('Admin Band members — instrument from inside the member form', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const FIRST_NAME = `E2E QuickAdd ${stamp}`
  const INSTRUMENT = `E2E Theremin ${stamp}`
  let instrumentId: number | undefined

  test.afterAll(async ({ request }) => {
    if (instrumentId) await request.delete(`/api/instruments/${instrumentId}`, { headers: adminHeaders() })
  })

  test('creates the instrument over the member form and selects it as main', async ({ page }) => {
    await page.goto('/admin/band-members')
    // The sidebar's "+" opens the create modal.
    await page.locator('button.btn-new').click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()
    await outer.locator('input[placeholder="Jane"]').fill(FIRST_NAME)

    await outer.getByTestId('instrument-quick-add').click()
    const inner = page.locator('.modal-overlay').nth(1)
    await expect(inner).toBeVisible()
    await expect(inner.getByRole('heading', { name: 'Add instrument' })).toBeVisible()
    await expect(outer).toHaveAttribute('inert', '')

    await inner.locator('.trans-row input').first().fill(INSTRUMENT)
    const created = page.waitForResponse(r => r.url().endsWith('/api/instruments') && r.request().method() === 'POST')
    await inner.getByRole('button', { name: 'Save' }).click()
    instrumentId = ((await (await created).json()) as { data: { id: number } }).data.id

    await expectToast(page, 'Instrument added')
    await expect(page.locator('.modal-overlay')).toHaveCount(1)

    // Listed, chosen as the main instrument, and the name survived the detour.
    const card = outer.locator('.main-inst-card').filter({ hasText: INSTRUMENT })
    await expect(card).toHaveClass(/main-inst-card--on/)
    await expect(outer.locator('.instrument-check').filter({ hasText: INSTRUMENT })).toHaveClass(/instrument-check--on/)
    await expect(outer.locator('input[placeholder="Jane"]')).toHaveValue(FIRST_NAME)

    // Nothing else is saved: discard the member draft.
    await outer.locator('button[aria-label="Close"]').click()
    const confirm = page.getByRole('dialog').filter({ hasText: 'Discard changes' })
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Discard' }).click()
    await expect(page.locator('.modal-overlay')).toHaveCount(0)
  })
})
