import { test, expect, type APIRequestContext } from '@playwright/test'
import { adminToken } from '../../fixtures/admin-api'
import { confirmDelete, expectToast, searchTable } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

const API = process.env.E2E_API_URL ?? 'http://localhost:8081'
const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const TITLE = `E2E clip ${STAMP}`
const EDITED = `${TITLE} edited`
// A video id no other spec uses: concert-clips.spec.ts seeds dQw4w9WgXcQ on the
// same concert in parallel, and this file's cleanup deletes by url + owner.
const QUICK_URL = 'https://www.youtube.com/watch?v=9bZkp7q19f0'



async function api(request: APIRequestContext, method: 'get' | 'post' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}`)
  return res
}

type ApiClip = { id: number; title: string | null; url: string; owners: { type: string; id: number }[] }

/**
 * The video library end to end: create from /admin/clips with a concert
 * owner, edit, mark it as a fan video, Retrieve and the view sync (both
 * served through page.route — E2E never reaches YouTube), see and detach it
 * from the concert form, quick-add from the concert form, delete. Serial
 * because each step builds on the last.
 */
test.describe.serial('Clips admin', () => {
  let concertId: number
  let concertDate: string

  test.beforeAll(async ({ request }) => {
    const concerts = (await (await api(request, 'get', '/api/concerts')).json()).data as { id: number; date: string }[]
    test.skip(concerts.length === 0, 'No concert to attach to')
    concertId = concerts[0].id
    concertDate = concerts[0].date
  })

  test.afterAll(async ({ request }) => {
    // Find anything this run created, in case a step failed midway: the
    // titled clip by title, the quick-added one by url + owner.
    const clips = (await (await api(request, 'get', '/api/clips')).json()).data as ApiClip[]
    const mine = clips.filter(c =>
      c.title?.startsWith(TITLE) ||
      (c.url === QUICK_URL && c.owners.some(o => o.type === 'concert' && o.id === concertId)),
    )
    for (const c of mine) await api(request, 'delete', `/api/clips/${c.id}`)
  })

  async function openConcertForm(page: import('@playwright/test').Page) {
    await page.goto('/admin/concerts')
    await searchTable(page, concertDate)
    await page.locator('tbody tr', { hasText: concertDate }).first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()
  }

  test('creates a clip with a custom category and a concert owner', async ({ page }) => {
    await page.goto('/admin/clips')
    await page.getByRole('button', { name: '+ Add video' }).click()
    const form = page.getByTestId('clip-form')

    await form.locator('input').first().fill('https://vimeo.com/76979871')
    await expect(form.locator('.provider-badge')).toHaveText('Vimeo')
    await form.getByTestId('trans-input-clip.title-en').fill(TITLE)
    // Typed key by key: the custom category starts with a preset word, and the
    // picker used to blank the field the moment the text spelled "live".
    await form.getByTestId('clip-category-custom').pressSequentially('live acoustic')

    await form.getByRole('button', { name: /^Concerts/ }).click()
    await form.locator('.checkbox-item', { hasText: concertDate }).first().locator('input').check()

    await form.getByRole('button', { name: 'Create' }).click()
    await expectToast(page, 'Video added')

    await searchTable(page, TITLE)
    const row = page.locator('tbody tr', { hasText: TITLE })
    await expect(row).toBeVisible()
    await expect(row).toContainText('live acoustic')
    await expect(row).toContainText('Vimeo')
    await expect(row.getByTestId('clip-attached-count')).toHaveText('1')
  })

  test('edits the title and switches to a preset category', async ({ page }) => {
    await page.goto('/admin/clips')
    await searchTable(page, TITLE)
    await page.locator('tbody tr', { hasText: TITLE }).getByRole('button', { name: 'Edit' }).click()
    const form = page.getByTestId('clip-form')

    await form.getByTestId('trans-input-clip.title-en').fill(EDITED)
    // `exact` keeps the chip from matching the relations panel's "Concerts (1)" toggle.
    await form.getByRole('button', { name: 'Backstage', exact: true }).click()
    await form.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Video updated')

    await searchTable(page, EDITED)
    const row = page.locator('tbody tr', { hasText: EDITED })
    await expect(row).toContainText('Backstage')
  })

  test('marks it as a fan video with a channel credit, and filters by who made it', async ({ page, request }) => {
    await page.goto('/admin/clips')
    await searchTable(page, EDITED)
    await page.locator('tbody tr', { hasText: EDITED }).getByRole('button', { name: 'Edit' }).click()
    const form = page.getByTestId('clip-form')

    await form.getByText('Fan video', { exact: true }).click()
    await form.getByTestId('clip-channel-name').fill('Gig Goer')
    await form.getByTestId('clip-channel-url').fill('https://www.youtube.com/@giggoer')
    await form.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Video updated')

    const row = page.locator('tbody tr', { hasText: EDITED })
    await expect(row.getByTestId('clip-source-badge')).toHaveText('Fan video')
    await expect(row).toContainText('Gig Goer')

    const clip = ((await (await api(request, 'get', '/api/clips')).json()).data as (ApiClip & { source: string; channel_url: string })[])
      .find(c => c.title === EDITED)
    expect(clip).toMatchObject({ source: 'fan', channel_url: 'https://www.youtube.com/@giggoer' })

    const filter = page.getByTestId('clips-source-filter')
    await filter.selectOption('official')
    await expect(page.locator('tbody tr', { hasText: EDITED })).toHaveCount(0)
    await filter.selectOption('fan')
    await expect(page.locator('tbody tr', { hasText: EDITED })).toHaveCount(1)
  })

  test('Retrieve fills the title in the band\'s first language and the channel, without overwriting typed text', async ({ page }) => {
    // A Polish-first band: the title belongs in the Polish row, not in the
    // registry's first language. Served, never written — the order decides
    // which title is required for every parallel spec (root CLAUDE.md).
    await page.route(/\/api\/admin\/content-locales$/, route => route.fulfill({ json: { data: { order: ['pl', 'en'] } } }))
    // Never reach YouTube from E2E: the endpoint is served here.
    await page.route('**/api/clips/retrieve-metadata', route => route.fulfill({
      json: {
        title: 'Live at Klub Studio', thumbnail_url: null, channel_name: 'Gig Goer',
        channel_url: 'https://www.youtube.com/@giggoer', provider_name: 'YouTube', view_count: 4321, duration: '3:12',
      },
    }))
    await page.goto('/admin/clips')
    await page.getByRole('button', { name: '+ Add video' }).click()
    const form = page.getByTestId('clip-form')

    await expect(form.getByTestId('clip-retrieve')).toBeDisabled()
    await form.locator('input').first().fill(QUICK_URL)
    await form.getByTestId('clip-channel-name').fill('Typed by hand')
    await form.getByTestId('clip-retrieve').click()

    await expect(form.getByTestId('trans-input-clip.title-pl')).toHaveValue('Live at Klub Studio')
    await expect(form.getByTestId('trans-input-clip.title-en')).toHaveValue('')
    await expect(form.getByTestId('clip-channel-name')).toHaveValue('Typed by hand')
    await expect(form.getByTestId('clip-channel-url')).toHaveValue('https://www.youtube.com/@giggoer')
    await expect(form.getByTestId('clip-meta')).toContainText('4,321 views')

    // Nothing was saved: leave without creating.
    await page.getByRole('button', { name: 'Cancel' }).click()
    const discard = page.getByRole('dialog').filter({ hasText: 'Discard changes' })
    if (await discard.isVisible().catch(() => false)) await discard.getByRole('button', { name: /discard/i }).click()
  })

  test('syncs YouTube views and shows the total', async ({ page }) => {
    await page.route('**/api/clips/sync-views', route => route.fulfill({
      json: { message: 'ok', updated: 2, total_views: 1250, synced_at: new Date().toISOString(), results: [] },
    }))
    await page.goto('/admin/clips')
    await page.getByTestId('clips-sync-views').click()
    await expectToast(page, 'Updated 2 videos — 1,250 views')
  })

  test('the concert form lists the clip and can detach it', async ({ page, request }) => {
    const clips = (await (await api(request, 'get', '/api/clips')).json()).data as ApiClip[]
    expect(clips.find(c => c.title === EDITED)?.owners).toEqual([expect.objectContaining({ type: 'concert', id: concertId })])

    await openConcertForm(page)

    const field = page.getByTestId('attached-clips')
    const row = field.getByTestId('attached-clip').filter({ hasText: EDITED })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Backstage · Vimeo')
    await row.getByTitle('Detach video').click()
    await expectToast(page, 'Video detached')
    await expect(field.getByTestId('attached-clip').filter({ hasText: EDITED })).toHaveCount(0)

    // Detaching leaves the clip in the library — only the link is gone.
    const after = (await (await api(request, 'get', '/api/clips')).json()).data as ApiClip[]
    expect(after.find(c => c.title === EDITED)?.owners).toEqual([])
  })

  test('quick-adds a clip from the concert form', async ({ page, request }) => {
    await openConcertForm(page)

    const field = page.getByTestId('attached-clips')
    await field.getByRole('button', { name: 'Studio', exact: true }).click()
    await field.getByTestId('attached-clip-url').fill(QUICK_URL)
    await expect(field.locator('.provider-badge')).toHaveText('YouTube')
    await field.getByRole('button', { name: 'Add video' }).click()
    await expectToast(page, 'Video added')
    await expect(field.getByTestId('attached-clip').filter({ hasText: 'Studio · YouTube' })).toBeVisible()

    const clips = (await (await api(request, 'get', '/api/clips')).json()).data as ApiClip[]
    const quick = clips.filter(c => c.url === QUICK_URL && c.owners.some(o => o.type === 'concert' && o.id === concertId))
    expect(quick).toHaveLength(1)
    for (const c of quick) await api(request, 'delete', `/api/clips/${c.id}`)
  })

  test('deletes the clip', async ({ page }) => {
    await page.goto('/admin/clips')
    await searchTable(page, EDITED)
    await page.locator('tbody tr', { hasText: EDITED }).getByRole('button', { name: 'Delete' }).click()
    await confirmDelete(page)
    await expectToast(page, 'Video deleted')
    await expect(page.locator('tbody tr', { hasText: EDITED })).toHaveCount(0)
  })
})
