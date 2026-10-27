import { test, expect } from '@playwright/test'
import { expectToast } from '../../fixtures/test-base'
import { adminHeaders, TEST_PNG } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * The relations panel's sections can create the record they link
 * (EntityQuickAdd): the entity's form stacks over the host modal, and on
 * save the new record is listed and ticked in that section without the host
 * losing what was typed. Two sections with the cheapest forms are driven end
 * to end (a tour from the press form, a band member from the post form), and
 * one sweep opens every section's form on the shop item form. Nothing else
 * is saved; the records are deleted afterwards through the API.
 *
 * Both overlays teleport to <body>; `.modal-overlay` is addressed by index
 * because a bare locator is a strict-mode violation while two are open.
 */
test.describe('Admin — relations panel creates its own records', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  let tourId: number | undefined
  let memberId: number | undefined
  let albumId: number | undefined
  let videoId: number | undefined

  test.afterAll(async ({ request }) => {
    if (tourId) await request.delete(`/api/tours/${tourId}`, { headers: adminHeaders() })
    if (memberId) await request.delete(`/api/band-profile/members/${memberId}`, { headers: adminHeaders() })
    if (albumId) await request.delete(`/api/albums/${albumId}`, { headers: adminHeaders() })
    if (videoId) await request.delete(`/api/music-videos/${videoId}`, { headers: adminHeaders() })
  })

  async function discard(page: import('@playwright/test').Page, outer: import('@playwright/test').Locator) {
    await outer.locator('button[aria-label="Close"]').click()
    const confirm = page.getByRole('dialog').filter({ hasText: 'Discard changes' })
    if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: 'Discard' }).click()
    await expect(page.locator('.modal-overlay')).toHaveCount(0)
  }

  test('press form: a tour created from the Tours section is listed and ticked', async ({ page }) => {
    const name = `E2E QuickAdd Tour ${stamp}`
    await page.goto('/admin/press-releases')
    await page.locator('button.btn-add-primary').click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()
    await outer.locator('input[type="url"]').first().fill(`https://example.com/e2e-${stamp}`)

    const section = outer.locator('.assoc-section').filter({ hasText: 'Tours' })
    await section.locator('.assoc-toggle').click()
    await section.getByTestId('quick-add-tour').click()
    const inner = page.locator('.modal-overlay').nth(1)
    await expect(inner.getByRole('heading', { name: 'New tour' })).toBeVisible()
    await expect(outer).toHaveAttribute('inert', '')

    await inner.locator('input[placeholder*="Tour" i]').first().fill(name)
    const created = page.waitForResponse(r => r.url().endsWith('/api/tours') && r.request().method() === 'POST')
    await inner.getByRole('button', { name: /create|save/i }).click()
    tourId = ((await (await created).json()) as { data: { id: number } }).data.id
    await expectToast(page, 'Tour created')
    await expect(page.locator('.modal-overlay')).toHaveCount(1)

    const item = section.locator('.checkbox-item').filter({ hasText: name })
    await expect(item.locator('input[type="checkbox"]')).toBeChecked()
    await expect(outer.locator('input[type="url"]').first()).toHaveValue(`https://example.com/e2e-${stamp}`)

    await discard(page, outer)
  })

  test('post form: a band member created from the Band members section is listed and ticked', async ({ page }) => {
    const first = `E2EQuick${stamp.replace(/\W/g, '')}`
    await page.goto('/admin/posts')
    await page.getByRole('button', { name: '+ Add post' }).click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()

    const section = outer.getByTestId('relations-members')
    await section.locator('.assoc-toggle').click()
    await section.getByTestId('quick-add-member').click()
    const inner = page.locator('.modal-overlay').nth(1)
    await expect(inner.getByRole('heading', { name: 'Add member' })).toBeVisible()

    await inner.locator('input[placeholder="Jane"]').fill(first)
    await inner.locator('input[placeholder="Smith"]').fill('Quickadd')
    await inner.locator('input[placeholder="member@example.com"]').fill(`e2e-quickadd-${stamp}@example.com`)
    const created = page.waitForResponse(r => r.url().endsWith('/api/band-profile/members') && r.request().method() === 'POST')
    await inner.getByRole('button', { name: 'Add member' }).click()
    memberId = ((await (await created).json()) as { data: { id: number } }).data.id
    await expectToast(page, 'Member added')
    await expect(page.locator('.modal-overlay')).toHaveCount(1)

    const item = section.locator('.checkbox-item').filter({ hasText: first })
    await expect(item.locator('input[type="checkbox"]')).toBeChecked()

    await discard(page, outer)
  })

  test('press form: a photo album created from the Photo albums section, photo included, is ticked', async ({ page, request }) => {
    const title = `E2E QuickAdd Album ${stamp}`
    await page.goto('/admin/press-releases')
    await page.locator('button.btn-add-primary').click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()

    const section = outer.locator('.assoc-section').filter({ hasText: 'Photo albums' })
    await section.locator('.assoc-toggle').click()
    await section.getByTestId('quick-add-album').click()
    const inner = page.locator('.modal-overlay').nth(1)
    await expect(inner.getByRole('heading', { name: 'New Photo Album' })).toBeVisible()

    await inner.locator('input[placeholder*="Rudeboy" i]').fill(title)
    // An album is its photos: the form wants at least one before it enables Create.
    await inner.locator('input[type="file"]').setInputFiles({ name: 'e2e.png', mimeType: 'image/png', buffer: TEST_PNG })
    await inner.locator('button.btn-primary').click()
    await expectToast(page, 'Album created')
    await expect(page.locator('.modal-overlay')).toHaveCount(1)
    // The upload is an XHR (progress events), so the id is read back from the
    // list rather than off the response; capture it before any assertion can
    // fail, or the album outlives the test.
    const albums = ((await (await request.get('/api/albums')).json()) as { data: { id: number; title: string }[] }).data
    albumId = albums.find(a => a.title === title)?.id
    expect(albumId).toBeDefined()

    const item = section.locator('.checkbox-item').filter({ hasText: title })
    await expect(item.locator('input[type="checkbox"]')).toBeChecked()

    await discard(page, outer)
  })

  test('shop item form: a music video created from the Music videos section is ticked', async ({ page }) => {
    const title = `E2E QuickAdd Video ${stamp}`
    await page.goto('/admin/shop')
    await page.locator('button.btn-add-primary').first().click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()

    const section = outer.locator('.assoc-section').filter({ hasText: 'Music videos' })
    await section.locator('.assoc-toggle').click()
    await section.getByTestId('quick-add-music_video').click()
    const inner = page.locator('.modal-overlay').nth(1)
    await expect(inner.getByRole('heading', { name: 'Add video' })).toBeVisible()

    await inner.locator('input[type="url"]').fill(`https://youtu.be/e2e${stamp.replace(/\W/g, '')}`)
    await inner.locator('input[placeholder="Video title"]').fill(title)
    const created = page.waitForResponse(r => r.url().endsWith('/api/music-videos') && r.request().method() === 'POST')
    await inner.getByRole('button', { name: 'Save' }).click()
    videoId = ((await (await created).json()) as { data: { id: number } }).data.id
    await expectToast(page, 'Music video added')
    await expect(page.locator('.modal-overlay')).toHaveCount(1)

    const item = section.locator('.checkbox-item').filter({ hasText: title })
    await expect(item.locator('input[type="checkbox"]')).toBeChecked()

    await discard(page, outer)
  })

  test('shop item form: every section offers its form, and Escape closes only that form', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/admin/shop')
    await page.locator('button.btn-add-primary').first().click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()

    // The shop item form links tags, releases, concerts, posts and videos.
    // Sections are found by title: the button only renders once a section is
    // expanded, so it cannot be what identifies the section.
    const expected: [string, string, string][] = [
      ['Music releases', 'quick-add-release', 'New release'],
      ['Concerts', 'quick-add-concert', 'New concert'],
      ['Blog posts', 'quick-add-post', 'New post'],
      ['Music videos', 'quick-add-music_video', 'Add video'],
    ]
    for (const [title, testId, heading] of expected) {
      const section = outer.locator('.assoc-section').filter({ hasText: title })
      await section.locator('.assoc-toggle').click()
      await section.getByTestId(testId).click()
      const inner = page.locator('.modal-overlay').nth(1)
      await expect(inner.getByRole('heading', { name: heading })).toBeVisible()
      await inner.locator('input').first().focus()
      await page.keyboard.press('Escape')
      await expect(page.locator('.modal-overlay')).toHaveCount(1)
    }
    expect(errors).toEqual([])

    await discard(page, outer)
  })
})
