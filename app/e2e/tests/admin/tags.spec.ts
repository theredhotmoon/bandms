import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test.use({ storageState: 'e2e/.auth/admin.json' })

const UNIQUE_TAG = `e2e-tag-${Date.now()}`
let editedTagName = `${UNIQUE_TAG}-edited`

test.describe('Tags Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test('page loads and shows tags table or empty state', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    const hasTable = await page.locator('table').isVisible().catch(() => false)
    const hasEmptyState = await page
      .getByText(/no tags/i)
      .isVisible()
      .catch(() => false)

    expect(hasTable || hasEmptyState).toBe(true)
  })

  test('create tag: modal opens, fill name, save → toast and row appear', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add tag' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('input[name="name"], input[id="name"], input[placeholder*="name" i]').first().fill(UNIQUE_TAG)

    await modal.getByRole('button', { name: /save|create/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Tag created', { timeout: 8000 })
    await expect(modal).not.toBeVisible()

    await expect(page.getByRole('cell', { name: UNIQUE_TAG }).first()).toBeVisible({ timeout: 8000 })
  })

  test('search: type tag name → matching row is shown', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(UNIQUE_TAG)

    await expect(page.getByRole('cell', { name: UNIQUE_TAG }).first()).toBeVisible({ timeout: 8000 })
  })

  test('edit tag: modal opens with "Edit Tag" title, change name, save → toast', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(UNIQUE_TAG)

    const row = page.locator('tr').filter({ hasText: UNIQUE_TAG })
    await row.getByRole('button', { name: /edit/i }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText(/edit tag/i)

    const nameInput = modal.locator('input[name="name"], input[id="name"], input[placeholder*="name" i]').first()
    await nameInput.clear()
    await nameInput.fill(editedTagName)

    await modal.getByRole('button', { name: /save|update/i }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Tag updated', { timeout: 8000 })
    await expect(modal).not.toBeVisible()
  })

  test('delete tag: confirm dialog appears, confirm delete → toast and row gone', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    const searchInput = page.locator('input[aria-label="Search"]')
    await searchInput.fill(editedTagName)

    const row = page.locator('tr').filter({ hasText: editedTagName })
    await row.getByRole('button', { name: /delete/i }).click()

    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Confirm deletion' })
    await expect(confirmDialog).toBeVisible({ timeout: 5000 })

    await confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Tag deleted', { timeout: 8000 })
    await expect(page.getByRole('cell', { name: editedTagName })).not.toBeVisible({ timeout: 8000 })
  })

  // Tag slugs are one translated bag now (translated-slug series), edited with
  // TranslatedSlugInput. Its predecessor flipped to "manual" on any prop
  // change, including its own generated value coming back, so a slug stopped
  // following the name after the first keystroke. Typing a whole name and
  // seeing the whole slug is what proves it keeps following, per language.
  test("slugs follow each language's name, and the server owns the generated ones", async ({ page, request, baseURL }) => {
    const token = JSON.parse(fs.readFileSync('e2e/.auth/admin.json', 'utf-8'))
      .origins.flatMap((o: { localStorage?: { name: string; value: string }[] }) => o.localStorage ?? [])
      .find((kv: { name: string }) => kv.name === 'auth_token')?.value
    const created: number[] = []
    const stamp = Date.now()

    const openNew = async () => {
      await page.getByRole('button', { name: '+ Add tag' }).click()
      return page.locator('.modal-overlay')
    }
    const save = async (modal: ReturnType<typeof page.locator>, method: 'POST' | 'PUT') => {
      const res = page.waitForResponse(r => r.url().includes('/api/tags') && r.request().method() === method)
      await modal.getByRole('button', { name: /save|create|update/i }).click()
      const response = await res
      expect(response.status(), await response.text()).toBeLessThan(300)
      return (await response.json()).data
    }

    try {
      await page.goto('/admin/tags')
      await page.waitForLoadState('networkidle')

      // Typing a whole name and seeing the whole slug proves it keeps following.
      // SlugInput stopped after the first keystroke.
      let modal = await openNew()
      await modal.locator('.trans-row[data-locale="en"] input').fill(`E2E Slug Tag ${stamp}`)
      await modal.locator('.trans-row[data-locale="pl"] input').fill(`Na Zywo ${stamp}`)
      await expect(modal.locator('.slug-row[data-locale="en"] input')).toHaveValue(`e2e-slug-tag-${stamp}`)
      await expect(modal.locator('.slug-row[data-locale="pl"] input')).toHaveValue(`na-zywo-${stamp}`)
      const first = await save(modal, 'POST')
      created.push(first.id)
      expect(first.translations.slug).toEqual({ en: `e2e-slug-tag-${stamp}`, pl: `na-zywo-${stamp}` })

      // A second tag whose ENGLISH name is the first one's POLISH name. The
      // form used to send its preview "na-zywo-…" as an explicit slug, which
      // the cross-locale rule rejected with a 422; sent as null, the server
      // suffixes it.
      modal = await openNew()
      await modal.locator('.trans-row[data-locale="en"] input').fill(`Na Zywo ${stamp}`)
      const second = await save(modal, 'POST')
      created.push(second.id)
      expect(second.slug).toBe(`na-zywo-${stamp}-2`)

      // Clearing a language's name must release that language's slug. A loaded
      // slug that is just its name's slug still counts as following the name.
      const search = page.locator('input[aria-label="Search"]')
      await search.fill(`E2E Slug Tag ${stamp}`)
      await page.getByRole('row').filter({ hasText: `E2E Slug Tag ${stamp}` }).getByRole('button', { name: /edit/i }).click()
      modal = page.locator('.modal-overlay')
      await modal.locator('.trans-row[data-locale="pl"] input').fill('')
      const edited = await save(modal, 'PUT')
      expect(edited.translations.slug.pl).toBeNull()
    } finally {
      for (const id of created) {
        const res = await request.delete(`${baseURL}/api/tags/${id}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        })
        expect(res.ok(), `cleanup delete of tag ${id} failed with ${res.status()}`).toBeTruthy()
      }
    }
  })

  test('modal: open modal then click X close button → modal closes', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add tag' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    await modal.locator('button[aria-label="Close"], button.close, button:has(svg)').first().click()

    await expect(modal).not.toBeVisible()
  })

  test('validation: submit empty name → error message shown', async ({ page }) => {
    await page.goto('/admin/tags')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add tag' }).click()

    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // Neither locale input carries `required` — a Polish-only name is valid
    // — so the empty-name case is enforced server-side and surfaces as a
    // field error under the name inputs, keyed per locale (name.en/name.pl).
    await modal.getByRole('button', { name: /save|create/i }).click()

    await expect(modal.locator('.field-error').first()).toBeVisible({ timeout: 8000 })
  })
})
