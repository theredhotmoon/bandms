import fs from 'fs'
import path from 'path'
import type { APIRequestContext } from '@playwright/test'

/**
 * Bearer auth for API calls made from a spec.
 *
 * `request.newContext({ storageState })` replays cookies only, and the admin
 * storage state holds none — this app keeps its token in localStorage. So an
 * API context built from the storage state is anonymous and every admin call
 * 401s, quietly: a beforeAll that reads state to restore later records "there
 * was nothing" and the afterAll then restores nothing. Read the token out of
 * the file and send it as a header instead, and throw rather than return an
 * empty result so a failed capture cannot become a destructive restore.
 *
 * Specs are ESM, so the path is relative to the Playwright cwd (`app/`), the
 * way `test.use({ storageState })` already is.
 */
const AUTH_FILE = path.resolve('e2e/.auth/admin.json')

let cachedToken: string | undefined

export function adminToken(): string {
  if (cachedToken) return cachedToken
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return (cachedToken = entry.value)
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}

export function adminHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' }
}

/**
 * The band's content-language order, primary first. It decides which
 * locale's text the admin renders in a list, which locale's title input is
 * `required`, and which locale's textarea comes first in a block — so a spec
 * that types into or reads "the first language" has to ask rather than
 * assume English.
 */
export async function contentLocaleOrder(request: APIRequestContext): Promise<string[]> {
  const res = await request.get('/api/admin/content-locales', { headers: adminHeaders() })
  if (!res.ok()) throw new Error(`GET /api/admin/content-locales failed: ${res.status()} ${await res.text()}`)
  const body = (await res.json()) as { data: { order: string[] } }
  return body.data.order
}

export async function primaryLocale(request: APIRequestContext): Promise<string> {
  return (await contentLocaleOrder(request))[0]
}

/**
 * The fields every post needs before the API will save it — an intro and at
 * least one tag, drafts included. Spread into a seeded post's payload so a
 * spec spells out only what it is about.
 *
 * Uses a tag of its own, found by name and created once: "the first tag" could
 * be another spec's temporary fixture, deleted mid-run, after which every post
 * seed in this worker would 422 — a cross-spec failure that is hard to place.
 * That one tag is the single row this leaves behind.
 */
const REQUIRED_TAG = 'E2E required tag'

let requiredTagId: number | undefined

export async function postRequiredFields(
  request: APIRequestContext,
  apiBase = '',
): Promise<{ intro: Record<string, string>; tag_ids: number[] }> {
  if (requiredTagId === undefined) {
    const res = await request.get(`${apiBase}/api/tags`, { headers: adminHeaders() })
    if (!res.ok()) throw new Error(`GET /api/tags failed: ${res.status()} ${await res.text()}`)
    const tags = ((await res.json()) as { data: { id: number; name: string }[] }).data
    const mine = tags.find(t => t.name === REQUIRED_TAG)
    if (mine) {
      requiredTagId = mine.id
    } else {
      const created = await request.post(`${apiBase}/api/tags`, { headers: adminHeaders(), data: { name: { en: REQUIRED_TAG } } })
      if (!created.ok()) throw new Error(`POST /api/tags failed: ${created.status()} ${await created.text()}`)
      requiredTagId = ((await created.json()) as { data: { id: number } }).data.id
    }
  }
  return { intro: { en: 'E2E intro' }, tag_ids: [requiredTagId] }
}

/** A 1×1 transparent PNG — small enough to embed, real enough to pass Laravel's `image` rule. */
export const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

/**
 * `web` bakes the site once at container start; a record created via the API
 * never appears until something rebuilds it. Triggers the same rebuild the
 * admin's manual button uses and polls its status rather than sleeping a
 * fixed duration — a full Astro build is not a fixed-cost operation.
 *
 * `since` guards against a second concurrent spec file's beforeAll: two
 * workers can each seed and call this within moments of each other, and a
 * 409 here just means the other worker's rebuild is the one in flight. A
 * completed build is only accepted if it started at or after `since`, so a
 * build that read the database before this worker's seed is never trusted.
 */
export async function rebuildAndWait(request: APIRequestContext, since: number, apiBase = ''): Promise<void> {
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline) {
    const trigger = await request.post(`${apiBase}/api/admin/site/rebuild`, { headers: adminHeaders() })
    if (!trigger.ok() && trigger.status() !== 409) throw new Error(`POST /api/admin/site/rebuild → ${trigger.status()}`)
    while (Date.now() < deadline) {
      const res = await request.get(`${apiBase}/api/admin/site/rebuild/status`, { headers: adminHeaders() })
      const body = await res.json()
      if (body.status === 'error') throw new Error('Public site rebuild failed')
      if (body.status === 'done') {
        if ((body.startedAt ?? 0) >= since) return
        break // a build that started before our seed — trigger another
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

/**
 * The public URL segment a module is served under for a locale, or null when
 * the module is switched off (a disabled module unbuilds its routes) or the
 * site config is unreachable. The slug is per locale and band-editable, so a
 * spec must ask rather than assume `news`.
 */
export async function moduleSectionSlug(
  request: APIRequestContext,
  module: string,
  lang: string,
  apiBase = '',
): Promise<string | null> {
  const res = await request.get(`${apiBase}/api/site-config?lang=${lang}`)
  if (!res.ok()) return null
  const body = await res.json()
  const cfg = body.data ?? body
  if (cfg.modules?.[module] === false) return null
  return cfg.module_config?.[module]?.slug ?? module
}
