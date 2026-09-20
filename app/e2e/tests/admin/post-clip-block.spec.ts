import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { expectToast, searchTable } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

const API = process.env.E2E_API_URL ?? 'http://localhost:8081'
const TITLE = `E2E clip-block ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const CLIP_URL = 'https://www.tiktok.com/@band/video/7234567890123456789'

function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json')
  return entry.value
}

async function api(request: APIRequestContext, method: 'get' | 'post' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}`)
  return res
}

/**
 * The post editor's clip reference: "Add a new clip…" creates a library row
 * (attached to a concert) and points the block at it; saving the post stores
 * the reference, and the resolver hands the public site the clip plus its
 * concert.
 */
test.describe.serial('Post block — clip', () => {
  let postId: number
  let concertCount = 0

  test.beforeAll(async ({ request }) => {
    const concerts = (await (await api(request, 'get', '/api/concerts')).json()).data as unknown[]
    concertCount = concerts.length
    // No published_at: a draft, which /admin/posts lists and the public build ignores.
    const res = await api(request, 'post', '/api/posts', { title: { en: TITLE }, blocks: [] })
    postId = (await res.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    if (postId) await api(request, 'delete', `/api/posts/${postId}`)
    const clips = (await (await api(request, 'get', '/api/clips')).json()).data as { id: number; url: string }[]
    for (const c of clips.filter(c => c.url === CLIP_URL)) await api(request, 'delete', `/api/clips/${c.id}`)
  })

  test('adds a new clip from the block editor and saves the reference', async ({ page, request }) => {
    await page.goto('/admin/posts')
    await searchTable(page, TITLE)
    await page.locator('tbody tr', { hasText: TITLE }).first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    await page.getByRole('button', { name: '+ Reference' }).click()
    const block = page.locator('.block-row').last()
    await block.locator('select').first().selectOption('clip')
    await block.getByTestId('clip-select').selectOption('__new__')

    const panel = block.getByTestId('new-clip')
    await panel.getByTestId('new-clip-url').fill(CLIP_URL)
    await expect(panel.locator('.provider-badge')).toHaveText('TikTok')
    await panel.getByRole('button', { name: 'Live', exact: true }).click()
    if (concertCount > 0) await panel.getByTestId('new-clip-concert').selectOption({ index: 1 })
    await panel.getByRole('button', { name: 'Attach' }).click()
    await expectToast(page, 'Clip added to the library')

    // The select now shows the new clip and the add panel is gone.
    await expect(block.getByTestId('new-clip')).toHaveCount(0)
    await expect(block.getByTestId('clip-select')).not.toHaveValue('')
    const chosen = await block.getByTestId('clip-select').inputValue()
    expect(Number(chosen)).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Update' }).click()
    // The 'Clip added' toast may still be on screen: filter by text, never match every toast.
    await expectToast(page, 'Post updated')

    const post = (await (await api(request, 'get', `/api/admin/posts/${postId}`)).json()).data
    const ref = post.blocks.find((b: { type: string }) => b.type === 'ref')
    expect(ref.entity).toBe('clip')
    expect(ref.data.id).toBe(Number(chosen))
    expect(ref.data.provider).toBe('tiktok')
    if (concertCount > 0) expect(ref.data.concert).not.toBeNull()
  })

  test('the clip now shows in the library with the concert as owner', async ({ page }) => {
    await page.goto('/admin/clips')
    await searchTable(page, CLIP_URL)
    const row = page.locator('tbody tr', { hasText: 'TikTok' }).first()
    await expect(row).toBeVisible()
    await expect(row.locator('td').nth(3)).toHaveText(concertCount > 0 ? '1' : '0')   // "Attached to"
  })
})
