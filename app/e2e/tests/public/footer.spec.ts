import { test, expect } from '@playwright/test'

/**
 * The site footer.
 *
 * It appears on every page, and until this PR it was the last piece of chrome on
 * the pre-theme layout — an ink header bookending a plain footer. It is now also
 * a module, so its copy is editable and it can be switched off, and these specs
 * check both the port and that the module wiring works.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

async function siteIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe('Site footer', () => {
  test.beforeEach(async ({ request, page }) => {
    test.skip(!(await siteIsUp(request)), `${WEB}/en unavailable`)
    page.on('pageerror', (e) => {
      throw new Error(`page error: ${e.message}`)
    })
  })

  test('renders on the ink ground with its checker seam', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const footer = page.locator('footer.ft')
    await expect(footer).toBeVisible()
    await expect(footer.locator('.ft-brand')).toHaveText(/\S/)

    // The strip marks the seam between page and footer; without it the ink band
    // just starts.
    await expect(footer.locator('.ft-strip')).toHaveCount(1)
  })

  test('carries no pre-theme layout classes', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const stray = await page.evaluate(() => {
      const bad = /\b(?:font-black|mt-24|py-12|text-lg|max-w-7xl)\b|\b(?:text|bg|border)-(?:zinc|gray|neutral)-\d{2,3}\b/
      return [...document.querySelectorAll('footer [class]')]
        .map((el) => el.getAttribute('class') ?? '')
        .filter((c) => bad.test(c))
    })
    expect(stray).toEqual([])
  })

  test('shows copy from the CMS, not hardcoded strings', async ({ page, request }) => {
    const cfg = await request.get(`${API}/api/site-config?lang=en`)
    test.skip(!cfg.ok(), 'site-config unreachable')

    const settings =
      ((await cfg.json()) as { module_config?: Record<string, { settings?: Record<string, string> }> })
        .module_config?.footer?.settings ?? {}

    test.skip(!settings.booking_title, 'No footer copy configured')

    await page.goto(`${WEB}/en`)
    await expect(page.locator('footer .ft-col-title').first()).toHaveText(settings.booking_title!)
    if (settings.tagline) {
      await expect(page.locator('footer .ft-tagline')).toHaveText(settings.tagline)
    }
  })

  test('copy is localised', async ({ page, request }) => {
    const cfg = await request.get(`${API}/api/site-config?lang=pl`)
    test.skip(!cfg.ok(), 'site-config unreachable')

    const plTitle =
      ((await cfg.json()) as { module_config?: Record<string, { settings?: Record<string, string> }> })
        .module_config?.footer?.settings?.booking_title

    test.skip(!plTitle, 'No Polish footer copy configured')

    await page.goto(`${WEB}/pl`)
    await expect(page.locator('footer .ft-col-title').first()).toHaveText(plTitle!)
  })

  test('nav lists only enabled modules and never itself', async ({ page, request }) => {
    const cfg = await request.get(`${API}/api/site-config?lang=en`)
    test.skip(!cfg.ok(), 'site-config unreachable')

    const body = (await cfg.json()) as {
      modules?: Record<string, boolean>
      module_config?: Record<string, { label?: string }>
    }
    const modules = body.modules ?? {}

    const labels = (await page.goto(`${WEB}/en`))
      ? await page.locator('footer .ft-nav a').allTextContents()
      : []

    // The footer has no route, so its own label must never appear as a link.
    const footerLabel = body.module_config?.footer?.label
    if (footerLabel) expect(labels.map((l) => l.trim())).not.toContain(footerLabel)

    // Nothing disabled may be linked — a dead link is the footgun this repo
    // documents most.
    for (const [slug, enabled] of Object.entries(modules)) {
      if (enabled) continue
      const label = body.module_config?.[slug]?.label
      if (label) expect(labels.map((l) => l.trim())).not.toContain(label)
    }
  })

  test('every footer link resolves', async ({ page, request }) => {
    await page.goto(`${WEB}/en`)

    const hrefs = await page.locator('footer a[href^="/"]').evaluateAll((els) =>
      [...new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''))].filter(Boolean),
    )

    for (const href of hrefs) {
      // /admin is served by the SPA container, not Astro — out of scope here.
      if (href.startsWith('/admin')) continue
      const res = await request.get(`${WEB}${href}`)
      expect(res.status(), `${href} should not 404`).toBeLessThan(400)
    }
  })

  test('social links open safely', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const socials = page.locator('footer .ft-social')
    test.skip((await socials.count()) === 0, 'No social links configured')

    for (let i = 0; i < (await socials.count()); i++) {
      expect(await socials.nth(i).getAttribute('target')).toBe('_blank')
      expect(await socials.nth(i).getAttribute('rel')).toContain('noopener')
    }
  })

  test('appears on every kind of page, not just the homepage', async ({ page, request }) => {
    const candidates = ['/en', '/en/contact', '/en/news']

    for (const path of candidates) {
      const probe = await request.get(`${WEB}${path}`)
      if (!probe.ok()) continue
      await page.goto(`${WEB}${path}`)
      await expect(page.locator('footer.ft'), `${path} should have the footer`).toBeVisible()
    }
  })
})
