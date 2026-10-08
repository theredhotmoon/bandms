import { test, expect, type APIRequestContext } from '@playwright/test'
import { adminToken, TEST_PNG } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * These tests upload real pictures into the shared dev database's `main`
 * scope, and the public site bakes whatever is there at container start — so
 * a run that does not clean up leaves a probe picture behind the title of
 * every page. Unlike the old whole-scope PUT, there is no single "restore"
 * call any more: each per-row endpoint only touches the row it names. So
 * instead of restoring a snapshot, the ids present before the run are
 * captured, and anything introduced beyond them is deleted individually.
 */
test.describe('Hero Images Admin', () => {
  test.describe.configure({ mode: 'serial' })

  let originalMainIds: number[] | null = null

  const apiOptions = (baseURL: string | undefined) => ({
    baseURL,
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: `Bearer ${adminToken()}`,
    },
  })

  /** Throws rather than returning [] on a failed read — see readMainIds below. */
  async function readMainIds(request: APIRequestContext): Promise<number[]> {
    const res = await request.get('/api/admin/hero-images')
    if (!res.ok()) {
      throw new Error(`Could not read hero images (${res.status()}) — refusing to guess the original state`)
    }
    const body = await res.json()
    return (body.data?.main ?? []).map((h: { id: number }) => h.id)
  }

  test.beforeAll(async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext(apiOptions(baseURL))
    originalMainIds = await readMainIds(request)
    await request.dispose()
  })

  test.afterAll(async ({ playwright, baseURL }) => {
    if (originalMainIds === null) return
    const request = await playwright.request.newContext(apiOptions(baseURL))
    const currentIds = await readMainIds(request)
    const introduced = currentIds.filter((id) => !originalMainIds!.includes(id))
    for (const id of introduced) {
      const res = await request.delete(`/api/admin/hero-images/${id}`)
      expect(res.ok(), `cleanup delete failed with ${res.status()}`).toBeTruthy()
    }
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
    // its page is the token-gated rider document and shows no backdrop.
    await expect(page.getByRole('button', { name: /^Tech Rider/ })).toHaveCount(0)
    // footer is chrome, not a page, and is excluded by NON_PAGE_MODULES.
    await expect(page.getByRole('button', { name: /^Footer/ })).toHaveCount(0)
  })

  test('uploads a picture directly and it persists across a reload', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-hero.png',
      mimeType: 'image/png',
      buffer: TEST_PNG,
    })

    await expect(page.locator('img[alt=""]').last()).toBeVisible({ timeout: 8000 })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /^Main/ })).toContainText('picture')
  })

  test('edits a caption and it persists across a reload', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    const captionInput = page.locator('input[placeholder="Caption (optional)"]').last()
    await captionInput.fill('E2E caption')

    await Promise.all([
      page.waitForResponse(res => /\/api\/admin\/hero-images\/\d+$/.test(res.url()) && res.request().method() === 'PATCH'),
      captionInput.blur(),
    ])

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.locator('input[placeholder="Caption (optional)"]').last()).toHaveValue('E2E caption')
  })

  test('reorders pictures with the arrow buttons and it persists across a reload', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    // Upload a second picture so there's something to reorder against the
    // first test's probe.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-hero-2.png',
      mimeType: 'image/png',
      buffer: TEST_PNG,
    })
    await page.waitForLoadState('networkidle')

    const thumbnails = page.locator('li.rounded-lg.overflow-hidden')
    await expect(thumbnails).toHaveCount(2)

    // Capture identifying info (image src) for both thumbnails in their
    // current order.
    const firstSrcBefore = await thumbnails.nth(0).locator('img').getAttribute('src')
    const secondSrcBefore = await thumbnails.nth(1).locator('img').getAttribute('src')

    // Move the first thumbnail later — it should swap with the second.
    const moveLaterButtons = page.getByRole('button', { name: 'Move later' })
    await Promise.all([
      page.waitForResponse(res => /\/api\/admin\/hero-images\/[a-z-]+\/order$/.test(res.url()) && res.request().method() === 'PUT'),
      moveLaterButtons.first().click(),
    ])

    const firstSrcAfter = await thumbnails.nth(0).locator('img').getAttribute('src')
    const secondSrcAfter = await thumbnails.nth(1).locator('img').getAttribute('src')
    expect(firstSrcAfter).toBe(secondSrcBefore)
    expect(secondSrcAfter).toBe(firstSrcBefore)

    await page.reload()
    await page.waitForLoadState('networkidle')

    const firstSrcReloaded = await page.locator('li.rounded-lg.overflow-hidden').nth(0).locator('img').getAttribute('src')
    expect(firstSrcReloaded).toBe(firstSrcAfter)
  })

  test('toggling active off dims the thumbnail and updates the summary', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    const before = (await page.getByRole('button', { name: /^Main/ }).textContent()) ?? ''
    const dimmedBefore = await page.locator('li.opacity-40').count()

    // .last(), not .first(): this test's own probe (uploaded in the previous
    // test) always lands at the highest position — the same reasoning the
    // Remove test below already applies. .first() risks toggling a
    // pre-existing real picture on the shared dev database.
    const checkbox = page.locator('label:has-text("Active") input[type="checkbox"]').last()

    await Promise.all([
      page.waitForResponse(res => /\/api\/admin\/hero-images\/\d+$/.test(res.url()) && res.request().method() === 'PATCH'),
      checkbox.uncheck(),
    ])

    await expect(page.locator('li.opacity-40')).toHaveCount(dimmedBefore + 1)

    await page.reload()
    await page.waitForLoadState('networkidle')
    const after = (await page.getByRole('button', { name: /^Main/ }).textContent()) ?? ''
    expect(after).not.toBe(before)

    // Restore it active, so the next test (and the introduced-id cleanup
    // above, which only deletes — it does not know how to re-toggle) leaves
    // main in the state other specs expect. Wait for the response and assert
    // it landed, rather than firing-and-forgetting the restore.
    const restoreCheckbox = page.locator('label:has-text("Active") input[type="checkbox"]').last()
    const [restoreRes] = await Promise.all([
      page.waitForResponse(res => /\/api\/admin\/hero-images\/\d+$/.test(res.url()) && res.request().method() === 'PATCH'),
      restoreCheckbox.check(),
    ])
    expect(restoreRes.ok(), `restore of active state failed with ${restoreRes.status()}`).toBeTruthy()

    await expect(page.locator('li.opacity-40')).toHaveCount(dimmedBefore)
  })

  // .last(): this spec's own probe picture, never a real one on the shared DB.
  // The probe is deleted by the cleanup above, so the weight needs no restore.
  test('sets a display weight and it persists across a reload', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    const weight = page.getByTestId('hero-weight').last()
    await expect(weight).toHaveValue('100')

    const [res] = await Promise.all([
      page.waitForResponse(r => /\/api\/admin\/hero-images\/\d+$/.test(r.url()) && r.request().method() === 'PATCH'),
      weight.selectOption('25'),
    ])
    expect(res.ok()).toBeTruthy()
    expect(JSON.parse(res.request().postData() ?? '{}')).toEqual({ weight: 25 })

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('hero-weight').last()).toHaveValue('25')

    // Back to Normal is stored as null, not 100.
    const [reset] = await Promise.all([
      page.waitForResponse(r => /\/api\/admin\/hero-images\/\d+$/.test(r.url()) && r.request().method() === 'PATCH'),
      page.getByTestId('hero-weight').last().selectOption('100'),
    ])
    expect(JSON.parse(reset.request().postData() ?? '{}')).toEqual({ weight: null })
  })

  test('removes a picture', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    const countBefore = await page.locator('li.rounded-lg.overflow-hidden').count()
    // .last(), not .first(): a new upload always lands at the highest position
    // (last in DOM order), so this is guaranteed to remove this test's own
    // probe picture — never a pre-existing real one that might already be in
    // the Main scope on the shared dev database.
    await page.getByRole('button', { name: 'Remove' }).last().click()

    await expect(page.locator('li.rounded-lg.overflow-hidden')).toHaveCount(countBefore - 1)
  })
})
