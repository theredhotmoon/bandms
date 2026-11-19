import { anonymousVisitor } from '../../fixtures/visitor'
import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'
import { adminHeaders, postRequiredFields, rebuildAndWait, moduleSectionSlug, TEST_PNG } from '../../fixtures/admin-api'

/**
 * A news post linked to a photo album (admin → Link to… → Photo albums):
 * the post shows the album as a card, the card opens the album's own page,
 * that page's photos open in the lightbox, and the album page links back to
 * the post under "See also".
 *
 * Seeds a published album with two photos and a published post linking it,
 * rebuilds the public site, checks, then deletes both and rebuilds. The
 * Gallery and News modules are switched on for the run when they are off
 * (the dev database has had Gallery off), and back off afterwards — a spec
 * that skips whenever a module happens to be off proves nothing.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: anonymousVisitor() })

/** Wait for the island holding `selector` to hydrate (see gallery.spec.ts). */
async function hydrated(page: import('@playwright/test').Page, selector: string) {
  await page.locator(selector).first().scrollIntoViewIfNeeded()
  await page.waitForFunction(
    (sel) => {
      const island = document.querySelector(sel)?.closest('astro-island')
      return Boolean(island) && !island!.hasAttribute('ssr')
    },
    selector,
    { timeout: 10_000 },
  )
}

test.describe.serial('Public — albums linked from a news post', () => {
  failOnPageError()

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const albumTitle = `E2E Linked Album ${stamp}`
  const postTitle = `E2E Album Post ${stamp}`
  let albumId: number | null = null
  let albumSlug = ''
  let postId: number | null = null
  let postSlug = ''
  let photosSection: string | null = null
  let postsSection: string | null = null
  const enabledByUs: string[] = []

  test.beforeAll(async ({ request }) => {
    test.setTimeout(300_000)
    const modules = (await (await request.get(`${API}/api/admin/modules`, { headers: adminHeaders() })).json())
      .data as { slug: string; enabled: boolean }[]
    for (const slug of ['photos', 'posts']) {
      if (modules.find(m => m.slug === slug)?.enabled === false) {
        const on = await request.put(`${API}/api/admin/modules/${slug}`, { headers: adminHeaders(), data: { enabled: true } })
        expect(on.ok(), await on.text()).toBeTruthy()
        enabledByUs.push(slug)
      }
    }
    photosSection = await moduleSectionSlug(request, 'photos', 'en', API)
    postsSection = await moduleSectionSlug(request, 'posts', 'en', API)

    const album = await request.post(`${API}/api/albums/batch`, {
      headers: adminHeaders(),
      timeout: 90_000,
      multipart: {
        title: albumTitle,
        published_at: new Date(Date.now() - 86_400_000).toISOString().slice(0, 16),
        'files[]': { name: 'a.png', mimeType: 'image/png', buffer: TEST_PNG },
        'captions[]': 'first',
      },
    })
    expect(album.status(), await album.text()).toBe(201)
    albumId = (await album.json()).data.id
    albumSlug = (await album.json()).data.slug
    const more = await request.post(`${API}/api/albums/${albumId}/photos`, {
      headers: adminHeaders(),
      timeout: 90_000,
      multipart: { 'files[]': { name: 'b.png', mimeType: 'image/png', buffer: TEST_PNG }, 'captions[]': 'second' },
    })
    expect(more.ok(), await more.text()).toBeTruthy()

    const post = await request.post(`${API}/api/posts`, {
      headers: adminHeaders(),
      data: {
        ...(await postRequiredFields(request, API)),
        title: { en: postTitle },
        published_at: new Date(Date.now() - 3_600_000).toISOString().slice(0, 16),
        album_ids: [albumId],
      },
    })
    expect(post.status(), await post.text()).toBe(201)
    postId = (await post.json()).data.id
    postSlug = (await post.json()).data.translations?.slug?.en ?? (await post.json()).data.slug

    await rebuildAndWait(request, Date.now(), API)
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    if (postId !== null) await request.delete(`${API}/api/posts/${postId}`, { headers: adminHeaders() })
    if (albumId !== null) await request.delete(`${API}/api/albums/${albumId}`, { headers: adminHeaders() })
    for (const slug of enabledByUs) {
      await request.put(`${API}/api/admin/modules/${slug}`, { headers: adminHeaders(), data: { enabled: false } })
    }
    await rebuildAndWait(request, Date.now(), API)
  })

  test('the post shows the album as a card leading to its page', async ({ page }) => {
    await page.goto(`${WEB}/en/${postsSection}/${postSlug}`)

    const cards = page.getByTestId('linked-albums').getByTestId('linked-album-card')
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText(albumTitle)
    await expect(cards.first()).toContainText('2')
    await expect(cards.first()).toHaveAttribute('href', `/en/${photosSection}/${albumSlug}`)

    await cards.first().click()
    await expect(page).toHaveURL(new RegExp(`/en/${photosSection}/${albumSlug}/?$`))
    await expect(page.getByRole('heading', { level: 1, name: albumTitle })).toBeVisible()
  })

  test('the album page opens its photos in the lightbox', async ({ page }) => {
    await page.goto(`${WEB}/en/${photosSection}/${albumSlug}`)
    await hydrated(page, '.ap-thumb')

    await page.getByRole('button', { name: 'Open photo 1' }).click()
    const dialog = page.getByTestId('album-lightbox')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-label', albumTitle)
    const counter = page.getByTestId('album-lightbox-counter')
    await expect(counter).toHaveText('1 / 2')

    await dialog.getByRole('button', { name: 'Next photo' }).click()
    await expect(counter).toHaveText('2 / 2')
    await expect(dialog).toContainText('second')

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    // Focus goes back to the photo that opened it.
    await expect(page.getByRole('button', { name: 'Open photo 1' })).toBeFocused()
  })

  test('the album page links back to the post, and to the gallery', async ({ page }) => {
    await page.goto(`${WEB}/en/${photosSection}/${albumSlug}`)

    const also = page.getByTestId('album-see-also')
    await expect(also).toBeVisible()
    const link = also.getByRole('link', { name: new RegExp(postTitle) })
    await expect(link).toHaveAttribute('href', `/en/${postsSection}/${postSlug}`)

    await expect(page.getByTestId('album-back')).toHaveAttribute('href', `/en/${photosSection}`)
  })

  test('the gallery card opens the album page', async ({ page }) => {
    await page.goto(`${WEB}/en/${photosSection}`)

    const card = page.getByTestId('gallery-album-card').filter({ hasText: albumTitle })
    await expect(card).toHaveAttribute('href', `/en/${photosSection}/${albumSlug}`)
  })
})
