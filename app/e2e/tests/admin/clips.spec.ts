import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { confirmDelete, expectToast, searchTable } from '../../fixtures/test-base'

test.use({ storageState: 'e2e/.auth/admin.json' })

const API = process.env.E2E_API_URL ?? 'http://localhost:8081'
const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const TITLE = `E2E clip ${STAMP}`
const EDITED = `${TITLE} edited`
// A video id no other spec uses: concert-clips.spec.ts seeds dQw4w9WgXcQ on the
// same concert in parallel, and this file's cleanup deletes by url + owner.
const QUICK_URL = 'https://www.youtube.com/watch?v=9bZkp7q19f0'

/**
 * storageState replays cookies only, and e2e/.auth/admin.json holds none — an
 * API context built from it is anonymous. The token has to be lifted out and
 * sent explicitly. Path is relative to the Playwright cwd (app/): these spec
 * files are ESM, so __dirname does not exist.
 */
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

type ApiClip = { id: number; title: string | null; url: string; owners: { type: string; id: number }[] }

/**
 * The clips library end to end: create from /admin/clips with a concert
 * owner, edit, see and detach it from the concert form, quick-add from the
 * concert form, delete. Serial because each step builds on the last.
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
    await page.getByRole('button', { name: '+ Add clip' }).click()
    const form = page.getByTestId('clip-form')

    await form.locator('input').first().fill('https://vimeo.com/76979871')
    await expect(form.locator('.provider-badge')).toHaveText('Vimeo')
    await form.getByTestId('clip-title-en').fill(TITLE)
    await form.getByTestId('clip-category-custom').fill('charity gig')

    await form.getByRole('button', { name: /^Concerts/ }).click()
    await form.locator('.checkbox-item', { hasText: concertDate }).first().locator('input').check()

    await form.getByRole('button', { name: 'Create' }).click()
    await expectToast(page, 'Clip created')

    await searchTable(page, TITLE)
    const row = page.locator('tbody tr', { hasText: TITLE })
    await expect(row).toBeVisible()
    await expect(row).toContainText('charity gig')
    await expect(row).toContainText('Vimeo')
    await expect(row.locator('td').nth(3)).toHaveText('1')   // "Attached to"
  })

  test('edits the title and switches to a preset category', async ({ page }) => {
    await page.goto('/admin/clips')
    await searchTable(page, TITLE)
    await page.locator('tbody tr', { hasText: TITLE }).getByRole('button', { name: 'Edit' }).click()
    const form = page.getByTestId('clip-form')

    await form.getByTestId('clip-title-en').fill(EDITED)
    // `exact` keeps the chip from matching the relations panel's "Concerts (1)" toggle.
    await form.getByRole('button', { name: 'Backstage', exact: true }).click()
    await form.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Clip updated')

    await searchTable(page, EDITED)
    const row = page.locator('tbody tr', { hasText: EDITED })
    await expect(row).toContainText('Backstage')
  })

  test('the concert form lists the clip and can detach it', async ({ page, request }) => {
    const clips = (await (await api(request, 'get', '/api/clips')).json()).data as ApiClip[]
    expect(clips.find(c => c.title === EDITED)?.owners).toEqual([expect.objectContaining({ type: 'concert', id: concertId })])

    await openConcertForm(page)

    const field = page.getByTestId('attached-clips')
    const row = field.getByTestId('attached-clip').filter({ hasText: EDITED })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Backstage · Vimeo')
    await row.getByTitle('Detach clip').click()
    await expectToast(page, 'Clip detached')
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
    await field.getByRole('button', { name: 'Add clip' }).click()
    await expectToast(page, 'Clip added')
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
    await expectToast(page, 'Clip deleted')
    await expect(page.locator('tbody tr', { hasText: EDITED })).toHaveCount(0)
  })
})
