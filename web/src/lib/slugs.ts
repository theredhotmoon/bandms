import type { Locale } from '@/types/shared'
import { getSiteConfig } from './cms'

export type SlugMap = { en: Record<string, string>; pl: Record<string, string> }

export const LOCALES: Locale[] = ['en', 'pl']

// Last-resort fallbacks for a site-config that has no row for these modules —
// an API that has not run the slug migrations yet. Both are ordinary modules
// now, so a live API always overwrites these.
const STATIC_SLUGS: SlugMap = {
  en: { contact: 'contact', newsletter: 'newsletter' },
  pl: { contact: 'kontakt', newsletter: 'newsletter' },
}

let _cache: SlugMap | null = null

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
 * Fetches /api/site-config for both locales in parallel; result is cached.
 */
export async function getSlugMap(): Promise<SlugMap> {
  if (_cache) return _cache

  const [enCfg, plCfg] = await Promise.all([
    getSiteConfig('en'),
    getSiteConfig('pl'),
  ])

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

  _cache = { en: dedupeSlugMap(map.en), pl: dedupeSlugMap(map.pl) }
  return _cache
}
