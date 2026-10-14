import { test, expect } from '@playwright/test'
import { adminHeaders, contentLocaleOrder } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Tag pickers name a tag in the band's FIRST content language (useTagLabel),
 * the language TagForm leads with. The API's `name` follows the request
 * language — English here, since Playwright's Chromium sends en-US — so a
 * picker printing `t.name` showed a Polish-first band the English name of a
 * tag it had just renamed in Polish. The tag below has a different name in
 * every language, so only the right one can match.
 */
const STAMP = Date.now()
const names: Record<string, string> = { en: `e2e-tl-${STAMP}-en`, pl: `e2e-tl-${STAMP}-pl` }
let shown = ''
let hidden: string[] = []
let tagId = 0

test.describe('Tag labels in pickers', () => {
  test.beforeAll(async ({ request }) => {
    const order = await contentLocaleOrder(request)
    shown = names[order.find(l => names[l])!]
    hidden = Object.values(names).filter(n => n !== shown)

    const res = await request.post('/api/tags', { headers: adminHeaders(), data: { name: names } })
    expect(res.ok(), `POST /api/tags → ${res.status()} ${await res.text()}`).toBe(true)
    tagId = (await res.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    if (!tagId) return
    const res = await request.delete(`/api/tags/${tagId}`, { headers: adminHeaders() })
    expect(res.ok(), `DELETE /api/tags/${tagId} → ${res.status()}`).toBe(true)
  })

  for (const { path, add } of [
    { path: '/admin/concerts', add: '+ Add concert' },
    { path: '/admin/venues', add: '+ Add venue' },
  ]) {
    test(`${path} form lists the tag in the band's first language`, async ({ page }) => {
      await page.goto(path)
      await page.getByRole('button', { name: add }).click()

      const modal = page.locator('.modal-overlay')
      await expect(modal.locator('.checkbox-item').filter({ hasText: shown })).toBeVisible()
      for (const other of hidden) await expect(modal.getByText(other, { exact: true })).toHaveCount(0)
    })
  }
})
