import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * Website Modules → Shows → page copy. Proves that a section heading saved in
 * the admin — not just the hero title — reaches the public page in each
 * locale, and that clearing it brings the registry default back. The admin
 * half (the grouped form, placeholders, round-trip) is
 * app/e2e/tests/admin/website-modules.spec.ts; this is the half the band
 * actually cares about.
 *
 * Only mutates `website_modules.settings` for the 'concerts' slug, one key,
 * and restores it. Runs serial, like the other public specs that rebuild.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

const STAMP = `${Date.now()}`
const EN = `E2E UPCOMING ${STAMP}`
const PL = `E2E NADCHODZĄCE ${STAMP}`

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

async function setUpcomingTitle(request: APIRequestContext, value: { en: string | null; pl: string | null }) {
  await api(request, 'put', '/api/admin/modules/concerts', { settings: { upcomingTitle: value } })
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

/** The Shows page path per locale, from the slug the site actually serves. */
async function showsPath(request: APIRequestContext, lang: 'en' | 'pl') {
  const res = await request.get(`${API}/api/site-config?lang=${lang}`, { headers: { Accept: 'application/json' } })
  const cfg = await res.json()
  return `/${lang}/${cfg.module_config?.concerts?.slug ?? 'concerts'}`
}

async function pageIsUp(request: APIRequestContext, path: string) {
  try {
    return (await request.get(`${WEB}${path}`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe.serial('Public — section copy from Website Modules', () => {
  failOnPageError()

  let original: { en: string | null; pl: string | null } = { en: null, pl: null }

  test.beforeAll(async ({ request }) => {
    test.setTimeout(30_000)
    const res = await api(request, 'get', '/api/admin/modules')
    const modules = (await res.json()).data as { slug: string; settings?: Record<string, { en?: string; pl?: string }> }[]
    const saved = modules.find(m => m.slug === 'concerts')?.settings?.upcomingTitle
    original = { en: saved?.en ?? null, pl: saved?.pl ?? null }
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(180_000)
    await setUpcomingTitle(request, original)
    await rebuildAndWait(request, Date.now())
  })

  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await pageIsUp(request, await showsPath(request, 'en'))),
      `${WEB} shows page unavailable — site down, or the concerts module is off`,
    )
  })

  test('a saved section heading renders on the public page in each locale', async ({ request, page }) => {
    test.setTimeout(180_000)

    await setUpcomingTitle(request, { en: EN, pl: PL })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}${await showsPath(request, 'en')}`)
    // The shared section heading, not any h2 — a page regressing to a
    // hardcoded string would still have an h2 with the default text.
    await expect(page.locator('.upcoming-sec .sec-title')).toHaveText(EN)

    await page.goto(`${WEB}${await showsPath(request, 'pl')}`)
    await expect(page.locator('.upcoming-sec .sec-title')).toHaveText(PL)
  })

  test('clearing the field brings the registry default back', async ({ request, page }) => {
    test.setTimeout(180_000)

    await setUpcomingTitle(request, { en: null, pl: null })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}${await showsPath(request, 'en')}`)
    await expect(page.locator('.upcoming-sec .sec-title')).toHaveText('Upcoming shows')

    await page.goto(`${WEB}${await showsPath(request, 'pl')}`)
    await expect(page.locator('.upcoming-sec .sec-title')).toHaveText('Nadchodzące koncerty')
  })
})
