import { test, expect, type Locator } from '@playwright/test'
import { adminHeaders, primaryLocale } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

const UNIQUE_TAG = `e2e-tag-${Date.now()}`
let editedTagName = `${UNIQUE_TAG}-edited`

// The list shows each tag in the band's FIRST content language (TagsAdminView
// resolves translations.name through useContentLocales), so every name these
// tests type goes into that language's row, by locale and never `.first()`.
// TagForm only fetches the order once the modal opens, so `.first()` is the
// registry's first row until that request lands and the band's first after:
// it raced (#194). On the Polish-first dev DB this types Polish, which also
// proves the list reads the band's language — until this fix the list showed
// the request-language (English) name, and a Polish rename never appeared.
let primary = 'en'
/** Ids the slug test created. Swept in afterAll, not in the test's own
 *  `finally`: a timed-out test has its `request` closed before `finally`
 *  runs, which is how two slug runs leaked their tags. */
const createdIds: number[] = []
const nameInput = (modal: Locator) => modal.locator(`.trans-row[data-locale="${primary}"] input`)

test.describe('Tags Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ request }) => {
    primary = await primaryLocale(request)
  })

  // A failure before "delete" used to leave the tag behind for good; the dev
  // DB had collected one `-edited` tag per failed run. Sweep whatever this
  // run created, whichever step it got to. Match every stored language, not
  // the resolved `name`: a half-finished rename can sit in one language only.
  // Delete them all before asserting, so one bad DELETE cannot leak the rest.
  test.afterAll(async ({ request }) => {
    const res = await request.get('/api/tags')
    expect(res.ok(), `GET /api/tags → ${res.status()}`).toBe(true)
    const tags: { id: number; translations: { name: Record<string, string | null> } }[] = (await res.json()).data
    const ours = tags.filter(t =>
      createdIds.includes(t.id) || Object.values(t.translations.name).some(n => n?.startsWith(UNIQUE_TAG)))
    const failed: string[] = []
    for (const tag of ours) {
      const del = await request.delete(`/api/tags/${tag.id}`, { headers: adminHeaders() })
      if (!del.ok()) failed.push(`${tag.id} → ${del.status()}`)
    }
    expect(failed, 'cleanup DELETE /api/tags/{id} failed').toEqual([])
  })

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

    await nameInput(modal).fill(UNIQUE_TAG)

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

    await nameInput(modal).fill(editedTagName)

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
  test("slugs follow each language's name, and the server owns the generated ones", async ({ page }) => {
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
    createdIds.push(first.id)
    expect(first.translations.slug).toEqual({ en: `e2e-slug-tag-${stamp}`, pl: `na-zywo-${stamp}` })

    // A second tag whose ENGLISH name is the first one's POLISH name. The
    // form used to send its preview "na-zywo-…" as an explicit slug, which
    // the cross-locale rule rejected with a 422; sent as null, the server
    // suffixes it.
    modal = await openNew()
    await modal.locator('.trans-row[data-locale="en"] input').fill(`Na Zywo ${stamp}`)
    const second = await save(modal, 'POST')
    createdIds.push(second.id)
    expect(second.slug).toBe(`na-zywo-${stamp}-2`)

    // Clearing a language's name must release that language's slug. A loaded
    // slug that is just its name's slug still counts as following the name.
    const search = page.locator('input[aria-label="Search"]')
    await search.fill(`E2E Slug Tag ${stamp}`)
    // Search covers every language, so the English name finds the tag — and
    // the row shows it in the band's first language. Before the list read
    // the content-language order, a Polish-first band saw the English name
    // here: this is the assertion that fails without that fix.
    const row = page.locator('tbody tr')
    await expect(row).toHaveCount(1)
    const shown = primary === 'pl'
      ? { name: `Na Zywo ${stamp}`, slug: `na-zywo-${stamp}` }
      : { name: `E2E Slug Tag ${stamp}`, slug: `e2e-slug-tag-${stamp}` }
    await expect(row.locator('td').nth(0)).toHaveText(shown.name)
    await expect(row.locator('td').nth(1)).toHaveText(shown.slug)
    await row.getByRole('button', { name: /edit/i }).click()
    modal = page.locator('.modal-overlay')
    await modal.locator('.trans-row[data-locale="pl"] input').fill('')
    const edited = await save(modal, 'PUT')
    expect(edited.translations.slug.pl).toBeNull()
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
