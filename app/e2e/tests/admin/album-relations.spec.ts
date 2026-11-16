import { test, expect } from '@playwright/test'
import { adminHeaders, TEST_PNG } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * "Link to… → Photo albums" on a release: tick an album, save, and the link
 * is what the API stores and what the form shows when reopened. An album the
 * public site does not show (here: unpublished) carries a "not on site"
 * badge, so nobody wonders why its link never appears.
 *
 * Seeds its own release and album through the API and deletes both.
 */
test.describe('Admin — linking photo albums', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const releaseTitle = `E2E Album Link Release ${stamp}`
  const albumTitle = `E2E Link Album ${stamp}`
  let releaseId: number | undefined
  let albumId: number | undefined

  test.beforeAll(async ({ request }) => {
    const album = await request.post('/api/albums/batch', {
      headers: adminHeaders(),
      timeout: 90_000,
      // No published_at: a draft, which the panel must badge.
      multipart: { title: albumTitle, 'files[]': { name: 'a.png', mimeType: 'image/png', buffer: TEST_PNG } },
    })
    expect(album.status(), await album.text()).toBe(201)
    albumId = (await album.json()).data.id

    const release = await request.post('/api/releases', {
      headers: adminHeaders(),
      data: { title: { en: releaseTitle }, type: 'EP' },
    })
    expect(release.status(), await release.text()).toBe(201)
    releaseId = (await release.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    if (releaseId) await request.delete(`/api/releases/${releaseId}`, { headers: adminHeaders() })
    if (albumId) await request.delete(`/api/albums/${albumId}`, { headers: adminHeaders() })
  })

  async function openRelease(page: import('@playwright/test').Page) {
    await page.goto('/admin/releases')
    await page.locator('input[aria-label="Search"]').fill(releaseTitle)
    const row = page.locator('tr').filter({ hasText: releaseTitle })
    await row.getByRole('button', { name: /edit/i }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal.locator('input[placeholder="Release title"]')).not.toHaveValue('', { timeout: 8000 })
    return modal
  }

  test('a release links an album, and the form shows it ticked when reopened', async ({ page, request }) => {
    let modal = await openRelease(page)

    const section = modal.getByTestId('relations-albums')
    await section.locator('.assoc-toggle').click()
    const item = section.locator('.checkbox-item').filter({ hasText: albumTitle })
    await expect(item).toContainText('not on site')
    await item.locator('input[type="checkbox"]').check()

    const saved = page.waitForResponse(r => r.url().endsWith(`/api/releases/${releaseId}`) && r.request().method() === 'PUT')
    await modal.getByRole('button', { name: /Update release/i }).click()
    expect((await (await saved).json()).data.album_ids).toEqual([albumId])
    await expect(modal).not.toBeVisible()

    const stored = await request.get(`/api/releases/${releaseId}`, { headers: adminHeaders() })
    expect((await stored.json()).data.album_ids).toEqual([albumId])

    modal = await openRelease(page)
    const reopened = modal.getByTestId('relations-albums')
    // Closed, the section summarises what is linked.
    await expect(reopened.locator('.assoc-summary')).toContainText(albumTitle)
    await reopened.locator('.assoc-toggle').click()
    await expect(reopened.locator('.checkbox-item').filter({ hasText: albumTitle }).locator('input')).toBeChecked()
  })

  test('the concert, post and merch forms offer the Photo albums section', async ({ page }) => {
    for (const path of ['/admin/concerts', '/admin/posts', '/admin/shop']) {
      await page.goto(path)
      // Each page's primary "+ Add …" button.
      await page.locator('button.btn-add-primary').first().click()
      const modal = page.locator('.modal-overlay').first()
      await expect(modal.getByTestId('relations-albums')).toBeVisible()
      await modal.locator('button[aria-label="Close"]').click()
      await expect(page.locator('.modal-overlay')).toHaveCount(0)
    }
  })
})
