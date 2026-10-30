import { test, expect, type APIRequestContext } from '@playwright/test'
import { searchTable } from '../../fixtures/test-base'
import { adminHeaders, postRequiredFields, rebuildAndWait } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/*
 * The ★ in the posts list pins a post to the top of the public News page —
 * one at a time — and a draft cannot be pinned. The public half (the pinned
 * post on top, whatever the visitor filters) is list-per-page.spec.ts.
 *
 * Pinning changes what a rebuild bakes on top of News, so this runs in its
 * own project after list-per-page, never beside a spec that reads the list
 * (`post-highlight` in playwright.config.ts). It puts back whichever post was
 * pinned before, and rebuilds, because another project's rebuild may have
 * baked one of this spec's posts on top in the meantime.
 */
const STAMP = `${Date.now()}${Math.floor(Math.random() * 1000)}`
const ids: Record<'a' | 'b' | 'draft', number | null> = { a: null, b: null, draft: null }
let previouslyHighlighted: number | null = null

async function seed(request: APIRequestContext, title: string, publishedAt: string | null): Promise<number> {
  const res = await request.post('/api/posts', {
    headers: adminHeaders(),
    data: {
      ...(await postRequiredFields(request)),
      title: { en: title },
      published_at: publishedAt,
      blocks: [{ type: 'text', payload: { body: { en: '<p>Body</p>' } } }],
    },
  })
  if (!res.ok()) throw new Error(`Seeding ${title} failed: ${res.status()} ${await res.text()}`)
  return ((await res.json()) as { data: { id: number } }).data.id
}

async function highlightedId(request: APIRequestContext): Promise<number | null> {
  const res = await request.get('/api/admin/posts', { headers: adminHeaders() })
  if (!res.ok()) throw new Error(`Reading the posts failed: ${res.status()}`)
  const posts = ((await res.json()) as { data: { id: number; is_highlighted?: boolean }[] }).data
  return posts.find(p => p.is_highlighted)?.id ?? null
}

test.describe.serial('Admin posts list — highlight on the News page', () => {
  test.beforeAll(async ({ request }) => {
    previouslyHighlighted = await highlightedId(request)
    const now = new Date().toISOString()
    ids.a = await seed(request, `E2E Highlight ${STAMP} A`, now)
    ids.b = await seed(request, `E2E Highlight ${STAMP} B`, now)
    ids.draft = await seed(request, `E2E Highlight ${STAMP} draft`, null)
  })

  test.afterAll(async ({ request }) => {
    for (const id of Object.values(ids)) {
      if (id !== null) await request.delete(`/api/posts/${id}`, { headers: adminHeaders() })
    }
    if (previouslyHighlighted !== null) {
      const res = await request.put(`/api/posts/${previouslyHighlighted}/highlight`, {
        headers: adminHeaders(), data: { highlighted: true },
      })
      expect(res.ok(), 'restoring the highlighted post').toBe(true)
    }
    await rebuildAndWait(request, Date.now())
  })

  test('pins one post at a time, and unpins', async ({ page, request }) => {
    await page.goto('/admin/posts')
    await page.waitForLoadState('networkidle')
    await searchTable(page, `E2E Highlight ${STAMP}`)
    const star = (suffix: string) => page.locator('tbody tr').filter({ hasText: `${STAMP} ${suffix}` }).getByTestId('post-highlight')

    await star('A').click()
    await expect(star('A')).toHaveAttribute('aria-pressed', 'true')
    expect(await highlightedId(request)).toBe(ids.a)

    // Pinning B takes the top from A.
    await star('B').click()
    await expect(star('B')).toHaveAttribute('aria-pressed', 'true')
    await expect(star('A')).toHaveAttribute('aria-pressed', 'false')
    expect(await highlightedId(request)).toBe(ids.b)

    await star('B').click()
    await expect(star('B')).toHaveAttribute('aria-pressed', 'false')
    expect(await highlightedId(request)).toBeNull()
  })

  test('a draft cannot be pinned', async ({ page }) => {
    await page.goto('/admin/posts')
    await page.waitForLoadState('networkidle')
    await searchTable(page, `E2E Highlight ${STAMP} draft`)
    await expect(page.locator('tbody tr').filter({ hasText: 'draft' }).getByTestId('post-highlight')).toBeDisabled()
  })
})
