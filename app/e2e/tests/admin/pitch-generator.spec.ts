import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

/**
 * band-contacts.spec.ts:104/:123 already assert this view's heading, so the
 * English default has a second dependency on content.pitch.title — worth
 * knowing before anyone changes the default locale.
 *
 * This is the first spec for the view itself. The migration turned its
 * `pitchTypes` const array into a computed so the tab labels re-render on a
 * language switch. A const would have frozen them at module load and looked
 * fine in every English run — which is exactly the failure this asserts.
 *
 * The generated email body is deliberately NOT asserted here: it is outgoing
 * mail to a third party, stays English pending its own language picker, and
 * pinning it would make that future change look like a regression.
 */
test.describe('Pitch Generator', () => {
  test.describe.configure({ mode: 'serial' })

  test('renders its chrome and the six pitch types', async ({ page }) => {
    await page.goto('/admin/pitch')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('.pg-title')).toHaveText('Pitch Generator')
    for (const label of ['Venue / Booker', 'Music Blog / PR', 'Playlist Curator', 'Festival']) {
      await expect(page.locator('.type-tab').filter({ hasText: label })).toBeVisible()
    }
  })

  test('the tab labels follow a language switch', async ({ page }) => {
    await page.goto('/admin/pitch')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.pg-title')).toHaveText('Pitch Generator')

    await page.getByTestId('ui-lang-switcher').selectOption('pl')

    await expect(page.locator('.pg-title')).toHaveText('Generator ofert')
    // The computed is what makes these move; a const array would still read
    // "Venue / Booker" here with everything around it in Polish.
    await expect(page.locator('.type-tab').filter({ hasText: 'Klub / Booker' })).toBeVisible()
    await expect(page.locator('.type-tab').filter({ hasText: 'Kurator playlist' })).toBeVisible()
    await expect(page.locator('.type-tab').filter({ hasText: 'Venue / Booker' })).toHaveCount(0)
  })

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('admin_ui_lang'))
  })
})
