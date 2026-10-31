/**
 * The line-up timeline on the About page — the chart a Wikipedia band article
 * draws with EasyTimeline: one row per member, a bar per tenure coloured by
 * instrument, thinner stripes for secondary instruments, a year axis, and a
 * vertical line at every album (solid) and EP (dashed).
 *
 * Pure maths, so the page renders it as plain HTML with percentages and no
 * island. Every position is a percentage of the axis.
 */
import type { BandMember, MemberInstrument } from '@/types/bandMember'
import type { ReleaseSummary } from '@/types/release'

/** How many `--chart-N` colours tokens.css declares; legend entries cycle through them. */
export const CHART_COLOURS = 8

/** At most this many secondary instruments get a stripe; more is unreadable at bar height. */
const MAX_STRIPES = 2

export interface TimelineLegendEntry {
  name: string
  /** 1-based index into `--chart-N`. */
  colour: number
}

export interface TimelineRow {
  id: number
  name: string
  current: boolean
  left: number
  width: number
  /** Null when the member has no instrument at all — drawn in the neutral colour. */
  colour: number | null
  stripes: number[]
  instruments: string[]
  fromYear: number
  /** Null while the member is still in the band — or when they left on an unknown date. */
  toYear: number | null
  /**
   * A former member with no leave date. Their bar is a short stub rather
   * than running to today, which would draw them as still in the band.
   */
  endUnknown: boolean
}

export interface TimelineRelease {
  title: string
  kind: 'album' | 'ep'
  left: number
  year: number
}

export interface TimelineTick {
  year: number
  left: number
}

export interface MemberTimeline {
  rows: TimelineRow[]
  ticks: TimelineTick[]
  legend: TimelineLegendEntry[]
  releases: TimelineRelease[]
}

type ReleaseInput = Pick<ReleaseSummary, 'title' | 'type' | 'release_date' | 'is_upcoming'>

/** `2015-06-01` → 2015.41…, at day precision. Invalid or missing → null. */
export function fractionalYear(date: string | null | undefined): number | null {
  if (!date) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (!m) return null
  const year  = Number(m[1])
  const start = Date.UTC(year, 0, 1)
  const end   = Date.UTC(year + 1, 0, 1)
  const at    = Date.UTC(year, Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(at) ? null : year + (at - start) / (end - start)
}

function nowYear(now: Date): number {
  return fractionalYear(now.toISOString().slice(0, 10))!
}

/** Gridline step: every year for a short history, every 2 or 5 for a longer one. */
export function tickStep(span: number): number {
  return span <= 12 ? 1 : span <= 25 ? 2 : 5
}

function primaryInstrument(m: BandMember): MemberInstrument | null {
  return m.main_instrument ?? m.instruments[0] ?? null
}

/**
 * Null when there is nothing to draw: no members, or neither a join date nor
 * a formation year to anchor the axis.
 */
export function buildMemberTimeline(
  members: readonly BandMember[],
  releases: readonly ReleaseInput[],
  formationYear: number | null,
  now: Date,
): MemberTimeline | null {
  if (members.length === 0) return null

  const joins = members.map(m => fractionalYear(m.joined_at)).filter((y): y is number => y !== null)
  if (joins.length === 0 && formationYear === null) return null

  // Albums and EPs only — Wikipedia leaves singles off for the same reason:
  // a busy single schedule turns the chart into a barcode.
  const records = releases
    .filter(r => !r.is_upcoming && (r.type === 'LP' || r.type === 'EP'))
    .map(r => ({ r, at: fractionalYear(r.release_date) }))
    .filter((x): x is { r: ReleaseInput; at: number } => x.at !== null)

  const today  = nowYear(now)
  // A record released before anyone's known join date still belongs on the
  // chart, so it pulls the axis back too.
  const anchor = Math.min(...joins, ...records.map(x => x.at), formationYear ?? Infinity)
  const start  = Math.floor(anchor)
  // Through the end of the current year, so a current member's bar never
  // touches the right edge mid-year.
  const end    = Math.floor(today) + 1
  const span   = end - start
  const pct    = (y: number): number => Math.min(100, Math.max(0, ((y - start) / span) * 100))

  const sorted = [...members].sort((a, b) => {
    const ay = fractionalYear(a.joined_at) ?? start
    const by = fractionalYear(b.joined_at) ?? start
    return ay - by || a.sort_order - b.sort_order
  })

  // Colours are handed out in the order instruments first appear down the
  // chart, so the founding line-up gets the first (most distinct) colours.
  const legend = new Map<string, number>()
  const colourOf = (name: string): number => {
    if (!legend.has(name)) legend.set(name, (legend.size % CHART_COLOURS) + 1)
    return legend.get(name)!
  }

  const rows: TimelineRow[] = sorted.map(m => {
    const from = fractionalYear(m.joined_at) ?? (formationYear ?? start)
    const left = fractionalYear(m.quit_at)
    const endUnknown = left === null && !m.is_current
    const to   = left ?? (endUnknown ? Math.min(from + 1, today) : today)
    const main = primaryInstrument(m)
    const rest = m.instruments.filter(i => i.id !== main?.id)

    return {
      id: m.id,
      name: `${m.first_name} ${m.last_name}`.trim(),
      current: m.is_current,
      left: pct(from),
      // Never zero-width: a member who joined and left the same week is still a member.
      width: Math.max(pct(to) - pct(from), 0.6),
      colour: main ? colourOf(main.name) : null,
      stripes: rest.slice(0, MAX_STRIPES).map(i => colourOf(i.name)),
      instruments: [main, ...rest].filter((i): i is MemberInstrument => i !== null).map(i => i.name),
      fromYear: Math.floor(from),
      toYear: left !== null ? Math.floor(left) : null,
      endUnknown,
    }
  })

  const lines: TimelineRelease[] = records
    .filter(x => x.at <= end)
    .sort((a, b) => a.at - b.at)
    .map(({ r, at }) => ({ title: r.title, kind: r.type === 'LP' ? 'album' as const : 'ep' as const, left: pct(at), year: Math.floor(at) }))

  const step  = tickStep(span)
  const ticks: TimelineTick[] = []
  for (let y = Math.ceil(start / step) * step; y <= end; y += step) ticks.push({ year: y, left: pct(y) })

  return {
    rows,
    ticks,
    legend: [...legend].map(([name, colour]) => ({ name, colour })),
    releases: lines,
  }
}
