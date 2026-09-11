/**
 * Tile URL for the admin's venue map. Mirrors `web/src/lib/basemap.ts` — same
 * CARTO gating behaviour: an unkeyed request still returns `200 OK` with a
 * real PNG, just watermarked "API KEY REQUIRED" across the middle, so a
 * missing key looks fine in the network tab and is only visible to a human
 * looking at the map.
 *
 * Unlike the public site, this uses the *labelled* `voyager` tile set, not
 * `voyager_nolabels` — the public maps hide labels because the 2-Tone theme
 * runs them through a grayscale filter, but here an editor is placing a pin
 * against real street names, so hiding them would make the map less useful.
 *
 * With no key this returns the bare URL rather than falling back to a
 * different provider (e.g. plain OpenStreetMap) — a deploy missing the key
 * should look broken, not quietly render different tiles than production.
 */
const CARTO_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

export function basemapTileUrl(key?: string): string {
  return key ? `${CARTO_TILES}?key=${encodeURIComponent(key)}` : CARTO_TILES
}

export const BASEMAP_ATTRIBUTION = '© OpenStreetMap © CARTO'
