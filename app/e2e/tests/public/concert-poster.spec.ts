import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The concert page's poster opens full size.
 *
 * No concert in the dev database has a poster, so this seeds one: a concert
 * with a poster, a public-site rebuild, the checks, then the concert deleted
 * and the site rebuilt again so nothing of it stays served.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

/** A 1×1 PNG — a real image to Laravel's `image` rule. */
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

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

test.describe.serial('Public — concert poster', () => {
  failOnPageError()

  let concertId: number | null = null
  let slug = ''

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    const venues = (await (await request.get(`${API}/api/venues`)).json()).data as { id: number }[]
    test.skip(venues.length === 0, 'No venue to hold a concert')

    // A date far out and random enough not to collide with another run's.
    const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
    const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
    const created = await request.post(`${API}/api/concerts`, {
      headers: headers(),
      data: { venue_id: venues[0].id, date: `2098-${month}-${day}`, name: { en: `E2E Poster ${Date.now()}` } },
    })
    expect(created.status(), await created.text()).toBe(201)
    const concert = (await created.json()).data
    concertId = concert.id
    slug = concert.slug

    const poster = await request.post(`${API}/api/concerts/${concertId}/poster`, {
      headers: headers(),
      multipart: { poster: { name: 'poster.png', mimeType: 'image/png', buffer: TEST_PNG } },
    })
    expect(poster.ok(), await poster.text()).toBeTruthy()

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    if (concertId === null) return
    const res = await request.delete(`${API}/api/concerts/${concertId}`, { headers: headers() })
    expect(res.ok(), `cleanup delete failed with ${res.status()}`).toBeTruthy()
    await rebuildAndWait(request, Date.now())
  })

  test('clicking the poster opens it full size; Escape closes it and returns focus', async ({ page, request }) => {
    const config = (await (await request.get(`${API}/api/site-config?lang=en`)).json()).data
    const section = config?.module_config?.concerts?.slug ?? 'concerts'
    await page.goto(`${WEB}/en/${section}/${slug}`)

    const trigger = page.getByTestId('poster-open')
    await expect(trigger).toBeVisible()
    // The island hydrates on idle; wait until it has attached its listener.
    await page.waitForFunction(() =>
      [...document.querySelectorAll('astro-island')].some((i) => i.getAttribute('component-url')?.includes('PosterModal') && !i.hasAttribute('ssr')),
    )
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('poster-full')).toHaveAttribute('src', /\/storage\/posters\//)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})
