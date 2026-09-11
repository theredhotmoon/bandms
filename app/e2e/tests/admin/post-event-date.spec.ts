import { test, expect, expectToast, confirmDelete, searchTable } from '../../fixtures/test-base'
import { readFileSync } from 'node:fs'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Admin half of "news post event date is derived from linked concerts", not
 * typed in by hand. The public half (what a visitor actually sees) lives in
 * e2e/tests/public/post-event-date.spec.ts.
 *
 * Serial: every row this file touches is one it creates itself, and the
 * second test depends on the post the first test created (same reasoning as
 * posts.spec.ts's own describe.serial).
 */
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

/**
 * storageState replays cookies only — an API context built from it is
 * anonymous. Path is relative to the Playwright cwd (app/): these spec files
 * are ESM, so __dirname does not exist.
 */
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed concerts')
  return entry.value
}

async function authedFetch(request: import('@playwright/test').APIRequestContext, method: 'get' | 'post' | 'delete', path: string, data?: unknown) {
  return request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
}

test.describe.serial('Admin Posts — event date from linked concerts', () => {
  const postTitle = `E2E Event Date Post ${Date.now()}`
  let concertAId: number
  let concertBId: number

  test.beforeAll(async ({ request }) => {
    const venues = await (await authedFetch(request, 'get', '/api/venues')).json()
    const venueId = venues.data[0].id

    const a = await authedFetch(request, 'post', '/api/concerts', { venue_id: venueId, date: '2099-01-10' })
    const b = await authedFetch(request, 'post', '/api/concerts', { venue_id: venueId, date: '2099-01-12' })
    concertAId = (await a.json()).data.id
    concertBId = (await b.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    if (concertAId) await authedFetch(request, 'delete', `/api/concerts/${concertAId}`)
    if (concertBId) await authedFetch(request, 'delete', `/api/concerts/${concertBId}`)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/posts')
    await page.waitForLoadState('networkidle')
  })

  test('links a single concert; the display-mode toggle stays hidden', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add post' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await page.locator('input[placeholder="Post title"]').fill(postTitle)

    await page.getByRole('button', { name: /^Concerts/ }).click()
    await page.locator('.checkbox-item').filter({ hasText: '2099-01-10' }).locator('input[type="checkbox"]').check()

    // A single linked concert has only one date — nothing to choose a display
    // mode for.
    await expect(page.getByText('Event date shown as')).not.toBeVisible()

    await page.getByRole('button', { name: 'Create' }).click()
    await expectToast(page, 'Post created')
  })

  test('linking a second concert reveals the range/list toggle, and both persist', async ({ page }) => {
    await searchTable(page, postTitle)
    await page.locator('tbody tr').filter({ hasText: postTitle }).getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    await page.getByRole('button', { name: /^Concerts/ }).click()
    await expect(page.locator('.checkbox-item').filter({ hasText: '2099-01-10' }).locator('input[type="checkbox"]')).toBeChecked()
    await expect(page.locator('.checkbox-item').filter({ hasText: '2099-01-12' }).locator('input[type="checkbox"]')).not.toBeChecked()

    await page.locator('.checkbox-item').filter({ hasText: '2099-01-12' }).locator('input[type="checkbox"]').check()

    await expect(page.getByText('Event date shown as')).toBeVisible()
    await page.getByLabel('List of dates').check()

    await page.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Post updated')

    // Reopen — both concerts and the chosen display mode must have saved.
    await page.locator('tbody tr').filter({ hasText: postTitle }).getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await page.getByRole('button', { name: /^Concerts/ }).click()

    await expect(page.locator('.checkbox-item').filter({ hasText: '2099-01-10' }).locator('input[type="checkbox"]')).toBeChecked()
    await expect(page.locator('.checkbox-item').filter({ hasText: '2099-01-12' }).locator('input[type="checkbox"]')).toBeChecked()
    await expect(page.getByLabel('List of dates')).toBeChecked()
  })

  test('cleans up the test post', async ({ page }) => {
    await searchTable(page, postTitle)
    const row = page.locator('tbody tr').filter({ hasText: postTitle })
    await row.getByRole('button', { name: 'Delete' }).click()
    await confirmDelete(page)
    await expectToast(page, 'Post deleted')
  })
})
