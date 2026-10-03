import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A member's page lists the news linked to them, and each item leads to the
 * post. Seeds a member and a published post linked to them, rebuilds the
 * public site, checks, then deletes both and rebuilds again.
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

test.describe.serial('Public — member news', () => {
  failOnPageError()

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const title = `E2E Member Story ${stamp}`
  let memberId: number | null = null
  let slug = ''
  let postId: number | null = null

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    const member = await request.post(`${API}/api/band-profile/members`, { headers: headers(), data: { first_name: 'News', last_name: `Member${stamp}` } })
    expect(member.status(), await member.text()).toBe(201)
    memberId = (await member.json()).data.id
    slug = (await member.json()).data.slug

    const post = await request.post(`${API}/api/posts`, {
      headers: headers(),
      data: { title: { en: title }, published_at: new Date(Date.now() - 3_600_000).toISOString().slice(0, 16), member_ids: [memberId] },
    })
    expect(post.status(), await post.text()).toBe(201)
    postId = (await post.json()).data.id
    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    if (postId !== null) await request.delete(`${API}/api/posts/${postId}`, { headers: headers() })
    if (memberId !== null) await request.delete(`${API}/api/band-profile/members/${memberId}`, { headers: headers() })
    await rebuildAndWait(request, Date.now())
  })

  test('lists the linked news, which leads to the post', async ({ page, request }) => {
    const config = (await (await request.get(`${API}/api/site-config?lang=en`)).json()).data
    test.skip(config?.modules?.about === false || config?.module_config?.about?.visibility?.show_members === false,
      'Member pages are not built: About or its Members section is off')
    test.skip(config?.modules?.posts === false, 'Posts module is off, so news is not linked')
    const about = config?.module_config?.about?.slug ?? 'about'

    await page.goto(`${WEB}/en/${about}/${slug}`)
    const item = page.getByTestId('member-news-item')
    await expect(item).toHaveCount(1)
    await expect(item).toContainText(title)

    await item.click()
    await expect(page.locator('h1')).toContainText(title)
  })
})
