import { test, expect } from '@playwright/test'
import fs from 'node:fs'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * Release slugs are one translated bag (translated-slug series, table 4).
 *
 * On EDIT no slug fills itself in: the API never invents a non-default slug on
 * update, so a form that previewed one either dropped it (sent as null — #153's
 * review) or sent a client guess that skipped server suffixing (#154's review).
 * The rule now: the form saves exactly what it shows, and a missing slug is
 * filled only when the band presses regenerate.
 */
function adminToken(): string {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/admin.json', 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}

test('on edit a Polish slug appears only on regenerate, and is the one saved', async ({ page, request, baseURL }) => {
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

    const plSlug = modal.locator('.slug-row[data-locale="pl"] input')
    await modal.locator('.trans-row[data-locale="pl"] input').first().fill(`Wydanie ${stamp}`)
    // Not filled in by itself on an existing release…
    await expect(plSlug).toHaveValue('')
    // …but one press of regenerate does it, and that is what is saved.
    await modal.locator('.slug-row[data-locale="pl"] .slug-regen').click()
    await expect(plSlug).toHaveValue(`wydanie-${stamp}`)

    const saved = page.waitForResponse(r => r.url().endsWith(`/api/releases/${release.id}`) && r.request().method() === 'PUT')
    await modal.getByRole('button', { name: /Update release/i }).click()
    const body = (await (await saved).json()).data

    expect(body.translations.slug).toEqual({ en: `e2e-release-${stamp}`, pl: `wydanie-${stamp}` })
  } finally {
    const res = await request.delete(`${baseURL}/api/releases/${release.id}`, { headers })
    expect(res.ok(), `cleanup delete failed with ${res.status()}`).toBeTruthy()
  }
})
