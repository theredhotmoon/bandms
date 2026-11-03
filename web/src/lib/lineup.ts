import { ourStageTime } from '@bandms/concert-core'
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
 * and its stage time is `ourStageTime()`. The admin numbers one sequence across
 * both (ConcertForm's line-up editor), so merging by position reproduces what
 * the band arranged. Reading only `bands` dropped our band from every
 * line-up on the site.
 *
 * On a tie our band goes first: rows saved before `own_sort_order` existed
 * default it to 1, which can collide with a guest's 1.
 */
export function concertLineup(
  concert: Pick<Concert, 'bands' | 'own_sort_order' | 'start_time' | 'own_play_time'>,
  bandName: string,
): LineupEntry[] {
  const own = { order: concert.own_sort_order ?? 1, rank: 0, entry: { name: bandName, play_time: ourStageTime(concert), own: true } }
  const guests = concert.bands.map((b) => ({
    order: b.sort_order,
    rank: 1,
    entry: { name: b.name, play_time: b.play_time, own: false },
  }))

  return [own, ...guests]
    .sort((a, b) => a.order - b.order || a.rank - b.rank)
    .map((x) => x.entry)
}

/**
 * When our band is on stage: its own slot time, else the show's start.
 * Everything labelled "On stage" reads this, never `start_time` directly. The
 * rule lives in `@bandms/concert-core` because the admin's concerts list
 * shows the same time and must not drift from it.
 */
export { ourStageTime }

export interface LineupRoleLabels {
  headliner: string
  support: string
}

/**
 * Whether a concert's line-up is billed as headliner + support — the band's
 * choice per concert, since a festival slot or a split bill is not. Read
 * `!== false` so a concert served without the key (an older API mid-deploy)
 * keeps the labels it had. The one place this is decided: the caption and
 * the show page's highlight (`isHighlighted()`) both take its answer.
 */
export function showsLineupRoles(concert: { show_lineup_roles?: boolean }): boolean {
  return concert.show_lineup_roles !== false
}

/**
 * The small line under an act's name: its billing role, its stage time, or
 * both — "Headliner · 21:00". With the roles off only the time is left, and
 * an act with no time gets no line at all ('').
 */
export function lineupCaption(
  index: number,
  entry: Pick<LineupEntry, 'play_time'>,
  showRoles: boolean,
  labels: LineupRoleLabels,
  fmtTime: (time: string) => string,
): string {
  const role = showRoles ? (index === 0 ? labels.headliner : labels.support) : ''
  const time = entry.play_time ? fmtTime(entry.play_time) : ''
  return [role, time].filter(Boolean).join(' · ')
}

/**
 * Which line-up row the show page paints as the headliner.
 *
 * With the roles on, the billing is the band's own statement: the act on top
 * is the headliner, even when it is a guest. With them off there is no billing
 * to follow, and on its own site our band is always the headliner — so our
 * row is highlighted wherever it sits in the running order.
 */
export function isHighlighted(index: number, entry: Pick<LineupEntry, 'own'>, showRoles: boolean): boolean {
  return showRoles ? index === 0 : entry.own
}

/**
 * The number printed beside an act: its place in the running order.
 *
 * The list itself is in billing order — the headliner on top — and the
 * headliner plays last, so counting down the list numbered the night
 * backwards. The opener is 01, the act at the top of the bill the highest.
 */
export function runningOrderNumber(index: number, total: number): string {
  return String(total - index).padStart(2, '0')
}
