import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
  })

  test('dashboard loads with welcome heading', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Welcome back')
  })

  test('all 6 stat cards are visible', async ({ page }) => {
    await expect(page.getByText('Bands')).toBeVisible()
    await expect(page.getByText('Releases')).toBeVisible()
    await expect(page.getByText('Tours')).toBeVisible()
    await expect(page.getByText('Venues')).toBeVisible()
    await expect(page.getByText('Concerts')).toBeVisible()
    await expect(page.getByText('Tags')).toBeVisible()
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
    const concertAction = page.getByRole('link', { name: '+ Concert' })
    await expect(concertAction).toBeVisible()
  })

  test('"+ Concert" quick action navigates to /admin/concerts', async ({ page }) => {
    const concertAction = page.getByRole('link', { name: '+ Concert' })
    await expect(concertAction).toHaveAttribute('href', '/admin/concerts')
  })
})
