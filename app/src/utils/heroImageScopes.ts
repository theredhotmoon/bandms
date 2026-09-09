import type { HeroImage, HeroImageSets } from '@/types/heroImage'

/**
 * Pure helpers for reading hero image sets.
 *
 * They live here rather than in useHeroImages so they can be tested without a
 * DOM: the composable imports useAuth, which reads localStorage at module
 * load, and the admin's vitest environment is `node`.
 */

/** The pictures stored against one scope, or an empty list. Includes inactive rows. */
export function scopeSet(sets: HeroImageSets | undefined, scope: string): HeroImage[] {
  return sets?.[scope] ?? []
}

/**
 * Whether a scope overrides the main set.
 *
 * Filtered to *active* rows: a scope holding only inactive pictures must
 * report "inherits Main" the same way an empty scope does, because that is
 * exactly what a visitor sees — resolveHeroImages() on the public side never
 * learns a picture exists if it isn't active. The editor would otherwise show
 * "N pictures" for a scope that renders nothing.
 */
export function hasOwnSet(sets: HeroImageSets | undefined, scope: string): boolean {
  return scopeSet(sets, scope).some((h) => h.active)
}
