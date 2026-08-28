import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The About page on the public Astro site.
 *
 * About became a real CMS module in this PR, so unlike the other public specs
 * this one also checks the things being a module buys: a Polish URL, a nav entry
 * and a working legacy redirect target.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

test.use({ storageState: { cookies: [], origins: [] } })

async function aboutIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    return (await request.get(`${WEB}/en/about`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

async function hydrated(page: import('@playwright/test').Page, selector: string) {
  await page.locator(selector).first().scrollIntoViewIfNeeded()
  await page.waitForFunction(
    (sel) => {
      const island = document.querySelector(sel)?.closest('astro-island')
      return Boolean(island) && !island!.hasAttribute('ssr')
    },
    selector,
    { timeout: 10_000 },
  )
}

test.describe('About page', () => {
  failOnPageError()

  test.beforeEach(async ({ request, page }) => {
    test.skip(
      !(await aboutIsUp(request)),
      `${WEB}/en/about unavailable — site down, or the about module is off`,
    )

  })

  test('renders the hero with formed and based facts', async ({ page }) => {
    await page.goto(`${WEB}/en/about`)

    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible()

    const pills = page.locator('.ab-pill')
    if (await pills.count()) await expect(pills.first()).not.toBeEmpty()
  })

  test('bio renders as separate paragraphs', async ({ page }) => {
    await page.goto(`${WEB}/en/about`)

    const paragraphs = page.locator('.ab-bio')
    expect(await paragraphs.count()).toBeGreaterThan(0)
    await expect(paragraphs.first()).not.toBeEmpty()
  })

  test('genre and comparable-artist lists have no empty entries', async ({ page }) => {
    await page.goto(`${WEB}/en/about`)

    // These are free-text comma-separated fields; a trailing comma would leave a
    // blank chip, which is what the defensive split exists to prevent.
    for (const selector of ['.ab-genre', '.ab-comparable li']) {
      const items = page.locator(selector)
      for (let i = 0; i < (await items.count()); i++) {
        await expect(items.nth(i)).toHaveText(/\S/)
      }
    }
  })

  test('stats show only filled-in numbers', async ({ page }) => {
    await page.goto(`${WEB}/en/about`)

    const values = page.locator('.ab-stat-value')
    test.skip((await values.count()) === 0, 'No stats filled in on this instance')

    for (let i = 0; i < (await values.count()); i++) {
      // A zero would read as "a band with no audience" rather than "no data".
      await expect(values.nth(i)).not.toHaveText('0')
      await expect(values.nth(i)).toHaveText(/\d/)
    }
  })

  test('a member card opens their modal', async ({ page }) => {
    await page.goto(`${WEB}/en/about`)

    const card = page.locator('.mg-card').first()
    test.skip((await card.count()) === 0, 'No current members on this instance')
    await hydrated(page, '.mg-card')

    const name = (await card.locator('.mg-name').textContent())?.trim() ?? ''

    await card.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })
    await expect(dialog.locator('.mg-panel-name')).toHaveText(name)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 8000 })
  })

  test('former members appear separately and open the same modal', async ({ page }) => {
    await page.goto(`${WEB}/en/about`)

    const pills = page.locator('.mg-pill')
    test.skip((await pills.count()) === 0, 'No former members on this instance')
    await hydrated(page, '.mg-pill')

    // Former members must not appear in the current line-up grid.
    const formerName = (await pills.first().locator('.mg-pill-name').textContent())?.trim() ?? ''
    const gridNames = await page.locator('.mg-card .mg-name').allTextContents()
    expect(gridNames.map((n) => n.trim())).not.toContain(formerName)

    await pills.first().click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 })
  })

  test('member instruments render as chips', async ({ page }) => {
    await page.goto(`${WEB}/en/about`)

    const chips = page.locator('.mg-card .mg-chip')
    // The instruments field was missing from the BandMember type until this PR,
    // so its absence was invisible rather than broken.
    test.skip((await chips.count()) === 0, 'No members with instruments on this instance')
    await expect(chips.first()).toHaveText(/\S/)
  })

  test('press cards link to something real and files open in a new tab', async ({ page }) => {
    await page.goto(`${WEB}/en/about`)

    const cards = page.locator('.ab-press-card')
    test.skip((await cards.count()) === 0, 'No press assets on this instance')

    for (let i = 0; i < (await cards.count()); i++) {
      const href = await cards.nth(i).getAttribute('href')
      expect(href).toBeTruthy()

      const target = await cards.nth(i).getAttribute('target')
      if (href!.startsWith('/storage/')) expect(target).toBe('_blank')
      else expect(target).toBeNull()
    }
  })

  test('is served in Polish under its own slug', async ({ page }) => {
    // Being a module is what buys About a Polish URL; before this PR it was
    // English-only at /about.
    const res = await page.goto(`${WEB}/pl/o-nas`)
    expect(res?.status()).toBeLessThan(400)
    await expect(page.getByRole('heading', { level: 1, name: 'O nas' })).toBeVisible()
  })

  test('appears in the site navigation', async ({ page }) => {
    await page.goto(`${WEB}/en`)

    const nav = page.locator('nav').first()
    await expect(nav.getByRole('link', { name: /^About$/i })).toBeVisible()
  })

  test('the legacy unlocalised /about still works', async ({ page }) => {
    const res = await page.goto(`${WEB}/about`)
    expect(res?.status()).toBeLessThan(400)
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible()
  })

  test('every internal link resolves', async ({ page, request }) => {
    await page.goto(`${WEB}/en/about`)

    const hrefs = await page.locator('main a[href^="/"]').evaluateAll((els) =>
      [...new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''))].filter(Boolean),
    )

    for (const href of hrefs) {
      // /storage/* is a real backend path, not an Astro route; the web container
      // proxies it, so a 404 there means missing media rather than a dead link.
      if (href.startsWith('/storage/')) continue
      const res = await request.get(`${WEB}${href}`)
      expect(res.status(), `${href} should not 404`).toBeLessThan(400)
    }
  })
})
