import type { HeroImage, HeroImageSets } from '@/types/heroImage'

/**
 * Pure helpers for reading hero image sets.
 *
 * They live here rather than in useHeroImages so they can be tested without a
 * DOM: the composable imports useAuth, which reads localStorage at module load,
 * and the admin's vitest environment is `node`. Same reason riderDiff and
 * venueGate are utils rather than composables.
 */

/** The pictures stored against one scope, or an empty list. */
export function scopeSet(sets: HeroImageSets | undefined, scope: string): HeroImage[] {
  return sets?.[scope] ?? []
}

/**
 * Whether a scope overrides the main set.
 *
 * An empty stored set counts as *no* override, matching resolveHeroImages() on
 * the public side. The two have to agree: if the admin showed "3 pictures" for
 * a scope the public site treats as inheriting, the editor would be lying about
 * what visitors see.
 */
export function hasOwnSet(sets: HeroImageSets | undefined, scope: string): boolean {
  return scopeSet(sets, scope).length > 0
}
