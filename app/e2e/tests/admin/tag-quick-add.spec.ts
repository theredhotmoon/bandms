import { test, expect } from '@playwright/test'
import { expectToast } from '../../fixtures/test-base'
import { adminHeaders } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * A tag created from inside a form (TagQuickAdd): the tag form stacks over
 * the host modal, and on save the new tag is listed and ticked without the
 * host losing what was typed. Two hosts, one per shape: the concert form's
 * plain checkbox list and the post form's relations panel section. Nothing
 * else is saved; the tags are deleted afterwards through the API.
 *
 * Both overlays teleport to <body>; `.modal-overlay` is addressed by index
 * because a bare locator is a strict-mode violation while two are open.
 */
test.describe('Admin — tag from inside a form', () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const createdIds: number[] = []

  test.afterAll(async ({ request }) => {
    for (const id of createdIds) await request.delete(`/api/tags/${id}`, { headers: adminHeaders() })
  })

  /** `scope` holds the button; `outer` is the host overlay that must go inert. */
  async function createTagOver(
    page: import('@playwright/test').Page,
    outer: import('@playwright/test').Locator,
    scope: import('@playwright/test').Locator,
    name: string,
  ) {
    await scope.getByTestId('tag-quick-add').click()
    const inner = page.locator('.modal-overlay').nth(1)
    await expect(inner).toBeVisible()
    await expect(inner.getByRole('heading', { name: 'New tag' })).toBeVisible()
    await expect(outer).toHaveAttribute('inert', '')

    await inner.locator('.trans-row[data-locale="en"] input').fill(name)
    const created = page.waitForResponse(r => r.url().endsWith('/api/tags') && r.request().method() === 'POST')
    await inner.getByRole('button', { name: /create|save/i }).click()
    createdIds.push(((await (await created).json()) as { data: { id: number } }).data.id)

    await expectToast(page, 'Tag created')
    await expect(page.locator('.modal-overlay')).toHaveCount(1)
  }

  async function discard(page: import('@playwright/test').Page, outer: import('@playwright/test').Locator) {
    await outer.locator('button[aria-label="Close"]').click()
    const confirm = page.getByRole('dialog').filter({ hasText: 'Discard changes' })
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Discard' }).click()
    await expect(page.locator('.modal-overlay')).toHaveCount(0)
  }

  test('concert form: the new tag is listed and ticked, the typed name survives', async ({ page }) => {
    const name = `E2E Tag concert ${stamp}`
    const concertName = `E2E Concert ${stamp}`
    await page.goto('/admin/concerts')
    await page.locator('button.btn-add-primary').click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()
    await outer.locator('.trans-row[data-locale="en"] input').first().fill(concertName)

    await createTagOver(page, outer, outer, name)

    const item = outer.locator('.checkbox-item').filter({ hasText: name })
    await expect(item.locator('input[type="checkbox"]')).toBeChecked()
    await expect(outer.locator('.trans-row[data-locale="en"] input').first()).toHaveValue(concertName)

    await discard(page, outer)
  })

  test('post form: the relations panel section lists and ticks the new tag', async ({ page }) => {
    const name = `E2E Tag post ${stamp}`
    await page.goto('/admin/posts')
    await page.getByRole('button', { name: '+ Add post' }).click()
    const outer = page.locator('.modal-overlay').nth(0)
    await expect(outer).toBeVisible()

    const section = outer.getByTestId('relations-tags')
    await section.locator('.assoc-toggle').click()
    await createTagOver(page, outer, section, name)

    const item = section.locator('.checkbox-item').filter({ hasText: name })
    await expect(item.locator('input[type="checkbox"]')).toBeChecked()
    await expect(section.locator('.assoc-toggle')).toContainText('(1)')

    await discard(page, outer)
  })
})
