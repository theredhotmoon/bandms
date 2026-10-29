import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * Website Modules → About → Section visibility toggles ("Band in numbers",
 * "Band members", "Member pages"), plus the member's own opt-out from a page. Proves the admin toggle actually controls what the public
 * About page renders — not just that the field round-trips through the
 * admin, which app/e2e/tests/admin/website-modules.spec.ts already covers
 * without a save (see that file's note on why it stays read-only here).
 *
 * Mutates `website_modules.visibility` for the 'about' slug and one member's
 * `public_page` — never band_profiles, so this can't collide with about-bio-variant.spec.ts or
 * genre-kicker.spec.ts, which mutate that singleton instead. Runs serial and
 * restores what it touches, same as those two.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed website modules')
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

async function setAboutVisibility(request: APIRequestContext, visibility: Record<string, boolean>) {
  await api(request, 'put', '/api/admin/modules/about', { visibility })
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

interface PublicMember {
  id: number
  first_name: string
  last_name: string
  slug?: string
  is_current: boolean
  public_page?: boolean
  main_instrument_id: number | null
  instruments: { id: number }[]
  social_links: { platform: string; url: string }[]
}

/**
 * A member's opt-out, written with everything the update endpoint would
 * otherwise wipe: it replaces social links and instruments with whatever the
 * payload carries, so a bare {public_page} would strip both.
 */
async function setPublicPage(request: APIRequestContext, m: PublicMember, publicPage: boolean) {
  await api(request, 'put', `/api/band-profile/members/${m.id}`, {
    first_name: m.first_name,
    last_name: m.last_name,
    public_page: publicPage,
    main_instrument_id: m.main_instrument_id,
    instrument_ids: m.instruments.map((i) => i.id),
    social_links: m.social_links.map((l) => ({ platform: l.platform, url: l.url })),
  })
}

async function pageIsUp(request: APIRequestContext, path: string) {
  try {
    return (await request.get(`${WEB}${path}`, { timeout: 5000 })).ok()
  } catch {
    return false
  }
}

test.describe.serial('Public — About page section visibility', () => {
  failOnPageError()

  let original: Record<string, boolean> = {}
  // The member the opt-out test hides, with what to put back.
  let optedOut: { member: PublicMember; was: boolean } | null = null

  test.beforeAll(async ({ request }) => {
    test.setTimeout(30_000)
    const res = await api(request, 'get', '/api/admin/modules')
    const modules = (await res.json()).data as { slug: string; visibility?: Record<string, boolean> }[]
    original = modules.find((m) => m.slug === 'about')?.visibility ?? {}
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(180_000)
    if (optedOut) await setPublicPage(request, optedOut.member, optedOut.was)
    await setAboutVisibility(request, {
      show_stats: original.show_stats ?? true,
      show_members: original.show_members ?? true,
      member_pages: original.member_pages ?? true,
    })
    await rebuildAndWait(request, Date.now())
  })

  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await pageIsUp(request, '/en/about')),
      `${WEB}/en/about unavailable — site down, or the about module is off`,
    )
  })

  test('hides the stats section when show_stats is off, regardless of stats data', async ({ request, page }) => {
    test.setTimeout(180_000)

    await setAboutVisibility(request, { show_stats: false })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.locator('.ab-stats')).toHaveCount(0)
  })

  test('hides the members section — heading included — when show_members is off', async ({ request, page }) => {
    test.setTimeout(180_000)

    await setAboutVisibility(request, { show_members: false })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.getByRole('heading', { name: /line-up/i })).toHaveCount(0)
  })

  test('restores the members section — heading included — when show_members is on', async ({ request, page }) => {
    test.setTimeout(180_000)

    await setAboutVisibility(request, { show_members: true })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.getByRole('heading', { name: /line-up/i })).toBeVisible()
  })

  // ── Member pages ─────────────────────────────────────────────────────────
  // Switched off, no card links anywhere and no member page is built: every
  // card opens the details modal instead.
  test('member_pages off: cards open the modal and member pages are not built', async ({ request, page }) => {
    test.setTimeout(180_000)
    const members = (await (await request.get(`${API}/api/band-profile/members`)).json()).data as PublicMember[]
    const current = members.find((m) => m.is_current && m.slug)
    test.skip(!current, 'No current member with a slug on this instance')

    await setAboutVisibility(request, { show_members: true, member_pages: false })
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    await expect(page.locator('a.mg-card, a.mg-pill')).toHaveCount(0)
    const card = page.locator('button.mg-card').filter({ hasText: current!.last_name }).first()
    await card.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => !document.querySelector('.mg-card')?.closest('astro-island')?.hasAttribute('ssr'))
    await card.click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8000 })

    const about = page.url().replace(/\/$/, '')
    expect((await request.get(`${about}/${current!.slug}`)).status()).toBe(404)
  })

  // On, but one member opted out: their card opens the modal and their page
  // is gone, while everyone else keeps a link.
  test('a member who opts out loses their page while the others keep theirs', async ({ request, page }) => {
    test.setTimeout(240_000)
    const members = (await (await request.get(`${API}/api/band-profile/members`)).json()).data as PublicMember[]
    const current = members.filter((m) => m.is_current && m.slug)
    test.skip(current.length === 0, 'No current member with a slug on this instance')
    const [hidden, ...others] = current
    optedOut = { member: hidden, was: hidden.public_page !== false }

    await setAboutVisibility(request, { show_members: true, member_pages: true })
    await setPublicPage(request, hidden, false)
    await rebuildAndWait(request, Date.now())

    await page.goto(`${WEB}/en/about`)
    const about = page.url().replace(/\/$/, '')
    const mine = page.locator('.mg-card').filter({ hasText: hidden.last_name }).first()
    await expect(mine).not.toHaveAttribute('href')
    expect((await request.get(`${about}/${hidden.slug}`)).status()).toBe(404)

    const other = others.find((m) => m.public_page !== false)
    if (other) {
      const theirs = page.locator('a.mg-card').filter({ hasText: other.last_name }).first()
      await expect(theirs).toHaveAttribute('href', new RegExp(`/${other.slug}$`))
      expect((await request.get(`${about}/${other.slug}`)).status()).toBe(200)
    }
  })
})
