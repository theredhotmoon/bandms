import { test, expect } from '@playwright/test'
import { adminToken, TEST_PNG } from '../../fixtures/admin-api'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Album slugs are one translated bag (translated-slug series, table 2). An
 * album title is a single untranslated string, so only the default locale's
 * slug follows it; another locale's slug is typed by hand.
 *
 * photos.spec.ts never uploads an album — every album case there skips on an
 * empty dev database — so without this the upload path the series rewrote
 * (multipart `slug[<locale>]`, the auto-follow flag) had no coverage at all.
 */



test('uploading an album saves the title-following slug and a hand-typed one as one bag', async ({ page, request, baseURL }) => {
  // A batch upload stores the file and creates the photo row server-side; on a
  // loaded dev machine that answered in ~26 s, past the 30 s default.
  test.setTimeout(120_000)

  const stamp = Date.now()
  const title = `E2E Album ${stamp}`
  let albumId: number | null = null

  try {
    await page.goto('/admin/photos')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: '+ New Album' }).click()

    await page.getByPlaceholder('e.g. Rudeboy 2026-05-08').fill(title)
    await expect(page.locator('.slug-row[data-locale="en"] input')).toHaveValue(`e2e-album-${stamp}`)
    await page.locator('.slug-row[data-locale="pl"] input').fill(`album-pl-${stamp}`)

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'probe.png', mimeType: 'image/png', buffer: TEST_PNG,
    })

    const saved = page.waitForResponse(
      r => r.url().endsWith('/api/albums/batch') && r.request().method() === 'POST',
      { timeout: 90_000 },
    )
    await page.getByRole('button', { name: /Create album/ }).click()
    const response = await saved
    expect(response.status(), await response.text()).toBe(201)
    const body = (await response.json()).data
    albumId = body.id

    // The default locale went as null (auto) and the API generated it from the
    // title; the Polish one went as typed.
    expect(body.slug).toBe(`e2e-album-${stamp}`)
    expect(body.translations.slug).toEqual({ en: `e2e-album-${stamp}`, pl: `album-pl-${stamp}` })
  } finally {
    // If the response never arrived the album may still have been created —
    // find it by title rather than leave it in the shared dev database.
    const headers = { Accept: 'application/json', Authorization: `Bearer ${adminToken()}` }
    if (albumId === null) {
      const list = (await (await request.get(`${baseURL}/api/albums`, { headers })).json()).data as { id: number; title: string }[]
      albumId = list.find(a => a.title === title)?.id ?? null
    }
    if (albumId !== null) {
      const res = await request.delete(`${baseURL}/api/albums/${albumId}`, { headers })
      expect(res.ok(), `cleanup delete failed with ${res.status()}`).toBeTruthy()
    }
  }
})
