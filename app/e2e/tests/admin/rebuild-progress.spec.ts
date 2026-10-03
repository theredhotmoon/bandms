import { test, expect, type Page } from '@playwright/test'

/**
 * The progress line on the admin's rebuild bar.
 *
 * #99 moved Rebuild into the admin-wide bar and dropped the old progress bar
 * with it, so a rebuild's progress was invisible. The status endpoint is
 * mocked: a real rebuild takes a minute and restarts the public site under
 * every other public spec.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

type Status = 'idle' | 'building' | 'done' | 'error' | 'unknown'

/** `skewMs` is how far the server's clock runs behind the browser's. */
async function mockStatus(page: Page, skewMs = 0) {
  const state: { status: Status; startedAt: number | null; finishedAt: number | null } =
    { status: 'idle', startedAt: null, finishedAt: null }
  await page.route('**/api/admin/site/rebuild/status', (route) =>
    route.fulfill({ json: { ...state, serverNow: Date.now() - skewMs, autoRebuild: false, pendingAreas: [] } }),
  )
  return state
}

test('the line grows while building, fills green when done, then goes away', async ({ page }) => {
  const state = await mockStatus(page)
  state.status = 'building'
  state.startedAt = Date.now() - 30_000 // half of the expected minute

  await page.goto('/admin')
  const line = page.getByTestId('rebuild-progress')
  await expect(line).toBeVisible()
  await expect(line).toHaveClass(/rebuild-progress--building/)
  const percent = Number(await line.getAttribute('aria-valuenow'))
  expect(percent).toBeGreaterThan(30)
  expect(percent).toBeLessThan(90)

  state.status = 'done'
  state.finishedAt = Date.now()
  // The bar polls every 2 s while a build runs.
  await expect(line).toHaveClass(/rebuild-progress--done/, { timeout: 6000 })
  await expect(line).toHaveAttribute('aria-valuenow', '100')
  await expect(line).toBeHidden({ timeout: 8000 })
})

test('a failed build turns the line red', async ({ page }) => {
  const state = await mockStatus(page)
  state.status = 'building'
  state.startedAt = Date.now()

  await page.goto('/admin')
  await expect(page.getByTestId('rebuild-progress')).toBeVisible()

  state.status = 'error'
  state.finishedAt = Date.now()
  await expect(page.getByTestId('rebuild-progress')).toHaveClass(/rebuild-progress--error/, { timeout: 6000 })
})

test('no line when nothing is building, and no old result on a fresh page', async ({ page }) => {
  const state = await mockStatus(page)
  state.status = 'done'
  state.startedAt = Date.now() - 60_000
  state.finishedAt = Date.now() - 1000

  await page.goto('/admin')
  await expect(page.locator('.rebuild-bar')).toBeVisible()
  await expect(page.getByTestId('rebuild-progress')).toHaveCount(0)
})

test('one unknown poll mid-build does not lose the result', async ({ page }) => {
  // 'unknown' is the API failing to reach the webhook — a blip, not an end.
  const state = await mockStatus(page)
  state.status = 'building'
  state.startedAt = Date.now() - 20_000

  await page.goto('/admin')
  const line = page.getByTestId('rebuild-progress')
  await expect(line).toBeVisible()

  const before = Number(await line.getAttribute('aria-valuenow'))
  // An 'unknown' poll carries no timestamps; the line must not restart.
  state.status = 'unknown'
  state.startedAt = null
  await page.waitForTimeout(2500) // at least one poll answers 'unknown'
  await expect(line).toBeVisible()
  expect(Number(await line.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(before)

  state.status = 'done'
  state.finishedAt = Date.now()
  await expect(line).toHaveClass(/rebuild-progress--done/, { timeout: 8000 })
})

test('a skewed browser clock does not skew the estimate', async ({ page }) => {
  // The server runs two minutes behind; the build started 30 s ago by its clock.
  const skew = 120_000
  const state = await mockStatus(page, skew)
  state.status = 'building'
  state.startedAt = Date.now() - skew - 30_000

  await page.goto('/admin')
  const line = page.getByTestId('rebuild-progress')
  await expect(line).toBeVisible()
  // Half of the expected minute: ~45%. Uncorrected it would read 150 s → 95%+.
  const percent = Number(await line.getAttribute('aria-valuenow'))
  expect(percent).toBeGreaterThan(30)
  expect(percent).toBeLessThan(70)
})
