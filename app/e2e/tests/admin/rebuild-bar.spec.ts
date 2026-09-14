import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/admin.json' })

// A timestamp alone collided across parallel workers before (see the
// SeedE2eTicket fixture-naming footgun in the root CLAUDE.md) — a random
// suffix avoids the same class of collision here.
const SUFFIX = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const QUESTION_EN = `e2e-rebuild-probe-${SUFFIX}`
const QUESTION_PL = `${QUESTION_EN}-pl`

/**
 * RebuildBar (mounted globally in AdminLayout) shows a global pending-areas
 * count and clears it via a manual rebuild — see RebuildBar.vue,
 * useSiteRebuild.ts and SiteRebuildController::rebuild(), which clears every
 * pending area unconditionally the moment a rebuild is requested, not when it
 * finishes.
 *
 * The dev database is shared with every other spec file, and this suite's
 * workers run two files at once, so other areas may already be pending before
 * this test starts. Assertions compare against a captured baseline rather
 * than an absolute count for that reason.
 */
test.describe('Rebuild Bar', () => {
  test.describe.configure({ mode: 'serial' })

  test('shows a pending change after a FAQ edit, names it in the popover, and clears it after a manual rebuild', async ({ page }) => {
    await page.goto('/admin/faqs')
    await page.waitForLoadState('networkidle')

    const pendingCount = page.locator('.pending-count')

    // A real write: FaqController::store() calls SiteRebuild::markDirty('faqs').
    await page.getByRole('button', { name: '+ Add question' }).click()
    await page.locator('#faq-q-en').fill(QUESTION_EN)
    await page.locator('#faq-q-pl').fill(QUESTION_PL)
    await page.locator('#faq-a-en').fill('Probe answer EN')
    await page.locator('#faq-a-pl').fill('Probe answer PL')
    await page.getByRole('button', { name: /^Save$/ }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Question added', { timeout: 8000 })

    // useSiteRebuild's rebuild-status query is deliberately decoupled from
    // useFaqs — the FAQ mutation only invalidates the 'faqs' query key, not
    // 'rebuild-status' — so a reload is what picks up the newly dirty area,
    // the same way hero-images.spec.ts reloads rather than trusting an
    // unrelated cache to have refreshed on its own.
    await page.reload()
    await page.waitForLoadState('networkidle')

    // pendingAreas is a SET keyed by area name (SiteDirtyArea::markDirty does an
    // updateOrCreate), not an event counter — so if another spec already left
    // 'faqs' dirty (faqs.spec.ts, which runs in this same suite, never triggers
    // a rebuild to clear it), this write only refreshes that area's timestamp
    // rather than growing the total count. A strict "greater than baseline"
    // assertion is therefore the wrong invariant on a shared dev database; a
    // non-zero count plus 'FAQs' actually named in the popover is what this
    // write can reliably guarantee regardless of what else is already pending.
    await expect
      .poll(async () => Number((await pendingCount.textContent())?.trim() || '0'), { timeout: 8000 })
      .toBeGreaterThan(0)

    // Open the popover and confirm the FAQs area is named in it.
    await page.getByRole('button', { name: /pending change/i }).click()
    await expect(page.locator('.pending-popover').getByText('FAQs', { exact: true })).toBeVisible()

    // Trigger a manual rebuild. The backend clears every pending area
    // synchronously on request (SiteRebuildController::rebuild), so the badge
    // should reach 0 without needing another reload.
    await page.getByRole('button', { name: /Rebuild Public Site/ }).click()
    await expect(pendingCount).toHaveText('0', { timeout: 8000 })

    // Clean up the probe FAQ so it does not linger on the shared dev database
    // into the next real rebuild.
    page.on('dialog', (d) => d.accept())
    const row = page.locator('div.rounded-xl').filter({ hasText: QUESTION_EN })
    await row.getByRole('button', { name: /^Delete question/ }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Question deleted', { timeout: 8000 })
  })
})
