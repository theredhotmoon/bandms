/**
 * Which gigs a concert page lists under its "more shows" heading.
 *
 * Upcoming gigs win whenever any are left besides the current one, soonest
 * first; otherwise the most recently played. At most three — the page lays
 * them out one column per card, so the count decides the widths.
 */
export interface MoreShows<T> {
  kind: 'upcoming' | 'past'
  shows: T[]
}

export const MORE_SHOWS_LIMIT = 3

/**
 * `concerts` must be in date order, oldest first — the order `/api/concerts`
 * returns. `isUpcoming` is passed in so the page and a test agree on "now".
 */
export function pickMoreShows<T extends { id: number; date: string }>(
  concerts: T[],
  currentId: number,
  isUpcoming: (date: string) => boolean,
): MoreShows<T> {
  const others = concerts.filter(c => c.id !== currentId)
  const upcoming = others.filter(c => isUpcoming(c.date))
  if (upcoming.length > 0) return { kind: 'upcoming', shows: upcoming.slice(0, MORE_SHOWS_LIMIT) }
  return {
    kind: 'past',
    shows: others.filter(c => !isUpcoming(c.date)).reverse().slice(0, MORE_SHOWS_LIMIT),
  }
}
