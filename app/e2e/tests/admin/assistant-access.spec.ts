import { test, expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

/**
 * Per-user access to the assistant (Translate / Enhance) and the superadmin
 * flag, on the Users page. `/api/users` is served through `page.route`: the
 * dev backend may not carry the migration yet, and the spec must not flip
 * real accounts. The signed-in user is identified by the stored auth user.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

const USERS = /\/api\/users$/
const USER = /\/api\/users\/(\d+)$/

interface Row { id: number; first_name: string; last_name: string; email: string; role: string; is_superadmin: boolean; can_translate: boolean; can_enhance: boolean; band_member_id: null; band_member: null; created_at: string; updated_at: string }

function row(id: number, over: Partial<Row>): Row {
  return { id, first_name: `U${id}`, last_name: 'Test', email: `u${id}@x.test`, role: 'member', is_superadmin: false, can_translate: false, can_enhance: false, band_member_id: null, band_member: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...over }
}

async function meId(page: Page): Promise<number> {
  await page.goto('/admin')
  return page.evaluate(() => JSON.parse(localStorage.getItem('auth_user') ?? '{}').id as number)
}

async function serveUsers(page: Page, rows: Row[], puts: { id: number; body: Record<string, unknown> }[]) {
  await page.route(USERS, route => route.fulfill({ json: rows }))
  await page.route(USER, async (route: Route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    const id = Number(route.request().url().match(USER)![1])
    const body = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
    puts.push({ id, body })
    const target = rows.find(r => r.id === id)!
    Object.assign(target, body)
    return route.fulfill({ json: target })
  })
}

test('a superadmin switches a user\'s Enhance on and it sticks', async ({ page }) => {
  const me = await meId(page)
  const rows = [row(me, { role: 'admin', is_superadmin: true }), row(9001, {})]
  const puts: { id: number; body: Record<string, unknown> }[] = []
  await serveUsers(page, rows, puts)

  await page.goto('/admin/users')
  const target = page.locator('tr', { hasText: 'u9001@x.test' })
  const enhance = target.getByRole('switch', { name: /enhance/i })
  await expect(enhance).toHaveAttribute('aria-checked', 'false')

  await enhance.click()
  await expect(enhance).toHaveAttribute('aria-checked', 'true')
  expect(puts).toEqual([{ id: 9001, body: { can_enhance: true } }])
})

test('a superadmin can make another user superadmin', async ({ page }) => {
  const me = await meId(page)
  const rows = [row(me, { role: 'admin', is_superadmin: true }), row(9002, { role: 'admin' })]
  const puts: { id: number; body: Record<string, unknown> }[] = []
  await serveUsers(page, rows, puts)

  await page.goto('/admin/users')
  const target = page.locator('tr', { hasText: 'u9002@x.test' })
  await target.getByRole('switch', { name: /superadmin/i }).click()
  await expect(target.getByRole('switch', { name: /superadmin/i })).toHaveAttribute('aria-checked', 'true')
  expect(puts[0]).toEqual({ id: 9002, body: { is_superadmin: true } })
})

test('a regular admin sees the switches but cannot change them', async ({ page }) => {
  const me = await meId(page)
  const rows = [row(me, { role: 'admin', is_superadmin: false }), row(9003, { can_translate: true })]
  const puts: { id: number; body: Record<string, unknown> }[] = []
  await serveUsers(page, rows, puts)

  await page.goto('/admin/users')
  const target = page.locator('tr', { hasText: 'u9003@x.test' })
  await expect(target.getByRole('switch', { name: /translate/i })).toHaveAttribute('aria-checked', 'true')
  await expect(target.getByRole('switch', { name: /translate/i })).toBeDisabled()
  await expect(target.getByRole('switch', { name: /enhance/i })).toBeDisabled()
  await expect(target.getByRole('switch', { name: /superadmin/i })).toBeDisabled()
  expect(puts).toHaveLength(0)
})

test('a superadmin row shows both features as always on', async ({ page }) => {
  const me = await meId(page)
  const rows = [row(me, { role: 'admin', is_superadmin: true }), row(9004, { role: 'admin', is_superadmin: true })]
  await serveUsers(page, rows, [])

  await page.goto('/admin/users')
  const target = page.locator('tr', { hasText: 'u9004@x.test' })
  await expect(target.getByRole('switch', { name: /translate/i })).toHaveAttribute('aria-checked', 'true')
  await expect(target.getByRole('switch', { name: /translate/i })).toBeDisabled()
})
