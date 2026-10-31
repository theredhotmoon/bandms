import { describe, expect, it } from 'vitest'
import { normaliseCrawlerSettings, parseList } from './crawlerSettings'
import type { CrawlerSettings } from '@/types/assistantCrawler'

const base: CrawlerSettings = {
  keywords: ['Skanking Storks'],
  countries: ['PL'],
  cities_by_country: {},
  sources: { youtube: { enabled: true, cap_day: 20 } },
  rss_feeds: [],
  sibling_bands: [],
  digest_to: [],
}

describe('parseList', () => {
  it('splits on new lines and commas, trims, drops blanks and duplicates', () => {
    expect(parseList(' a, b\n\nc ,a\n')).toEqual(['a', 'b', 'c'])
  })

  it('keeps commas when told to split on lines only', () => {
    expect(parseList('Kraków, PL\nWarsaw', { lines: true })).toEqual(['Kraków, PL', 'Warsaw'])
  })
})

describe('normaliseCrawlerSettings', () => {
  it('trims and dedupes the lists', () => {
    const out = normaliseCrawlerSettings({ ...base, keywords: [' Storks ', 'Storks', ''], digest_to: [' a@b.pl '] })
    expect(out.keywords).toEqual(['Storks'])
    expect(out.digest_to).toEqual(['a@b.pl'])
  })

  it('drops the cities of a country no longer searched, and empty city lists', () => {
    const out = normaliseCrawlerSettings({
      ...base,
      countries: ['PL'],
      cities_by_country: { PL: ['Kraków', ' '], DE: ['Berlin'], JP: [] },
    })
    expect(out.cities_by_country).toEqual({ PL: ['Kraków'] })
  })

  it('holds caps to whole non-negative numbers', () => {
    const out = normaliseCrawlerSettings({ ...base, sources: { youtube: { enabled: false, cap_day: -3.7 } } })
    expect(out.sources.youtube).toEqual({ enabled: false, cap_day: 0 })
  })
})
