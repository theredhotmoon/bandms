import type { Concert } from '@/types/concert'

export interface LineupEntry {
  name: string
  play_time: string | null
  /** True for the band this site belongs to. */
  own: boolean
}

/**
 * The full running order of a show: the guest bands *and* our own band.
 *
 * The API keeps them apart. Guests are the `bands` pivot, each with its
 * `sort_order`; our band is the concert itself, its slot in `own_sort_order`
 * and its stage time in `start_time`. The admin numbers one sequence across
 * both (ConcertForm's line-up editor), so merging by position reproduces what
 * the band arranged. Reading only `bands` dropped our band from every
 * line-up on the site.
 *
 * On a tie our band goes first: rows saved before `own_sort_order` existed
 * default it to 1, which can collide with a guest's 1.
 */
export function concertLineup(
  concert: Pick<Concert, 'bands' | 'own_sort_order' | 'start_time'>,
  bandName: string,
): LineupEntry[] {
  const own = { order: concert.own_sort_order ?? 1, rank: 0, entry: { name: bandName, play_time: concert.start_time, own: true } }
  const guests = concert.bands.map((b) => ({
    order: b.sort_order,
    rank: 1,
    entry: { name: b.name, play_time: b.play_time, own: false },
  }))

  return [own, ...guests]
    .sort((a, b) => a.order - b.order || a.rank - b.rank)
    .map((x) => x.entry)
}
