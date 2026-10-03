import { describe, expect, it } from 'vitest'
import { bookingFromQuery, bookingQuery } from './bookingQuery'

describe('bookingQuery', () => {
  it('round-trips an available date', () => {
    const q = bookingQuery({ date: '2026-11-07', unavailable: false })
    expect(q).toBe('?booking=2026-11-07')
    expect(bookingFromQuery(q)).toEqual({ date: '2026-11-07', unavailable: false })
  })

  it('round-trips a date the visitor confirmed was taken', () => {
    const q = bookingQuery({ date: '2026-11-07', unavailable: true })
    expect(bookingFromQuery(q)).toEqual({ date: '2026-11-07', unavailable: true })
  })

  it('ignores a missing or malformed date', () => {
    expect(bookingFromQuery('')).toBeNull()
    expect(bookingFromQuery('?booking=tomorrow')).toBeNull()
    expect(bookingFromQuery('?booking=2026-13-45')).toBeNull()
    // Date.parse would roll these over into the next month.
    expect(bookingFromQuery('?booking=2026-02-31')).toBeNull()
    expect(bookingFromQuery('?booking=2026-04-31')).toBeNull()
    expect(bookingFromQuery('?booking=2028-02-29')).toEqual({ date: '2028-02-29', unavailable: false })
    expect(bookingFromQuery('?booking=<script>')).toBeNull()
  })

  it('ignores unrelated parameters', () => {
    expect(bookingFromQuery('?utm_source=x&booking=2026-01-02')).toEqual({ date: '2026-01-02', unavailable: false })
  })
})
