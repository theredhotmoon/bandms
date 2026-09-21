import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * The press-kit modal on the public Astro site.
 *
 * Same arrangement as availability.spec.ts: absolute URLs to the `web`
 * container, skipped when it is not up, since it sits outside the Playwright
 * webServer config.
 *
 * Every assertion here is data-dependent by design — the modal lists what the
 * band actually has, so a row is proof the data exists rather than proof of a
 * hardcoded list. Tests guard rather than assume.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * storageState replays cookies only, and e2e/.auth/admin.json holds none — an
 * API context built from it is anonymous. The token has to be lifted out and
 * sent explicitly. Path is relative to the Playwright cwd (app/): these spec
 * files are ESM, so __dirname does not exist.
 */
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed clips')
  return entry.value
}

async function api(request: APIRequestContext, method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}: ${await res.text()}`)
  return res
}

/** Same rebuild-and-poll as post-blocks.spec.ts — see the comment there. */
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

async function publicSiteIsUp(request: import('@playwright/test').APIRequestContext) {
  try {
    const res = await request.get(`${WEB}/en/contact`, { timeout: 5000 })
    return res.ok()
  } catch {
    return false
  }
}

/** The card only exists when the band has something to put in the kit. */
async function openKit(page: import('@playwright/test').Page) {
  await page.goto(`${WEB}/en/contact`)

  const trigger = page.locator('button.ct-card[data-open-epk]')
  if ((await trigger.count()) === 0) return null

  await trigger.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 8000 })
  return dialog
}

test.describe('Press kit modal — public contact page', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await publicSiteIsUp(request)), `Astro site not reachable at ${WEB}`)
  })

  test('opens from the promoters card', async ({ page }) => {
    const dialog = await openKit(page)
    test.skip(dialog === null, 'No press-kit assets on this instance')

    await expect(dialog!).toContainText('Press kit (EPK)')
  })

  test('lists at least one asset with a format line', async ({ page }) => {
    const dialog = await openKit(page)
    test.skip(dialog === null, 'No press-kit assets on this instance')

    const rows = dialog!.locator('.ek-row')
    expect(await rows.count()).toBeGreaterThan(0)

    // Every row must carry both a title and a meta line — a row with an empty
    // meta means a field was read that the API does not actually send.
    for (let i = 0; i < (await rows.count()); i++) {
      await expect(rows.nth(i).locator('.ek-title')).not.toBeEmpty()
      await expect(rows.nth(i).locator('.ek-meta')).not.toBeEmpty()
    }
  })

  test('every asset row links somewhere real', async ({ page }) => {
    const dialog = await openKit(page)
    test.skip(dialog === null, 'No press-kit assets on this instance')

    const rows = dialog!.locator('.ek-row')
    for (let i = 0; i < (await rows.count()); i++) {
      const href = await rows.nth(i).getAttribute('href')
      expect(href, 'asset row has an href').toBeTruthy()
      expect(href).not.toBe('')
    }
  })

  // A file opens in a new tab; a page on this site navigates in place. The
  // distinction is what `isFile` exists to carry.
  test('file assets open in a new tab, pages do not', async ({ page }) => {
    const dialog = await openKit(page)
    test.skip(dialog === null, 'No press-kit assets on this instance')

    const rows = dialog!.locator('.ek-row')
    let sawFile = false

    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i)
      const href = (await row.getAttribute('href')) ?? ''
      const target = await row.getAttribute('target')

      if (href.startsWith('/storage/')) {
        expect(target, `${href} should open in a new tab`).toBe('_blank')
        expect(await row.getAttribute('rel')).toContain('noopener')
        sawFile = true
      } else {
        expect(target, `${href} should navigate in place`).toBeNull()
      }
    }

    test.skip(!sawFile, 'No file-backed assets on this instance')
  })

  test('closes on Escape', async ({ page }) => {
    const dialog = await openKit(page)
    test.skip(dialog === null, 'No press-kit assets on this instance')

    await page.keyboard.press('Escape')
    await expect(dialog!).toBeHidden({ timeout: 8000 })
  })

  test('the two modals are independent', async ({ page }) => {
    await page.goto(`${WEB}/en/contact`)

    const epkTrigger = page.locator('button.ct-card[data-open-epk]')
    test.skip((await epkTrigger.count()) === 0, 'No press-kit assets on this instance')

    // Opening the calendar must not also open the press kit: both delegate from
    // document, so a matcher that was too loose would fire both.
    await page.locator('button.ct-card[data-open-availability]').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })
    await expect(dialog).toContainText('Check our availability')
    await expect(dialog).not.toContainText('Press kit')

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 8000 })

    await epkTrigger.click()
    await expect(dialog).toBeVisible({ timeout: 8000 })
    await expect(dialog).toContainText('Press kit (EPK)')
    await expect(dialog).not.toContainText('Check our availability')
  })
})

// Seeds a published rider, links it, rebuilds, and asserts the modal's rider
// row opens the rider page. Serial and self-restoring: it writes the shared
// band_profiles row and the served site.
test.describe('Press kit modal — linked tech rider', () => {
  test.describe.configure({ mode: 'serial' })

  const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  let riderId = 0
  let token = ''
  let originalRiderId: number | null = null

  test.beforeAll(async ({ request }) => {
    // Two rebuilds at ~1–2 min each — the default 30s hook timeout is nowhere
    // near enough (same pattern as clips-surfaces.spec.ts).
    test.setTimeout(180_000)
    test.skip(!(await publicSiteIsUp(request)), `Astro site not reachable at ${WEB}`)

    const profile = await (await api(request, 'get', '/api/band-profile')).json()
    originalRiderId = profile.data.epk_tech_rider_id ?? null

    const rider = (await (await api(request, 'post', '/api/tech-riders', { name: `E2E epk rider ${STAMP}`, is_active: false })).json()).data
    riderId = rider.id
    token = rider.public_token
    await api(request, 'post', `/api/tech-riders/${riderId}/versions`, { notes: 'E2E' })
    await api(request, 'put', '/api/band-profile', { epk_tech_rider_id: riderId })
    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(180_000)
    if (!riderId) return
    const restore = await api(request, 'put', '/api/band-profile', { epk_tech_rider_id: originalRiderId })
    expect(restore.ok()).toBe(true)
    await api(request, 'delete', `/api/tech-riders/${riderId}`)
    // The served site still shows the seeded link until rebuilt.
    await rebuildAndWait(request, Date.now())
  })

  test('has one rider row, no stage-plot row, and it opens the rider sheet', async ({ page }) => {
    const dialog = await openKit(page)
    expect(dialog, 'press kit trigger present once a rider is linked').not.toBeNull()

    // `.ek-row` is the <a> itself (EpkModal.vue), so href sits on the row.
    const riderRow = dialog!.locator(`.ek-row[href="/rider/${token}"]`)
    await expect(riderRow).toBeVisible()
    await expect(dialog!.locator('.ek-row[href^="/rider/"]')).toHaveCount(1)
    await expect(dialog!.locator('.ek-title', { hasText: /^stage plot$/i })).toHaveCount(0)
    expect(await riderRow.getAttribute('target'), 'a page, not a download').toBeNull()

    await riderRow.click()
    await expect(page).toHaveURL(new RegExp(`/rider/${token}$`))
    await expect(page.locator('.preview-root')).toBeVisible({ timeout: 15000 })
  })
})
