import type { FindingKind, FindingsFilter } from '@/types/assistantCrawler'

/** Tab order; All comes first. */
export const FINDING_KINDS: FindingKind[] = ['lead', 'mention', 'news']

export interface CountryChip { code: string; count: number }
export interface KindTab { kind: FindingKind | null; count: number }

/**
 * The country chips: busiest first, then by code. The selected country stays
 * on the row at zero, so a filter that empties the list can still be undone
 * from where it was set.
 */
export function countryChips(counts: Record<string, number>, selected: string | null): CountryChip[] {
  const chips = Object.entries(counts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
  if (selected && !(selected in counts)) chips.push({ code: selected, count: 0 })
  return chips
}

export function kindTabs(counts: Partial<Record<FindingKind, number>>): KindTab[] {
  const total = FINDING_KINDS.reduce((n, k) => n + (counts[k] ?? 0), 0)
  return [{ kind: null, count: total }, ...FINDING_KINDS.map(kind => ({ kind, count: counts[kind] ?? 0 }))]
}

/**
 * The next filter. Any change but the page goes back to page 1 (page 4 of a
 * narrower list may not exist), and choosing the selected country again
 * clears it — a chip is a toggle.
 */
export function withFilter(current: FindingsFilter, change: Partial<FindingsFilter>): FindingsFilter {
  const next = { ...current, ...change }
  if ('country' in change && change.country !== null && change.country === current.country) next.country = null
  if (!('page' in change)) next.page = 1
  return next
}
