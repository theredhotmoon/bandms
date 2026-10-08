import fs from 'fs'
import path from 'path'

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

export function adminToken(): string {
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}

export function adminHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' }
}

/** The band's content-language order, primary first — what decides which locale's text the admin renders and requires. */
export async function contentLocaleOrder(request: { get: (url: string, o: { headers: Record<string, string> }) => Promise<{ ok(): boolean; json(): Promise<unknown> }> }): Promise<string[]> {
  const res = await request.get('/api/admin/content-locales', { headers: adminHeaders() })
  if (!res.ok()) throw new Error('GET /api/admin/content-locales failed')
  const body = (await res.json()) as { data: { order: string[] } }
  return body.data.order
}

/** A 1×1 transparent PNG — small enough to embed, real enough to pass Laravel's `image` rule. */
export const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)
