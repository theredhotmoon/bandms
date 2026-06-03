import { test, expect, expectToast, confirmDelete, searchTable } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

test.describe('Admin Posts', () => {
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

    await page.locator('input[placeholder="Post title"]').fill('E2E Test Post')
    await page.locator('textarea[placeholder*="introductory"]').fill('Short intro text.')

    await page.getByRole('button', { name: 'Create' }).click()

    await expectToast(page, 'Post created')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('filters posts by search query', async ({ page }) => {
    // Ensure there is at least one row before searching
    const rowsBefore = page.locator('tbody tr')
    const countBefore = await rowsBefore.count()
    test.skip(countBefore === 0, 'No posts to search — skipping search test')

    const firstTitle = await rowsBefore.first().locator('td').first().textContent()
    const searchTerm = (firstTitle ?? '').trim().slice(0, 6)

    await searchTable(page, searchTerm)

    // All visible rows must contain the search term (case-insensitive)
    const visibleRows = page.locator('tbody tr')
    const count = await visibleRows.count()
    for (let i = 0; i < count; i++) {
      const text = await visibleRows.nth(i).textContent()
      expect(text?.toLowerCase()).toContain(searchTerm.toLowerCase())
    }
  })

  test('no posts match search shows empty-state message', async ({ page }) => {
    await searchTable(page, 'xyzzy-no-such-post-9999')
    await expect(page.locator('.empty-state')).toContainText('No posts match your search.')
  })

  test('edits a post and shows "Post updated" toast', async ({ page }) => {
    const firstEditBtn = page.locator('tbody tr').first().getByRole('button', { name: 'Edit' })
    await expect(firstEditBtn).toBeVisible()
    await firstEditBtn.click()

    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(page.getByText('Edit post')).toBeVisible()

    const titleInput = page.locator('input[placeholder="Post title"]')
    await titleInput.clear()
    await titleInput.fill('Updated Post Title E2E')

    await page.getByRole('button', { name: 'Update' }).click()

    await expectToast(page, 'Post updated')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('deletes a post and shows "Post deleted" toast', async ({ page }) => {
    const firstDeleteBtn = page.locator('tbody tr').first().getByRole('button', { name: 'Delete' })
    await expect(firstDeleteBtn).toBeVisible()
    await firstDeleteBtn.click()

    await confirmDelete(page)

    await expectToast(page, 'Post deleted')
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
