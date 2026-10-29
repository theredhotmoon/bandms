import { test, expect } from '@playwright/test'

/**
 * The public site's favicon. It shipped broken twice in different ways: the
 * page linked /favicon.svg with no such file (no icon anywhere), and
 * /favicon.ico — which browsers request on their own, whatever the page
 * links — 404'd. A rename of the files, or an nginx/Caddy change, can bring
 * either back silently: the page still renders and the build stays green.
 *
 * Reads the hrefs off the page rather than hardcoding them, so this follows
 * a rename instead of pinning one.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'

test.use({ storageState: { cookies: [], origins: [] } })

test('every icon the page links is served as an image', async ({ page, request }) => {
  await page.goto(`${WEB}/en/`)
  const hrefs = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll(
    (links) => links.map((l) => l.getAttribute('href') ?? ''),
  )
  expect(hrefs.length).toBeGreaterThanOrEqual(2)

  for (const href of hrefs) {
    const res = await request.get(new URL(href, `${WEB}/`).toString())
    expect(res.status(), href).toBe(200)
    expect(res.headers()['content-type'], href).toMatch(/^image\//)
  }
})

test('/favicon.ico answers even though no page links it', async ({ request }) => {
  const res = await request.get(`${WEB}/favicon.ico`)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toMatch(/^image\//)
})
