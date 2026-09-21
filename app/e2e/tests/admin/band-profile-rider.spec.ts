import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

/**
 * Split out of band-profile.spec.ts (the "tech rider selector" describe under
 * the EPK tab) because this file and public/epk-modal.spec.ts both write
 * band_profiles.epk_tech_rider_id on the single shared row, and the public
 * spec waits on a site rebuild in between — the two cannot share the parallel
 * `chromium` pool with each other, or they stomp each other's write. Both run
 * serially in the chained `rider-link-admin` → `rider-link-public` projects
 * (app/playwright.config.ts) instead.
 */

test.use({ storageState: 'e2e/.auth/admin.json' })

const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

// storageState replays cookies only and e2e/.auth/admin.json holds none — an
// API context built from it is anonymous. Lift the token out and send it.
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed riders')
  return entry.value
}

async function api(request: APIRequestContext, method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}: ${await res.text()}`)
  return res
}

test.describe('Band Profile Admin — EPK tech rider selector', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/band-profile')
    await page.waitForLoadState('networkidle')
    await page.getByRole('tab', { name: 'EPK' }).click()
  })

  // The selector offers only riders that have a published version — a
  // never-published rider's public page 404s, and the API refuses it.
  test.describe('tech rider selector', () => {
    const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const PUBLISHED_NAME = `E2E published rider ${STAMP}`
    const DRAFT_NAME = `E2E draft rider ${STAMP}`
    let publishedId = 0
    let draftId = 0
    let originalRiderId: number | null = null

    test.beforeAll(async ({ request }) => {
      const profile = await (await api(request, 'get', '/api/band-profile')).json()
      originalRiderId = profile.data.epk_tech_rider_id ?? null

      publishedId = (await (await api(request, 'post', '/api/tech-riders', { name: PUBLISHED_NAME, is_active: false })).json()).data.id
      await api(request, 'post', `/api/tech-riders/${publishedId}/versions`, { notes: 'E2E' })
      draftId = (await (await api(request, 'post', '/api/tech-riders', { name: DRAFT_NAME, is_active: false })).json()).data.id
    })

    test.afterAll(async ({ request }) => {
      // beforeAll never got past its GET — nothing was seeded, and
      // originalRiderId is not trustworthy.
      if (!publishedId) return

      // Restore first, then delete: the FK is nullOnDelete, so deleting a
      // rider the profile still points at would silently clear the link.
      const restore = await api(request, 'put', '/api/band-profile', { epk_tech_rider_id: originalRiderId })
      expect(restore.ok()).toBe(true)
      await api(request, 'delete', `/api/tech-riders/${publishedId}`)
      await api(request, 'delete', `/api/tech-riders/${draftId}`)
    })

    test('offers published riders and not drafts', async ({ page }) => {
      const select = page.getByTestId('epk-tech-rider')
      await expect(select.locator('option', { hasText: PUBLISHED_NAME })).toHaveCount(1)
      await expect(select.locator('option', { hasText: DRAFT_NAME })).toHaveCount(0)
    })

    test('selecting a rider persists across reload and links its token', async ({ page, request }) => {
      await page.getByTestId('epk-tech-rider').selectOption(String(publishedId))
      await page.locator('form button[type="submit"]').click()
      await expect(page.getByText('Profile saved')).toBeVisible()

      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.getByRole('tab', { name: 'EPK' }).click()
      await expect(page.getByTestId('epk-tech-rider')).toHaveValue(String(publishedId))

      const profile = await (await api(request, 'get', '/api/band-profile')).json()
      expect(profile.data.tech_rider_url).toMatch(/^\/rider\/[A-Za-z0-9]{32}$/)
    })
  })
})
