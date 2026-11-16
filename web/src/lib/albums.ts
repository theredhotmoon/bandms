import type { Locale } from '@/types/shared'
import type { Album, AlbumLink } from '@/types/album'
import type { SlugMap } from './slugs'
import { postSlug } from './i18n'
import { refHref } from './refHref'

/**
 * Whether the site builds a page for this album: published, with at least
 * one photo that has a file. The Gallery page has always hidden the rest —
 * a card that opens an empty album is worse than no card — and the API's
 * `Album::scopeOnSite()` applies the same rule to the cards it sends for
 * posts, shows, releases and merch. Change one, change both.
 */
export function isAlbumOnSite(album: Pick<Album, 'published_at' | 'photos'>): boolean {
  return !!album.published_at && (album.photos ?? []).some(p => !!p.image_url)
}

/**
 * The album page's path, or null when it is not built: the Gallery module is
 * switched off (which unbuilds every album page with it) or the album has no
 * slug. `!== false`, never `=== true` — getSiteConfig fails open to {}, so an
 * absent key means enabled.
 */
export function albumHref(
  album: { slug?: string | null },
  lang: Locale,
  slugMap: SlugMap,
  modules: Record<string, boolean>,
): string | null {
  if (modules.photos === false || !album.slug) return null
  return `/${lang}/${slugMap[lang]?.photos ?? 'photos'}/${album.slug}`
}

/**
 * Where a record linking to an album lives, or null when its page is not
 * built (its module is off, or the identifying field is missing). The API
 * already leaves out drafts and hidden merch.
 *
 * Concerts, releases and merch go through refHref(), the one place their
 * URLs and module gates are decided — a second copy here would 404 the
 * day one of those routes changed. Posts are not a ref entity, so they are
 * built here, per language, with postSlug().
 */
export function linkedHref(
  link: AlbumLink,
  lang: Locale,
  slugMap: SlugMap,
  modules: Record<string, boolean>,
): string | null {
  if (link.type !== 'post') {
    return refHref(link.type, link as unknown as Record<string, unknown>, lang, slugMap, modules)?.href ?? null
  }
  if (modules.posts === false) return null
  const slug = postSlug(link, lang)
  return slug ? `/${lang}/${slugMap[lang]?.posts ?? 'posts'}/${slug}` : null
}
