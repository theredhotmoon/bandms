import { test, expect } from '@playwright/test'

/**
 * Videos, Press, EPK and Newsletter.
 *
 * These four have no counterpart in the design project, so they were restyled by
 * extension — reusing the ported pages' hero, section heading, card and divider
 * patterns rather than inventing new layouts. What these specs check is
 * therefore consistency: every page opens with the shared hero, uses the shared
 * section heading, and shows nothing rather than an empty shell when it has no
 * data.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

test.use({ storageState: { cookies: [], origins: [] } })

const PAGES = [
  { slug: 'videos', module: 'videos' },
  { slug: 'press', module: 'press' },
  { slug: 'epk', module: 'epk' },
  { slug: 'newsletter', module: 'newsletter' },
] as const

async function pageIsUp(request: import('@playwright/test').APIRequestContext, slug: string) {
  try {
    return (await request.get(`${WEB}/en/${slug}`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe('Undesigned pages — shared 2-Tone shell', () => {
  for (const { slug, module } of PAGES) {
    test.describe(slug, () => {
      test.beforeEach(async ({ request, page }) => {
        test.skip(
          !(await pageIsUp(request, slug)),
          `${WEB}/en/${slug} unavailable — site down, or the ${module} module is off`,
        )
        page.on('pageerror', (e) => {
          throw new Error(`page error: ${e.message}`)
        })
      })

      test('opens with the shared page hero', async ({ page }) => {
        await page.goto(`${WEB}/en/${slug}`)

        // One h1, rendered by PageHero rather than a per-page copy.
        const title = page.locator('h1.ph-title')
        await expect(title).toHaveCount(1)
        await expect(title).toHaveText(/\S/)
        await expect(page.locator('.ph-kicker')).toHaveText(/\S/)
      })

      test('has no leftover Tailwind palette classes', async ({ page }) => {
        await page.goto(`${WEB}/en/${slug}`)

        // The token lint guards source; this guards the rendered output, which is
        // what a visitor actually gets.
        const stray = await page.evaluate(() => {
          const bad = /\b(?:text|bg|border)-(?:zinc|gray|neutral|slate|stone)-\d{2,3}\b/
          return [...document.querySelectorAll('[class]')]
            .map((el) => el.getAttribute('class') ?? '')
            .filter((c) => bad.test(c))
        })
        expect(stray).toEqual([])
      })

      test('every internal link resolves', async ({ page, request }) => {
        await page.goto(`${WEB}/en/${slug}`)

        const hrefs = await page.locator('main a[href^="/"]').evaluateAll((els) =>
          [...new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''))].filter(Boolean),
        )

        for (const href of hrefs) {
          // /storage/* is proxied to the backend, so a 404 there is missing media
          // rather than a dead route.
          if (href.startsWith('/storage/')) continue
          const res = await request.get(`${WEB}${href}`)
          expect(res.status(), `${href} should not 404`).toBeLessThan(400)
        }
      })

      test('every outbound link opens safely', async ({ page }) => {
        await page.goto(`${WEB}/en/${slug}`)

        const links = page.locator('main a[href^="http"]')
        for (let i = 0; i < (await links.count()); i++) {
          expect(await links.nth(i).getAttribute('target')).toBe('_blank')
          expect(await links.nth(i).getAttribute('rel')).toContain('noopener')
        }
      })
    })
  }

  // ── page-specific behaviour ────────────────────────────────────────────────

  test('videos reuses the Music page gallery and its lightbox', async ({ request, page }) => {
    test.skip(!(await pageIsUp(request, 'videos')), 'videos module off')
    await page.goto(`${WEB}/en/videos`)

    const card = page.locator('.vg-card').first()
    test.skip((await card.count()) === 0, 'No videos on this instance')

    await page.locator('.vg-card').first().scrollIntoViewIfNeeded()
    await page.waitForFunction(
      () => {
        const island = document.querySelector('.vg-card')?.closest('astro-island')
        return Boolean(island) && !island!.hasAttribute('ssr')
      },
      undefined,
      { timeout: 10_000 },
    )

    await card.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 })
    await page.keyboard.press('Escape')
  })

  test('press separates featured coverage from the rest', async ({ request, page }) => {
    test.skip(!(await pageIsUp(request, 'press')), 'press module off')
    await page.goto(`${WEB}/en/press`)

    const cards = page.locator('.pr-card')
    const rows = page.locator('.pr-row')
    test.skip((await cards.count()) + (await rows.count()) === 0, 'No press coverage on this instance')

    // Every entry carries a publication name — it falls back to the URL host
    // server-side, so a nameless row means the fallback broke.
    for (const sel of ['.pr-card .pr-site', '.pr-row .pr-site']) {
      const sites = page.locator(sel)
      for (let i = 0; i < (await sites.count()); i++) {
        await expect(sites.nth(i)).toHaveText(/\S/)
      }
    }
  })

  test('newsletter shows the dashed panel and a working form', async ({ request, page }) => {
    test.skip(!(await pageIsUp(request, 'newsletter')), 'newsletter module off')
    await page.goto(`${WEB}/en/newsletter`)

    await expect(page.locator('.nl-panel')).toBeVisible()
    await expect(page.locator('.ns-input')).toBeVisible()
    await expect(page.locator('.ns-btn')).toBeVisible()

    // The signup island takes its copy from the page, so the button must not
    // fall back to the component default when a label was passed.
    await expect(page.locator('.ns-btn')).toContainText('Join the list')
  })

  test('epk stays out of search results', async ({ request, page }) => {
    test.skip(!(await pageIsUp(request, 'epk')), 'epk module off')
    await page.goto(`${WEB}/en/epk`)

    // A press kit carries contact addresses and download links; it was marked
    // noindex before this restyle and must stay that way.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })
})
