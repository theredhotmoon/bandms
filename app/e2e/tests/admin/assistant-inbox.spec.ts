import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

/**
 * The assistant's inbox (AssistantInboxView). Findings come from a nightly
 * crawl that never runs in E2E, so both endpoints are served through
 * `page.route` — the fake honours `kind`, `country` and `status` the way the
 * controller does, counts included, so the chips are exercised for real.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

interface F { id: number; kind: string; country: string | null; status: string; title: string; url: string }

const SEED: F[] = [
  { id: 1, kind: 'lead', country: 'PL', status: 'new', title: 'Klub Pod Minogą — concerts', url: 'https://minoga.example/koncerty' },
  { id: 2, kind: 'news', country: 'DE', status: 'new', title: 'Ska festival lineup announced', url: 'https://ska.example/news' },
  { id: 3, kind: 'lead', country: 'JP', status: 'new', title: 'Tokyo ska night', url: 'javascript:alert(1)' },
]

async function serveInbox(page: Page, patches: { id: number; status: string }[] = []): Promise<void> {
  const rows = SEED.map(f => ({ ...f }))
  await page.route(/\/api\/admin\/assistant\/runs$/, route => route.fulfill({ json: { data: [
    { source: 'youtube', status: 'capped', started_at: null, finished_at: null, queries: 20, new: 4, error: null },
  ] } }))
  await page.route(/\/api\/admin\/assistant\/findings(\?.*)?$/, (route: Route) => {
    const u = new URL(route.request().url())
    const kind = u.searchParams.get('kind')
    const country = u.searchParams.get('country')
    const status = u.searchParams.get('status') ?? 'new'
    const base = rows.filter(f => f.status === status)
    const count = (list: F[], key: 'kind' | 'country') =>
      list.reduce<Record<string, number>>((acc, f) => { if (f[key]) acc[f[key]!] = (acc[f[key]!] ?? 0) + 1; return acc }, {})
    const list = base.filter(f => (!kind || f.kind === kind) && (!country || f.country === country))
    return route.fulfill({ json: {
      data: list.map(f => ({ ...f, source: 'google_cse', snippet: '', lead_type: f.kind === 'lead' ? 'venue' : null,
        score: 0, summary: null, saved_type: null, saved_id: null, found_at: null })),
      meta: {
        countries: count(base.filter(f => !kind || f.kind === kind), 'country'),
        kinds: count(base.filter(f => !country || f.country === country), 'kind'),
        total: list.length, page: 1, last_page: 1,
      },
    } })
  })
  await page.route(/\/api\/admin\/assistant\/findings\/\d+$/, (route: Route) => {
    const id = Number(route.request().url().split('/').pop())
    const { status } = JSON.parse(route.request().postData() ?? '{}')
    patches.push({ id, status })
    const row = rows.find(f => f.id === id)!
    row.status = status
    return route.fulfill({ json: { data: row } })
  })
}

test('lists findings with counts and the last runs', async ({ page }) => {
  await serveInbox(page)
  await page.goto('/admin/assistant')

  await expect(page.getByTestId('finding-row')).toHaveCount(3)
  await expect(page.getByTestId('run-status')).toContainText('YouTube')
  await expect(page.getByTestId('findings-filters').locator('[data-country]')).toHaveCount(3)
})

test('filters by country and kind, and a second click on a chip clears it', async ({ page }) => {
  await serveInbox(page)
  await page.goto('/admin/assistant')
  await expect(page.getByTestId('finding-row')).toHaveCount(3)

  const pl = page.getByTestId('findings-filters').locator('[data-country="PL"]')
  await pl.click()
  await expect(page.getByTestId('finding-row')).toHaveCount(1)
  await expect(page.getByTestId('finding-row')).toContainText('Pod Minogą')
  await expect(pl).toHaveAttribute('aria-pressed', 'true')

  await pl.click()
  await expect(page.getByTestId('finding-row')).toHaveCount(3)

  await page.getByTestId('findings-filters').getByRole('radio', { name: /news/i }).check({ force: true })
  await expect(page.getByTestId('finding-row')).toHaveCount(1)
  await expect(page.getByTestId('finding-row')).toContainText('lineup')
})

test('dismisses a finding, and it can be restored from the dismissed view', async ({ page }) => {
  const patches: { id: number; status: string }[] = []
  await serveInbox(page, patches)
  await page.goto('/admin/assistant')

  await page.locator('[data-finding-id="2"]').getByRole('button', { name: /dismiss/i }).click()
  await expect(page.getByTestId('finding-row')).toHaveCount(2)
  expect(patches).toEqual([{ id: 2, status: 'dismissed' }])

  await page.getByLabel(/show dismissed/i).check()
  await expect(page.getByTestId('finding-row')).toHaveCount(1)
  await page.locator('[data-finding-id="2"]').getByRole('button', { name: /restore/i }).click()
  await expect(page.getByTestId('findings-empty')).toBeVisible()
  expect(patches.at(-1)).toEqual({ id: 2, status: 'new' })
})

test('links only http(s) results', async ({ page }) => {
  await serveInbox(page)
  await page.goto('/admin/assistant')

  await expect(page.locator('[data-finding-id="1"] a')).toHaveAttribute('href', 'https://minoga.example/koncerty')
  await expect(page.locator('[data-finding-id="3"] a')).toHaveCount(0)
})
