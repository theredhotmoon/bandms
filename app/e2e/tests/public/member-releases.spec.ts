import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A member's page lists the releases they played on, each leading to the
 * release page. Seeds a member and a release they played on, rebuilds the
 * public site, checks, then deletes both and rebuilds again.
 *
 * Skips when the releases module is switched off: the pages it links to are
 * then not built.
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

test.describe.serial('Public — member releases', () => {
  failOnPageError()

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const title = `E2E Member Record ${stamp}`
  let memberId: number | null = null
  let slug = ''
  let releaseId: number | null = null

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    const member = await request.post(`${API}/api/band-profile/members`, { headers: headers(), data: { first_name: 'Record', last_name: `Member${stamp}` } })
    expect(member.status(), await member.text()).toBe(201)
    memberId = (await member.json()).data.id
    slug = (await member.json()).data.slug

    const release = await request.post(`${API}/api/releases`, {
      headers: headers(),
      data: { title: { en: title }, type: 'LP', release_date: '2025-05-05', member_ids: [memberId] },
    })
    expect(release.status(), await release.text()).toBe(201)
    releaseId = (await release.json()).data.id
    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    if (releaseId !== null) await request.delete(`${API}/api/releases/${releaseId}`, { headers: headers() })
    if (memberId !== null) await request.delete(`${API}/api/band-profile/members/${memberId}`, { headers: headers() })
    await rebuildAndWait(request, Date.now())
  })

  test('lists the release, which leads to its page', async ({ page, request }) => {
    // site-config is not wrapped in `data`.
    const config = await (await request.get(`${API}/api/site-config?lang=en`)).json()
    test.skip(config?.modules?.about === false || config?.module_config?.about?.visibility?.show_members === false,
      'Member pages are not built: About or its Members section is off')
    test.skip(config?.modules?.releases === false, 'Releases module is off, so release pages are not built')
    const about = config?.module_config?.about?.slug ?? 'about'
    const releases = config?.module_config?.releases?.slug ?? 'releases'

    await page.goto(`${WEB}/en/${about}/${slug}`)
    const item = page.getByTestId('member-release')
    await expect(item).toHaveCount(1)
    await expect(item).toContainText(title)
    await expect(item).toContainText('2025')
    await expect(item).toHaveAttribute('href', `/en/${releases}/${releaseId}`)

    await item.click()
    await expect(page.locator('h1')).toContainText(title)
  })
})
