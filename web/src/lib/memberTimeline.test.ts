import { describe, expect, it } from 'vitest'
import type { BandMember, MemberInstrument } from '@/types/bandMember'
import { buildMemberTimeline, CHART_COLOURS, fractionalYear, tickStep } from './memberTimeline'

const NOW = new Date('2026-07-02T12:00:00Z')

let nextId = 1
const inst = (name: string): MemberInstrument => ({ id: name.length * 100 + name.charCodeAt(0), name, category: null })

function member(over: Partial<BandMember>): BandMember {
  const id = nextId++
  return {
    id, first_name: `First${id}`, last_name: 'Last', nickname: null, slug: `m${id}`,
    bio: null, photo: null, role: null, is_current: true, joined_at: null, quit_at: null,
    sort_order: id, main_instrument: null, instruments: [], social_links: [],
    created_at: '', updated_at: '', ...over,
  }
}

describe('fractionalYear', () => {
  it('places a date within its year', () => {
    expect(fractionalYear('2020-01-01')).toBe(2020)
    expect(fractionalYear('2021-07-02')).toBeCloseTo(2021.5, 2)
  })

  it('rejects missing or malformed dates', () => {
    expect(fractionalYear(null)).toBeNull()
    expect(fractionalYear('soon')).toBeNull()
  })
})

describe('tickStep', () => {
  it('thins the gridlines as the history grows', () => {
    expect(tickStep(8)).toBe(1)
    expect(tickStep(20)).toBe(2)
    expect(tickStep(40)).toBe(5)
  })
})

describe('buildMemberTimeline', () => {
  it('draws nothing without members or an anchor year', () => {
    expect(buildMemberTimeline([], [], 2010, NOW)).toBeNull()
    expect(buildMemberTimeline([member({})], [], null, NOW)).toBeNull()
  })

  it('runs the axis from the earliest year to the end of this one', () => {
    const t = buildMemberTimeline([member({ joined_at: '2016-03-01' })], [], 2015, NOW)!
    expect(t.ticks[0]).toEqual({ year: 2015, left: 0 })
    expect(t.ticks.at(-1)).toEqual({ year: 2027, left: 100 })
  })

  it('sorts rows by join date and sizes a former member\'s bar by tenure', () => {
    const late   = member({ first_name: 'Late', joined_at: '2020-01-01' })
    const former = member({ first_name: 'Gone', joined_at: '2015-01-01', quit_at: '2017-01-01', is_current: false })
    const t = buildMemberTimeline([late, former], [], null, NOW)!

    expect(t.rows.map(r => r.name)).toEqual(['Gone Last', 'Late Last'])
    // 2015..2027 is 12 years; two of them is a sixth of the axis.
    expect(t.rows[0].left).toBe(0)
    expect(t.rows[0].width).toBeCloseTo(100 / 6, 5)
    expect(t.rows[0].toYear).toBe(2017)
    expect(t.rows[1].toYear).toBeNull()
  })

  it('colours by main instrument and stripes the others, one legend entry each', () => {
    const vox = inst('Vocals'), gtr = inst('Guitar'), sax = inst('Saxophone')
    const a = member({ joined_at: '2015-01-01', main_instrument: vox, instruments: [vox, gtr] })
    const b = member({ joined_at: '2016-01-01', main_instrument: null, instruments: [sax, vox] })
    const t = buildMemberTimeline([a, b], [], null, NOW)!

    expect(t.legend).toEqual([
      { name: 'Vocals', colour: 1 },
      { name: 'Guitar', colour: 2 },
      { name: 'Saxophone', colour: 3 },
    ])
    expect(t.rows[0]).toMatchObject({ colour: 1, stripes: [2] })
    // No main instrument: the first one listed leads.
    expect(t.rows[1]).toMatchObject({ colour: 3, stripes: [1], instruments: ['Saxophone', 'Vocals'] })
  })

  it('cycles colours past the palette', () => {
    const members = Array.from({ length: CHART_COLOURS + 1 }, (_, i) =>
      member({ joined_at: '2015-01-01', main_instrument: inst(`I${i}`), instruments: [] }))
    const t = buildMemberTimeline(members, [], null, NOW)!
    expect(t.legend.at(-1)!.colour).toBe(1)
  })

  it('a member without an instrument has no colour', () => {
    const t = buildMemberTimeline([member({ joined_at: '2015-01-01' })], [], null, NOW)!
    expect(t.rows[0].colour).toBeNull()
  })

  it('a member without a join date starts at the formation year', () => {
    const t = buildMemberTimeline([member({}), member({ joined_at: '2018-01-01' })], [], 2014, NOW)!
    expect(t.rows[0].left).toBe(0)
    expect(t.rows[0].fromYear).toBe(2014)
  })

  it('does not draw a former member with no leave date as still in the band', () => {
    const t = buildMemberTimeline([
      member({ joined_at: '2015-01-01', is_current: false, quit_at: null }),
    ], [], null, NOW)!
    expect(t.rows[0]).toMatchObject({ endUnknown: true, toYear: null })
    // A one-year stub, not a bar to today (2015..2027 → 1/12 of the axis).
    expect(t.rows[0].width).toBeCloseTo(100 / 12, 5)
  })

  it('pulls the axis back to a record released before any known join', () => {
    const t = buildMemberTimeline([member({ joined_at: '2018-01-01' })], [
      { title: 'Early', type: 'LP', release_date: '2012-05-01', is_upcoming: false },
    ], null, NOW)!
    expect(t.ticks[0].year).toBeLessThanOrEqual(2012)
    expect(t.releases.map(r => r.title)).toEqual(['Early'])
  })

  it('marks albums and EPs, skips singles and anything upcoming', () => {
    const t = buildMemberTimeline([member({ joined_at: '2015-01-01' })], [
      { title: 'Debut', type: 'LP', release_date: '2018-01-01', is_upcoming: false },
      { title: 'Short', type: 'EP', release_date: '2016-01-01', is_upcoming: false },
      { title: 'Hit', type: 'single', release_date: '2017-01-01', is_upcoming: false },
      { title: 'Next', type: 'LP', release_date: '2026-12-01', is_upcoming: true },
      { title: 'Undated', type: 'LP', release_date: null, is_upcoming: false },
    ], null, NOW)!

    expect(t.releases.map(r => [r.title, r.kind, r.year])).toEqual([
      ['Short', 'ep', 2016],
      ['Debut', 'album', 2018],
    ])
  })
})
