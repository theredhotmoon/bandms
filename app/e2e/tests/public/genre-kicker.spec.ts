import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The genre kicker shown above every section-page hero (About, Concerts,
 * Posts, Photos, Press, Newsletter, Releases, Videos).
 *
 * It used to be a hardcoded literal duplicated across all 8 section
 * components; it now reads the Band Profile's `genres` field, joining it
 * with " · " and uppercasing. This mutates that field directly (it's a
 * singleton on band_profiles, not a row that can be created/deleted), so the
 * whole file runs in one serial block — a second worker's beforeAll running
 * concurrently would race the shared value the same way article-press.spec.ts
 * warns about.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * storageState replays cookies only, and e2e/.auth/admin.json holds none — an
 * API context built from it is anonymous. Path is relative to the Playwright
 * cwd (app/): these spec files are ESM, so __dirname does not exist.
 */
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed the band profile')
  return entry.value
}

async function api(request: APIRequestContext, method: 'get' | 'put', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data !== undefined ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}`)
  return res
}

async function setGenres(request: APIRequestContext, genres: string | null) {
  await api(request, 'put', '/api/band-profile', { genres })
}

/**
 * `web` bakes the site once at container start; a band-profile change made
 * via the API never appears until something rebuilds it. Triggers the same
 * rebuild the admin's manual button uses and polls its status rather than
 * sleeping a fixed duration.
 */
async function rebuildAndWait(request: APIRequestContext, since: number) {
  const deadline = Date.now() + 180_000

  while (Date.now() < deadline) {
    const trigger = await request.post(`${API}/api/admin/site/rebuild`, {
      headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    })
    if (!trigger.ok() && trigger.status() !== 409) {
      throw new Error(`POST /api/admin/site/rebuild → ${trigger.status()}`)
    }

    while (Date.now() < deadline) {
      const res = await api(request, 'get', '/api/admin/site/rebuild/status')
      const body = await res.json()
      if (body.status === 'error') throw new Error('Public site rebuild failed')
      if (body.status === 'done') {
        if ((body.startedAt ?? 0) >= since) return
        break // stale build finished before our seed — trigger another
      }
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

async function pageIsUp(request: APIRequestContext, path: string) {
  try {
    return (await request.get(`${WEB}${path}`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe.serial('Public — genre kicker', () => {
  failOnPageError()

  let originalGenres: string | null = null

  test.beforeAll(async ({ request }) => {
    test.setTimeout(30_000)
    const res = await api(request, 'get', '/api/band-profile')
    originalGenres = (await res.json()).data.genres
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(180_000)
    await setGenres(request, originalGenres)
    await rebuildAndWait(request, Date.now())
  })

  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await pageIsUp(request, '/en/about')),
      `${WEB}/en/about unavailable — site down, or the about module is off`,
    )
  })

  test('joins Band Profile genres with a middle dot, uppercased', async ({ request, page }) => {
    test.setTimeout(180_000)

    // Irregular spacing and a trailing comma, the way an admin would actually
    // type it — proves the formatter's trim/filter, not just a clean join.
    await setGenres(request, 'Ska,  Ska-Jazz ,Rocksteady,')
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.locator('.ph-kicker')).toHaveText('SKA · SKA-JAZZ · ROCKSTEADY')
  })

  test('renders the same kicker on another section page', async ({ request, page }) => {
    // Reuses the value the previous test seeded — this block is serial and
    // both pages read the same Band Profile field, so a second rebuild would
    // only prove the same thing twice.
    test.skip(
      !(await pageIsUp(request, '/en/concerts')),
      `${WEB}/en/concerts unavailable — site down, or the concerts module is off`,
    )

    await page.goto(`${WEB}/en/concerts`)
    await expect(page.locator('.ph-kicker')).toHaveText('SKA · SKA-JAZZ · ROCKSTEADY')
  })

  test('hides the kicker line entirely when genres is empty', async ({ request, page }) => {
    test.setTimeout(180_000)

    await setGenres(request, '')
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.locator('.ph-kicker')).toHaveCount(0)
  })
})
