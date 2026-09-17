import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'

test.use({ storageState: 'e2e/.auth/admin.json' })

const AUTH_FILE = 'e2e/.auth/admin.json'

/** See hero-images.spec.ts — storageState replays cookies only, and the token lives in localStorage. */
function adminToken(): string {
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}

interface Version { id: number; version_number: number; status: 'pending' | 'published' | 'archived'; release_reason: string | null }

const REASON_PREFIX = 'E2E history'

/**
 * Publishing is a real state change on the shared dev database: whichever
 * version was live before the run is put back afterwards, and every version
 * this spec created is deleted. One thing cannot be undone — if *no* version
 * was live beforehand, the spec necessarily leaves one live, because a
 * published version can never be deleted (that is the rule under test).
 */
test.describe('EPK version history', () => {
  test.describe.configure({ mode: 'serial' })

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const reasonA = `${REASON_PREFIX} A ${stamp}`
  const reasonB = `${REASON_PREFIX} B ${stamp}`

  let originalLiveId: number | null = null
  let idA = 0
  let idB = 0
  let numberA = 0

  const apiOptions = (baseURL: string | undefined) => ({
    baseURL,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${adminToken()}` },
  })

  async function list(request: APIRequestContext): Promise<Version[]> {
    const res = await request.get('/api/epk-versions')
    if (!res.ok()) throw new Error(`Could not list EPK versions (${res.status()}) — refusing to guess the original state`)
    return (await res.json()).data
  }

  async function createAndPublish(request: APIRequestContext, reason: string): Promise<number> {
    const created = await request.post('/api/epk-versions', { data: { release_reason: reason } })
    expect(created.status(), await created.text()).toBe(201)
    const id: number = (await created.json()).data.id
    const published = await request.post(`/api/epk-versions/${id}/publish`)
    expect(published.status(), await published.text()).toBe(200)
    return id
  }

  test.beforeAll(async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext(apiOptions(baseURL))
    const before = await list(request)

    // A pending draft blocks store(). Ours from an aborted run can go; anyone else's must not.
    const pending = before.find((v) => v.status === 'pending')
    if (pending) {
      if (!pending.release_reason?.startsWith(REASON_PREFIX)) {
        throw new Error(`A pending EPK version (v${pending.version_number}) exists — publish or discard it before running this spec`)
      }
      await request.delete(`/api/epk-versions/${pending.id}`)
    }

    originalLiveId = before.find((v) => v.status === 'published')?.id ?? null

    idA = await createAndPublish(request, reasonA)
    idB = await createAndPublish(request, reasonB)
    numberA = (await list(request)).find((v) => v.id === idA)!.version_number
    await request.dispose()
  })

  test.afterAll(async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext(apiOptions(baseURL))
    if (originalLiveId !== null) {
      const res = await request.post(`/api/epk-versions/${originalLiveId}/publish`)
      expect(res.status(), `restore of v#${originalLiveId} failed: ${await res.text()}`).toBe(200)
    }
    for (const v of await list(request)) {
      if (v.release_reason?.startsWith(REASON_PREFIX) && v.status !== 'published') {
        await request.delete(`/api/epk-versions/${v.id}`)
      }
    }
    await request.dispose()
  })

  test('lists every version, restores an archived one and deletes the one it replaced', async ({ page }) => {
    await page.goto('/admin')
    await page.getByRole('button', { name: 'All versions' }).click()

    const modal = page.locator('.modal-panel').filter({ hasText: 'EPK version history' })
    await expect(modal).toBeVisible()

    const rowA = modal.getByTestId('epk-version-row').filter({ hasText: reasonA })
    const rowB = modal.getByTestId('epk-version-row').filter({ hasText: reasonB })

    await expect(rowB.getByTestId('epk-version-status')).toHaveText('Live')
    await expect(rowA.getByTestId('epk-version-status')).toHaveText('Archived')

    // Restore A: the badge moves and B becomes deletable.
    await rowA.getByRole('button', { name: 'Make live' }).click()
    await expect(rowA.getByTestId('epk-version-status')).toHaveText('Live')
    await expect(rowB.getByTestId('epk-version-status')).toHaveText('Archived')
    await expect(rowA.getByRole('button', { name: 'Delete' })).toHaveCount(0)

    await rowB.getByRole('button', { name: 'Delete' }).click()
    await rowB.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await expect(rowB).toHaveCount(0)
    await expect(rowA).toBeVisible()
  })

  test('the widget on the dashboard reports the restored version as live', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByText(`Live: v${numberA}`)).toBeVisible()
  })

  test('Band Profile → EPK opens the same history', async ({ page }) => {
    await page.goto('/admin/band-profile')
    await page.getByRole('tab', { name: 'EPK' }).click()
    await page.getByRole('button', { name: 'Version history' }).click()
    const modal = page.locator('.modal-panel').filter({ hasText: 'EPK version history' })
    await expect(modal.getByTestId('epk-version-row').filter({ hasText: reasonA })).toBeVisible()
  })
})
