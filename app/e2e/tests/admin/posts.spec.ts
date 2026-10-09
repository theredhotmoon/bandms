import { test, expect, expectToast, confirmDelete, searchTable } from '../../fixtures/test-base'
import { adminHeaders, primaryLocale, TEST_PNG } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Serial, and every row this file touches is one it created itself.
 *
 * Nothing seeds `posts`, so the only rows that exist are the ones these tests
 * make. Run in parallel against "the first row" — as this file used to — and
 * create/edit/delete race each other over the same shared row: the delete can
 * land between another test reading the row and submitting it, and once the
 * table is empty the edit has nothing to click at all.
 *
 * Kept as a single describe.serial (rather than two sibling ones) because
 * `playwright.config.ts` sets `fullyParallel: true` — serial mode only
 * orders tests *within* one describe block, so two sibling serial blocks in
 * this file could still be scheduled onto different workers and run
 * concurrently against the same `posts` table.
 */
test.describe.serial('Admin Posts', () => {
  const postTitle = `E2E Post ${Date.now()}`
  const updatedTitle = `${postTitle} Updated`
  const scrollPostTitle = `E2E Scroll Post ${Date.now()}`

  // The Reference block lists the band's releases, and the prod-synced dev DB
  // has none — so "pick the first item" found nothing to pick. Seed one for
  // the block to point at, and remove it once the post that referenced it is
  // gone (the delete test runs before afterAll in this serial chain).
  let releaseId: number | null = null
  // The band's first content language: the title input that is `required`,
  // the textarea that comes first in a block, and the title's lead locale.
  let primary = ''

  test.beforeAll(async ({ request }) => {
    primary = await primaryLocale(request)
    const res = await request.post('/api/releases', {
      headers: adminHeaders(),
      data: { title: { [primary]: `E2E Ref Release ${Date.now()}` }, type: 'single' },
    })
    if (!res.ok()) throw new Error(`Seeding the release failed: ${res.status()} ${await res.text()}`)
    releaseId = ((await res.json()) as { data: { id: number } }).data.id
  })

  // A failure anywhere in the chain skips the delete test, which would leave
  // this file's posts live on the dev DB (and, after a rebuild, on the public
  // site) with a reference to a release that is about to go. Sweep them by
  // title first, then drop the release.
  test.afterAll(async ({ request }) => {
    const list = await request.get('/api/admin/posts', { headers: adminHeaders() })
    if (list.ok()) {
      const posts = ((await list.json()) as { data: { id: number; title: string }[] }).data
      const mine = posts.filter(p => [postTitle, updatedTitle, scrollPostTitle].some(t => p.title?.startsWith(t)))
      for (const p of mine) await request.delete(`/api/posts/${p.id}`, { headers: adminHeaders() })
    }
    if (releaseId === null) return
    await request.delete(`/api/releases/${releaseId}`, { headers: adminHeaders() })
  })

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
    await page.locator('.block-row').nth(0).locator(`[data-locale="${primary}"] textarea`).fill('First paragraph')

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
    await expect(page.locator('.block-row').nth(0).locator(`[data-locale="${primary}"] textarea`)).toHaveValue('First paragraph')
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

  // The main image is uploaded the moment it is picked and the form submits
  // only the stored path; the preview is the `/storage/…` URL the server
  // returned, not a data URL read from the file.
  test('uploads a main image and saves its stored path', async ({ page, request }) => {
    await searchTable(page, updatedTitle)
    await page.locator('tbody tr').filter({ hasText: updatedTitle }).getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('input[placeholder="Post title"]')).toHaveValue(updatedTitle)

    await page.locator('.pf-cover input[type="file"]').setInputFiles({
      name: 'e2e-cover.png', mimeType: 'image/png', buffer: TEST_PNG,
    })
    await expect(page.locator('.pf-cover .siu-img')).toHaveAttribute('src', /\/storage\/post-images\/.+\.png$/)

    await page.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Post updated')

    const list = await request.get('/api/admin/posts', { headers: adminHeaders() })
    const mine = ((await list.json()) as { data: { id: number; title: string }[] }).data.find(p => p.title === updatedTitle)
    expect(mine).toBeTruthy()
    const detail = await request.get(`/api/admin/posts/${mine!.id}`, { headers: adminHeaders() })
    expect(((await detail.json()) as { data: { image: string | null } }).data.image).toMatch(/^\/storage\/post-images\/.+\.png$/)
  })

  // The public site hides posts with no published_at, so the band needs to be
  // able to withdraw one by switching it back to Draft — not just to publish
  // it. A form that dropped the empty field from its payload would leave the
  // post published. Status is a Draft / Published choice; the date input only
  // exists while Published is selected, and choosing Published fills it with
  // "now" so the writer never has to type a date to go live.
  test('publishes with a date, then switches back to Draft', async ({ page }) => {
    const modal = page.locator('.modal-overlay')
    const publishedAt = modal.locator('input[type="datetime-local"]')
    const row = () => page.locator('tbody tr').filter({ hasText: updatedTitle })

    await searchTable(page, updatedTitle)
    await expect(row()).toContainText('Draft')

    await row().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('input[placeholder="Post title"]')).toHaveValue(updatedTitle)
    await expect(modal.getByRole('radio', { name: 'Draft' })).toBeChecked()
    await expect(publishedAt).toHaveCount(0)

    await modal.getByRole('radio', { name: 'Published' }).check()
    await expect(publishedAt).not.toHaveValue('')   // prefilled with "now"
    await publishedAt.fill('2026-09-01T10:00')
    await page.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Post updated')
    await expect(row()).toContainText('2026-09-01')

    await row().getByRole('button', { name: 'Edit' }).click()
    await expect(publishedAt).toHaveValue('2026-09-01T10:00')
    await modal.getByRole('radio', { name: 'Draft' }).check()
    await expect(publishedAt).toHaveCount(0)
    await page.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Post updated')
    await expect(row()).toContainText('Draft')
  })

  // Closing a dirty form — backdrop, Escape, ✕ or Cancel — must ask first;
  // a stray click outside the panel used to throw the whole post away.
  test('asks before discarding unsaved changes, and keeps them on cancel', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add post' }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    // Pristine: closing needs no confirmation.
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()

    await page.getByRole('button', { name: '+ Add post' }).click()
    await modal.locator('input[placeholder="Post title"]').fill('Unsaved draft')
    await page.keyboard.press('Escape')

    const discard = page.getByRole('dialog', { name: 'Discard changes?' })
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Cancel' }).click()
    await expect(discard).not.toBeVisible()
    await expect(modal).toBeVisible()
    await expect(modal.locator('input[placeholder="Post title"]')).toHaveValue('Unsaved draft')

    await modal.getByRole('button', { name: 'Cancel' }).click()
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Discard' }).click()
    await expect(modal).not.toBeVisible()
    await expect(page.getByText('Post created')).toHaveCount(0)
  })

  // The language view narrows intro and block inputs to one locale for
  // writing prose, and remembers the choice across a reopen. Hidden locales
  // keep their text — nothing is cleared by hiding it.
  test('shows one language at a time in blocks and remembers the choice', async ({ page }) => {
    const modal = page.locator('.modal-overlay')
    const firstBlock = () => page.locator('.block-row').first()

    await searchTable(page, postTitle)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(firstBlock()).toBeVisible()
    await expect(firstBlock().locator('textarea')).toHaveCount(2)

    await modal.getByRole('radio', { name: 'PL' }).check()
    await expect(firstBlock().locator('textarea')).toHaveCount(1)
    await expect(firstBlock().locator('[data-locale="pl"] textarea')).toBeVisible()
    await expect(modal.locator('textarea[placeholder*="introductory"]')).toHaveCount(0)

    // Pristine form (the view is not post data), so Cancel closes at once.
    await modal.getByRole('button', { name: 'Cancel' }).click()
    await expect(modal).not.toBeVisible()
    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(firstBlock()).toBeVisible()
    await expect(modal.getByRole('radio', { name: 'PL' })).toBeChecked()
    await expect(firstBlock().locator('textarea')).toHaveCount(1)

    await modal.getByRole('radio', { name: 'All' }).check()
    await expect(firstBlock().locator('textarea')).toHaveCount(2)
    await expect(firstBlock().locator(`[data-locale="${primary}"] textarea`)).toHaveValue('First paragraph')
    await modal.getByRole('button', { name: 'Cancel' }).click()
  })

  // The settings rail sits beside the content when the modal has the room,
  // and falls back below it when it does not — a container query on the
  // form's own width, so narrowing the viewport is what flips it.
  test('lays publishing beside the content on desktop and below it when narrow', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add post' }).click()
    const main = page.locator('.pf-main')
    const rail = page.locator('.pf-rail')
    await expect(rail).toBeVisible()

    // Both boxes in one evaluate: the modal's enter transition scales and
    // slides the panel for ~200 ms, and two separate boundingBox() calls
    // land in different frames — the rail then reads ~5 px off the column
    // it is level with. Polled, so the check also outlasts the transition.
    const columns = () => page.evaluate(() => {
      const m = document.querySelector('.pf-main')?.getBoundingClientRect()
      const r = document.querySelector('.pf-rail')?.getBoundingClientRect()
      return m && r ? { m: { x: m.x, y: m.y, w: m.width, h: m.height }, r: { x: r.x, y: r.y } } : null
    })
    await expect.poll(async () => {
      const c = await columns()
      return c ? c.r.x >= c.m.x + c.m.w && Math.abs(c.r.y - c.m.y) < 4 : false
    }).toBe(true)

    await page.setViewportSize({ width: 720, height: 900 })
    await expect.poll(async () => {
      const c = await columns()
      return c ? c.r.y >= c.m.y + c.m.h - 1 && Math.abs(c.r.x - c.m.x) < 4 : false
    }).toBe(true)

    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  // Reordering used to be pointer-drag only — no path at all for keyboard or
  // touch. The up/down buttons are the accessible path, and the public site
  // renders blocks in saved order, so the order must round-trip.
  test('reorders blocks with the move buttons and saves the new order', async ({ page }) => {
    await searchTable(page, postTitle)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.block-row').first()).toBeVisible()

    const rows = page.locator('.block-row')
    const count = await rows.count()
    await expect(rows.nth(0).locator('.block-type')).toHaveText('Text')
    await expect(rows.nth(0).getByRole('button', { name: 'Move up' })).toBeDisabled()
    await expect(rows.nth(count - 1).getByRole('button', { name: 'Move down' })).toBeDisabled()

    await rows.nth(0).getByRole('button', { name: 'Move down' }).click()
    await expect(rows.nth(1).locator('.block-type')).toHaveText('Text')

    await page.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Post updated')

    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(rows.nth(1).locator('.block-type')).toHaveText('Text')
  })

  test('deletes a post and shows "Post deleted" toast', async ({ page }) => {
    await searchTable(page, updatedTitle)

    const row = page.locator('tbody tr').filter({ hasText: updatedTitle })
    await row.getByRole('button', { name: 'Delete' }).click()

    await confirmDelete(page)

    await expectToast(page, 'Post deleted')
    await expect(page.locator('tbody tr').filter({ hasText: updatedTitle })).toHaveCount(0)
  })

  // Since #99 every form's submit is dirty-gated: on a pristine form "Create"
  // is disabled, so it cannot even be clicked (Playwright waits for an
  // enabled button and times out — which is exactly how this test failed for
  // a while). To still prove the rule "no post without a title", dirty the
  // form through a non-title field, then submit with the title blank and
  // let the input's native `required` block it. Same shape as releases.spec.
  test('shows validation error when saving without a title', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add post' }).click()
    const modal = page.locator('.modal-overlay')
    await expect(modal).toBeVisible()

    const createBtn = modal.getByRole('button', { name: 'Create' })
    await expect(createBtn).toBeDisabled()

    await modal.locator('textarea[placeholder*="introductory"]').fill('Intro without a title')
    await expect(createBtn).toBeEnabled()

    await createBtn.click()

    // `required` sits on the band's *first* content language's title, which
    // is the input the form ids `post-title-0` — "Post title" is the English
    // one and is optional on a Polish-first band.
    const titleInput = modal.locator('#post-title-0')
    await expect(titleInput).toHaveAttribute('required', '')
    expect(await titleInput.evaluate((el) => (el as HTMLInputElement).validity.valid)).toBe(false)

    // Not submitted: the modal is still open and no "created" toast appeared.
    await expect(modal).toBeVisible()
    await expect(page.getByText('Post created')).toHaveCount(0)
  })

  test('a post with many content blocks stays scrollable to the submit button', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add post' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await page.locator('input[placeholder="Post title"]').fill(scrollPostTitle)

    // Enough blocks to push the modal past the viewport — this is the state
    // that used to make the content area unscrollable (see
    // PostBlockEditor.vue's touch-action comment). 8 empty text blocks plus
    // the rest of the form's fields is comfortably past a typical viewport
    // height without padding the test with an arbitrarily large count.
    for (let i = 0; i < 8; i++) {
      await page.getByRole('button', { name: '+ Text' }).click()
    }
    await expect(page.locator('.block-row')).toHaveCount(8)

    const overlay = page.locator('.modal-overlay')
    await expect.poll(() => overlay.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)

    // Scroll with the mouse wheel, the way a sighted mouse user reaches the
    // submit button once the block list overflows the modal. Derive the
    // pointer position from the overlay (always viewport-sized, since it's
    // `position: fixed; inset: 0`) rather than the panel — once the panel
    // overflows, its own bounding box extends past the viewport and a point
    // derived from it can land off-screen.
    const overlayBox = await page.locator('.modal-overlay').boundingBox()
    if (!overlayBox) throw new Error('modal overlay not found')
    await page.mouse.move(overlayBox.x + overlayBox.width / 2, overlayBox.y + overlayBox.height / 2)
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
    // block row must declare a `touch-action` that prioritises vertical
    // panning over starting a drag from touch input, whatever the block
    // count. See the touch-action comment on `.block-row` in
    // PostBlockEditor.vue.
    await page.getByRole('button', { name: '+ Add post' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    await page.getByRole('button', { name: '+ Text' }).click()
    await expect(page.locator('.block-row')).toHaveCount(1)

    await expect(page.locator('.block-row').first()).toHaveCSS('touch-action', 'pan-y pinch-zoom')
  })

  test('deletes the scroll test post', async ({ page }) => {
    await searchTable(page, scrollPostTitle)
    const row = page.locator('tbody tr').filter({ hasText: scrollPostTitle })
    await row.getByRole('button', { name: 'Delete' }).click()
    await confirmDelete(page)
    await expectToast(page, 'Post deleted')
  })
})
