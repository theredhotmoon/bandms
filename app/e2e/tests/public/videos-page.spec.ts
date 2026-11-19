import { anonymousVisitor } from '../../fixtures/visitor'
import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

/**
 * The Videos page is one mixed list: the band's own videos and fans' footage
 * together, a fan video labelled "Fan video" and crediting the channel that
 * posted it. The Music page keeps only the music videos.
 *
 * Seeds an official music video and a fan's live video, rebuilds the public
 * site, checks both pages, then deletes both and rebuilds again.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: anonymousVisitor() })

function adminToken(): string {
  const state = JSON.parse(fs.readFileSync('e2e/.auth/admin.json', 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}
const headers = () => ({ Accept: 'application/json', Authorization: `Bearer ${adminToken()}` })

async function rebuildAndWait(request: APIRequestContext, since: number) {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    const trigger = await request.post(`${API}/api/admin/site/rebuild`, { headers: headers() })
    if (!trigger.ok() && trigger.status() !== 409) throw new Error(`POST rebuild → ${trigger.status()}`)
    while (Date.now() < deadline) {
      const body = await (await request.get(`${API}/api/admin/site/rebuild/status`, { headers: headers() })).json()
      if (body.status === 'error') throw new Error('Public site rebuild failed')
      if (body.status === 'done') {
        if ((body.startedAt ?? 0) >= since) return
        break
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

/**
 * Wait for the island holding `selector` to hydrate: Astro removes the `ssr`
 * attribute when it mounts. A click before that lands on inert markup. Same
 * helper as music.spec.ts.
 */
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

/** An 11-character YouTube-shaped id no other spec uses. */
function ytId(stamp: string, prefix: string): string {
  return (prefix + stamp).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 11).padEnd(11, '0')
}

test.describe.serial('Public — videos page (official and fan)', () => {
  failOnPageError()

  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const OFFICIAL = `E2E official ${stamp}`
  const FAN = `E2E fan ${stamp}`
  const CHANNEL = `Gig Goer ${stamp}`
  const CHANNEL_URL = `https://www.youtube.com/@giggoer${stamp}`
  const ids: number[] = []
  // Modules this spec switched on, to switch off again. A disabled module
  // unbuilds its page, and the dev DB has both of these off — skipping on
  // that would leave the spec asserting nothing.
  const enabledByUs: string[] = []

  test.beforeAll(async ({ request }) => {
    test.setTimeout(240_000)
    const modules = (await (await request.get(`${API}/api/admin/modules`, { headers: headers() })).json()).data as { slug: string; enabled: boolean }[]
    for (const slug of ['videos', 'releases']) {
      if (modules.find(m => m.slug === slug)?.enabled === false) {
        const res = await request.put(`${API}/api/admin/modules/${slug}`, { headers: headers(), data: { enabled: true } })
        expect(res.ok(), `enable ${slug}`).toBe(true)
        enabledByUs.push(slug)
      }
    }

    const seed = async (data: Record<string, unknown>) => {
      const res = await request.post(`${API}/api/clips`, { headers: headers(), data })
      expect(res.status(), await res.text()).toBe(201)
      ids.push((await res.json()).data.id)
    }
    await seed({
      url: `https://www.youtube.com/watch?v=${ytId(stamp, 'o')}`,
      title: { en: OFFICIAL, pl: null }, category: 'music_video', source: 'official',
      recorded_on: '2099-01-02',
    })
    await seed({
      url: `https://www.youtube.com/watch?v=${ytId(stamp, 'f')}`,
      title: { en: FAN, pl: null }, category: 'live', source: 'fan',
      channel_name: CHANNEL, channel_url: CHANNEL_URL, recorded_on: '2099-01-01',
    })
    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    test.setTimeout(240_000)
    for (const id of ids) await request.delete(`${API}/api/clips/${id}`, { headers: headers() })
    for (const slug of enabledByUs) {
      await request.put(`${API}/api/admin/modules/${slug}`, { headers: headers(), data: { enabled: false } })
    }
    await rebuildAndWait(request, Date.now())
  })

  async function siteConfig(request: APIRequestContext) {
    // site-config is not wrapped in `data`.
    return (await request.get(`${API}/api/site-config?lang=en`)).json()
  }

  test('lists official and fan videos together, the fan one labelled and credited', async ({ page, request }) => {
    const config = await siteConfig(request)

    await page.goto(`${WEB}/en/${config?.module_config?.videos?.slug ?? 'videos'}`)
    const cards = page.getByTestId('video-card')

    const fan = cards.filter({ hasText: FAN })
    await expect(fan).toHaveCount(1)
    await expect(fan).toHaveAttribute('data-source', 'fan')
    await expect(fan.getByTestId('video-fan-label')).toHaveText('Fan video')
    const credit = fan.getByTestId('video-credit').getByRole('link')
    await expect(credit).toContainText(`Filmed by ${CHANNEL}`)
    await expect(credit).toHaveAttribute('href', CHANNEL_URL)
    await expect(credit).toHaveAttribute('target', '_blank')

    const official = cards.filter({ hasText: OFFICIAL })
    await expect(official).toHaveCount(1)
    await expect(official).toHaveAttribute('data-source', 'official')
    await expect(official.getByTestId('video-fan-label')).toHaveCount(0)
    await expect(official.getByTestId('video-credit')).toHaveCount(0)
    await expect(official).toContainText('Music video')
  })

  test('a fan video opens in the player like any other', async ({ page, request }) => {
    const config = await siteConfig(request)

    await page.goto(`${WEB}/en/${config?.module_config?.videos?.slug ?? 'videos'}`)
    await hydrated(page, '.vg-card')
    await page.getByTestId('video-card').filter({ hasText: FAN }).locator('.vg-open').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 8000 })
    await expect(dialog.locator('iframe')).toHaveAttribute('src', new RegExp(`youtube-nocookie\\.com/embed/${ytId(stamp, 'f')}`))
    await page.keyboard.press('Escape')
  })

  test('the Music page lists the music video and not the fan footage', async ({ page, request }) => {
    const config = await siteConfig(request)

    await page.goto(`${WEB}/en/${config?.module_config?.releases?.slug ?? 'releases'}`)
    const cards = page.getByTestId('video-card')
    await expect(cards.filter({ hasText: OFFICIAL })).toHaveCount(1)
    await expect(cards.filter({ hasText: FAN })).toHaveCount(0)
  })
})
