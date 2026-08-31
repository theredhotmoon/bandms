import { getSiteConfig, isFailOpenConfig, type SiteConfig } from './cms'
import { DEFAULT_LOCALE, LOCALES, type Locale } from './locales'

// Keyed by the registry rather than a literal pair, so a new locale is a
// missing-key type error here instead of a silently half-built slug map.
export type SlugMap = Record<Locale, Record<string, string>>

export { LOCALES }

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
    const entries = await Promise.all(
      LOCALES.map(async l => [l, await getSiteConfig(l)] as const),
    )
    const configs = Object.fromEntries(entries) as Record<Locale, SiteConfig>

    const built = buildSlugMap(configs)
    const failOpen = LOCALES.some(l => isFailOpenConfig(configs[l]))

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

function buildSlugMap(configs: Record<Locale, SiteConfig>): SlugMap {
  const map = Object.fromEntries(
    LOCALES.map(l => [l, { ...STATIC_SLUGS[l] }]),
  ) as SlugMap

  // Slugs are stored per locale on the module, not derived from its label —
  // renaming "Shop" to "Merch store" must not move /en/shop. The API resolves
  // an empty slug to the module key before it gets here; the fallback covers an
  // API old enough not to send the field at all.
  //
  // Tested for empty rather than with `||`, which would discard the legal slug
  // "0" the same way PHP's `?:` does.
  const resolve = (slug: string | undefined, moduleSlug: string) =>
    slug === undefined || slug === '' ? moduleSlug : slug

  // The module list comes from the default locale: every locale serves the same
  // set, and reading it from a locale whose config happened to fail open would
  // silently shrink the map for all of them.
  for (const moduleSlug of Object.keys(configs[DEFAULT_LOCALE].module_config)) {
    for (const l of LOCALES) {
      map[l][moduleSlug] = resolve(configs[l]?.module_config[moduleSlug]?.slug, moduleSlug)
    }
  }

  return Object.fromEntries(
    LOCALES.map(l => [l, dedupeSlugMap(map[l])]),
  ) as SlugMap
}
