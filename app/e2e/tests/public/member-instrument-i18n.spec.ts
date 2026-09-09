import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * Regression coverage for the bug this PR fixes: `getMembers()` in
 * web/src/lib/cms.ts never passed `?lang=`, so every locale's About page
 * showed a member's instrument name in whichever language the backend
 * defaulted to — regardless of the page's own locale. This seeds an
 * instrument with distinct EN/PL names, attaches it to a throwaway member,
 * and checks the two locale pages render two different strings.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

// storageState replays cookies only, and e2e/.auth/admin.json holds none — an
// API context built from it is anonymous. The token has to be lifted out and
// sent explicitly. Path is relative to the Playwright cwd (app/): these spec
// files are ESM, so __dirname does not exist.
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed')
  return entry.value
}

async function api(request: APIRequestContext, method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}`)
  return res
}

/**
 * `web` bakes the site once at container start; content created via the API
 * never appears until something rebuilds it. Triggers the same rebuild the
 * admin's manual button uses and polls its status rather than sleeping a
 * fixed duration.
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

test.describe.serial('Public About — member instrument name locale', () => {
  failOnPageError()

  const stamp = Date.now()
  const enName = `E2E Instrument EN ${stamp}`
  const plName = `E2E Instrument PL ${stamp}`
  let instrumentId: number
  let memberId: number

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000)

    const instrumentRes = await api(request, 'post', '/api/instruments', {
      name: { en: enName, pl: plName },
    })
    instrumentId = (await instrumentRes.json()).data.id

    const memberRes = await api(request, 'post', '/api/band-profile/members', {
      first_name: 'E2E',
      last_name:  `Member ${stamp}`,
      is_current: true,
      sort_order: 999,
      instrument_ids:     [instrumentId],
      main_instrument_id: instrumentId,
    })
    memberId = (await memberRes.json()).data.id

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    if (memberId) await api(request, 'delete', `/api/band-profile/members/${memberId}`)
    if (instrumentId) await api(request, 'delete', `/api/instruments/${instrumentId}`)
  })

  test('renders the English instrument name on the English page', async ({ page }) => {
    await page.goto(`${WEB}/en/about`)

    const card = page.locator('.mg-card').filter({ hasText: `Member ${stamp}` })
    await expect(card.locator('.mg-chip')).toContainText(enName)
  })

  test('renders the Polish instrument name on the Polish page', async ({ page }) => {
    await page.goto(`${WEB}/pl/o-nas`)

    const card = page.locator('.mg-card').filter({ hasText: `Member ${stamp}` })
    await expect(card.locator('.mg-chip')).toContainText(plName)
  })
})
