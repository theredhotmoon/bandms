import { test, expect } from '@playwright/test'
import { adminHeaders } from '../../fixtures/admin-api'

/**
 * The activity log: a change made in the admin shows up with who made it,
 * the record it touched and the old → new values, and a record's History
 * button narrows the log to that record.
 *
 * Seeds through the API (a tag — the smallest entity with a name), so the
 * entry it looks for is one this run made. Its own create/edit/delete are
 * logged too; that is the feature, not a leak.
 */
test.use({ storageState: 'e2e/.auth/admin.json' })

const NAME = `e2e-activity-${Date.now()}`
let tagId = 0

test.describe('Activity log', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ request }) => {
    const created = await request.post('/api/tags', { headers: adminHeaders(), data: { name: { en: NAME } } })
    expect(created.ok(), await created.text()).toBe(true)
    tagId = (await created.json()).data.id

    const edited = await request.put(`/api/tags/${tagId}`, { headers: adminHeaders(), data: { name: { en: `${NAME}-edited` } } })
    expect(edited.ok(), await edited.text()).toBe(true)
  })

  test.afterAll(async ({ request }) => {
    if (tagId) await request.delete(`/api/tags/${tagId}`, { headers: adminHeaders() })
  })

  test('is reachable from the admin nav', async ({ page }) => {
    // Users sits in the same "More" group, which opens for the active route.
    // By href, not by text: the menu may be in either UI language.
    await page.goto('/admin/users')
    await page.locator('a.nav-item[href$="/activity"]').click()
    await expect(page).toHaveURL(/\/admin\/activity$/)
    await expect(page.getByTestId('activity-filters')).toBeVisible()
  })

  test('shows the edit with who did it and the old and new value', async ({ page }) => {
    await page.goto(`/admin/activity?q=${NAME}&action=updated`)

    const entry = page.getByTestId('activity-entry').filter({ hasText: `${NAME}-edited` }).first()
    await expect(entry).toBeVisible()
    await expect(entry).toHaveAttribute('data-action', 'updated')
    // The person, not "System": the edit went through the admin's token.
    await expect(entry.locator('.ae-system')).toHaveCount(0)

    await entry.getByTestId('activity-details-toggle').click()
    const nameRow = page.getByTestId('activity-change').locator('tr[data-field="name"]').first()
    await expect(nameRow.locator('.ad-before')).toContainText(NAME)
    await expect(nameRow.locator('.ad-after')).toContainText(`${NAME}-edited`)
  })

  test('History narrows the log to one record, through the URL', async ({ page }) => {
    await page.goto(`/admin/activity?q=${NAME}`)

    await page.getByTestId('activity-entry').first().getByTestId('activity-history').click()

    await expect(page).toHaveURL(new RegExp(`subject_type=Tag&subject_id=${tagId}`))
    await expect(page.getByTestId('activity-history-note')).toContainText(`#${tagId}`)
    // Created, then edited — newest first.
    await expect(page.getByTestId('activity-entry')).toHaveCount(2)
    await expect(page.getByTestId('activity-entry').first()).toHaveAttribute('data-action', 'updated')
    await expect(page.getByTestId('activity-entry').last()).toHaveAttribute('data-action', 'created')
  })
})
