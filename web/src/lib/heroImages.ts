import type { SiteConfig } from './cms'

/**
 * One hero backdrop candidate.
 *
 * `id` is the hero_images row's own id — hero pictures are uploaded directly
 * and have no relationship to the gallery.
 *
 * `url` is non-nullable because `hero_images.image` is a required column on
 * the server. That guarantee lives there rather than here: a null would
 * otherwise reach a CSS `url()` and render as the literal string "null".
 */
export interface HeroImage {
  id: number
  url: string
  caption: string | null
  /**
   * How often this picture shows, 1–100, relative to the others in its set.
   * Absent or null means 100: weights only ever *lower* a picture's chance.
   * Optional because an API predating the column omits it.
   */
  weight?: number | null
}

/** The highest weight, and what an unweighted picture counts as. */
export const MAX_HERO_WEIGHT = 100

/** Each picture's effective weight: null/absent is the maximum, the rest clamped to 1–100. */
export function heroWeights(images: readonly HeroImage[]): number[] {
  return images.map((i) =>
    i.weight == null ? MAX_HERO_WEIGHT : Math.min(MAX_HERO_WEIGHT, Math.max(1, Math.round(i.weight))),
  )
}

/**
 * Picks an index with probability weight / Σweights, given `r` in [0, 1).
 *
 * Self-contained on purpose — no imports, no closures, plain ES5 — because
 * HeroBackdrop ships this function's own source into an `is:inline` script
 * (`String(pickWeightedIndex)`), which runs before first paint and cannot
 * import a module. This copy is the tested one; there is no other.
 */
export function pickWeightedIndex(weights: number[], r: number): number {
  var total = 0
  for (var i = 0; i < weights.length; i++) total += weights[i]
  var target = r * total
  for (var j = 0; j < weights.length; j++) {
    target -= weights[j]
    if (target < 0) return j
  }
  return weights.length - 1
}

/** The scope every page falls back to when it has no set of its own. */
const MAIN_SCOPE = 'main'

/**
 * The pictures a page should offer as its hero backdrop.
 *
 * A page's own set *replaces* the main set rather than extending it — that is
 * what "override" means here, and it is what lets one page be deliberately
 * different rather than merely additional.
 *
 * An empty override is treated as no override. The alternative — letting an
 * empty list mean "this page shows nothing" — would need a third state in the
 * editor to distinguish it from "not configured", for a result the band can
 * already get by choosing a plain image.
 *
 * Reads defensively throughout: `getSiteConfig` fails open to `{}` when the API
 * is unreachable mid-build, and an API predating this feature omits the key. A
 * bare access would throw during `astro build`, taking down all 35 pages.
 */
export function resolveHeroImages(config: SiteConfig, scope: string): HeroImage[] {
  const sets = config.hero_images ?? {}
  const own = sets[scope] ?? []

  if (own.length > 0) return own

  return scope === MAIN_SCOPE ? [] : (sets[MAIN_SCOPE] ?? [])
}
