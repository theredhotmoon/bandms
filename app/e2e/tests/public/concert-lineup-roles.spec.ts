import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A show page labels its line-up "Headliner" / "Support" only when the
 * concert's `show_lineup_roles` is on, prints our band's own stage time, and
 * numbers the acts in the order they play.
 *
 * Seeds two concerts — roles on, roles off — each starting at 20:00 with our
 * band on top of the bill and a guest at 21:30. The roles-off one also sets
 * our own stage time (23:00); the other falls back to the start. Rebuilds the public site
 * once, checks both pages, then deletes everything and rebuilds again so
 * nothing of it stays served.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json')
  return entry.value
}
const headers = () => ({ Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' })

async function rebuildAndWait(request: APIRequestContext, since: number) {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    const trigger = await request.post(`${API}/api/admin/site/rebuild`, { headers: headers() })
    if (!trigger.ok() && trigger.status() !== 409) throw new Error(`POST rebuild → ${trigger.status()}`)
    while (Date.now() < deadline) {
      const body = await (await request.get(`${API}/api/admin/site/rebuild/status`, { headers: headers() })).json()
      if (body.status === 'error') throw new Error('Public site rebuild failed')
      if (body.status === 'done') {
        if ((body.startedAt ?? 0) >= since) return
        break // a build that started before our seed — trigger another
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

test.describe.serial('Public — concert line-up roles', () => {
  failOnPageError()

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  let venueId: number | null = null
  let bandId: number | null = null
  const concerts: Record<'on' | 'off', { id: number; slug: string } | null> = { on: null, off: null }

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    const venue = await request.post(`${API}/api/venues`, { headers: headers(), data: { name: `E2E Roles Venue ${stamp}` } })
    expect(venue.status(), await venue.text()).toBe(201)
    venueId = (await venue.json()).data.id

    const band = await request.post(`${API}/api/bands`, { headers: headers(), data: { name: `E2E Roles Guest ${stamp}` } })
    expect(band.status(), await band.text()).toBe(201)
    bandId = (await band.json()).data.id

    for (const [key, show] of [['on', true], ['off', false]] as const) {
      const res = await request.post(`${API}/api/concerts`, {
        headers: headers(),
        data: {
          name: { en: `E2E Roles ${key} ${stamp}` },
          venue_id: venueId,
          date: '2096-07-07',
          start_time: '20:00',
          own_sort_order: 1,
          own_play_time: show ? null : '23:00',
          bands: [{ id: bandId, sort_order: 2, play_time: '21:30' }],
          show_lineup_roles: show,
        },
      })
      expect(res.status(), await res.text()).toBe(201)
      const data = (await res.json()).data
      expect(data.show_lineup_roles).toBe(show)
      concerts[key] = { id: data.id, slug: data.slug }
    }

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    // Concerts first: they reference the band and the venue.
    for (const path of [
      concerts.on && `/api/concerts/${concerts.on.id}`,
      concerts.off && `/api/concerts/${concerts.off.id}`,
      bandId && `/api/bands/${bandId}`,
      venueId && `/api/venues/${venueId}`,
    ]) {
      if (!path) continue
      const res = await request.delete(`${API}${path}`, { headers: headers() })
      expect(res.ok(), `DELETE ${path} → ${res.status()}`).toBe(true)
    }
    await rebuildAndWait(request, Date.now())
  })

  async function open(page: import('@playwright/test').Page, request: APIRequestContext, key: 'on' | 'off') {
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.concerts === false, 'Concerts module is off')
    const section = config?.module_config?.concerts?.slug ?? 'concerts'
    const res = await page.goto(`${WEB}/en/${section}/${concerts[key]!.slug}`)
    expect(res?.status()).toBe(200)
    await expect(page.locator('.lineup-row')).toHaveCount(2)
  }

  test('with roles on, the first act is billed and highlighted as the headliner', async ({ page, request }) => {
    await open(page, request, 'on')
    await expect(page.locator('.lineup-headliner')).toHaveCount(1)
    await expect(page.locator('.lineup-row').first()).toHaveClass(/lineup-headliner/)
    // A role, then the time: "Headliner · 20:00", whatever the band named the role.
    const roles = page.locator('.lineup-role')
    await expect(roles.nth(0)).toHaveText(/^\S.* · 20:00$/)
    await expect(roles.nth(1)).toHaveText(/^\S.* · 21:30$/)
  })

  test('numbers the acts in running order: the headliner on top plays last', async ({ page, request }) => {
    await open(page, request, 'on')
    await expect(page.locator('.lineup-num')).toHaveText(['02', '01'])
  })

  test('with roles off, only the stage times are printed and nobody is highlighted', async ({ page, request }) => {
    await open(page, request, 'off')
    await expect(page.locator('.lineup-headliner')).toHaveCount(0)
    // 23:00 is our own stage time, not the show's 20:00 start.
    await expect(page.locator('.lineup-role')).toHaveText(['23:00', '21:30'])
    // …and the facts strip agrees: "On stage" is our slot, not the doors-to-opener start.
    await expect(page.locator('.fact').filter({ hasText: '23:00' })).toHaveCount(1)
    await expect(page.locator('.fact-val', { hasText: '20:00' })).toHaveCount(0)
  })

  test('the shows page lists upcoming gigs first, then the map, then the archive', async ({ page, request }) => {
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.concerts === false, 'Concerts module is off')
    const section = config?.module_config?.concerts?.slug ?? 'concerts'
    expect((await page.goto(`${WEB}/en/${section}/`))?.status()).toBe(200)

    // In page order, which of the three are there. Our seeded 2096 shows
    // guarantee the upcoming list; map and archive depend on the data.
    const seen = await page.evaluate(() =>
      [...document.querySelectorAll('.ph, .upcoming-sec, #shows-map, .archive-wrap-outer')].map((el) =>
        el.matches('.ph') ? 'hero' : el.matches('.upcoming-sec') ? 'upcoming' : el.id === 'shows-map' ? 'map' : 'archive'),
    )
    expect(seen.slice(0, 2)).toEqual(['hero', 'upcoming'])
    expect(seen).toEqual(['hero', 'upcoming', 'map', 'archive'].filter((s) => seen.includes(s)))
  })
})
