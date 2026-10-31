import type { CrawlerSettings } from '@/types/assistantCrawler'

const clean = (list: string[]): string[] => [...new Set(list.map(s => s.trim()).filter(s => s !== ''))]

/**
 * A textarea's value as a list: one entry per line, or per comma too unless
 * `lines` — a city may carry a comma ("Kraków, PL"), a keyword list may not.
 */
export function parseList(text: string, opts: { lines?: boolean } = {}): string[] {
  return clean(text.split(opts.lines ? /\n/ : /[\n,]/))
}

/**
 * What the form sends: lists trimmed and deduped, the cities of a country no
 * longer searched dropped (they would be stored and never used), caps whole
 * and non-negative. The server normalises again; this keeps a save from
 * 422ing on a stray blank line.
 */
export function normaliseCrawlerSettings(s: CrawlerSettings): CrawlerSettings {
  const cities: Record<string, string[]> = {}
  for (const code of s.countries) {
    const list = clean(s.cities_by_country[code] ?? [])
    if (list.length) cities[code] = list
  }

  const sources: CrawlerSettings['sources'] = {}
  for (const [key, src] of Object.entries(s.sources)) {
    sources[key] = { ...src, cap_day: Math.max(0, Math.trunc(src.cap_day)) }
    if (src.cap_month !== undefined) sources[key].cap_month = Math.max(0, Math.trunc(src.cap_month))
  }

  return {
    ...s,
    keywords: clean(s.keywords),
    countries: clean(s.countries),
    cities_by_country: cities,
    sources,
    rss_feeds: clean(s.rss_feeds),
    digest_to: clean(s.digest_to),
  }
}
