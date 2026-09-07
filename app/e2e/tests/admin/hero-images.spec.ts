import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'

test.use({ storageState: 'e2e/.auth/admin.json' })

// Relative to the Playwright cwd (app/), the same way test.use() names it above.
// __dirname is unavailable — these specs are ESM.
const AUTH_FILE = 'e2e/.auth/admin.json'

/**
 * The bearer token, read out of the stored auth state.
 *
 * `request.newContext({ storageState })` replays **cookies only**, and this app
 * keeps its token in localStorage — so an API context built that way is
 * anonymous, every call 401s, and a restore that does not check its response
 * silently does nothing. Pulling the token out and sending it explicitly is what
 * makes the cleanup below actually run.
 */
function adminToken(): string {
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}

/**
 * These tests write real hero images into the shared dev database, and the
 * public site bakes whatever is there at container start — so a run that does
 * not clean up leaves a probe picture behind the title of every page. The main
 * scope is captured before and restored after, the same way
 * website-modules.spec.ts restores the contact kicker.
 */
test.describe('Hero Images Admin', () => {
  test.describe.configure({ mode: 'serial' })

  /** photo_ids of the main scope as we found it, restored in afterAll. */
  let originalMainIds: number[] | null = null

  /** Request options shared by the capture and the restore. */
  const apiOptions = (baseURL: string | undefined) => ({
    baseURL,
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: `Bearer ${adminToken()}`,
    },
  })

  /**
   * Throws rather than returning [] on a failed read.
   *
   * A silent empty result would be recorded as "main was empty" and the restore
   * would then *clear* a set the band had configured — a cleanup step that
   * destroys the thing it exists to protect.
   */
  async function readMainIds(request: APIRequestContext): Promise<number[]> {
    const res = await request.get('/api/admin/hero-images')
    if (!res.ok()) {
      throw new Error(`Could not read hero images (${res.status()}) — refusing to guess the original state`)
    }
    const body = await res.json()
    return (body.data?.main ?? []).map((h: { photo_id: number }) => h.photo_id)
  }

  test.beforeAll(async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext(apiOptions(baseURL))
    originalMainIds = await readMainIds(request)
    await request.dispose()
  })

  test.afterAll(async ({ playwright, baseURL }) => {
    if (originalMainIds === null) return
    const request = await playwright.request.newContext(apiOptions(baseURL))
    const res = await request.put('/api/admin/hero-images/main', {
      data: { photo_ids: originalMainIds },
    })
    // Assert the restore landed. A 401 here used to pass unnoticed and leave the
    // probe picture behind the title of every public page.
    expect(res.ok(), `restore failed with ${res.status()}`).toBeTruthy()
    await request.dispose()
  })

  test('page loads and lists every scope', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Hero Images' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Main/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Homepage/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Contact/ })).toBeVisible()
  })

  test('a page with no set of its own reports that it inherits Main', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    // Contact has no set in a clean dev database, so its row carries the
    // inheritance note rather than a count.
    await expect(page.getByRole('button', { name: /^Contact/ })).toContainText('inherits Main')
  })

  test('omits modules whose page renders no hero', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    // tech-rider has a route and a slug, so it is not a NON_PAGE_MODULE — but
    // its page is the token-gated rider document and shows no backdrop. Offering
    // a picture there would be a control that changes nothing.
    await expect(page.getByRole('button', { name: /^Tech Rider/ })).toHaveCount(0)
    // footer is chrome, not a page, and is excluded by NON_PAGE_MODULES.
    await expect(page.getByRole('button', { name: /^Footer/ })).toHaveCount(0)
  })

  test('Save stays disabled until something changes', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  test('adds a picture to the main set and keeps it across a reload', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Add from gallery' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    const choices = page.locator('.modal-panel li button:not([disabled])')
    const available = await choices.count()

    // Data-dependent by design: the gallery is empty in a freshly seeded dev
    // database, and inventing a photo here would leave a file behind that the
    // API cleanup above cannot remove.
    test.skip(available === 0, 'no gallery photos to choose from')

    await choices.first().click()
    await page.locator('button[aria-label="Close"]').click()
    await expect(page.locator('.modal-overlay')).not.toBeVisible()

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Hero images saved' }))
      .toBeVisible({ timeout: 8000 })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /^Main/ })).toContainText('picture')
  })
})
