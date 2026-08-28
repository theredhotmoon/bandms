import type { Locale } from '@/types/shared'
import { getSiteConfig, isFailOpenConfig, type SiteConfig } from './cms'

export type SlugMap = { en: Record<string, string>; pl: Record<string, string> }

export const LOCALES: Locale[] = ['en', 'pl']

// Last-resort fallbacks for a site-config that has no row for these modules —
// an API that has not run the slug migrations yet. Both are ordinary modules
// now, so a live API always overwrites these.
const STATIC_SLUGS: SlugMap = {
  en: { contact: 'contact', newsletter: 'newsletter' },
  pl: { contact: 'kontakt', newsletter: 'newsletter' },
}

// One resolution per build, shared by every caller — see getSlugMap.
let _pending: Promise<SlugMap> | null = null

// getSiteConfig gives up after its own 3 attempts and caches the fail-open value,
// so there is no point looping past that.
const MAX_ATTEMPTS = 3

function dedupeSlugMap(m: Record<string, string>): Record<string, string> {
  const seen = new Set<string>()
  const result: Record<string, string> = {}
  for (const [key, slug] of Object.entries(m)) {
    if (seen.has(slug)) {
      result[key] = key
    } else {
      seen.add(slug)
      result[key] = slug
    }
  }
  return result
}

/**
 * Returns the full slug map for all modules + hardcoded sections.
 *
 * Resolved exactly once per build. This matters more than it looks: the map
 * decides both which routes `getStaticPaths` generates and which hrefs the
 * Header and Footer emit, and those two are computed by separate callers. An
 * earlier version returned an uncached map whenever the config came back
 * fail-open, so a mid-build blip could hand the section list `/pl/shop` and —
 * after the retry succeeded — hand the detail routes and every nav link
 * `/pl/sklep`. Links pointing at a page that was never generated, on a build
 * `astro build` reports as green.
 *
 * A single shared promise makes divergence impossible, and the retries inside
 * absorb a blip. If the API is still unreachable after those, the build ships
 * module keys for the whole site: wrong URLs, but consistent ones, and no dead
 * links. Throwing instead would be worse — a failed Astro build crash-loops the
 * `web` container and takes the public site down entirely.
 */
export function getSlugMap(): Promise<SlugMap> {
  _pending ??= resolveSlugMap()
  return _pending
}

async function resolveSlugMap(): Promise<SlugMap> {
  for (let attempt = 1; ; attempt++) {
    const [enCfg, plCfg] = await Promise.all([
      getSiteConfig('en'),
      getSiteConfig('pl'),
    ])

    const built = buildSlugMap(enCfg, plCfg)
    const failOpen = isFailOpenConfig(enCfg) || isFailOpenConfig(plCfg)

    if (!failOpen) return built

    if (attempt >= MAX_ATTEMPTS) {
      console.warn(
        '[slugs] site-config unreachable after ' +
          `${MAX_ATTEMPTS} attempts — falling back to module keys for every URL.`,
      )
      return built
    }
  }
}

function buildSlugMap(enCfg: SiteConfig, plCfg: SiteConfig): SlugMap {
  const map: SlugMap = {
    en: { ...STATIC_SLUGS.en },
    pl: { ...STATIC_SLUGS.pl },
  }

  // Slugs are stored per locale on the module, not derived from its label —
  // renaming "Shop" to "Merch store" must not move /en/shop. The API resolves
  // an empty slug to the module key before it gets here; the fallback covers an
  // API old enough not to send the field at all.
  //
  // Tested for empty rather than with `||`, which would discard the legal slug
  // "0" the same way PHP's `?:` does.
  const resolve = (slug: string | undefined, moduleSlug: string) =>
    slug === undefined || slug === '' ? moduleSlug : slug

  for (const moduleSlug of Object.keys(enCfg.module_config)) {
    map.en[moduleSlug] = resolve(enCfg.module_config[moduleSlug]?.slug, moduleSlug)
    map.pl[moduleSlug] = resolve(plCfg.module_config[moduleSlug]?.slug, moduleSlug)
  }

  return { en: dedupeSlugMap(map.en), pl: dedupeSlugMap(map.pl) }
}
