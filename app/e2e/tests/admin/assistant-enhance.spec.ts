import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { contentLocaleOrder } from '../../fixtures/admin-api'

/**
 * The Enhance menu on a translated text field (TranslatedField.vue +
 * EnhanceMenu.vue), driven on the concert description. Both assistant
 * endpoints are served through `page.route`: CI has no Anthropic key. The
 * fake model echoes `[<mode>] <text>` so an assertion can tell which mode ran.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

const CAPABILITIES = /\/api\/admin\/assistant\/capabilities$/
const REWRITE = /\/api\/admin\/assistant\/rewrite$/

interface Body { text: string; mode: string; maxLength?: number; fieldKey: string }

async function serveAssistant(page: Page, rewrite: boolean, requests: Body[] = [], delayMs = 0, status = 200): Promise<void> {
  await page.route(CAPABILITIES, route => route.fulfill({ json: { data: { translate: false, rewrite } } }))
  await page.route(REWRITE, async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as Body
    requests.push(body)
    if (delayMs) await new Promise(r => setTimeout(r, delayMs))
    if (status !== 200) return route.fulfill({ status, json: { message: 'The assistant is busy — try again in a minute.' } })
    return route.fulfill({ json: { data: { text: `[${body.mode}] ${body.text}`, mode: body.mode, provider: 'fake', model: 'fake' } } })
  })
}

async function openNewConcert(page: Page) {
  await page.goto('/admin/concerts')
  await page.waitForLoadState('networkidle')
  await page.locator('button.btn-add-primary').click()
  const modal = page.locator('.modal-overlay')
  await expect(modal.getByRole('heading', { name: /new concert/i })).toBeVisible({ timeout: 8000 })
  return modal
}

const descRow = (modal: ReturnType<Page['locator']>, l: string) =>
  modal.locator(`[data-field-key="concert.description"] .trans-row[data-locale="${l}"]`)

test('offers five modes and a mode replaces the text', async ({ page, request }) => {
  const [first] = await contentLocaleOrder(request)
  const requests: Body[] = []
  await serveAssistant(page, true, requests)
  const modal = await openNewConcert(page)

  await descRow(modal, first).locator('textarea').fill('Doors 19:00, come early.')
  const enhance = descRow(modal, first).locator('.trans-enhance')
  await enhance.click()

  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem')).toHaveCount(5)

  await menu.locator('[data-mode="punchier"]').click()
  await expect(descRow(modal, first).locator('textarea')).toHaveValue('[punchier] Doors 19:00, come early.')
  expect(requests[0]).toMatchObject({ mode: 'punchier', fieldKey: 'concert.description', maxLength: 2000 })
  await expect(menu).toHaveCount(0)
})

test('undo puts the previous text back, once', async ({ page, request }) => {
  const [first] = await contentLocaleOrder(request)
  await serveAssistant(page, true)
  const modal = await openNewConcert(page)

  await descRow(modal, first).locator('textarea').fill('Original.')
  await descRow(modal, first).locator('.trans-enhance').click()
  await page.getByRole('menu').locator('[data-mode="flow"]').click()
  await expect(descRow(modal, first).locator('textarea')).toHaveValue('[flow] Original.')

  const undo = descRow(modal, first).locator('.trans-undo')
  await expect(undo).toBeVisible()
  await undo.click()
  await expect(descRow(modal, first).locator('textarea')).toHaveValue('Original.')
  await expect(undo).toHaveCount(0)
})

test('a rich-text row keeps its Undo after the editor normalises the html', async ({ page, request }) => {
  // Tiptap re-emits normalised HTML after setContent; the Undo chip must
  // still be there, and still restore the original.
  const [first] = await contentLocaleOrder(request)
  await page.route(CAPABILITIES, route => route.fulfill({ json: { data: { translate: false, rewrite: true } } }))
  await page.route(REWRITE, route => route.fulfill({ json: { data: { text: '<p>Rewritten</p>\n<p>paragraph</p>', mode: 'flow', provider: 'fake', model: 'fake' } } }))

  await page.goto('/admin/releases')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '+ Add release' }).click()
  const modal = page.locator('.modal-overlay')
  await expect(modal).toBeVisible()
  const row = modal.locator(`[data-field-key="release.description"] .trans-row[data-locale="${first}"]`)
  await row.locator('.tiptap').fill('Original words.')

  await row.locator('.trans-enhance').click()
  await page.getByRole('menu').locator('[data-mode="flow"]').click()
  await expect(row.locator('.tiptap')).toContainText('Rewritten')

  const undo = row.locator('.trans-undo')
  await expect(undo).toBeVisible()
  await undo.click()
  await expect(row.locator('.tiptap')).toHaveText('Original words.')
})

test('escape closes the menu and focus returns to the button', async ({ page, request }) => {
  const [first] = await contentLocaleOrder(request)
  await serveAssistant(page, true)
  const modal = await openNewConcert(page)

  await descRow(modal, first).locator('textarea').fill('Text.')
  const enhance = descRow(modal, first).locator('.trans-enhance')
  await enhance.click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(enhance).toBeFocused()
  // Escape closed the menu, not the modal.
  await expect(modal).toBeVisible()
})

test('no control on an empty row, and none at all when the capability is off', async ({ page, request }) => {
  const [first] = await contentLocaleOrder(request)
  await serveAssistant(page, true)
  const modal = await openNewConcert(page)
  await expect(descRow(modal, first).locator('.trans-enhance')).toHaveCount(0)

  await page.unroute(CAPABILITIES)
  await page.route(CAPABILITIES, route => route.fulfill({ json: { data: { translate: false, rewrite: false } } }))
  await page.reload()
  const again = await openNewConcert(page)
  await descRow(again, first).locator('textarea').fill('Text.')
  await expect(again.locator('.trans-enhance')).toHaveCount(0)
})

test('a failure toasts and leaves the row alone', async ({ page, request }) => {
  const [first] = await contentLocaleOrder(request)
  await serveAssistant(page, true, [], 0, 503)
  const modal = await openNewConcert(page)

  await descRow(modal, first).locator('textarea').fill('Keep me.')
  await descRow(modal, first).locator('.trans-enhance').click()
  await page.getByRole('menu').locator('[data-mode="shorter"]').click()

  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'busy' })).toHaveCount(1)
  await expect(descRow(modal, first).locator('textarea')).toHaveValue('Keep me.')
  await expect(descRow(modal, first).locator('.trans-undo')).toHaveCount(0)
})

test('a reply after the band edited the row is dropped and says so', async ({ page, request }) => {
  const [first] = await contentLocaleOrder(request)
  await serveAssistant(page, true, [], 1500)
  const modal = await openNewConcert(page)

  await descRow(modal, first).locator('textarea').fill('Before.')
  await descRow(modal, first).locator('.trans-enhance').click()
  await page.getByRole('menu').locator('[data-mode="longer"]').click()
  await descRow(modal, first).locator('textarea').fill('Before, then edited.')

  await page.waitForTimeout(2000)
  await expect(descRow(modal, first).locator('textarea')).toHaveValue('Before, then edited.')
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: /changed/i })).toHaveCount(1)
})
