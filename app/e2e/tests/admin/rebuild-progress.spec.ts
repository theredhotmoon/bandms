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

type Status = 'idle' | 'building' | 'done' | 'error'

async function mockStatus(page: Page) {
  const state: { status: Status; startedAt: number | null; finishedAt: number | null } =
    { status: 'idle', startedAt: null, finishedAt: null }
  await page.route('**/api/admin/site/rebuild/status', (route) =>
    route.fulfill({ json: { ...state, autoRebuild: false, pendingAreas: [] } }),
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
