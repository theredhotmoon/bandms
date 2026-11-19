import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { setWelcomeCampaign } from '../../fixtures/seed'

test.describe.configure({ mode: "serial" })
test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * The welcome-screen panel in Website modules. The settings are ONE shared
 * row, so the spec captures them over the API (Bearer from the storage-state
 * file - a storageState API context carries no token) and puts them back.
 */
function adminToken(): string {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/admin.json', 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json - did the auth setup run?')
}
const headers = () => ({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken()}` })
const ENDPOINT = '/api/admin/welcome-settings'

let original: Record<string, unknown> | null = null

test.beforeAll(async ({ request, baseURL }) => {
  const res = await request.get(`${baseURL}${ENDPOINT}`, { headers: headers() })
  if (!res.ok()) throw new Error(`Could not capture welcome settings: ${res.status()}`)
  original = (await res.json()).data
  // A known start, so the reorder assertions do not depend on what the dev DB held.
  const known = await request.put(`${baseURL}${ENDPOINT}`, {
    headers: headers(),
    data: {
      blocks: ['concerts', 'news', 'newsletter', 'account'], concert_count: 2, frequency: 'interval', reshow_days: 90,
      geo: { enabled: false, radius_km: 100, far_visitors: 'hide_gigs' },
    },
  })
  if (!known.ok()) throw new Error(`Could not set the known welcome state: ${known.status()}`)
})

test.afterAll(async ({ request, baseURL }) => {
  if (!original) throw new Error('welcome settings were never captured, so there is nothing to restore')
  const { campaign, geo_available: _g, ...input } = original
  try {
    const res = await request.put(`${baseURL}${ENDPOINT}`, { headers: headers(), data: input })
    expect(res.status()).toBe(200)
  } finally {
    // The spec presses *Show to everyone now*. site_settings travels with
    // `sync_db.py push --content`, so a stamp left here would re-show the
    // screen to every production visitor: put the campaign back as found.
    setWelcomeCampaign(Number(campaign) || 0)
  }
})

test('the welcome panel saves, persists and stamps a campaign', async ({ page, request, baseURL }) => {
  const openPanel = async () => {
    await page.goto('/admin/website-modules')
    await page.getByRole('button', { name: /Edit .*welcome.* settings/i }).click()
    const panel = page.getByTestId('welcome-settings')
    await expect(panel).toBeVisible()
    return panel
  }

  const panel = await openPanel()

  // Start from a known state: all four on, default order.
  for (const key of ['concerts', 'news', 'newsletter', 'account']) {
    const box = panel.getByTestId(`welcome-block-${key}`)
    if (!(await box.isChecked())) await box.check()
  }
  await panel.getByTestId('welcome-block-news').uncheck()
  await panel.getByTestId('welcome-block-up-newsletter').click()
  await panel.getByTestId('welcome-concert-count').selectOption('3')
  await panel.getByTestId('welcome-frequency-once').check()
  await panel.getByTestId('welcome-geo-radius').fill('150')

  const saved = page.waitForResponse(r => r.url().endsWith(ENDPOINT) && r.request().method() === 'PUT')
  await panel.getByTestId('welcome-save').click()
  expect((await saved).status()).toBe(200)

  const again = await openPanel()
  await expect(again.getByTestId('welcome-block-news')).not.toBeChecked()
  await expect(again.getByTestId('welcome-block-concerts')).toBeChecked()
  await expect(again.getByTestId('welcome-concert-count')).toHaveValue('3')
  await expect(again.getByTestId('welcome-frequency-once')).toBeChecked()
  await expect(again.getByTestId('welcome-geo-radius')).toHaveValue('150')

  // Newsletter moved above news (which is off), so it follows concerts.
  const stored = await request.get(`${baseURL}${ENDPOINT}`, { headers: headers() })
  expect((await stored.json()).data.blocks).toEqual(['concerts', 'newsletter', 'account'])

  // The campaign stamp must not reset unsaved edits.
  await again.getByTestId('welcome-concert-count').selectOption('1')
  await again.getByTestId('welcome-campaign').click()
  const stamped = page.waitForResponse(r => r.url().endsWith(`${ENDPOINT}/campaign`) && r.request().method() === 'POST')
  await again.getByTestId('welcome-campaign-confirm').click()
  expect((await stamped).status()).toBe(200)
  await expect(again.getByTestId('welcome-campaign-last')).not.toHaveText('never')
  await expect(again.getByTestId('welcome-campaign-last')).toContainText(String(new Date().getFullYear()))
  await expect(again.getByTestId('welcome-concert-count')).toHaveValue('1')
})

test('the module row Save also saves unsaved panel edits', async ({ page, request, baseURL }) => {
  await page.goto('/admin/website-modules')
  await page.getByRole('button', { name: /Edit .*welcome.* settings/i }).click()
  const panel = page.getByTestId('welcome-settings')
  await expect(panel).toBeVisible()
  await panel.getByTestId('welcome-geo-radius').fill('222')

  // Only the panel changed, so the module row itself must not be PUT.
  const modulePuts: string[] = []
  page.on('request', r => {
    if (r.method() === 'PUT' && /\/api\/admin\/modules\/welcome$/.test(new URL(r.url()).pathname)) modulePuts.push(r.url())
  })

  const saved = page.waitForResponse(r => r.url().endsWith(ENDPOINT) && r.request().method() === 'PUT')
  // The module row's own Save, not the panel's.
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  expect((await saved).status()).toBe(200)
  await expect(page.getByTestId('welcome-settings')).toBeHidden()
  expect(modulePuts).toEqual([])

  const stored = await request.get(`${baseURL}${ENDPOINT}`, { headers: headers() })
  expect((await stored.json()).data.geo.radius_km).toBe(222)

  await page.getByRole('button', { name: /Edit .*welcome.* settings/i }).click()
  await expect(page.getByTestId('welcome-geo-radius')).toHaveValue('222')
})
