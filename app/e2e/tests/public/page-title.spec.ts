import { test, expect } from '@playwright/test'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The <title> of every public page.
 *
 * Two layers used to append the band name: each section and detail component
 * built `${heading} — ${profile.name}` itself, and BaseLayout appended
 * ` — ${bandName}` again unless the title *was* the band name. Every section
 * page in both locales shipped as "News — Skanking Storks — Skanking Storks".
 * The layout's copy was also a hardcoded literal rather than the profile, so it
 * only ever looked right for the one band whose name matched it.
 *
 * The layout is now the single owner of the suffix, and this spec pins both
 * halves: callers must not add the name (it would appear twice again), and the
 * layout must keep adding it (pages that pass a bare title — privacy, newsletter,
 * rider — rely on that).
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

async function bandName(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.get(`${API}/api/band-profile?lang=en`)
  expect(res.ok(), `GET /api/band-profile → ${res.status()}`).toBe(true)
  const { data } = (await res.json()) as { data: { name: string } }
  expect(data.name).toMatch(/\S/)
  return data.name
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

test.describe('Public page <title>', () => {
  failOnPageError()

  test.beforeEach(async ({ request }) => {
    test.skip(!(await siteIsUp(request)), `${WEB}/en unavailable`)
  })

  test('the homepage title is the band name alone', async ({ page, request }) => {
    const name = await bandName(request)
    await page.goto(`${WEB}/en`)
    await expect(page).toHaveTitle(name)
  })

  for (const path of ['/en/news', '/en/contact', '/en/about', '/pl/kontakt']) {
    test(`${path} carries the band name exactly once, as a suffix`, async ({ page, request }) => {
      const name = await bandName(request)
      const res = await page.goto(`${WEB}${path}`)
      test.skip(res?.status() === 404, `${path} is not built — module disabled or slug moved`)

      const title = await page.title()
      expect(title, `title was "${title}"`).toMatch(new RegExp(` — ${escapeRegExp(name)}$`))
      expect(occurrences(title, name), `title was "${title}"`).toBe(1)
      // A bare " — Band" (empty heading) would still pass the two checks above.
      expect(title.replace(` — ${name}`, '')).toMatch(/\S/)
    })
  }

  test('a post detail page carries the band name exactly once', async ({ page, request }) => {
    const name = await bandName(request)
    await page.goto(`${WEB}/en/news`)
    const first = page.locator('a[href^="/en/news/"]').first()
    test.skip((await first.count()) === 0, 'no published post to open')

    await first.click()
    await page.waitForURL(/\/en\/news\/.+/)

    const title = await page.title()
    expect(occurrences(title, name), `title was "${title}"`).toBe(1)
    expect(title).toMatch(new RegExp(` — ${escapeRegExp(name)}$`))
  })

  test('a page that passes a bare title still gets the suffix from the layout', async ({ page, request }) => {
    const name = await bandName(request)
    // privacy.astro hands BaseLayout its heading with no band name of its own;
    // if the layout stopped appending, this is a page that would lose it. (The
    // 404 page would be the natural pick, but nginx answers unknown paths with
    // its own bare "404 Not Found" rather than Astro's 404.html.)
    const res = await page.goto(`${WEB}/en/privacy`)
    test.skip(res?.status() === 404, '/en/privacy is not built')

    const title = await page.title()
    expect(title, `title was "${title}"`).toMatch(new RegExp(` — ${escapeRegExp(name)}$`))
    expect(occurrences(title, name)).toBe(1)
  })
})

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
