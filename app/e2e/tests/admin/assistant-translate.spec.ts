import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { contentLocaleOrder } from '../../fixtures/admin-api'

/**
 * The Translate button on a translated field (TranslatedField.vue), driven
 * on the concert form. Both assistant endpoints are served through
 * `page.route`: CI has no DeepL key, and a spec that reached one would spend
 * the band's quota on every run. The fake translator echoes `[<target>] <text>`
 * so an assertion can tell which locale a row was filled for.
 *
 * Rows are addressed by `[data-locale]`, never by position — the band's
 * content order decides which row comes first (#194).
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

const CAPABILITIES = /\/api\/admin\/assistant\/capabilities$/
const TRANSLATE = /\/api\/admin\/assistant\/translate$/

interface Item { key: string; text: string; target: string }

async function serveAssistant(page: Page, translate: boolean, requests: Item[][] = [], delayMs = 0): Promise<void> {
  await page.route(CAPABILITIES, route => route.fulfill({ json: { data: { translate, rewrite: false } } }))
  await page.route(TRANSLATE, async (route: Route) => {
    const items = (JSON.parse(route.request().postData() ?? '{}').items ?? []) as Item[]
    requests.push(items)
    if (delayMs) await new Promise(r => setTimeout(r, delayMs))
    return route.fulfill({ json: { data: {
      items: items.map(i => ({ key: i.key, text: `[${i.target}] ${i.text}` })),
      provider: 'fake',
    } } })
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

const nameRow = (modal: ReturnType<Page['locator']>, l: string) =>
  modal.locator(`[data-field-key="concert.name"] .trans-row[data-locale="${l}"]`)
const descRow = (modal: ReturnType<Page['locator']>, l: string) =>
  modal.locator(`[data-field-key="concert.description"] .trans-row[data-locale="${l}"]`)

test('fills an empty locale from the filled one, naming the source', async ({ page, request }) => {
  const [first, second] = await contentLocaleOrder(request)
  await serveAssistant(page, true)
  const modal = await openNewConcert(page)

  // Nothing filled yet: no row has a source, so no row has a button.
  await expect(modal.locator('[data-field-key="concert.name"] .trans-translate')).toHaveCount(0)

  await nameRow(modal, first).locator('input').fill('Summer Ska Night')
  const button = nameRow(modal, second).locator('.trans-translate')
  await expect(button).toHaveAttribute('data-source', first)
  await button.click()

  await expect(nameRow(modal, second).locator('input')).toHaveValue(`[${second}] Summer Ska Night`)
})

test('the primary row gets a button too when only another locale is filled', async ({ page, request }) => {
  const [first, second] = await contentLocaleOrder(request)
  await serveAssistant(page, true)
  const modal = await openNewConcert(page)

  await nameRow(modal, second).locator('input').fill('Legacy English name')
  await expect(nameRow(modal, first).locator('.trans-translate')).toHaveAttribute('data-source', second)
})

test('replacing a filled locale needs a second press', async ({ page, request }) => {
  const [first, second] = await contentLocaleOrder(request)
  const requests: Item[][] = []
  await serveAssistant(page, true, requests)
  const modal = await openNewConcert(page)

  await nameRow(modal, first).locator('input').fill('Source')
  await nameRow(modal, second).locator('input').fill('Hand-typed')

  const button = nameRow(modal, second).locator('.trans-translate')
  await button.click()
  await expect(button).toHaveAttribute('data-confirm', 'true')
  await expect(nameRow(modal, second).locator('input')).toHaveValue('Hand-typed')
  expect(requests).toHaveLength(0)

  await button.click()
  await expect(nameRow(modal, second).locator('input')).toHaveValue(`[${second}] Source`)
  expect(requests).toHaveLength(1)
})

test('translate-empty-fields fills what is empty and skips what is not', async ({ page, request }) => {
  const [first, second] = await contentLocaleOrder(request)
  const requests: Item[][] = []
  await serveAssistant(page, true, requests)
  const modal = await openNewConcert(page)

  await nameRow(modal, first).locator('input').fill('Name A')
  await nameRow(modal, second).locator('input').fill('Name B')
  await descRow(modal, first).locator('textarea').fill('Doors at eight.')

  await modal.getByTestId('translate-empty-fields').click()

  await expect(descRow(modal, second).locator('textarea')).toHaveValue(`[${second}] Doors at eight.`)
  await expect(nameRow(modal, second).locator('input')).toHaveValue('Name B')
  // One request, for the one field that had something to fill — keyed the way
  // the field itself keys its rows, so the two paths share one pending state.
  expect(requests).toHaveLength(1)
  expect(requests[0].map(i => i.key)).toEqual([`concert.description.${second}`])

  // Everything filled: the form-level button withdraws.
  await expect(modal.getByTestId('translate-empty-fields')).toHaveCount(0)
})

test('what the band types while a translation is in flight is kept', async ({ page, request }) => {
  const [first, second] = await contentLocaleOrder(request)
  await serveAssistant(page, true, [], 1500)
  const modal = await openNewConcert(page)

  await nameRow(modal, first).locator('input').fill('Source')
  await nameRow(modal, second).locator('.trans-translate').click()
  // The row stays editable during the request; a reply must not wipe this.
  await nameRow(modal, second).locator('input').fill('typed meanwhile')

  await page.waitForTimeout(2000)
  await expect(nameRow(modal, second).locator('input')).toHaveValue('typed meanwhile')
})

test('the form-level fill lights up the rows it is filling', async ({ page, request }) => {
  const [first, second] = await contentLocaleOrder(request)
  await serveAssistant(page, true, [], 1500)
  const modal = await openNewConcert(page)

  await nameRow(modal, first).locator('input').fill('Name A')
  await descRow(modal, first).locator('textarea').fill('Doors at eight.')
  await modal.getByTestId('translate-empty-fields').click()

  // Both empty rows are in flight through the shared pending set: their own
  // buttons are busy, so a second request for the same row cannot be fired.
  await expect(nameRow(modal, second).locator('.trans-translate')).toBeDisabled()
  await expect(descRow(modal, second).locator('.trans-translate')).toBeDisabled()

  await expect(nameRow(modal, second).locator('input')).toHaveValue(`[${second}] Name A`, { timeout: 5000 })
  await expect(descRow(modal, second).locator('textarea')).toHaveValue(`[${second}] Doors at eight.`)
})

test('the form-level fill skips a row whose own request is still in flight', async ({ page, request }) => {
  const [first, second] = await contentLocaleOrder(request)
  const requests: Item[][] = []
  await serveAssistant(page, true, requests, 1500)
  const modal = await openNewConcert(page)

  await nameRow(modal, first).locator('input').fill('Name A')
  await descRow(modal, first).locator('textarea').fill('Doors at eight.')
  await nameRow(modal, second).locator('.trans-translate').click()
  await modal.getByTestId('translate-empty-fields').click()

  await expect(nameRow(modal, second).locator('input')).toHaveValue(`[${second}] Name A`, { timeout: 5000 })
  await expect(descRow(modal, second).locator('textarea')).toHaveValue(`[${second}] Doors at eight.`)
  // Two requests, and the name travelled once: the fill left the in-flight row alone.
  expect(requests.map(r => r.map(i => i.key))).toEqual([[`concert.name.${second}`], [`concert.description.${second}`]])
})

test('a reply for a record the form has left does not land in the next one', async ({ page, request }) => {
  const [first, second] = await contentLocaleOrder(request)
  await serveAssistant(page, true, [], 2500)
  const modal = await openNewConcert(page)

  await nameRow(modal, first).locator('input').fill('Doomed draft')
  await nameRow(modal, second).locator('.trans-translate').click()
  // Leave this record while the reply is pending, then start a fresh one.
  await modal.getByRole('button', { name: /cancel/i }).click()
  const confirm = page.getByRole('button', { name: /discard/i })
  if (await confirm.isVisible().catch(() => false)) await confirm.click()
  await expect(modal).not.toBeVisible()
  const fresh = await openNewConcert(page)

  await page.waitForTimeout(3000)
  await expect(nameRow(fresh, second).locator('input')).toHaveValue('')
})

test('renders no translate controls when the capability is off', async ({ page, request }) => {
  const [first] = await contentLocaleOrder(request)
  await serveAssistant(page, false)
  const modal = await openNewConcert(page)

  await nameRow(modal, first).locator('input').fill('Anything')
  await expect(modal.locator('.trans-translate')).toHaveCount(0)
  await expect(modal.getByTestId('translate-empty-fields')).toHaveCount(0)
})
