import { anonymousVisitor } from '../../fixtures/visitor'
import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * One indexable URL per page.
 *
 * The legacy unlocalised routes (/posts/{id}, /concerts/{slug}, /about …) keep
 * old links working by rendering the English page a second time. Each named
 * *itself* canonical and sat in the sitemap, so a search engine was offered
 * every English page twice. They must point at their /en/ twin instead.
 *
 * Reads whatever the served build holds: no seeding, so no rebuild.
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: anonymousVisitor() })

// canonical, og:url and JSON-LD carry the production host; only the path is compared.
const pathOf = (url: string) => new URL(url).pathname

async function head(request: APIRequestContext, path: string) {
  const res = await request.get(`${WEB}${path}`)
  const html = await res.text()
  const one = (re: RegExp) => html.match(re)?.[1] ?? ''
  const json = one(/<script type="application\/ld\+json">(.*?)<\/script>/s)
  return {
    status: res.status(),
    canonical: one(/<link rel="canonical" href="([^"]+)"/),
    ogUrl: one(/<meta property="og:url"\s+content="([^"]+)"/),
    en: one(/<link rel="alternate" hreflang="en" href="([^"]+)"/),
    xDefault: one(/<link rel="alternate" hreflang="x-default" href="([^"]+)"/),
    structuredUrl: json ? (JSON.parse(json).url as string | undefined) : undefined,
  }
}

/**
 * Whether the served build holds this page. Asked of the *localised* page only:
 * a module switched off by another spec, or a post newer than the build, is a
 * reason to skip. A legacy URL missing beside a built page is the failure.
 */
async function isBuilt(request: APIRequestContext, path: string) {
  const res = await request.get(`${WEB}${path}`)
  return res.status() === 200 && !(await res.text()).includes('http-equiv="refresh"')
}

/** The legacy page names `twin` everywhere, and `twin` is a real page naming itself. */
async function expectPointsAt(request: APIRequestContext, legacy: string, twin: string) {
  const old = await head(request, legacy)
  expect(old.status, legacy).toBe(200)
  for (const key of ['canonical', 'ogUrl', 'en', 'xDefault'] as const) {
    expect(pathOf(old[key]), `${legacy} ${key}`).toBe(twin)
  }
  if (old.structuredUrl) expect(pathOf(old.structuredUrl), `${legacy} JSON-LD`).toBe(twin)

  const real = await head(request, twin)
  expect(real.status, twin).toBe(200)
  expect(pathOf(real.canonical), twin).toBe(twin)
}

async function siteConfig(request: APIRequestContext) {
  const res = await request.get(`${API}/api/site-config?lang=en`)
  expect(res.ok()).toBe(true)
  return await res.json() as {
    modules: Record<string, boolean>
    module_config: Record<string, { slug?: string }>
    locales: { code: string }[]
  }
}

const SECTIONS = ['about', 'concerts', 'contact', 'epk', 'merch', 'newsletter', 'photos', 'posts', 'press', 'releases', 'videos']

test.describe('Public — canonical URLs', () => {
  test('every legacy section page points at its English twin', async ({ request }) => {
    const cfg = await siteConfig(request)
    const on = []
    for (const s of SECTIONS) if (cfg.modules[s] === true && await isBuilt(request, `/en/${cfg.module_config[s]?.slug ?? s}/`)) on.push(s)
    test.skip(on.length === 0, 'every section is switched off')
    for (const s of on) {
      await expectPointsAt(request, `/${s}/`, `/en/${cfg.module_config[s]?.slug ?? s}/`)
    }
  })

  test('a legacy article URL points at the article', async ({ request }) => {
    const cfg = await siteConfig(request)
    test.skip(cfg.modules.posts !== true, 'News is off')
    const posts = (await (await request.get(`${API}/api/posts?lang=en`)).json()).data as { id: number; slug: string }[]

    // Oldest first: the newest are often fixtures a parallel spec is about to delete.
    const section = cfg.module_config.posts?.slug ?? 'posts'
    const built = []
    for (const p of posts.reverse()) {
      if (await isBuilt(request, `/en/${section}/${p.slug}/`)) built.push(p)
      if (built.length === 2) break
    }
    test.skip(built.length === 0, 'no article in the served build')
    for (const p of built) {
      await expectPointsAt(request, `/posts/${p.id}/`, `/en/${section}/${p.slug}/`)
    }
  })

  test('a legacy show URL points at the show', async ({ request }) => {
    const cfg = await siteConfig(request)
    test.skip(cfg.modules.concerts !== true, 'Shows are off')
    const concerts = (await (await request.get(`${API}/api/concerts?lang=en`)).json()).data as { id: number; slug: string }[]
    // Oldest record first, for the same reason.
    for (const c of concerts.sort((a, b) => a.id - b.id)) {
      const twin = `/en/${cfg.module_config.concerts?.slug ?? 'concerts'}/${c.slug}/`
      if (!await isBuilt(request, twin)) continue
      await expectPointsAt(request, `/concerts/${c.slug}/`, twin)
      return
    }
    test.skip(true, 'no show in the served build')
  })

  test('the sitemap lists localised pages only', async ({ request }) => {
    const res = await request.get(`${WEB}/sitemap-0.xml`)
    expect(res.status()).toBe(200)
    const { locales } = await siteConfig(request)
    const paths = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => pathOf(m[1]!))
    expect(paths).toContain('/en/')
    expect(paths.filter(p => !locales.some(l => p.startsWith(`/${l.code}/`)))).toEqual([])
  })
})
