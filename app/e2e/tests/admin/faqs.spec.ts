import { test, expect } from '@playwright/test'
import { adminHeaders, contentLocaleOrder } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

// The list shows each question in the band's *first* content language (see
// `questionLabel` in FaqsAdminView), so every assertion on a row's text has
// to be in that language — on the prod-synced dev DB that is Polish. The
// question is written in every language as `<base>-<locale>`; `question(l)`
// is what the row shows when `l` is the primary, and the rename below edits
// the primary's input so the row's text actually changes.
const BASE = `e2e-faq-${Date.now()}`
const question = (locale: string) => `${BASE}-${locale}`
let order: string[] = []
let primary = ''
let shown = ''
let edited = ''

test.describe('FAQ Admin', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ request }) => {
    order = await contentLocaleOrder(request)
    primary = order[0]
    shown = question(primary)
    edited = `${shown}-edited`
  })

  test('page loads with the contact subpage selected and its seeded questions', async ({ page, request }) => {
    // The create_faqs_table migration seeds four Contact questions, so this
    // list is never empty on a migrated database — but the admin renders each
    // question in the band's *first* content language, so on a Polish-first
    // band the English text is never on screen. Read the seeded row and the
    // order from the API and expect whichever translation the page will show.
    const res = await request.get('/api/admin/faqs', { headers: adminHeaders() })
    if (!res.ok()) throw new Error('GET /api/admin/faqs failed')
    const faqs = ((await res.json()) as { data: { question: Record<string, string | null> }[] }).data
    const seeded = faqs.find(f => f.question?.en === 'How far ahead should we book you?')
    if (!seeded) throw new Error('The migration-seeded Contact FAQ is missing from this database')
    const seededText = order.map(l => seeded.question[l]).find(Boolean)
    if (!seededText) throw new Error('Seeded FAQ has no text in any content language')

    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'FAQ', exact: true })).toBeVisible()
    await expect(page.getByText(seededText)).toBeVisible({ timeout: 8000 })
  })

  test('create: fills both locales and the row appears', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '+ Add question' }).click()

    for (const l of order) {
      await page.locator(`#faq-q-${l}`).fill(question(l))
      await page.locator(`#faq-a-${l}`).fill(`An answer in ${l}.`)
    }

    await page.getByRole('button', { name: /^Save$/ }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Question added', { timeout: 8000 })
    await expect(page.getByText(shown, { exact: true })).toBeVisible({ timeout: 8000 })
  })

  test('edit: renaming the question updates the row, and Save is dirty-gated', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    // Scope to the row card. A bare `div` filter also matches every ancestor
    // that contains the text, and .last() then lands on an inner text wrapper
    // that holds no buttons.
    const row = page.locator('div.rounded-xl').filter({ hasText: shown })
    await row.getByRole('button', { name: /^Edit question/ }).click()

    const input = page.locator(`#faq-q-${primary}`)
    await expect(input).toHaveValue(shown)

    // useDirtyGuard seeds its baseline from the entry being edited, so the
    // freshly-opened editor is clean and Save starts disabled.
    const saveButton = page.getByRole('button', { name: /^Save$/ })
    await expect(saveButton).toBeDisabled()

    await input.fill(edited)
    await expect(saveButton).toBeEnabled()

    await saveButton.click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Question saved', { timeout: 8000 })
    await expect(page.getByText(edited, { exact: true })).toBeVisible({ timeout: 8000 })

    // Reopening the same row reseeds the editor from the just-saved value —
    // markClean() runs again on the new baseline, so Save goes back to
    // disabled until it is dirty again.
    const savedRow = page.locator('div.rounded-xl').filter({ hasText: edited })
    await savedRow.getByRole('button', { name: /^Edit question/ }).click()
    await expect(page.locator(`#faq-q-${primary}`)).toHaveValue(edited)
    await expect(page.getByRole('button', { name: /^Save$/ })).toBeDisabled()
  })

  test('publish toggle flips the badge between Live and Draft', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    const row = page.locator('div.rounded-xl').filter({ hasText: edited })
    const badge = row.getByRole('button', { name: /^(Live|Draft)$/ })

    await expect(badge).toHaveText('Live')
    await badge.click()
    await expect(badge).toHaveText('Draft', { timeout: 8000 })

    // Put it back so the delete test operates on a published row.
    await badge.click()
    await expect(badge).toHaveText('Live', { timeout: 8000 })
  })

  test('switching subpage tabs filters the list', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(edited, { exact: true })).toBeVisible({ timeout: 8000 })

    // Any tab other than Contact. Concerts ships with no questions, so the
    // empty state is the assertion.
    const otherTab = page.getByRole('button', { name: /^Concerts/ })
    if (await otherTab.isVisible().catch(() => false)) {
      await otherTab.click()
      await expect(page.getByText(edited, { exact: true })).not.toBeVisible()
    }
  })

  test('delete: confirming removes the row', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    page.on('dialog', (d) => d.accept())

    const row = page.locator('div.rounded-xl').filter({ hasText: edited })
    await row.getByRole('button', { name: /^Delete question/ }).click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Question deleted', { timeout: 8000 })
    await expect(page.getByText(edited, { exact: true })).not.toBeVisible({ timeout: 8000 })
  })

  test('is closed to non-admins', async ({ browser }) => {
    // newContext() alone inherits the admin storageState from test.use above,
    // so the session has to be cleared explicitly for this to mean anything.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await ctx.newPage()

    await page.goto('/admin/faqs')
    // Bounced to the panel root, which renders the sign-in form — there is no
    // /login route to land on any more.
    await expect(page).toHaveURL(/\/admin\/?$/, { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()

    await ctx.close()
  })
})
