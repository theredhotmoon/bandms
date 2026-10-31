import { describe, expect, it } from 'vitest'
import { countryChips, kindTabs, withFilter } from './findingsFilters'
import type { FindingsFilter } from '@/types/assistantCrawler'

const base: FindingsFilter = { kind: null, country: null, status: 'new', q: '', page: 3 }

describe('countryChips', () => {
  it('orders by count, then code, and keeps the selected country even at zero', () => {
    expect(countryChips({ PL: 2, JP: 5, DE: 2 }, 'MX')).toEqual([
      { code: 'JP', count: 5 },
      { code: 'DE', count: 2 },
      { code: 'PL', count: 2 },
      { code: 'MX', count: 0 },
    ])
  })

  it('is empty when nothing was found and nothing is selected', () => {
    expect(countryChips({}, null)).toEqual([])
  })
})

describe('kindTabs', () => {
  it('puts All first with the sum, then every kind, absent ones at zero', () => {
    expect(kindTabs({ lead: 2, news: 1 })).toEqual([
      { kind: null, count: 3 },
      { kind: 'lead', count: 2 },
      { kind: 'mention', count: 0 },
      { kind: 'news', count: 1 },
    ])
  })
})

describe('withFilter', () => {
  it('goes back to page 1 when a filter changes', () => {
    expect(withFilter(base, { country: 'PL' })).toEqual({ ...base, country: 'PL', page: 1 })
  })

  it('keeps the page when only the page changes', () => {
    expect(withFilter(base, { page: 4 }).page).toBe(4)
  })

  it('clicking the selected country again clears it', () => {
    expect(withFilter({ ...base, country: 'PL' }, { country: 'PL' }).country).toBeNull()
  })
})
