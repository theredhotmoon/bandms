import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A member's page lists the concerts they played, each leading to its show
 * page. Seeds a member and a concert they played, rebuilds the public site,
 * checks, then deletes both and rebuilds again.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

function adminToken(): string {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/admin.json', 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}
const headers = () => ({ Accept: 'application/json', Authorization: `Bearer ${adminToken()}` })

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
        break
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

test.describe.serial('Public — member gigs', () => {
  failOnPageError()

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  let memberId: number | null = null
  let slug = ''
  let concertId: number | null = null
  let concertSlug = ''

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    const member = await request.post(`${API}/api/band-profile/members`, {
      headers: headers(),
      data: { first_name: 'Gig', last_name: `Member${stamp}` },
    })
    expect(member.status(), await member.text()).toBe(201)
    memberId = (await member.json()).data.id
    slug = (await member.json()).data.slug

    const venues = ((await (await request.get(`${API}/api/venues`, { headers: headers() })).json()).data ?? []) as { id: number }[]
    test.skip(venues.length === 0, 'No venue to hold a concert')
    const concert = await request.post(`${API}/api/concerts`, {
      headers: headers(),
      data: { venue_id: venues[0].id, date: '2096-05-05', name: { en: `E2E Gig ${stamp}` }, member_ids: [memberId] },
    })
    expect(concert.status(), await concert.text()).toBe(201)
    concertId = (await concert.json()).data.id
    concertSlug = (await concert.json()).data.slug
    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    if (concertId !== null) await request.delete(`${API}/api/concerts/${concertId}`, { headers: headers() })
    if (memberId !== null) await request.delete(`${API}/api/band-profile/members/${memberId}`, { headers: headers() })
    await rebuildAndWait(request, Date.now())
  })

  test('lists the gig, which leads to the show page', async ({ page, request }) => {
    // site-config is not wrapped in `data`.
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.about === false || config?.module_config?.about?.visibility?.show_members === false,
      'Member pages are not built: About or its Members section is off')
    test.skip(config?.modules?.concerts === false, 'Concerts module is off')
    const about = config?.module_config?.about?.slug ?? 'about'
    const concerts = config?.module_config?.concerts?.slug ?? 'concerts'

    await page.goto(`${WEB}/en/${about}/${slug}`)
    const gig = page.getByTestId('member-gig')
    await expect(gig).toHaveCount(1)
    await expect(gig).toHaveAttribute('href', `/en/${concerts}/${concertSlug}`)

    await gig.click()
    await expect(page).toHaveURL(new RegExp(`/en/${concerts}/${concertSlug}/?$`))
  })
})
