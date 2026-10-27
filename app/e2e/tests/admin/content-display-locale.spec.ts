import fs from 'node:fs'
import { test, expect, searchTable } from '../../fixtures/test-base'
import type { Page } from '@playwright/test'

/**
 * Lists show the band's content in their first content language. The concert
 * list printed `concert.name` as the API resolved it, and nothing told the API
 * which language to resolve: the admin's content locale had no setter after
 * #65, so it sat on English, and every other fetch fell back to the browser's
 * Accept-Language. A Polish-first band saw English names under a Polish UI.
 *
 * The order is served through `page.route`, never written — see
 * content-languages.spec.ts for why writing that row breaks parallel specs.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

function adminToken(): string {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/admin.json', 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}
const headers = () => ({ Accept: 'application/json', Authorization: `Bearer ${adminToken()}` })

const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
const NAME = { en: `E2E Anniversary ${stamp}`, pl: `E2E Rocznica ${stamp}` }
let concertId: number | null = null

async function serveOrder(page: Page, order: string[]): Promise<void> {
  await page.route(/\/api\/admin\/content-locales$/, route =>
    route.fulfill({ json: { data: { order } } }))
}

test.beforeEach(async ({ request, baseURL }) => {
  const venues = ((await (await request.get(`${baseURL}/api/venues`, { headers: headers() })).json()).data ?? []) as { id: number }[]
  test.skip(venues.length === 0, 'No venue to hold a concert')
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  const res = await request.post(`${baseURL}/api/concerts`, {
    headers: headers(),
    data: { venue_id: venues[0].id, date: `2096-03-${day}`, name: NAME },
  })
  expect(res.status(), await res.text()).toBe(201)
  concertId = (await res.json()).data.id
})

// afterEach, not `finally`: a timed-out test's request context is closed by then.
test.afterEach(async ({ request, baseURL }) => {
  if (concertId !== null) await request.delete(`${baseURL}/api/concerts/${concertId}`, { headers: headers() })
  concertId = null
})

for (const [order, shown, hidden] of [
  [['pl', 'en'], NAME.pl, NAME.en],
  [['en', 'pl'], NAME.en, NAME.pl],
] as const) {
  test(`a ${order[0]}-first band sees concert names in ${order[0]}`, async ({ page }) => {
    await serveOrder(page, [...order])
    await page.goto('/admin/concerts')
    await searchTable(page, stamp)

    const row = page.locator('tbody tr').filter({ hasText: stamp })
    await expect(row).toContainText(shown)
    await expect(row).not.toContainText(hidden)
  })
}
