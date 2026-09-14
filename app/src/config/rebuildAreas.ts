/**
 * Frontend half of the area-key registry — the backend half lives in
 * api/app/Support/SiteRebuild.php's call sites. The two are not auto-synced
 * (same convention as the locale registry in src/locales.ts): adding an area
 * means updating both.
 */
export const REBUILD_AREA_LABELS: Record<string, string> = {
  'band-profile': 'Band Profile',
  'band-members': 'Band Members',
  'hero-images': 'Hero Images',
  posts: 'Posts',
  'website-modules': 'Website Modules',
  concerts: 'Concerts',
  venues: 'Venues',
  setlists: 'Setlists',
  releases: 'Releases',
  photos: 'Photos',
  'music-videos': 'Music Videos',
  'press-releases': 'Press Releases',
  shop: 'Shop',
  faqs: 'FAQs',
}

/** Falls back to the raw key so a forgotten mapping degrades, not blanks. */
export function rebuildAreaLabel(area: string): string {
  return REBUILD_AREA_LABELS[area] ?? area
}
