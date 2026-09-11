import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The public half of "news post event date is derived from linked concerts".
 * The admin spec (tests/admin/post-event-date.spec.ts) covers linking
 * concerts and choosing a display mode; this covers what a visitor actually
 * sees, which is the point of the feature — see hero-backdrop.spec.ts for the
 * same split and why it matters (a post with the manual `event_date` field
 * removed and nothing rendering the derived date in its place would still
 * pass every admin-side check).
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed posts/concerts')
  return entry.value
}

async function authedFetch(request: import('@playwright/test').APIRequestContext, method: 'get' | 'post' | 'delete', path: string, data?: unknown) {
  return request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
}

async function rebuildAndWait(request: import('@playwright/test').APIRequestContext, since: number) {
  const deadline = Date.now() + 180_000

  while (Date.now() < deadline) {
    const trigger = await authedFetch(request, 'post', '/api/admin/site/rebuild')
    if (!trigger.ok() && trigger.status() !== 409) {
      throw new Error(`POST /api/admin/site/rebuild → ${trigger.status()}`)
    }

    while (Date.now() < deadline) {
      const res = await authedFetch(request, 'get', '/api/admin/site/rebuild/status')
      const body = await res.json()
      if (body.status === 'error') throw new Error('Public site rebuild failed')
      if (body.status === 'done') {
        if ((body.startedAt ?? 0) >= since) return
        break // stale build finished before our seed — trigger another
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const plFmt  = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
const single = (d: string) => dayFmt.format(new Date(d))
const range = (a: string, b: string) => dayFmt.formatRange(new Date(a), new Date(b))

// Serial: shares seeded fixtures across tests and rebuilds the public site
// once — the same reasoning as hero-backdrop.spec.ts's active-filter block.
test.describe.serial('Public news post — event date from linked concerts', () => {
  failOnPageError()

  const stamp = Date.now()
  let venueId: number
  let concertIds: number[] = []
  let singleSlug: string, rangeSlug: string, listSlug: string, noEventSlug: string

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000)
    const venues = await (await authedFetch(request, 'get', '/api/venues')).json()
    venueId = venues.data[0].id

    async function makeConcert(date: string): Promise<number> {
      const res = await authedFetch(request, 'post', '/api/concerts', { venue_id: venueId, date })
      const id = (await res.json()).data.id
      concertIds.push(id)
      return id
    }

    const soloConcert  = await makeConcert('2099-03-05')
    const rangeConcert1 = await makeConcert('2099-04-10')
    const rangeConcert2 = await makeConcert('2099-04-12')
    const listConcert1  = await makeConcert('2099-05-01')
    const listConcert2  = await makeConcert('2099-05-03')

    async function makePost(title: string, concert_ids: number[], event_date_display?: 'range' | 'list'): Promise<string> {
      const res = await authedFetch(request, 'post', '/api/posts', {
        title, published_at: new Date().toISOString(), concert_ids, event_date_display,
      })
      return (await res.json()).data.slug_en
    }

    singleSlug   = await makePost(`E2E Event Date Single ${stamp}`, [soloConcert])
    rangeSlug    = await makePost(`E2E Event Date Range ${stamp}`, [rangeConcert1, rangeConcert2], 'range')
    listSlug     = await makePost(`E2E Event Date List ${stamp}`, [listConcert1, listConcert2], 'list')
    noEventSlug  = await makePost(`E2E Event Date None ${stamp}`, [])

    await rebuildAndWait(request, stamp)
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(60_000)
    // Only slugs were captured when seeding — look the posts back up by the
    // shared title stamp to delete them by id.
    const search = await (await request.get(`${API}/api/posts?search=${encodeURIComponent(`E2E Event Date`)}`)).json()
    for (const p of (search.data ?? []).filter((p: { title: string }) => p.title.includes(String(stamp)))) {
      await authedFetch(request, 'delete', `/api/posts/${p.id}`)
    }
    for (const id of concertIds) {
      await authedFetch(request, 'delete', `/api/concerts/${id}`)
    }
  })

  test('a post linked to one concert shows that concert\'s date', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${singleSlug}`)
    await expect(page.getByText(`Event: ${single('2099-03-05')}`)).toBeVisible()
  })

  test('a post linked to two concerts shows a date range', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${rangeSlug}`)
    await expect(page.getByText(`Event: ${range('2099-04-10', '2099-04-12')}`)).toBeVisible()
  })

  test('a post linked to two concerts can list every date instead', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${listSlug}`)
    await expect(page.getByText(`Event: ${single('2099-05-01')}, ${single('2099-05-03')}`)).toBeVisible()
  })

  test('a post with no linked concert shows no event date at all', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${noEventSlug}`)
    await expect(page.getByText(/^Event:/)).toHaveCount(0)
  })

  test('the news listing shows the event date on the linked-concert card', async ({ page }) => {
    await page.goto(`${WEB}/en/news`)
    await expect(page.getByText(`Event: ${range('2099-04-10', '2099-04-12')}`)).toBeVisible()
  })

  test('renders the localized label on the Polish locale', async ({ page }) => {
    await page.goto(`${WEB}/pl/aktu/${singleSlug}`)
    await expect(page.getByText(`Wydarzenie: ${plFmt.format(new Date('2099-03-05'))}`)).toBeVisible()
  })
})
