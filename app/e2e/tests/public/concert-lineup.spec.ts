import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A concert page's line-up includes the band the site belongs to.
 *
 * The API keeps the two apart — guests in `bands`, our own slot in
 * `own_sort_order` — and the page used to render `bands` alone, so our band
 * never appeared in any line-up, and a show with no guests had none at all.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

interface ApiConcert { slug: string; own_sort_order: number; bands: { name: string; sort_order: number }[] }

test.describe('Public — concert line-up', () => {
  failOnPageError()

  test('lists our own band at its saved position among the guests', async ({ page, request }) => {
    const [concerts, profile, config] = await Promise.all([
      request.get(`${API}/api/concerts?lang=en`).then((r) => r.json()),
      request.get(`${API}/api/band-profile?lang=en`).then((r) => r.json()),
      request.get(`${API}/api/site-config?lang=en`).then((r) => r.json()),
    ])
    test.skip(config.data?.modules?.concerts === false, 'Concerts module is off')
    const list = concerts.data as ApiConcert[]
    test.skip(list.length === 0, 'No concerts on this instance')

    // Prefer a show with guests: it is the one that proves the ordering.
    const concert = list.find((c) => c.bands.length > 0) ?? list[0]
    const section = config.data?.module_config?.concerts?.slug ?? 'concerts'
    const res = await page.goto(`${WEB}/en/${section}/${concert.slug}`)
    test.skip(res?.status() === 404, 'Concert page not built yet')

    const names = page.locator('.lineup-name')
    await expect(page.locator('.lineup-row[data-own]')).toHaveCount(1)
    await expect(page.locator('.lineup-row[data-own] .lineup-name')).toHaveText(profile.data.name)

    // Same order the admin saved: one sequence over guests and our own slot.
    const expected = [
      { name: profile.data.name, order: concert.own_sort_order, own: 0 },
      ...concert.bands.map((b) => ({ name: b.name, order: b.sort_order, own: 1 })),
    ]
      .sort((a, b) => a.order - b.order || a.own - b.own)
      .map((e) => e.name)
    await expect(names).toHaveText(expected)
  })
})
