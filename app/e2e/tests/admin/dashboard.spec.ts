import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
  })

  // The assistant widget's numbers are served through page.route: the real
  // inbox fills only from a nightly crawl, which never runs in E2E.
  test('the assistant widget shows new leads and links to the inbox', async ({ page }) => {
    await page.route(/\/api\/admin\/assistant\/summary$/, route => route.fulfill({ json: { data: {
      new: { lead: 4, mention: 2, news: 0 }, last_run_at: '2026-10-31T02:10:00Z', failing_sources: 1,
    } } }))
    await page.goto('/admin')

    const widget = page.getByTestId('assistant-widget')
    await expect(widget.getByTestId('assistant-widget-leads')).toHaveText('4 new leads')
    await expect(widget).toContainText('1 source(s) failing')
    await widget.getByRole('link', { name: /open the inbox/i }).click()
    await expect(page).toHaveURL(/\/admin\/assistant$/)
  })

  test('dashboard loads with welcome heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Welcome back')
  })

  // The strip once borrowed the "Quick actions" label, so landmark
  // navigation announced two regions by that name.
  test('stat strip is its own landmark, not a second "Quick actions"', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: 'Content at a glance' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Quick actions' })).toHaveCount(0)
  })

  test('all 6 stat cards are visible', async ({ page }) => {
    for (const label of ['Bands', 'Releases', 'Tours', 'Venues', 'Concerts', 'Tags']) {
      await expect(page.locator('a.stat-cell').filter({ hasText: label })).toBeVisible()
    }
  })

  test('each stat card links to the correct admin route', async ({ page }) => {
    const statCards = [
      { label: 'Bands', href: '/admin/bands' },
      { label: 'Releases', href: '/admin/releases' },
      { label: 'Tours', href: '/admin/tours' },
      { label: 'Venues', href: '/admin/venues' },
      { label: 'Concerts', href: '/admin/concerts' },
      { label: 'Tags', href: '/admin/tags' },
    ]

    for (const { label, href } of statCards) {
      const link = page.locator('a').filter({ hasText: label }).first()
      await expect(link).toHaveAttribute('href', href)
    }
  })

  test('EPK Versions widget is visible', async ({ page }) => {
    await expect(page.getByText('EPK Versions')).toBeVisible()
  })

  test('"Create snapshot →" link navigates to /admin/band-profile', async ({ page }) => {
    const snapshotLink = page.getByRole('link', { name: /Create snapshot/i })
    await expect(snapshotLink).toBeVisible()
    await expect(snapshotLink).toHaveAttribute('href', '/admin/band-profile')
  })

  test('Career level widget is visible', async ({ page }) => {
    await expect(page.getByText('Band Career Level')).toBeVisible()
  })

  test('Quick actions section is visible with "+ Concert" link', async ({ page }) => {
    const concertAction = page.getByRole('link', { name: '+ Concert', exact: true })
    await expect(concertAction).toBeVisible()
  })

  test('"+ Concert" quick action navigates to /admin/concerts', async ({ page }) => {
    const concertAction = page.getByRole('link', { name: '+ Concert', exact: true })
    await expect(concertAction).toHaveAttribute('href', '/admin/concerts')
  })
})
