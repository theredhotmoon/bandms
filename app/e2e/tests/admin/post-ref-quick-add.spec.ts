import { test, expect } from '@playwright/test'
import { expectToast, searchTable } from '../../fixtures/test-base'
import { adminHeaders, postRequiredFields } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * A reference block's "+ New …" (RefQuickAdd): the entity's own admin form
 * opens over the post, and on save the block points at the new record at
 * once — before the post page's list has refetched — and the post saves the
 * reference. Press coverage is the entity under test because its form needs
 * only a URL; the other three share the wrapper and differ only in which
 * form they mount.
 *
 * Both overlays teleport to <body>; `.modal-overlay` is addressed by index
 * because a bare locator is a strict-mode violation while two are open.
 */
test.describe('Post block — reference created from the block', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const TITLE = `E2E ref-quick-add ${stamp}`
  const PRESS_URL = `https://example.com/e2e-press-${stamp}`
  let postId: number | undefined
  let pressId: number | undefined

  test.beforeAll(async ({ request }) => {
    // No published_at: a draft, which /admin/posts lists and the public build ignores.
    const res = await request.post('/api/posts', { headers: adminHeaders(), data: { ...(await postRequiredFields(request)), title: { en: TITLE }, blocks: [] } })
    if (!res.ok()) throw new Error(`POST /api/posts → ${res.status()} ${await res.text()}`)
    postId = ((await res.json()) as { data: { id: number } }).data.id
  })

  test.afterAll(async ({ request }) => {
    if (postId) await request.delete(`/api/posts/${postId}`, { headers: adminHeaders() })
    if (pressId) await request.delete(`/api/press-releases/${pressId}`, { headers: adminHeaders() })
  })

  test('creates press coverage over the post and the block references it', async ({ page, request }) => {
    await page.goto('/admin/posts')
    await searchTable(page, TITLE)
    await page.locator('tbody tr', { hasText: TITLE }).first().getByRole('button', { name: 'Edit' }).click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()

    await page.getByRole('button', { name: '+ Reference' }).click()
    const block = outer.locator('.block-row').last()
    await block.locator('select').first().selectOption('press_release')
    await block.getByTestId('quick-add-press_release').click()

    const inner = page.locator('.modal-overlay').nth(1)
    await expect(inner).toBeVisible()
    await expect(inner.getByRole('heading', { name: 'Add press release' })).toBeVisible()
    await expect(outer).toHaveAttribute('inert', '')

    await inner.locator('input[type="url"]').first().fill(PRESS_URL)
    const created = page.waitForResponse(r => r.url().endsWith('/api/press-releases') && r.request().method() === 'POST')
    await inner.getByRole('button', { name: 'Add press release' }).click()
    pressId = ((await (await created).json()) as { data: { id: number } }).data.id

    await expectToast(page, 'Press release added')
    await expect(page.locator('.modal-overlay')).toHaveCount(1)

    // Selected immediately, by the stand-in row, and still selected once the
    // list has refetched and the real row replaced it.
    const itemSelect = block.locator('select').nth(1)
    await expect(itemSelect).toHaveValue(String(pressId))
    await expect(itemSelect.locator('option:checked')).toHaveText(PRESS_URL)

    // The success toast sits over the Update button in the bottom-right
    // corner and stays while hovered; move off it and let it go first.
    await page.mouse.move(10, 10)
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15000 })
    await outer.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Post updated')

    const res = await request.get(`/api/admin/posts/${postId}`, { headers: adminHeaders() })
    expect(res.ok()).toBe(true)
    const post = ((await res.json()) as { data: { blocks: { type: string; entity?: string; data?: { id: number } }[] } }).data
    const ref = post.blocks.find(b => b.type === 'ref')
    expect(ref?.entity).toBe('press_release')
    expect(ref?.data?.id).toBe(pressId)
  })

  test('every entity but the clip opens its own form from the block', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto('/admin/posts')
    await searchTable(page, TITLE)
    await page.locator('tbody tr', { hasText: TITLE }).first().getByRole('button', { name: 'Edit' }).click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()
    await page.getByRole('button', { name: '+ Reference' }).click()
    const block = outer.locator('.block-row').last()

    const forms: [string, string][] = [
      ['concert', 'New concert'],
      ['album', 'New Photo Album'],
      ['release', 'New release'],
      ['music_video', 'Add video'],
      ['shop_item', 'New shop item'],
    ]
    for (const [entity, heading] of forms) {
      await block.locator('select').first().selectOption(entity)
      await block.getByTestId(`quick-add-${entity}`).click()
      const inner = page.locator('.modal-overlay').nth(1)
      await expect(inner.getByRole('heading', { name: heading })).toBeVisible()
      // A clean form: Escape closes the nested modal alone.
      await inner.locator('input').first().focus()
      await page.keyboard.press('Escape')
      await expect(page.locator('.modal-overlay')).toHaveCount(1)
    }

    expect(errors).toEqual([])
    // Nothing was saved: discard the untouched block.
    await outer.locator('button[aria-label="Close"]').click()
    const confirm = page.getByRole('dialog').filter({ hasText: 'Discard changes' })
    if (await confirm.isVisible().catch(() => false)) await confirm.getByRole('button', { name: 'Discard' }).click()
    await expect(page.locator('.modal-overlay')).toHaveCount(0)
  })
})
