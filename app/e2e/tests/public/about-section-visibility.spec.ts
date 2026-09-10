import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * Website Modules → About → Section visibility toggles ("Band in numbers",
 * "Band members"). Proves the admin toggle actually controls what the public
 * About page renders — not just that the field round-trips through the
 * admin, which app/e2e/tests/admin/website-modules.spec.ts already covers
 * without a save (see that file's note on why it stays read-only here).
 *
 * Only mutates `website_modules.visibility` for the 'about' slug — never
 * band_profiles, so this can't collide with about-bio-variant.spec.ts or
 * genre-kicker.spec.ts, which mutate that singleton instead. Runs serial and
 * restores what it touches, same as those two.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed website modules')
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

async function setAboutVisibility(request: APIRequestContext, visibility: Record<string, boolean>) {
  await api(request, 'put', '/api/admin/modules/about', { visibility })
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

test.describe.serial('Public — About page section visibility', () => {
  failOnPageError()

  let original: Record<string, boolean> = {}

  test.beforeAll(async ({ request }) => {
    test.setTimeout(30_000)
    const res = await api(request, 'get', '/api/admin/modules')
    const modules = (await res.json()).data as { slug: string; visibility?: Record<string, boolean> }[]
    original = modules.find((m) => m.slug === 'about')?.visibility ?? {}
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(180_000)
    await setAboutVisibility(request, {
      show_stats: original.show_stats ?? true,
      show_members: original.show_members ?? true,
    })
    await rebuildAndWait(request, Date.now())
  })

  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await pageIsUp(request, '/en/about')),
      `${WEB}/en/about unavailable — site down, or the about module is off`,
    )
  })

  test('hides the stats section when show_stats is off, regardless of stats data', async ({ request, page }) => {
    test.setTimeout(180_000)

    await setAboutVisibility(request, { show_stats: false })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.locator('.ab-stats')).toHaveCount(0)
  })

  test('hides the members section — heading included — when show_members is off', async ({ request, page }) => {
    test.setTimeout(180_000)

    await setAboutVisibility(request, { show_members: false })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.getByRole('heading', { name: /line-up/i })).toHaveCount(0)
  })

  test('restores the members section — heading included — when show_members is on', async ({ request, page }) => {
    test.setTimeout(180_000)

    await setAboutVisibility(request, { show_members: true })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.getByRole('heading', { name: /line-up/i })).toBeVisible()
  })
})
