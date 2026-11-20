import { anonymousVisitor } from '../../fixtures/visitor'
import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { adminHeaders, postRequiredFields, rebuildAndWait, moduleSectionSlug } from '../../fixtures/admin-api'

/**
 * Draft preview: the build bakes every draft at /{lang}/post-preview/{token}/
 * — the real article template, marked as a preview, noindex, without
 * comments — while the draft stays out of the News list and off its own
 * public URL. The internal draft list behind it is unreachable from outside.
 *
 * Seeds a draft through the API, rebuilds, checks, deletes it and rebuilds.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: anonymousVisitor() })

test.describe.serial('Public — draft post preview', () => {
  failOnPageError()

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const title = `E2E Draft Preview ${stamp}`
  let postId: number | null = null
  let token = ''
  let postsSection: string | null = null
  let enabledPosts = false

  test.beforeAll(async ({ request }) => {
    test.setTimeout(300_000)
    const modules = (await (await request.get(`${API}/api/admin/modules`, { headers: adminHeaders() })).json())
      .data as { slug: string; enabled: boolean }[]
    if (modules.find(m => m.slug === 'posts')?.enabled === false) {
      const on = await request.put(`${API}/api/admin/modules/posts`, { headers: adminHeaders(), data: { enabled: true } })
      expect(on.ok(), await on.text()).toBeTruthy()
      enabledPosts = true
    }
    postsSection = await moduleSectionSlug(request, 'posts', 'en', API)

    // No published_at: a draft.
    const post = await request.post(`${API}/api/posts`, {
      headers: adminHeaders(),
      data: {
        ...(await postRequiredFields(request, API)),
        title: { en: title },
        blocks: [{ type: 'text', payload: { body: { en: `<p>Draft body ${stamp}</p>` } } }],
      },
    })
    expect(post.status(), await post.text()).toBe(201)
    const body = (await post.json()).data
    postId = body.id
    token = body.preview_token
    expect(token).toMatch(/^[A-Za-z0-9]{40}$/)

    await rebuildAndWait(request, Date.now(), API)
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    if (postId !== null) await request.delete(`${API}/api/posts/${postId}`, { headers: adminHeaders() })
    if (enabledPosts) {
      await request.put(`${API}/api/admin/modules/posts`, { headers: adminHeaders(), data: { enabled: false } })
    }
    await rebuildAndWait(request, Date.now(), API)
  })

  test('the preview page renders the draft as an article, marked and unindexed', async ({ page }) => {
    const res = await page.goto(`${WEB}/en/post-preview/${token}/`)
    expect(res?.status()).toBe(200)

    await expect(page.getByTestId('post-preview-banner')).toBeVisible()
    await expect(page.locator('h1.art-title')).toHaveText(title)
    await expect(page.getByText(`Draft body ${stamp}`)).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.locator('#comments')).toHaveCount(0)

    // Its language twin is built too, and the switcher points there.
    expect((await page.request.get(`${WEB}/pl/post-preview/${token}/`)).status()).toBe(200)
  })

  test('the draft is nowhere else a visitor can reach', async ({ page, request }) => {
    await page.goto(`${WEB}/en/${postsSection}`)
    await expect(page.getByText(title)).toHaveCount(0)

    expect((await request.get(`${WEB}/en/post-preview/${'x'.repeat(40)}/`)).status()).toBe(404)
    // The build's draft list, from outside (through Caddy): does not exist.
    expect((await request.get(`${API}/api/internal/post-previews`)).status()).toBe(404)
  })
})

test.describe('Admin — the Preview link on a draft', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const title = `E2E Draft Link ${stamp}`
  let postId: number | null = null
  let token = ''

  test.beforeAll(async ({ request }) => {
    const post = await request.post(`${API}/api/posts`, {
      headers: adminHeaders(),
      data: { ...(await postRequiredFields(request, API)), title: { en: title }, blocks: [] },
    })
    expect(post.status(), await post.text()).toBe(201)
    postId = (await post.json()).data.id
    token = (await post.json()).data.preview_token
  })

  test.afterAll(async ({ request }) => {
    if (postId !== null) await request.delete(`${API}/api/posts/${postId}`, { headers: adminHeaders() })
  })

  test('a draft row and its editor link the preview; editing says to save first', async ({ page }) => {
    await page.goto('/admin/posts')
    await page.locator('input[aria-label="Search"]').fill(title)
    const row = page.locator('tbody tr', { hasText: title })
    await expect(row.getByTestId('post-row-preview')).toHaveAttribute('href', new RegExp(`/post-preview/${token}/$`))
    await expect(row.getByTestId('post-row-preview')).toHaveAttribute('target', '_blank')

    await page.goto(`/admin/posts?edit=${postId}`)
    const modal = page.locator('.modal-overlay')
    const link = modal.getByTestId('post-preview-link')
    await expect(link).toHaveAttribute('href', new RegExp(`/post-preview/${token}/$`))

    await modal.getByTestId('trans-input-post.title-en').fill(`${title} edited`)
    await expect(modal.getByTestId('post-preview-note')).toHaveAttribute('data-note', 'saveFirst')
  })
})
