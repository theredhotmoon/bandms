/**
 * Frontend half of the area-key registry — the backend half lives in
 * api/app/Support/SiteRebuild.php's call sites. The two are not auto-synced
 * (same convention as the locale registry in src/locales.ts): adding an area
 * means updating both, plus common.rebuildAreas in the i18n catalogues.
 */
export const REBUILD_AREAS = [
  'band-profile',
  'band-members',
  'hero-images',
  'posts',
  'website-modules',
  'concerts',
  'venues',
  'setlists',
  'releases',
  'photos',
  'music-videos',
  'press-releases',
  'shop',
  'faqs',
] as const

/**
 * The catalogue key for an area, or null when the area has no mapping.
 *
 * Null rather than the raw key so a forgotten mapping degrades in the caller
 * (which prints the raw area) instead of rendering "common.rebuildAreas.x".
 */
export function rebuildAreaMessageKey(area: string): string | null {
  return (REBUILD_AREAS as readonly string[]).includes(area)
    ? `common.rebuildAreas.${area}`
    : null
}
