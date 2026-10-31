import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

/**
 * The crawler's settings page. Served through `page.route`: the real row
 * decides what the nightly crawl spends, and a spec that saved it would
 * change production-shaped settings on the dev DB for every other run.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

const SETTINGS = /\/api\/admin\/assistant\/settings$/

function response(data: Record<string, unknown>) {
  return {
    data,
    sources: [
      { key: 'google_cse', enabled: true, hasKey: false, available: true, cap_day: 80, cap_month: null, lastRun: null },
      { key: 'places', enabled: true, hasKey: true, available: true, cap_day: 30, cap_month: 900, lastRun: null },
      { key: 'rss', enabled: true, hasKey: true, available: false, cap_day: 30, cap_month: null, lastRun: null },
    ],
    countries: [
      { code: 'PL', name: 'Poland', native: 'Polska' },
      { code: 'JP', name: 'Japan', native: '日本' },
    ],
  }
}

const INITIAL = {
  keywords: ['Skanking Storks'],
  countries: ['PL'],
  cities_by_country: { PL: ['Kraków'] },
  sources: {
    google_cse: { enabled: true, cap_day: 80 },
    places: { enabled: true, cap_day: 30, cap_month: 900 },
    rss: { enabled: true, cap_day: 30 },
  },
  rss_feeds: [],
  sibling_bands: [],
  digest_to: [],
}

async function serveSettings(page: Page, puts: Record<string, unknown>[]): Promise<void> {
  await page.route(SETTINGS, (route: Route) => {
    if (route.request().method() === 'PUT') {
      const body = JSON.parse(route.request().postData() ?? '{}')
      puts.push(body)
      return route.fulfill({ json: response(body) })
    }
    return route.fulfill({ json: response(INITIAL) })
  })
}

test('adds a country, switches a source off and saves', async ({ page }) => {
  const puts: Record<string, unknown>[] = []
  await serveSettings(page, puts)
  await page.goto('/admin/assistant/settings')

  const form = page.getByTestId('crawler-settings')
  await expect(form).toBeVisible()
  await expect(form.locator('[data-source="google_cse"]')).toContainText(/no api key/i)
  await expect(form.locator('[data-source="rss"]')).toContainText(/later update/i)
  await expect(form.locator('[data-source="rss"] input[type="checkbox"]')).toBeDisabled()

  await form.locator('[data-country="JP"] input').check()
  await form.locator('#cs-cities-JP').fill('Tokyo\n\nOsaka\n')
  await form.locator('[data-source="google_cse"] input[type="checkbox"]').uncheck()
  await form.locator('#cs-rss').fill('https://ska.example/feed?tags=ska,punk')
  await form.getByRole('button', { name: /save settings/i }).click()

  await expect(page.getByText(/crawler settings saved/i)).toBeVisible()
  expect(puts).toHaveLength(1)
  const sent = puts[0] as typeof INITIAL & { cities_by_country: Record<string, string[]> }
  expect(sent.countries).toEqual(['PL', 'JP'])
  expect(sent.cities_by_country).toEqual({ PL: ['Kraków'], JP: ['Tokyo', 'Osaka'] })
  expect(sent.sources.google_cse.enabled).toBe(false)
  expect(sent.sources.places.cap_month).toBe(900)
  expect(sent.rss_feeds).toEqual(['https://ska.example/feed?tags=ska,punk'])
})

test('picks a sibling band from setlist.fm and shows a source\'s last error', async ({ page }) => {
  const puts: Record<string, unknown>[] = []
  await page.route(SETTINGS, (route: Route) => {
    if (route.request().method() === 'PUT') {
      puts.push(JSON.parse(route.request().postData() ?? '{}'))
      return route.fulfill({ json: response(puts.at(-1)!) })
    }
    const r = response(INITIAL)
    r.sources[1] = { ...r.sources[1], lastRun: { status: 'failed', error: 'Places quota misconfigured', started_at: null, finished_at: null, queries: 1, new: 0 } } as never
    return route.fulfill({ json: r })
  })
  await page.route(/\/api\/setlists\/setlistfm\/search/, route => route.fulfill({ json: { data: [
    { mbid: 'mb-busters', name: 'The Busters' },
  ] } }))
  await page.goto('/admin/assistant/settings')

  const form = page.getByTestId('crawler-settings')
  await expect(form.locator('[data-source="places"] [data-testid="source-last-error"]')).toContainText('misconfigured')

  const picker = form.getByTestId('sibling-bands')
  await picker.getByRole('searchbox').fill('Busters')
  await picker.getByRole('button', { name: /^find$/i }).click()
  await picker.getByRole('button', { name: /The Busters/ }).click()
  await expect(picker.locator('[data-mbid="mb-busters"]')).toBeVisible()
  await form.getByRole('button', { name: /save settings/i }).click()

  await expect(page.getByText(/crawler settings saved/i)).toBeVisible()
  expect((puts[0] as { sibling_bands: unknown }).sibling_bands).toEqual([{ mbid: 'mb-busters', name: 'The Busters' }])
})

test('tells an admin who is not a superadmin why there is no form', async ({ page }) => {
  await page.route(SETTINGS, route => route.fulfill({ status: 403, json: { message: 'Only a superadmin can manage the crawler.' } }))
  await page.goto('/admin/assistant/settings')

  await expect(page.getByTestId('crawler-settings-forbidden')).toBeVisible()
  await expect(page.getByTestId('crawler-settings')).toHaveCount(0)
})
