import { test, expect } from '@playwright/test'
import { adminHeaders } from '../../fixtures/admin-api'

/**
 * One account per band member: in the Users form, a member who already has a
 * login is a disabled option, except in that very user's own Edit form.
 *
 * Creates one throwaway user linked to a member nobody has claimed, and
 * deletes it afterwards. Skips if every member already has an account.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

const EMAIL = `e2e-member-unique-${Date.now()}@test.com`
let userId = 0
let memberId = 0

test.describe('Users — one account per member', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ request }) => {
    const [usersRes, membersRes] = await Promise.all([
      request.get('/api/users', { headers: adminHeaders() }),
      request.get('/api/band-profile/members', { headers: adminHeaders() }),
    ])
    const users = (await usersRes.json()) as { band_member_id: number | null }[]
    const members = (await membersRes.json()).data as { id: number }[]
    const taken = new Set(users.map(u => u.band_member_id))
    memberId = members.find(m => !taken.has(m.id))?.id ?? 0
    if (!memberId) return

    const res = await request.post('/api/users', {
      headers: adminHeaders(),
      data: {
        first_name: 'Unique', last_name: 'Member', email: EMAIL,
        password: 'Password1', password_confirmation: 'Password1',
        role: 'member', band_member_id: memberId,
      },
    })
    expect(res.ok(), await res.text()).toBe(true)
    userId = (await res.json()).id
  })

  test.afterAll(async ({ request }) => {
    if (userId) {
      const res = await request.delete(`/api/users/${userId}`, { headers: adminHeaders() })
      expect(res.ok(), await res.text()).toBe(true)
    }
  })

  test('Add User greys out a member who already has an account', async ({ page }) => {
    test.skip(!memberId, 'every band member already has an account')

    await page.goto('/admin/users')
    await page.locator('.btn-add-primary').click()

    const option = page.locator(`.modal-overlay select option[value="${memberId}"]`)
    await expect(option).toBeDisabled()
    await expect(option).toContainText('Unique Member')
  })

  test('the linked user can keep their own member', async ({ page }) => {
    test.skip(!memberId, 'every band member already has an account')

    await page.goto('/admin/users')
    await page.locator('tr').filter({ hasText: EMAIL }).locator('.btn-edit').click()

    const select = page.locator('.modal-overlay select').first()
    await expect(select.locator(`option[value="${memberId}"]`)).toBeEnabled()
    await expect(select).toHaveValue(String(memberId))
  })
})
