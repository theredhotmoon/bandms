import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Release slugs are one translated bag (translated-slug series, table 4). Each
 * locale's slug follows its own title while it is auto — but the API only
 * GENERATES a missing non-default slug on create. So on edit the form must send
 * a previewed slug as the value it shows, not as null: #153's review found the
 * Polish slug shown, saved as null, dropped, and gone on reopen.
 */
function adminToken(): string {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/admin.json', 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}

test('a Polish slug previewed while editing is the one that is saved', async ({ page, request, baseURL }) => {
  const stamp = Date.now()
  const headers = { Accept: 'application/json', Authorization: `Bearer ${adminToken()}` }

  // An English-only release: it has no Polish slug yet.
  const created = await request.post(`${baseURL}/api/releases`, {
    headers, data: { title: { en: `E2E Release ${stamp}` }, type: 'EP' },
  })
  expect(created.status(), await created.text()).toBe(201)
  const release = (await created.json()).data
  expect(release.translations.slug.pl).toBeNull()

  try {
    await page.goto('/admin/releases')
    await page.waitForLoadState('networkidle')
    await page.locator('input[aria-label="Search"]').fill(`E2E Release ${stamp}`)
    await page.locator('tr').filter({ hasText: `E2E Release ${stamp}` }).getByRole('button', { name: /edit/i }).click()
    const modal = page.locator('.modal-overlay')

    await modal.locator('.trans-row[data-locale="pl"] input').first().fill(`Wydanie ${stamp}`)
    await expect(modal.locator('.slug-row[data-locale="pl"] input')).toHaveValue(`wydanie-${stamp}`)

    const saved = page.waitForResponse(r => r.url().endsWith(`/api/releases/${release.id}`) && r.request().method() === 'PUT')
    await modal.getByRole('button', { name: /Update release/i }).click()
    const body = (await (await saved).json()).data

    expect(body.translations.slug).toEqual({ en: `e2e-release-${stamp}`, pl: `wydanie-${stamp}` })
  } finally {
    const res = await request.delete(`${baseURL}/api/releases/${release.id}`, { headers })
    expect(res.ok(), `cleanup delete failed with ${res.status()}`).toBeTruthy()
  }
})
