import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

/**
 * The assistant's inbox (AssistantInboxView). Findings come from a nightly
 * crawl that never runs in E2E, so both endpoints are served through
 * `page.route` — the fake honours `kind`, `country` and `status` the way the
 * controller does, counts included, so the chips are exercised for real.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

interface F {
  id: number; kind: string; country: string | null; status: string; title: string; url: string
  site: { key: string; label: string } | null; snoozed_until?: string | null
}

const SEED: F[] = [
  { id: 1, kind: 'lead', country: 'PL', status: 'new', title: 'Klub Pod Minogą — concerts', url: 'https://minoga.example/koncerty',
    site: { key: 'minoga.example', label: 'minoga.example' } },
  { id: 2, kind: 'news', country: 'DE', status: 'new', title: 'Ska festival lineup announced', url: 'https://ska.example/news',
    site: { key: 'ska.example', label: 'ska.example' } },
  { id: 3, kind: 'lead', country: 'JP', status: 'new', title: 'Tokyo ska night', url: 'javascript:alert(1)', site: null },
]

type Patch = { id: number; status: string; snooze_months?: number; block_site?: boolean }
type Blocked = { id: number; key: string; label: string; created_by: string | null; created_at: string }

async function serveInbox(page: Page, patches: Patch[] = [], blocked: Blocked[] = []): Promise<void> {
  const rows = SEED.map(f => ({ ...f }))
  await page.route(/\/api\/admin\/assistant\/blocked-sites(\/\d+)?$/, (route: Route) => {
    if (route.request().method() === 'DELETE') {
      const id = Number(route.request().url().split('/').pop())
      blocked.splice(blocked.findIndex(b => b.id === id), 1)
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ json: { data: blocked } })
  })
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
    const body = JSON.parse(route.request().postData() ?? '{}') as Omit<Patch, 'id'>
    patches.push({ id, ...body })
    const row = rows.find(f => f.id === id)!
    row.status = body.status
    row.snoozed_until = body.status === 'snoozed' ? '2027-02-04T10:00:00Z' : null
    const site = body.block_site ? row.site : null
    if (site) blocked.push({ id: blocked.length + 1, ...site, created_by: 'Admin', created_at: '2026-11-04T10:00:00Z' })
    return route.fulfill({ json: { data: row, meta: { blocked: site, also_dismissed: 0 } } })
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

test('marks a finding as wrong, and it can be restored from the dismissed view', async ({ page }) => {
  const patches: Patch[] = []
  await serveInbox(page, patches)
  await page.goto('/admin/assistant')

  const row = page.locator('[data-finding-id="2"]')
  await row.getByTestId('wrong').locator('summary').click()
  await expect(row.getByTestId('block-site')).not.toBeChecked()
  await row.getByTestId('confirm-wrong').click()
  await expect(page.getByTestId('finding-row')).toHaveCount(2)
  expect(patches).toEqual([{ id: 2, status: 'dismissed', block_site: false }])
  await expect(page.getByTestId('blocked-sites')).toHaveCount(0)

  await page.getByTestId('findings-status').selectOption('dismissed')
  await expect(page.getByTestId('finding-row')).toHaveCount(1)
  await page.locator('[data-finding-id="2"]').getByRole('button', { name: /restore/i }).click()
  await expect(page.getByTestId('findings-empty')).toBeVisible()
  expect(patches.at(-1)).toEqual({ id: 2, status: 'new' })
})

test('Not now hides a finding for the months picked, and it waits under Not now with its date', async ({ page }) => {
  const patches: Patch[] = []
  await serveInbox(page, patches)
  await page.goto('/admin/assistant')

  const row = page.locator('[data-finding-id="1"]')
  await row.getByTestId('not-now').locator('summary').click()
  await row.getByTestId('not-now').locator('[data-months="3"]').click()
  await expect(page.getByTestId('finding-row')).toHaveCount(2)
  expect(patches).toEqual([{ id: 1, status: 'snoozed', snooze_months: 3 }])

  await page.getByTestId('findings-status').selectOption('snoozed')
  await expect(page.getByTestId('finding-row')).toHaveCount(1)
  await expect(page.getByTestId('finding-back-on')).toContainText('2027')
})

test('Wrong can block the whole site, which then lists under Blocked sites and can be unblocked', async ({ page }) => {
  const patches: Patch[] = []
  const blocked: Blocked[] = []
  await serveInbox(page, patches, blocked)
  await page.goto('/admin/assistant')

  // A link with nothing to block offers no checkbox.
  const bare = page.locator('[data-finding-id="3"]')
  await bare.getByTestId('wrong').locator('summary').click()
  await expect(bare.getByTestId('block-site')).toHaveCount(0)
  await bare.getByTestId('wrong').locator('summary').click()

  const row = page.locator('[data-finding-id="1"]')
  await row.getByTestId('wrong').locator('summary').click()
  await row.getByTestId('block-site').check()
  await expect(row.getByTestId('wrong')).toContainText('minoga.example')
  await row.getByTestId('confirm-wrong').click()

  const list = page.getByTestId('blocked-sites')
  await expect(list).toBeVisible()
  expect(patches).toEqual([{ id: 1, status: 'dismissed', block_site: true }])
  await list.locator('summary').click()
  await expect(list.locator('[data-site="minoga.example"]')).toBeVisible()
  await list.getByRole('button', { name: /unblock/i }).click()
  await expect(page.getByTestId('blocked-sites')).toHaveCount(0)
})

test('one popover at a time, and a block ticked then left is not remembered', async ({ page }) => {
  const patches: Patch[] = []
  await serveInbox(page, patches)
  await page.goto('/admin/assistant')

  const row = page.locator('[data-finding-id="1"]')
  const wrong = row.getByTestId('wrong')
  const notNow = row.getByTestId('not-now')

  await wrong.locator('summary').click()
  await row.getByTestId('block-site').check()
  await notNow.locator('summary').click() // opening Not now closes Wrong
  await expect(wrong).not.toHaveAttribute('open')
  await page.getByRole('heading', { name: 'Assistant' }).click() // a click outside closes Not now
  await expect(notNow).not.toHaveAttribute('open')

  await wrong.locator('summary').click()
  await expect(row.getByTestId('block-site')).not.toBeChecked()
  await row.getByTestId('confirm-wrong').click()
  await expect(page.getByTestId('finding-row')).toHaveCount(2)
  expect(patches).toEqual([{ id: 1, status: 'dismissed', block_site: false }])
})

test('links only http(s) results', async ({ page }) => {
  await serveInbox(page)
  await page.goto('/admin/assistant')

  await expect(page.locator('[data-finding-id="1"] a')).toHaveAttribute('href', 'https://minoga.example/koncerty')
  await expect(page.locator('[data-finding-id="3"] a')).toHaveCount(0)
})

test('Run now queues the crawl and the bar shows the new runs', async ({ page }) => {
  await serveInbox(page)
  let ran = false
  // Registered after serveInbox, so it answers first (Playwright tries the newest route first).
  await page.route(/\/api\/admin\/assistant\/runs$/, route => route.fulfill({ json: { data: ran
    ? [{ source: 'google_cse', status: 'ok', started_at: null, finished_at: null, queries: 12, new: 7, error: null, remaining: 68, failing_runs: 0 }]
    : [] } }))
  await page.route(/\/api\/admin\/assistant\/run$/, route => {
    ran = true
    return route.fulfill({ status: 202, json: { data: { queued: ['google_cse'], skipped: {} } } })
  })
  await page.goto('/admin/assistant')
  await expect(page.getByTestId('run-status')).toContainText(/not run yet/i)

  await page.getByTestId('run-now').click()

  await expect(page.getByTestId('run-status').locator('[data-source="google_cse"]')).toContainText('68')
  await expect(page.getByText(/crawl started/i)).toBeVisible()
})

test('a source failing three runs in a row gets a banner with its error', async ({ page }) => {
  await serveInbox(page)
  await page.route(/\/api\/admin\/assistant\/runs$/, route => route.fulfill({ json: { data: [
    { source: 'meta_own', status: 'failed', started_at: null, finished_at: null, queries: 1, new: 0,
      error: 'Facebook Page token expired — mint a new Page access token', remaining: 4, failing_runs: 3 },
  ] } }))
  await page.goto('/admin/assistant')

  await expect(page.getByTestId('run-failing-banner')).toContainText(/3 runs in a row/i)
  await expect(page.getByTestId('run-status')).toContainText('token expired')
})
