import type { Locale } from '@/types/shared'
import type { SlugMap } from './slugs'
import type { RefEntity } from '@/types/post'

/** Which website module has to be enabled for each entity's page to exist. */
const MODULE_FOR: Partial<Record<RefEntity, string>> = {
  concert: 'concerts', release: 'releases', shop_item: 'merch', album: 'photos',
}

export interface RefLink { href: string; external: boolean }

/**
 * The href for a resolved ref block, or null when it cannot safely be linked.
 *
 * Null has two causes and both matter:
 *  - the target module is switched off, which *unbuilds its routes* — the link
 *    would 404 on a page that builds perfectly green;
 *  - the identifying field is missing from a frozen or partial payload.
 *
 * An album links to its own page under the Gallery section.
 */
export function refHref(
  entity: RefEntity,
  data: Record<string, unknown>,
  lang: Locale,
  slugMap: SlugMap,
  modules: Record<string, boolean>,
): RefLink | null {
  if (entity === 'music_video') {
    return data.video_url ? { href: String(data.video_url), external: true } : null
  }
  if (entity === 'press_release') {
    return data.url ? { href: String(data.url), external: true } : null
  }

  const moduleKey = MODULE_FOR[entity]
  // `!== false`, never `=== true`: getSiteConfig fails open to {} when the API
  // is unreachable mid-build, so an absent key has to mean enabled.
  if (moduleKey && modules[moduleKey] === false) return null

  const section = (key: string) => slugMap[lang]?.[key] ?? key

  switch (entity) {
    case 'concert':
      return data.slug ? { href: `/${lang}/${section('concerts')}/${data.slug}`, external: false } : null
    case 'release':
      return data.id ? { href: `/${lang}/${section('releases')}/${data.id}`, external: false } : null
    case 'shop_item':
      return data.slug ? { href: `/${lang}/${section('merch')}/${data.slug}`, external: false } : null
    // An album page exists only for a published album with photos; the
    // resolver says which (`on_site`), so a block pointing at a draft stays
    // text rather than linking to a page that was never built. A frozen
    // payload without the flag (older API) is trusted, as before.
    case 'album':
      return data.slug && data.on_site !== false
        ? { href: `/${lang}/${section('photos')}/${data.slug}`, external: false }
        : null
    default:
      return null
  }
}
