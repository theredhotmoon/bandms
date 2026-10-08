import { test, expect, expectToast } from '../../fixtures/test-base'
import { adminToken, TEST_PNG } from '../../fixtures/admin-api'

/**
 * Adding photos to an album that already exists.
 *
 * `POST /api/albums/{album}/photos` was in the API from the start, but the
 * admin never called it: the only uploader was the New Album modal, so a band
 * could not add a single picture to an album without recreating it.
 *
 * Seeds its own album rather than using whatever the dev database holds —
 * photos.spec.ts skips almost everything when there are no albums, which is
 * exactly how this gap went unnoticed.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })



const headers = () => ({ Accept: 'application/json', Authorization: `Bearer ${adminToken()}` })
const title = `E2E Add Photos ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
let albumId: number | null = null

// Cleanup lives in afterEach, not a `finally`: when the test times out its
// request context is already closed by the time a `finally` runs, so the
// delete threw and the album stayed in the shared dev database.
test.afterEach(async ({ request, baseURL }) => {
  // If seeding timed out the album may still exist — find it by title.
  if (albumId === null) {
    const list = (await (await request.get(`${baseURL}/api/albums`, { headers: headers() })).json()).data as { id: number; title: string }[]
    albumId = list.find((a) => a.title === title)?.id ?? null
  }
  if (albumId !== null) {
    const res = await request.delete(`${baseURL}/api/albums/${albumId}`, { headers: headers() })
    expect(res.ok(), `cleanup delete failed with ${res.status()}`).toBeTruthy()
  }
})

test('a photo can be added to an existing album from its photo grid', async ({ page, request, baseURL }) => {
  // Each upload stores a file server-side; on a loaded dev machine that has
  // taken ~26 s, past the 30 s default.
  test.setTimeout(120_000)

  const seeded = await request.post(`${baseURL}/api/albums/batch`, {
    headers: headers(),
    timeout: 90_000,
    multipart: {
      title,
      'files[]': { name: 'first.png', mimeType: 'image/png', buffer: TEST_PNG },
      'captions[]': 'first',
    },
  })
  expect(seeded.status(), await seeded.text()).toBe(201)
  albumId = (await seeded.json()).data.id

  await page.goto('/admin/photos')
  await page.waitForLoadState('networkidle')

  const row = page.locator('tbody tr').filter({ hasText: title })
  await expect(row.locator('.photo-count-btn')).toHaveText('1 photo')
  await row.locator('.photo-count-btn').click()

  const modal = page.locator('.modal-overlay')
  await expect(modal.locator('.photo-item')).toHaveCount(1)

  await modal.getByRole('button', { name: '+ Add photos' }).click()
  const adder = modal.getByTestId('album-add-photos')
  await adder.locator('input[type="file"]').setInputFiles({
    name: 'second.png', mimeType: 'image/png', buffer: TEST_PNG,
  })

  const saved = page.waitForResponse(
    (r) => r.url().endsWith(`/api/albums/${albumId}/photos`) && r.request().method() === 'POST',
    { timeout: 90_000 },
  )
  await adder.getByRole('button', { name: 'Upload 1 photo' }).click()
  expect((await saved).status()).toBe(200)

  await expectToast(page, '1 photo added')
  await expect(adder).toHaveCount(0)
  await expect(modal.locator('.photo-item')).toHaveCount(2)

  // The list behind the modal picks it up too, and so does the server.
  await expect(row.locator('.photo-count-btn')).toHaveText('2 photos')
  const album = (await (await request.get(`${baseURL}/api/albums/${albumId}`, { headers: headers() })).json()).data
  expect(album.photos).toHaveLength(2)
})
