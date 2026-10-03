import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * A member's page lists their own gear, with each item's type named in the
 * page's language — and leaves out the tech-rider notes the API also sends.
 * Seeds a member with gear, rebuilds the public site, checks /en and /pl,
 * then deletes the member and rebuilds again.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

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

test.describe.serial('Public — member gear', () => {
  failOnPageError()

  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  let memberId: number | null = null
  let slug = ''

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    const res = await request.post(`${API}/api/band-profile/members`, {
      headers: headers(),
      data: {
        first_name: 'Gear',
        last_name: `Member${stamp}`,
        default_gear: [
          { id: 'g1', type: 'amp_head', label: 'Main amp', brand_model: 'Orange Rockerverb 50', own_gear: true, notes: 'SECRET-NOTE-do-not-publish' },
          { id: 'g2', type: 'pedal_board', label: '', brand_model: 'Custom board', own_gear: true, notes: '' },
          { id: 'g3', type: 'microphone', label: '', brand_model: '', own_gear: false, notes: 'empty item, skipped' },
        ],
      },
    })
    expect(res.status(), await res.text()).toBe(201)
    memberId = (await res.json()).data.id
    slug = (await res.json()).data.slug
    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    if (memberId !== null) await request.delete(`${API}/api/band-profile/members/${memberId}`, { headers: headers() })
    await rebuildAndWait(request, Date.now())
  })

  test('lists the gear with translated type names and without the notes', async ({ page, request }) => {
    const config = (await (await request.get(`${API}/api/site-config?lang=en`)).json()).data
    test.skip(config?.modules?.about === false || config?.module_config?.about?.visibility?.show_members === false,
      'Member pages are not built: About or its Members section is off')
    const en = config?.module_config?.about?.slug ?? 'about'
    const pl = (await (await request.get(`${API}/api/site-config?lang=pl`)).json()).data?.module_config?.about?.slug ?? 'about'

    await page.goto(`${WEB}/en/${en}/${slug}`)
    const items = page.getByTestId('member-gear-item')
    // The item with neither a label nor a model is not printed.
    await expect(items).toHaveCount(2)
    await expect(items.first()).toContainText('Amp Head')
    await expect(items.first()).toContainText('Main amp')
    await expect(items.first()).toContainText('Orange Rockerverb 50')
    await expect(page.locator('body')).not.toContainText('SECRET-NOTE')

    await page.goto(`${WEB}/pl/${pl}/${slug}`)
    await expect(page.getByTestId('member-gear-item').first()).toContainText('Głowa wzmacniacza')
  })
})
