import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { adminHeaders, rebuildAndWait } from '../../fixtures/admin-api'
import { failOnPageError } from '../../fixtures/page-errors'
import { anonymousVisitor } from '../../fixtures/visitor'
import { setWelcomeCampaign } from '../../fixtures/seed'

/**
 * The welcome screen as a visitor meets it (web/src/components/WelcomeScreen.vue).
 *
 * The screen is baked into the public build, so beforeAll switches the module
 * on, writes a known settings state and waits for the rebuild; afterAll puts
 * the row, the settings, the campaign and the build back. The campaign is
 * restored through `e2e:set-welcome-campaign` (no admin route can lower it):
 * site_settings travels with `sync_db.py push --content`, so a stamp left on
 * the dev DB would re-show the screen to every production visitor.
 *
 * Isolation: every other public spec starts from `anonymousVisitor()` (consent
 * answered, welcome seen). This one starts from nothing, like a first visit.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const SETTINGS = '/api/admin/welcome-settings'
const MODULE = '/api/admin/modules/welcome'

test.describe.configure({ mode: 'serial' })
test.use({ storageState: { cookies: [], origins: [] } })

type Json = Record<string, unknown>
const known = (geo: Json) => ({
  blocks: ['concerts', 'news', 'newsletter', 'account'],
  concert_count: 2,
  frequency: 'interval',
  reshow_days: 90,
  geo,
})
const GEO_OFF = { enabled: false, radius_km: 100, far_visitors: 'hide_gigs' }

let originalSettings: Json | null = null
let originalEnabled: boolean | null = null
/** A future show created for the geo case, so "near" never depends on what the dev DB holds. */
let gig: { id: number; slug: string } | null = null

async function putSettings(request: APIRequestContext, data: Json) {
  const res = await request.put(SETTINGS, { headers: adminHeaders(), data })
  if (!res.ok()) throw new Error(`PUT welcome-settings → ${res.status()}`)
}

