import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { adminHeaders } from '../../fixtures/admin-api'

/**
 * Save as… on an inbox lead. The finding list and the link call are served
 * through `page.route` (no crawl runs in E2E); the venue itself is created for
 * real through the venue endpoint, because its validation — a duplicate name
 * is a 422 — is what this has to prove reaches the form. Every venue made
 * here is deleted in afterAll.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })
test.describe.configure({ mode: 'serial' })

const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const NEW_NAME = `E2E Lead Club ${STAMP}`
const TAKEN_NAME = `E2E Taken Club ${STAMP}`
const RELINK_NAME = `E2E Relink Club ${STAMP}`
const madeVenueIds: number[] = []

function finding(id: number, title: string) {
  return {
    id, kind: 'lead', source: 'places', url: 'https://club.example', title, snippet: 'Live music bar',
    country: 'PL', lead_type: 'venue', score: 70, status: 'new', summary: 'Ska-friendly club',
    saved_type: null, saved_id: null, found_at: null, known: null, duplicate_of: null,
    contacts: { email: null, website: 'https://club.example/booking', instagram: null, facebook: null },
  }
}

async function serveInbox(page: Page, rows: ReturnType<typeof finding>[], links: { id: number; body: unknown }[], failFirstLink = false) {
  await page.route(/\/api\/admin\/assistant\/runs$/, route => route.fulfill({ json: { data: [] } }))
  await page.route(/\/api\/admin\/assistant\/findings(\?.*)?$/, route => route.fulfill({ json: {
    data: rows.filter(r => r.status === 'new'),
    meta: { countries: { PL: rows.length }, kinds: { lead: rows.length }, total: rows.length, page: 1, last_page: 1 },
  } }))
  let failNext = failFirstLink
  await page.route(/\/api\/admin\/assistant\/findings\/\d+\/saved$/, (route: Route) => {
    const id = Number(route.request().url().split('/').at(-2))
    links.push({ id, body: JSON.parse(route.request().postData() ?? '{}') })
    if (failNext) {
      failNext = false
      return route.fulfill({ status: 500, json: { message: 'Server Error' } })
    }
    const row = rows.find(r => r.id === id)!
    row.status = 'saved'
    return route.fulfill({ json: { data: row } })
  })
}

test.afterAll(async ({ request }) => {
  const list = await request.get('/api/venues', { headers: adminHeaders() })
  const venues = ((await list.json()).data ?? []) as { id: number; name: string }[]
  for (const v of venues.filter(v => v.name.includes(STAMP))) madeVenueIds.push(v.id)
  for (const id of new Set(madeVenueIds)) {
    await request.delete(`/api/venues/${id}`, { headers: adminHeaders() })
  }
})

test('Save as Venue opens the venue form prefilled, creates it, and links the lead', async ({ page }) => {
  const links: { id: number; body: unknown }[] = []
  await serveInbox(page, [finding(901, `${NEW_NAME}, Kraków`)], links)
  await page.goto('/admin/assistant')

  const row = page.locator('[data-finding-id="901"]')
  await row.getByTestId('save-as').locator('summary').click()
  await row.locator('[data-target="venue"]').click()

  const modal = page.locator('.modal-overlay')
  await expect(modal.locator('input.field-input').first()).toHaveValue(NEW_NAME)
  await expect(modal.locator('input[id$="-website"]')).toHaveValue('https://club.example/booking')
  await modal.getByRole('button', { name: /^create$/i }).click()

  await expect(page.getByText(/saved — the lead is in your records/i)).toBeVisible()
  expect(links).toHaveLength(1)
  expect((links[0].body as { type: string }).type).toBe('venue')
  await expect(row).toHaveCount(0) // saved: it leaves the New list
})

test('a name the band already has shows the 422 in the form and leaves the lead new', async ({ page, request }) => {
  const made = await request.post('/api/venues', { headers: adminHeaders(), data: { name: TAKEN_NAME } })
  expect(made.ok()).toBeTruthy()
  madeVenueIds.push((await made.json()).data.id)

  const links: { id: number; body: unknown }[] = []
  await serveInbox(page, [finding(902, TAKEN_NAME)], links)
  await page.goto('/admin/assistant')

  const row = page.locator('[data-finding-id="902"]')
  await row.getByTestId('save-as').locator('summary').click()
  await row.locator('[data-target="venue"]').click()
  const modal = page.locator('.modal-overlay')
  await modal.getByRole('button', { name: /^create$/i }).click()

  await expect(modal.locator('.field-error').first()).toBeVisible()
  expect(links).toHaveLength(0)
  await expect(row).toBeVisible()
})

test('a link that fails after the venue was made offers to link it again, not to make a second one', async ({ page, request }) => {
  const links: { id: number; body: unknown }[] = []
  await serveInbox(page, [finding(903, RELINK_NAME)], links, true)
  await page.goto('/admin/assistant')

  const row = page.locator('[data-finding-id="903"]')
  await row.getByTestId('save-as').locator('summary').click()
  await row.locator('[data-target="venue"]').click()
  await page.locator('.modal-overlay').getByRole('button', { name: /^create$/i }).click()

  await expect(row.getByTestId('finding-relink')).toBeVisible()
  await expect(row.getByTestId('save-as')).toHaveCount(0)
  await row.getByTestId('finding-relink').click()

  await expect(row).toHaveCount(0)
  expect(links).toHaveLength(2)
  expect(links[1].body).toEqual(links[0].body) // the same venue, linked again
  const venues = ((await (await request.get('/api/venues', { headers: adminHeaders() })).json()).data ?? []) as { name: string }[]
  expect(venues.filter(v => v.name === RELINK_NAME)).toHaveLength(1)
})
