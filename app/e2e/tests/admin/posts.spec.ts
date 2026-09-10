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

  test('adds one block of each type and saves them in order', async ({ page }) => {
    await searchTable(page, postTitle)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    await page.getByRole('button', { name: '+ Text' }).click()
    await page.locator('.block-row').nth(0).locator('textarea').first().fill('First paragraph')

    await page.getByRole('button', { name: '+ Embed / link' }).click()
    await page.locator('.block-row').nth(1).locator('input').first().fill('https://vimeo.com/76979871')
    await expect(page.locator('.block-row').nth(1).locator('.provider-badge')).toHaveText('Vimeo')

    await page.getByRole('button', { name: '+ Reference' }).click()
    const refBlock = page.locator('.block-row').nth(2)
    await refBlock.locator('select').first().selectOption('release')
    // The item select has `required` and defaults to the disabled "Choose an
    // item…" option — leaving it unset blocks submission client-side with no
    // network request at all, and no toast ever appears.
    await refBlock.locator('select').nth(1).selectOption({ index: 1 })

    await expect(page.locator('.block-row')).toHaveCount(3)

    await page.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Post updated')
  })

  test('blocks survive a reload in the order they were saved', async ({ page }) => {
    await searchTable(page, postTitle)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    // Order is the whole feature — assert position, not just presence.
    await expect(page.locator('.block-row').nth(0).locator('.block-type')).toHaveText('Text')
    await expect(page.locator('.block-row').nth(1).locator('.block-type')).toHaveText('Embed / link')
    await expect(page.locator('.block-row').nth(0).locator('textarea').first()).toHaveValue('First paragraph')
  })

  test('removing a block persists the shorter list', async ({ page }) => {
    await searchTable(page, postTitle)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    // The form hydrates from a second request; .count() does not wait for it,
    // so capturing "before" without first waiting for a block to render reads
    // the pre-hydration DOM (0) rather than the loaded block list.
    await expect(page.locator('.block-row').first()).toBeVisible()
    const before = await page.locator('.block-row').count()
    await page.locator('.block-row').last().getByTitle('Remove block').click()
    await expect(page.locator('.block-row')).toHaveCount(before - 1)

    await page.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Post updated')

    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.block-row')).toHaveCount(before - 1)
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

/**
 * Serial and self-contained for the same reason as the suite above: this
 * creates its own post so it isn't racing the shared row other tests use.
 */
test.describe.serial('Admin Posts — content blocks scrolling', () => {
  const postTitle = `E2E Scroll Post ${Date.now()}`

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/posts')
    await page.waitForLoadState('networkidle')
  })

  test('a post with many content blocks stays scrollable to the submit button', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add post' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await page.locator('input[placeholder="Post title"]').fill(postTitle)

    // Enough blocks to push the modal well past the viewport — this is the
    // state that used to make the content area unscrollable (see
    // PostBlockEditor.vue's touch-action comment).
    for (let i = 0; i < 15; i++) {
      await page.getByRole('button', { name: '+ Text' }).click()
    }
    await expect(page.locator('.block-row')).toHaveCount(15)

    const overlay = page.locator('.modal-overlay')
    await expect.poll(() => overlay.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)

    // Scroll with the mouse wheel, the way a sighted mouse user reaches the
    // submit button once the block list overflows the modal.
    await page.mouse.move(400, 300)
    await page.mouse.wheel(0, 10000)
    await expect(page.getByRole('button', { name: 'Create' })).toBeInViewport()

    await page.getByRole('button', { name: 'Create' }).click()
    await expectToast(page, 'Post created')
  })

  test('block rows allow touch scrolling instead of only native drag', async ({ page }) => {
    // A real device confirms the user-visible symptom: a touch swipe starting
    // on a draggable row got captured as a native HTML5 drag instead of
    // scrolling, and once blocks filled the whole modal there was no
    // non-draggable spot left to scroll from at all. Chromium's headless CDP
    // touch emulation doesn't reproduce that drag-vs-scroll disambiguation
    // reliably (verified: a synthetic touch swipe scrolled the modal even
    // with the fix reverted), so a gesture-based e2e assertion here would be
    // a flaky false-positive. Assert the actual mechanism instead: every
    // block row must declare `touch-action: pan-y` so the browser prioritises
    // vertical panning over starting a drag from touch input, whatever the
    // block count. See the touch-action comment on `.block-row` in
    // PostBlockEditor.vue.
    await page.getByRole('button', { name: '+ Add post' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    await page.getByRole('button', { name: '+ Text' }).click()
    await expect(page.locator('.block-row')).toHaveCount(1)

    await expect(page.locator('.block-row').first()).toHaveCSS('touch-action', 'pan-y')
  })

  test('deletes the scroll test post', async ({ page }) => {
    await searchTable(page, postTitle)
    const row = page.locator('tbody tr').filter({ hasText: postTitle })
    await row.getByRole('button', { name: 'Delete' }).click()
    await confirmDelete(page)
    await expectToast(page, 'Post deleted')
  })
})
