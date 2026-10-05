import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A member's page lists the music videos they appear in, each opening the
 * video itself. Seeds a member and a published video, rebuilds the public
 * site, checks, then deletes both and rebuilds again.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

function adminToken(): string {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/admin.json', 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}
const headers = () => ({ Accept: 'application/json', Authorization: `Bearer ${adminToken()}` })

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

test.describe.serial('Public — member videos', () => {
  failOnPageError()

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const url = `https://www.youtube.com/watch?v=e2e${stamp.slice(-8)}`
  let memberId: number | null = null
  let slug = ''
  let videoId: number | null = null

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    const member = await request.post(`${API}/api/band-profile/members`, {
      headers: headers(),
      data: { first_name: 'Video', last_name: `Member${stamp}` },
    })
    expect(member.status(), await member.text()).toBe(201)
    memberId = (await member.json()).data.id
    slug = (await member.json()).data.slug

    const video = await request.post(`${API}/api/music-videos`, {
      headers: headers(),
      data: { title: `E2E Video ${stamp}`, video_url: url, published_at: '2026-01-01', member_ids: [memberId] },
    })
    expect(video.status(), await video.text()).toBe(201)
    videoId = (await video.json()).data.id
    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    if (videoId !== null) await request.delete(`${API}/api/music-videos/${videoId}`, { headers: headers() })
    if (memberId !== null) await request.delete(`${API}/api/band-profile/members/${memberId}`, { headers: headers() })
    await rebuildAndWait(request, Date.now())
  })

  test('lists the video, which links out to it', async ({ page, request }) => {
    // site-config is not wrapped in `data`.
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.about === false || config?.module_config?.about?.visibility?.show_members === false,
      'Member pages are not built: About or its Members section is off')
    test.skip(config?.modules?.videos === false, 'Videos module is off')
    const about = config?.module_config?.about?.slug ?? 'about'

    await page.goto(`${WEB}/en/${about}/${slug}`)
    const video = page.getByTestId('member-video')
    await expect(video).toHaveCount(1)
    await expect(video).toContainText(`E2E Video ${stamp}`)
    await expect(video).toHaveAttribute('href', url)
    await expect(video).toHaveAttribute('target', '_blank')
  })
})
