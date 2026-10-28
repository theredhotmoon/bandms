import { test, expect } from '@playwright/test'
import { expectToast } from '../../fixtures/test-base'
import { adminHeaders } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * A contact person created from inside the band form (AuthorQuickAdd): the
 * author modal stacks over the band modal, and on save the new person is
 * listed and ticked without the band form losing what was typed.
 *
 * Both overlays teleport to <body>; `.modal-overlay` is addressed by index
 * because a bare locator is a strict-mode violation while two are open.
 */
test.describe('Admin Bands — contact from inside the band form', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const BAND_NAME = `E2E QuickAdd Band ${stamp}`
  const CONTACT_NAME = `E2E QuickAdd Contact ${stamp}`
  let bandId: number | undefined
  let authorId: number | undefined

  test.afterAll(async ({ request }) => {
    // The band first: its author_bands rows go with it.
    if (bandId) await request.delete(`/api/bands/${bandId}`, { headers: adminHeaders() })
    if (authorId) await request.delete(`/api/authors/${authorId}`, { headers: adminHeaders() })
  })

  test('creates the contact over the band form, ticks it, and the band saves with it', async ({ page, request }) => {
    await page.goto('/admin/bands')
    await page.getByRole('button', { name: /add band/i }).click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()
    await outer.locator('input[placeholder="Band name"]').fill(BAND_NAME)

    await outer.getByTestId('author-quick-add').click()
    const inner = page.locator('.modal-overlay').nth(1)
    await expect(inner).toBeVisible()
    await expect(inner.getByRole('heading', { name: 'Add author / contact' })).toBeVisible()
    // The band form underneath is inert while the contact form is up.
    await expect(outer).toHaveAttribute('inert', '')

    await inner.getByLabel('First name').fill(CONTACT_NAME)
    const created = page.waitForResponse(r => r.url().endsWith('/api/authors') && r.request().method() === 'POST')
    await inner.getByRole('button', { name: 'Save' }).click()
    authorId = ((await (await created).json()) as { data: { id: number } }).data.id

    await expectToast(page, 'Author added')
    await expect(page.locator('.modal-overlay')).toHaveCount(1)

    // Listed, ticked, and the band name survived the detour.
    const item = outer.locator('.contact-item').filter({ hasText: CONTACT_NAME })
    await expect(item.locator('input[type="checkbox"]')).toBeChecked()
    await expect(outer.locator('.contact-chip').filter({ hasText: CONTACT_NAME })).toBeVisible()
    await expect(outer.locator('input[placeholder="Band name"]')).toHaveValue(BAND_NAME)

    const saved = page.waitForResponse(r => r.url().endsWith('/api/bands') && r.request().method() === 'POST')
    await outer.getByRole('button', { name: /Create/i }).click()
    bandId = ((await (await saved).json()) as { data: { id: number } }).data.id
    await expectToast(page, 'Band created')

    // The link is real, not just a tick in the form.
    const res = await request.get(`/api/bands/${bandId}`, { headers: adminHeaders() })
    expect(res.ok()).toBe(true)
    const band = ((await res.json()) as { data: { contacts: { id: number }[] } }).data
    expect(band.contacts.map(c => c.id)).toContain(authorId)
  })
})
