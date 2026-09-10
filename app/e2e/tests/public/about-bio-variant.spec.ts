import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The About page's bio block used to hardcode bio_medium → bio_long →
 * bio_short as the public fallback chain. It now reads the admin's choice
 * from Band Profile → Bio → "Shown on public About page"
 * (`about_bio_variant`), so this proves the selected variant is what
 * actually renders — not just that the field round-trips through the admin.
 *
 * Mutates the band-profile singleton like genre-kicker.spec.ts, so it runs
 * serial and restores every field it touches.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

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

test.describe.serial('Public — About page bio variant', () => {
  failOnPageError()

  let original: {
    bio_short: string | null
    bio_medium: string | null
    bio_long: string | null
    bio_full: string | null
    about_bio_variant: string
  } | null = null

  test.beforeAll(async ({ request }) => {
    test.setTimeout(30_000)
    const res = await api(request, 'get', '/api/band-profile')
    const data = (await res.json()).data
    original = {
      bio_short: data.bio_short,
      bio_medium: data.bio_medium,
      bio_long: data.bio_long,
      bio_full: data.bio_full,
      about_bio_variant: data.about_bio_variant,
    }
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(180_000)
    if (!original) return
    await api(request, 'put', '/api/band-profile', original)
    await rebuildAndWait(request, Date.now())
  })

  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await pageIsUp(request, '/en/about')),
      `${WEB}/en/about unavailable — site down, or the about module is off`,
    )
  })

  test('renders the bio_full text when about_bio_variant is "full"', async ({ request, page }) => {
    test.setTimeout(180_000)

    const marker = `E2E FULL BIO ${Date.now()}`
    await api(request, 'put', '/api/band-profile', {
      bio_full: marker,
      about_bio_variant: 'full',
    })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.locator('.ab-bio').first()).toHaveText(marker)
  })

  test('falls back to another length when the selected variant is empty', async ({ request, page }) => {
    test.setTimeout(180_000)

    const marker = `E2E SHORT BIO ${Date.now()}`
    // The chain is bio_medium → bio_long → bio_short → bio_full once the
    // selected variant (full) is empty — null the other three so it can only
    // land on bio_short, not on whatever this instance happened to have.
    await api(request, 'put', '/api/band-profile', {
      bio_medium: null,
      bio_long: null,
      bio_short: marker,
      bio_full: null,
      about_bio_variant: 'full',
    })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.locator('.ab-bio').first()).toHaveText(marker)
  })
})
