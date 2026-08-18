import { test, expect, expectToast, confirmDelete, searchTable } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Serial, and every row this file touches is one it created itself.
 *
 * Nothing seeds `posts`, so the only rows that exist are the ones these tests
 * make. Run in parallel against "the first row" — as this file used to — and
 * create/edit/delete race each other over the same shared row: the delete can
 * land between another test reading the row and submitting it, and once the
 * table is empty the edit has nothing to click at all.
 */
test.describe.serial('Admin Posts', () => {
  const postTitle = `E2E Post ${Date.now()}`
  const updatedTitle = `${postTitle} Updated`

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/posts')
    await page.waitForLoadState('networkidle')
  })

  test('page loads and shows posts table', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Posts')
    // Either a table with rows or an empty-state message is shown — never a raw error
    const tableOrEmpty = page.locator('table, .empty-state')
    await expect(tableOrEmpty.first()).toBeVisible()
    await expect(page.getByText('Failed to load posts.')).not.toBeVisible()
  })

  test('opens "New post" modal via "+ Add post" button', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add post' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(page.getByText('New post')).toBeVisible()
    await expect(page.locator('input[placeholder="Post title"]')).toBeVisible()
  })

  test('creates a post and shows "Post created" toast', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add post' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    await page.locator('input[placeholder="Post title"]').fill(postTitle)
    await page.locator('textarea[placeholder*="introductory"]').fill('Short intro text.')

    await page.getByRole('button', { name: 'Create' }).click()

    await expectToast(page, 'Post created')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('filters posts by search query', async ({ page }) => {
    await searchTable(page, postTitle)

    const visibleRows = page.locator('tbody tr')
    await expect(visibleRows).toHaveCount(1)
    await expect(visibleRows.first()).toContainText(postTitle)
  })

  test('no posts match search shows empty-state message', async ({ page }) => {
    await searchTable(page, 'xyzzy-no-such-post-9999')
    await expect(page.locator('.empty-state')).toContainText('No posts match your search.')
  })

  test('edits a post and shows "Post updated" toast', async ({ page }) => {
    await searchTable(page, postTitle)

    const row = page.locator('tbody tr').filter({ hasText: postTitle })
    await row.getByRole('button', { name: 'Edit' }).click()

    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(page.getByText('Edit post')).toBeVisible()

    // The form is populated from a second request. Waiting for the title to
    // arrive stops the fill below from being overwritten when it resolves.
    const titleInput = page.locator('input[placeholder="Post title"]')
    await expect(titleInput).toHaveValue(postTitle)

    await titleInput.clear()
    await titleInput.fill(updatedTitle)

    await page.getByRole('button', { name: 'Update' }).click()

    await expectToast(page, 'Post updated')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('deletes a post and shows "Post deleted" toast', async ({ page }) => {
    await searchTable(page, updatedTitle)

    const row = page.locator('tbody tr').filter({ hasText: updatedTitle })
    await row.getByRole('button', { name: 'Delete' }).click()

    await confirmDelete(page)

    await expectToast(page, 'Post deleted')
    await expect(page.locator('tbody tr').filter({ hasText: updatedTitle })).toHaveCount(0)
  })

  test('shows validation error when saving without a title', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add post' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    // Leave title empty and submit
    await page.getByRole('button', { name: 'Create' }).click()

    // Either a browser-native validation message or a .field-error element must appear
    const titleInput = page.locator('input[placeholder="Post title"]')
    const isNativeInvalid = await titleInput.evaluate(
      (el) => !(el as HTMLInputElement).validity.valid
    )

    if (!isNativeInvalid) {
      // Server-side validation path
      await expect(page.locator('.field-error').first()).toBeVisible()
    } else {
      expect(isNativeInvalid).toBe(true)
    }

    // Modal must still be open
    await expect(page.locator('.modal-overlay')).toBeVisible()
  })
})