/** Writes settings, then waits for a build that includes them. */
async function applyAndRebuild(request: APIRequestContext, geo: Json) {
  const since = Date.now()
  await putSettings(request, known(geo))
  await rebuildAndWait(request, since)
}

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000)
  const s = await request.get(SETTINGS, { headers: adminHeaders() })
  if (!s.ok()) throw new Error(`Could not capture welcome settings: ${s.status()}`)
  originalSettings = (await s.json()).data

  const mods = await request.get('/api/admin/modules', { headers: adminHeaders() })
  if (!mods.ok()) throw new Error(`Could not capture modules: ${mods.status()}`)
  const row = ((await mods.json()).data as { slug: string; enabled: boolean }[]).find((m) => m.slug === 'welcome')
  if (!row) throw new Error('No welcome module row')
  originalEnabled = row.enabled

  // A show ~60 days out at a venue with coordinates, created before the rebuild
  // we wait on so that build bakes it. Unique name: parallel specs share the DB.
  const venues = await request.get('/api/venues', { headers: adminHeaders() })
  if (!venues.ok()) throw new Error(`Could not list venues: ${venues.status()}`)
  const all = (await venues.json()).data as { id: number; latitude?: number | null }[]
  const venue = all.find((v) => v.latitude != null) ?? all[0]
  if (!venue) throw new Error('No venue exists to attach the welcome-spec show to')
  const date = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)
  const created = await request.post('/api/concerts', {
    headers: adminHeaders(),
    data: { name: { en: `E2E Welcome Gig ${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }, venue_id: venue.id, date, start_time: '20:00' },
  })
  if (created.status() !== 201) throw new Error(`Could not create the welcome-spec show: ${created.status()} ${await created.text()}`)
  const made = (await created.json()).data
  gig = { id: made.id, slug: made.slug }

  const since = Date.now()
  const on = await request.put(MODULE, { headers: adminHeaders(), data: { enabled: true } })
  if (!on.ok()) throw new Error(`Could not enable the welcome module: ${on.status()}`)
  await putSettings(request, known(GEO_OFF))
  await rebuildAndWait(request, since)
})

test.afterAll(async ({ request }) => {
  test.setTimeout(180_000)
  try {
    if (!originalSettings || originalEnabled === null) {
      // beforeAll failed before anything was written; its error is the one to read.
      console.warn('welcome-screen: nothing was captured, so nothing is restored')
    } else {
      // Settings, module and campaign first, so a failed gig delete below can
      // never leave the module switched on for the rest of the dev DB's life.
      const { campaign, geo_available: _g, ...input } = originalSettings
      const since = Date.now()
      try {
        const put = await request.put(SETTINGS, { headers: adminHeaders(), data: input })
        expect(put.status()).toBe(200)
      } finally {
        try {
          const mod = await request.put(MODULE, { headers: adminHeaders(), data: { enabled: originalEnabled } })
          expect(mod.status()).toBe(200)
        } finally {
          setWelcomeCampaign(Number(campaign) || 0)
        }
      }
      await rebuildAndWait(request, since)
    }
  } finally {
    if (gig) {
      const del = await request.delete(`/api/concerts/${gig.id}`, { headers: adminHeaders() })
      expect(del.status()).toBe(204)
    }
  }
})

failOnPageError()

const dialog = (page: Page) => page.getByTestId('welcome-dialog')
const consentIsMounted = (page: Page) => page.locator('astro-island[component-url*="ConsentBanner"]').count().then((n) => n > 0)

/** Starts a context in which consent is already answered, so only the welcome screen is in play. */
async function answerConsent(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('bandms:consent')) {
      localStorage.setItem('bandms:consent', JSON.stringify({ status: 'denied', decidedAt: new Date().toISOString() }))
    }
  })
}

/** Waits for the island to hydrate, then a beat: "never opens" needs the chance to open. */
async function settle(page: Page) {
  await page
    .waitForFunction(() => {
      const i = document.querySelector('astro-island[component-url*="WelcomeScreen"]')
      return !!i && !i.hasAttribute('ssr')
    }, undefined, { timeout: 10_000 })
    .catch(() => undefined) // an unmounted island is what some cases assert
  await page.waitForTimeout(1200)
}

/** Astro serialises props as [type, value] pairs; unwrap to plain JSON. */
function unwrap(v: unknown): unknown {
  if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number') {
    return v[0] === 1 ? (v[1] as unknown[]).map(unwrap) : unwrap(v[1])
  }
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unwrap(x)]))
  return v
}

async function builtConcertIds(page: Page): Promise<number[]> {
  await page.goto(`${WEB}/en`)
  const raw = await page.locator('astro-island[component-url*="WelcomeScreen"]').first().getAttribute('props')
  if (!raw) return []
  const props = unwrap(JSON.parse(raw)) as { concerts?: { id: number }[] }
  return (props.concerts ?? []).map((c) => c.id)
}

const nearby = (page: Page, body: Json) =>
  page.route('**/api/welcome/nearby', (route) => route.fulfill({ json: body }))

test('a first visit shows the consent card, then the welcome screen after No thanks', async ({ page }) => {
  await page.goto(`${WEB}/en`)
  if (await consentIsMounted(page)) {
    await expect(page.getByTestId('consent-reject')).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
    await page.getByTestId('consent-reject').click()
  }
  await expect(dialog(page)).toBeVisible({ timeout: 15_000 })
  // Account is always available; the others depend on the dev DB (newsletter module
  // off, no upcoming gig or post), where a block with nothing behind it is left out.
  await expect(page.getByTestId('welcome-block-account')).toBeVisible()
})

test('the close button dismisses it and the next page does not reopen it', async ({ page }) => {
  await answerConsent(page)
  await page.goto(`${WEB}/en`)
  await expect(dialog(page)).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('welcome-close').click()
  await expect(dialog(page)).toHaveCount(0)

  await page.goto(`${WEB}/en`)
  await settle(page)
  await expect(dialog(page)).toHaveCount(0)
})

test('Enter the site also dismisses it', async ({ page }) => {
  await answerConsent(page)
  await page.goto(`${WEB}/en`)
  await expect(dialog(page)).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('welcome-enter').click()
  await expect(dialog(page)).toHaveCount(0)
})

for (const path of ['/en/privacy', '/rider/x']) {
  test(`${path} never shows it`, async ({ page }) => {
    await answerConsent(page)
    await page.goto(`${WEB}${path}`)
    await settle(page)
    await expect(dialog(page)).toHaveCount(0)
  })
}

test('a signed-in fan never sees it', async ({ page }) => {
  await answerConsent(page)
  await page.addInitScript(() => localStorage.setItem('fan_token', 'e2e-token'))
  await page.goto(`${WEB}/en`)
  await settle(page)
  await expect(dialog(page)).toHaveCount(0)
})

test('a new campaign shows it again to a visitor who has seen it', async ({ page, request }) => {
  await answerConsent(page)
  await page.goto(`${WEB}/en`)
  await expect(dialog(page)).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('welcome-close').click()
  await page.goto(`${WEB}/en`)
  await settle(page)
  await expect(dialog(page)).toHaveCount(0)

  const since = Date.now()
  const res = await request.post(`${SETTINGS}/campaign`, { headers: adminHeaders() })
  expect(res.status()).toBe(200)
  await rebuildAndWait(request, since)

  // Same browser context, so the old seen-campaign is still in storage.
  await page.goto(`${WEB}/en`)
  await expect(dialog(page)).toBeVisible({ timeout: 15_000 })
})

test('the seeded anonymous visitor sees neither the consent card nor the welcome screen', async ({ browser }) => {
  const context = await browser.newContext({ storageState: anonymousVisitor({ fresh: true }) }) // the campaign was stamped above
  try {
    const page = await context.newPage()
    await page.goto(`${WEB}/en`)
    await settle(page) // waits for the client:idle island to hydrate, then a beat
    await expect(page.locator('astro-island[component-url*="WelcomeScreen"]')).toHaveCount(1) // it is mounted, just not opened
    await expect(dialog(page)).toHaveCount(0)
    await expect(page.getByTestId('consent-allow')).not.toBeVisible()
  } finally {
    await context.close()
  }
})

test.describe('geo targeting', () => {
  test('near: the gigs block lists only the shows the server named', async ({ page, request }) => {
    await applyAndRebuild(request, { enabled: true, radius_km: 100, far_visitors: 'hide_gigs' })
    await answerConsent(page)
    if (!gig) throw new Error('the welcome-spec show was not created')
    const ids = await builtConcertIds(page)
    expect(ids, 'the build did not bake the show created in beforeAll').toContain(gig.id)
    const picked = gig.id
    await page.unrouteAll()
    await nearby(page, { located: true, concert_ids: [999_999_999, picked] })
    await page.evaluate(() => localStorage.removeItem('bandms:welcome'))
    await page.goto(`${WEB}/en`)
    await expect(dialog(page)).toBeVisible({ timeout: 15_000 })
    const gigs = page.getByTestId('welcome-block-concerts')
    await expect(gigs).toBeVisible()
    await expect(gigs.locator('a.welcome-gig')).toHaveCount(1)
    await expect(gigs.locator('a.welcome-gig')).toHaveAttribute('href', new RegExp(gig.slug))
  })

  test('far + hide gigs: the screen opens without a gigs block', async ({ page, request }) => {
    await applyAndRebuild(request, { enabled: true, radius_km: 100, far_visitors: 'hide_gigs' })
    await answerConsent(page)
    await nearby(page, { located: true, concert_ids: [] })
    await page.goto(`${WEB}/en`)
    await expect(dialog(page)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('welcome-block-concerts')).toHaveCount(0)
  })

  test('far + no screen: nothing opens', async ({ page, request }) => {
    await applyAndRebuild(request, { enabled: true, radius_km: 100, far_visitors: 'no_screen' })
    await answerConsent(page)
    await nearby(page, { located: true, concert_ids: [] })
    await page.goto(`${WEB}/en`)
    await settle(page)
    await expect(dialog(page)).toHaveCount(0)
  })
})
