import { test, expect } from '@playwright/test'
import { searchTable } from '../../fixtures/test-base'
import { adminHeaders, postRequiredFields } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/*
 * The news list says, per post, whether it has a cover image and which
 * languages are incomplete (title, intro, slug or a text block blank there).
 * Seeded English-only with no image, so both flags are raised.
 */
const TITLE = `E2E Flags ${Date.now()}`
let postId: number | null = null

test.describe('Admin posts list — image and translation flags', () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/posts', {
      headers: adminHeaders(),
      data: {
        ...(await postRequiredFields(request)),
        title: { en: TITLE },
        intro: { en: 'English only' },
        blocks: [{ type: 'text', payload: { body: { en: '<p>Only English</p>' } } }],
      },
    })
    if (!res.ok()) throw new Error(`Seeding the post failed: ${res.status()} ${await res.text()}`)
    postId = ((await res.json()) as { data: { id: number } }).data.id
  })

  test.afterAll(async ({ request }) => {
    if (postId !== null) await request.delete(`/api/posts/${postId}`, { headers: adminHeaders() })
  })

  test('flags a missing image and the incomplete language', async ({ page }) => {
    await page.goto('/admin/posts')
    await page.waitForLoadState('networkidle')
    await searchTable(page, TITLE)
    const row = page.locator('tbody tr').filter({ hasText: TITLE })
    await expect(row).toHaveCount(1)

    await expect(row.getByTestId('post-image-flag')).toContainText('None')

    const flags = row.getByTestId('post-translation-flags')
    await expect(flags.locator('[data-locale="en"]')).toHaveAttribute('data-complete', 'true')
    const pl = flags.locator('[data-locale="pl"]')
    await expect(pl).toHaveAttribute('data-complete', 'false')
    // The tooltip names what is missing.
    await expect(pl).toHaveAttribute('title', /title.*intro.*slug.*text blocks/)
  })
})
