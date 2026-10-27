import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The public half of the per-page content width switch
 * (/admin/website-modules → "Content width"; the admin half is in
 * tests/admin/website-modules.spec.ts).
 *
 * BaseLayout writes the module's setting onto <main> as data-content-width,
 * and every section's content box carries .page-content, which reads it. So
 * two things can break independently, and both are asserted:
 *
 *  1. The wiring — a page that forgets to pass `module` to BaseLayout is
 *     silently full width whatever the admin says.
 *  2. The measure — a section that keeps a hardcoded max-width, or never got
 *     .page-content, no longer lines up with the rest of its page. That
 *     misalignment between Contact/Home and News/Shows is what this feature
 *     was built to fix.
 *
 * Read-only: it asserts whatever the dev database holds, so it neither races
 * the admin spec nor needs a rebuild.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

/** Wider than --page-max, so 'limited' and 'full' measure differently. */
const VIEWPORT = { width: 1600, height: 1000 }
const PAGE_MAX = 1200

test.use({ storageState: { cookies: [], origins: [] }, viewport: VIEWPORT })

interface ModuleConfig { enabled: boolean; slug?: string; content_width?: 'full' | 'limited' }

async function siteConfig(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get(`${API}/api/site-config?lang=en`, { headers: { Accept: 'application/json' } })
  if (!res.ok()) throw new Error(`GET /api/site-config → ${res.status()}`)
  return (await res.json()) as { modules: Record<string, boolean>; module_config: Record<string, ModuleConfig> }
}

/** Module key → path, with the served slug resolved by the API. */
const PAGES: { module: string; path: (cfg: ModuleConfig | undefined) => string }[] = [
  { module: 'home', path: () => '/en/' },
  ...['contact', 'concerts', 'posts', 'about', 'releases', 'photos', 'videos', 'press', 'merch', 'epk', 'newsletter']
    .map(module => ({ module, path: (cfg: ModuleConfig | undefined) => `/en/${cfg?.slug ?? module}/` })),
]

test.describe('Public content width', () => {
  failOnPageError()

  for (const { module, path } of PAGES) {
    test(`${module} renders at the width set in the admin`, async ({ request, page }) => {
      const config = await siteConfig(request)
      test.skip(config.modules[module] === false, `the ${module} module is off`)

      const expected = config.module_config[module]?.content_width ?? 'full'
      const res = await page.goto(`${WEB}${path(config.module_config[module])}`)
      test.skip(!res?.ok(), `${WEB}${path(config.module_config[module])} unavailable`)

      await expect(page.locator('main')).toHaveAttribute('data-content-width', expected)

      // Content box of every visible .page-content: its left edge and width
      // once padding is taken off. Hidden ones (an empty filter state, a
      // collapsed block) measure zero and say nothing.
      const boxes = await page.locator('main .page-content').evaluateAll(els => els
        .map(el => {
          const r = el.getBoundingClientRect()
          const s = getComputedStyle(el)
          const left = r.left + parseFloat(s.paddingLeft)
          const right = r.right - parseFloat(s.paddingRight)
          const vw = document.documentElement.clientWidth // the viewport minus its scrollbar
          return { left, width: right - left, rightGap: vw - right, visible: r.width > 0 && r.height > 0 }
        })
        .filter(b => b.visible))

      expect(boxes.length, 'page has no .page-content section').toBeGreaterThan(0)

      for (const box of boxes) {
        if (expected === 'limited') {
          expect(box.width).toBeLessThanOrEqual(PAGE_MAX)
          // Centred: equal space either side, within a pixel of rounding.
          expect(Math.abs(box.left - box.rightGap)).toBeLessThanOrEqual(2)
        } else {
          expect(box.width).toBeGreaterThan(PAGE_MAX)
        }
      }

      // Every section on the page shares one content edge — the whole point.
      const lefts = boxes.map(b => Math.round(b.left))
      expect(Math.max(...lefts) - Math.min(...lefts), `content edges ${lefts.join(', ')}`).toBeLessThanOrEqual(2)
    })
  }
})
