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
