import type { Locale } from '@/types/shared'
import { getSiteConfig } from './cms'

export type SlugMap = { en: Record<string, string>; pl: Record<string, string> }

export const LOCALES: Locale[] = ['en', 'pl']

// Sections not managed by the CMS module system — slugs are hardcoded per locale.
const STATIC_SLUGS: SlugMap = {
  en: { contact: 'contact', newsletter: 'newsletter' },
  pl: { contact: 'kontakt', newsletter: 'newsletter' },
}

/**
 * Converts a display name to a URL-safe slug.
 * Handles Polish diacritics (ą→a, ę→e, ó→o, ł→l, etc.).
 */
export function slugify(str: string): string {
  return str
    .replace(/ł/gi, 'l')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip combining diacritics (ą→a, ę→e, ó→o, ź→z, etc.)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

let _cache: SlugMap | null = null

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

  for (const moduleSlug of Object.keys(enCfg.module_config)) {
    const enLabel = enCfg.module_config[moduleSlug]?.label ?? moduleSlug
    const plLabel = plCfg.module_config[moduleSlug]?.label ?? enLabel
    map.en[moduleSlug] = slugify(enLabel) || moduleSlug
    map.pl[moduleSlug] = slugify(plLabel) || moduleSlug
  }

  _cache = map
  return _cache
}
