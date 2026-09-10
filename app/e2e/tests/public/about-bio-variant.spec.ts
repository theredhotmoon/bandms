import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The About page's bio block used to hardcode bio_medium → bio_long →
 * bio_short as the public fallback chain. It now reads the admin's choice
 * from Band Profile → Bio → "Shown on public About page"
 * (`about_bio_variant`), so this proves the selected variant is what
 * actually renders — not just that the field round-trips through the admin.
 *
 * Mutates the band-profile singleton like genre-kicker.spec.ts, so it runs
 * serial and restores every field it touches.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed the band profile')
  return entry.value
}

async function api(request: APIRequestContext, method: 'get' | 'put', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data !== undefined ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}`)
  return res
}

async function rebuildAndWait(request: APIRequestContext, since: number) {
  const deadline = Date.now() + 180_000

  while (Date.now() < deadline) {
    const trigger = await request.post(`${API}/api/admin/site/rebuild`, {
      headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    })
    if (!trigger.ok() && trigger.status() !== 409) {
      throw new Error(`POST /api/admin/site/rebuild → ${trigger.status()}`)
    }

    while (Date.now() < deadline) {
      const res = await api(request, 'get', '/api/admin/site/rebuild/status')
      const body = await res.json()
      if (body.status === 'error') throw new Error('Public site rebuild failed')
      if (body.status === 'done') {
        if ((body.startedAt ?? 0) >= since) return
        break // stale build finished before our seed — trigger another
      }
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

async function pageIsUp(request: APIRequestContext, path: string) {
  try {
    return (await request.get(`${WEB}${path}`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe.serial('Public — About page bio variant', () => {
  failOnPageError()

  let original: {
    bio_short: string | null
    bio_medium: string | null
    bio_long: string | null
    bio_full: string | null
    about_bio_variant: string
  } | null = null

  test.beforeAll(async ({ request }) => {
    test.setTimeout(30_000)
    const res = await api(request, 'get', '/api/band-profile')
    const data = (await res.json()).data
    original = {
      bio_short: data.bio_short,
      bio_medium: data.bio_medium,
      bio_long: data.bio_long,
      bio_full: data.bio_full,
      about_bio_variant: data.about_bio_variant,
    }
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(180_000)
    if (!original) return
    await api(request, 'put', '/api/band-profile', original)
    await rebuildAndWait(request, Date.now())
  })

  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await pageIsUp(request, '/en/about')),
      `${WEB}/en/about unavailable — site down, or the about module is off`,
    )
  })

  // bio_full/bio_long are edited via RichEditor (Tiptap) and stored as HTML —
  // see app/src/components/admin/RichEditor.vue. AboutSection.astro used to
  // print that HTML through Astro's auto-escaping {expr} interpolation,
  // which showed literal "<p>...</p>" tags on the page instead of rendering
  // them. Seeding real markup here (not a plain-text marker) is what actually
  // exercises that bug — a plain string would pass whether or not the fix
  // were in place.
  test('renders bio_full as HTML — the format RichEditor produces — when about_bio_variant is "full"', async ({ request, page }) => {
    test.setTimeout(180_000)

    const marker = `E2E FULL BIO ${Date.now()}`
    const html = `<p>${marker} — formed in the practice room.</p><p>Then <strong>200+</strong> shows later.</p>`
    await api(request, 'put', '/api/band-profile', {
      bio_full: html,
      about_bio_variant: 'full',
    })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    const bioHtml = page.locator('.ab-bio-html')
    await expect(bioHtml).toBeVisible()
    await expect(bioHtml.locator('p').first()).toContainText(marker)
    await expect(bioHtml.locator('strong')).toHaveText('200+')
    // The regression this guards against: literal escaped markup rendered as
    // visible text rather than being parsed as HTML.
    await expect(page.locator('body')).not.toContainText('<p>')
  })

  test('falls back to another length when the selected variant is empty', async ({ request, page }) => {
    test.setTimeout(180_000)

    const marker = `E2E SHORT BIO ${Date.now()}`
    // The chain is bio_medium → bio_long → bio_short → bio_full once the
    // selected variant (full) is empty — null the other three so it can only
    // land on bio_short, not on whatever this instance happened to have.
    await api(request, 'put', '/api/band-profile', {
      bio_medium: null,
      bio_long: null,
      bio_short: marker,
      bio_full: null,
      about_bio_variant: 'full',
    })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.locator('.ab-bio').first()).toHaveText(marker)
  })

  // The riskier fallback direction: an admin explicitly picks the shortest
  // length but has only written the long-form press biography so far — the
  // fallback chain (by design, see AboutSection.astro) still shows something
  // rather than "Biography coming soon.", and that something must render as
  // real HTML, not escaped markup, exactly like the direct-selection case.
  test('a fallback that lands on bio_full still renders it as HTML, not escaped', async ({ request, page }) => {
    test.setTimeout(180_000)

    const marker = `E2E FALLBACK FULL BIO ${Date.now()}`
    const html = `<p>${marker}</p>`
    await api(request, 'put', '/api/band-profile', {
      bio_short: null,
      bio_medium: null,
      bio_long: null,
      bio_full: html,
      about_bio_variant: 'short',
    })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.locator('.ab-bio-html p')).toHaveText(marker)
  })
})
