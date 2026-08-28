/**
 * The tile URL both public maps render from.
 *
 * CARTO gated their raster basemaps behind an API key. Unkeyed requests still
 * return `200 OK` with a valid PNG — they are just watermarked "API KEY
 * REQUIRED" across the middle. Nothing in the network tab, in Leaflet's error
 * handling or in `astro build` can see that, so the only symptom is a map that
 * looks wrong to a human. Keep that in mind before concluding the map is fine
 * because the requests are green.
 *
 * Request a key at https://carto.com/basemaps/apikey — it is emailed back with
 * no approval queue and no CARTO account, free to 5M tile requests a month.
 * It arrives as `PUBLIC_CARTO_KEY`; Astro only exposes `PUBLIC_`-prefixed vars
 * to island code, so the name matters.
 *
 * The key is inlined into client-side JS and travels in a query string, which
 * is fine — a basemap key is a public, domain-scoped credential, not a secret.
 * Do not reach for a proxy to hide it.
 */
const CARTO_TILES =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png'

/**
 * `voyager_nolabels` deliberately carries no place names: the 2-Tone theme runs
 * the tile pane through a grayscale/sepia filter, and baked-in labels muddy it.
 * If you ever swap providers, keep the label-free variant.
 *
 * With no key we return the bare URL rather than falling back to another
 * provider. That leaves the watermark visible, which is the point — a dev or a
 * deploy missing the key should *look* broken rather than quietly render a
 * different basemap than production does.
 */
export function basemapTileUrl(key?: string): string {
  return key ? `${CARTO_TILES}?key=${encodeURIComponent(key)}` : CARTO_TILES
}

export const BASEMAP_ATTRIBUTION = '© OpenStreetMap © CARTO'
