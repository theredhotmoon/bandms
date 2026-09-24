import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

// storageState replays cookies only and e2e/.auth/admin.json holds none — an
// API context built from it is anonymous. Lift the token out and send it.
// Throws rather than returning empty: a silent failure here would make the
// afterAll cleanup think there was nothing to delete.
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed a rider')
  return entry.value
}

async function api(
  request: APIRequestContext,
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  data?: unknown,
) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}: ${await res.text()}`)
  return res
}

/**
 * The rider sheet in the admin's chrome language.
 *
 * `RiderSheet.vue` lives in `@bandms/rider-core` and holds no strings: every
 * word arrives through its `labels` prop. `vue-tsc` proves the prop is passed
 * — it is required — but nothing in the build can tell you the *right bundle*
 * is passed, or that the sheet still renders once it is. Wire
 * `riderSheetLabels(DEFAULT_LOCALE)` here instead of the live `uiLang` and
 * every other check in the repo stays green.
 *
 * Asserts on `.cover-title` and `.section-title` rather than on a heading
 * role: those classes are the shared component. A page that regressed to a
 * private copy of the document would still have an <h2> saying the same
 * thing, which is the drift this package exists to prevent.
 *
 * Seeds its own rider. The dev database has no active one — 24 riders, all
 * e2e leftovers, none flagged — so a data-dependent `test.skip` here would
 * never run and would read as coverage while asserting nothing.
 *
 * It opens the preview by explicit id and never sets `is_active`. That flag
 * is a single slot across the whole table and `tech-rider.spec.ts` writes it
 * too, so claiming it here would put this file in the chained-project rule
 * for no gain — the preview resolves an id perfectly well without it.
 */
test.describe('Rider sheet language', () => {
  test.describe.configure({ mode: 'serial' })

  const NAME = `e2e-sheet-lang-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  let riderId: number | null = null

  test.beforeAll(async ({ request }) => {
    const res = await api(request, 'post', '/api/tech-riders', { name: NAME })
    riderId = (await res.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    if (riderId) await api(request, 'delete', `/api/tech-riders/${riderId}`)
  })

  test('the preview follows the chrome language', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.getByTestId('ui-lang-switcher').selectOption('en')
    await expect(page.locator('nav.sidebar-nav')).toContainText('Dashboard')

    await page.goto(`/tech-rider/${riderId}`)
    await expect(page.locator('.cover-title')).toHaveText('Technical Rider', { timeout: 15000 })
    await expect(page.locator('.cover-rider-name')).toContainText(NAME)

    // The switcher is admin chrome and the preview is a bare route without it,
    // so the language is changed where it lives and the preview reopened.
    await page.goto('/admin')
    await page.getByTestId('ui-lang-switcher').selectOption('pl')
    await expect(page.locator('nav.sidebar-nav')).toContainText('Pulpit')

    await page.goto(`/tech-rider/${riderId}`)
    await expect(page.locator('.cover-title')).toHaveText('Rider techniczny', { timeout: 15000 })
    // The cover alone would pass with only the first few keys wired up, so
    // check the meta labels further down the same page too.
    await expect(page.locator('.cover-meta')).toContainText('Muzycy')
    await expect(page.locator('.cover-meta')).not.toContainText('Musicians')
  })

  test.afterEach(async ({ page }) => {
    // Scoped to this context — test.use() never writes back to the shared auth
    // state — but left set it would leak into any spec sharing the page.
    await page.goto('/admin')
    await page.evaluate(() => localStorage.removeItem('admin_ui_lang'))
  })
})
