import fs from 'node:fs'
import { test, expect } from '../../fixtures/test-base'

/**
 * A member's Public page tab: the link to their page on the website, a QR
 * code for it and the downloads. Seeds its own member and deletes it after,
 * so the slug is known and nothing is left in the shared dev database.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

function adminToken(): string {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/admin.json', 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}

const headers = () => ({ Accept: 'application/json', Authorization: `Bearer ${adminToken()}` })
const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
let memberId: number | null = null
let slug = ''

test.beforeEach(async ({ request, baseURL }) => {
  const res = await request.post(`${baseURL}/api/band-profile/members`, {
    headers: headers(),
    data: { first_name: 'Qr', last_name: `Member${stamp}`, role: 'Trombone' },
  })
  expect(res.status(), await res.text()).toBe(201)
  const body = (await res.json()).data
  memberId = body.id
  slug = body.slug
})

// afterEach, not a `finally`: a timed-out test's request context is closed
// before a `finally` runs, which would leave the member behind.
test.afterEach(async ({ request, baseURL }) => {
  if (memberId === null) return
  const res = await request.delete(`${baseURL}/api/band-profile/members/${memberId}`, { headers: headers() })
  expect(res.ok(), `cleanup delete failed with ${res.status()}`).toBeTruthy()
})

test('the Public page tab shows the member page URL and a QR code for it', async ({ page, baseURL }) => {
  expect(slug).toBe(`qr-member${stamp}`)

  await page.goto('/admin/band-members')
  await page.waitForLoadState('networkidle')
  await page.locator('.member-item').filter({ hasText: `Member${stamp}` }).click()
  await page.getByTestId('member-tab-public').click()

  const panel = page.getByTestId('member-public-page')
  // The About module may carry a custom slug, so only its shape is pinned.
  await expect(panel.getByTestId('member-public-url')).toHaveText(new RegExp(`^${baseURL}/en/[a-z0-9-]+/${slug}$`))

  const qr = panel.getByTestId('member-qr')
  await expect(qr).toBeVisible()
  await expect(qr).toHaveAttribute('src', /^data:image\/png;base64,/)
  // The image must actually have decoded, not merely carry a src.
  expect(await qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(100)

  await expect(panel.getByTestId('member-qr-svg')).toHaveAttribute('href', /^data:image\/svg\+xml/)
  await expect(panel.getByTestId('member-qr-svg')).toHaveAttribute('download', `qr-${slug}.svg`)
})
