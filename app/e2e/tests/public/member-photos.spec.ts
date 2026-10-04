import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A member's page shows the photos they are tagged in, and a photo opens full
 * size. Seeds a member, a published album with two photos tagged with that
 * member, rebuilds the public site, checks, then deletes it all and rebuilds.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json')
  return entry.value
}
const headers = () => ({ Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' })

async function rebuildAndWait(request: APIRequestContext, since: number) {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    const trigger = await request.post(`${API}/api/admin/site/rebuild`, { headers: headers() })
    if (!trigger.ok() && trigger.status() !== 409) throw new Error(`POST rebuild → ${trigger.status()}`)
    while (Date.now() < deadline) {
      const body = await (await request.get(`${API}/api/admin/site/rebuild/status`, { headers: headers() })).json()
      if (body.status === 'error') throw new Error('Public site rebuild failed')
      if (body.status === 'done') {
        if ((body.startedAt ?? 0) >= since) return
        break
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

test.describe.serial('Public — member photos', () => {
  failOnPageError()

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  let memberId: number | null = null
  let memberSlug = ''
  let albumId: number | null = null

  test.beforeAll(async ({ request }) => {
    test.setTimeout(300_000)
    const member = await request.post(`${API}/api/band-profile/members`, {
      headers: headers(),
      data: { first_name: 'Photo', last_name: `Member${stamp}` },
    })
    expect(member.status(), await member.text()).toBe(201)
    memberId = (await member.json()).data.id
    memberSlug = (await member.json()).data.slug

    const album = await request.post(`${API}/api/albums/batch`, {
      headers: headers(),
      timeout: 90_000,
      multipart: {
        title: `E2E Member Photos ${stamp}`,
        published_at: new Date(Date.now() - 86_400_000).toISOString().slice(0, 16),
        'files[]': { name: 'a.png', mimeType: 'image/png', buffer: TEST_PNG },
        'captions[]': 'first',
      },
    })
    expect(album.status(), await album.text()).toBe(201)
    albumId = (await album.json()).data.id
    // A second photo, so the viewer has somewhere to step to.
    const more = await request.post(`${API}/api/albums/${albumId}/photos`, {
      headers: headers(),
      timeout: 90_000,
      multipart: { 'files[]': { name: 'b.png', mimeType: 'image/png', buffer: TEST_PNG }, 'captions[]': 'second' },
    })
    expect(more.ok(), await more.text()).toBeTruthy()

    for (const photo of (await more.json()).data.photos as { id: number }[]) {
      const tagged = await request.put(`${API}/api/photos/${photo.id}/members`, {
        headers: headers(),
        data: { member_ids: [memberId] },
      })
      expect(tagged.ok(), await tagged.text()).toBeTruthy()
    }

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    if (albumId !== null) await request.delete(`${API}/api/albums/${albumId}`, { headers: headers() })
    if (memberId !== null) await request.delete(`${API}/api/band-profile/members/${memberId}`, { headers: headers() })
    await rebuildAndWait(request, Date.now())
  })

  test('the member page shows their photos, which open full size', async ({ page, request }) => {
    const config = (await (await request.get(`${API}/api/site-config?lang=en`)).json())
    test.skip(config?.modules?.about === false || config?.module_config?.about?.visibility?.show_members === false,
      'Member pages are not built: About or its Members section is off')
    const about = config?.module_config?.about?.slug ?? 'about'

    await page.goto(`${WEB}/en/${about}/${memberSlug}`)
    const section = page.getByTestId('member-photos')
    await expect(section).toBeVisible()
    await expect(section.getByTestId('member-photo')).toHaveCount(2)

    // client:visible: the island hydrates only once it is on screen.
    await section.scrollIntoViewIfNeeded()
    await page.waitForFunction(() =>
      [...document.querySelectorAll('astro-island')].some((i) => i.getAttribute('component-url')?.includes('MemberPhotoGrid') && !i.hasAttribute('ssr')),
    )
    await section.getByTestId('member-photo').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByTestId('member-photo-full')).toBeVisible()
    await expect(dialog).toContainText('1 / 2')

    await page.keyboard.press('ArrowRight')
    await expect(dialog).toContainText('2 / 2')

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(section.getByTestId('member-photo').first()).toBeFocused()
  })
})
