import { describe, it, expect } from 'vitest'
import { pickMoreShows } from './moreShows'

// "Now" is fixed at 2026-06-15; everything on or after it is upcoming.
const isUpcoming = (date: string) => date >= '2026-06-15'

const gig = (id: number, date: string) => ({ id, date })
const ids = (r: { shows: { id: number }[] }) => r.shows.map(s => s.id)

describe('pickMoreShows', () => {
  const past = [gig(1, '2026-01-10'), gig(2, '2026-02-10'), gig(3, '2026-03-10'), gig(4, '2026-04-10')]

  it('lists upcoming gigs, soonest first, when any are left', () => {
    const all = [...past, gig(5, '2026-07-01'), gig(6, '2026-08-01')]
    const r = pickMoreShows(all, 2, isUpcoming)
    expect(r.kind).toBe('upcoming')
    expect(ids(r)).toEqual([5, 6])
  })

  it('caps the upcoming list at three', () => {
    const all = [...past, gig(5, '2026-07-01'), gig(6, '2026-08-01'), gig(7, '2026-09-01'), gig(8, '2026-10-01')]
    expect(ids(pickMoreShows(all, 1, isUpcoming))).toEqual([5, 6, 7])
  })

  it('leaves the current gig out of its own list', () => {
    const all = [...past, gig(5, '2026-07-01'), gig(6, '2026-08-01')]
    const r = pickMoreShows(all, 5, isUpcoming)
    expect(r.kind).toBe('upcoming')
    expect(ids(r)).toEqual([6])
  })

  it('falls back to the three most recently played gigs when nothing is upcoming', () => {
    const r = pickMoreShows(past, 4, isUpcoming)
    expect(r.kind).toBe('past')
    expect(ids(r)).toEqual([3, 2, 1])
  })

  it('falls back to past gigs on the only upcoming gig\'s page', () => {
    const r = pickMoreShows([...past, gig(5, '2026-07-01')], 5, isUpcoming)
    expect(r.kind).toBe('past')
    expect(ids(r)).toEqual([4, 3, 2])
  })

  it('returns nothing when the current gig is the only one', () => {
    expect(pickMoreShows([gig(1, '2026-01-10')], 1, isUpcoming).shows).toEqual([])
  })
})
