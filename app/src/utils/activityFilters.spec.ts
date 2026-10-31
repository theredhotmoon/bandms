import { describe, expect, it } from 'vitest'
import { activityQueryParams, formatDiffValue, humanizeType, parseActivityFilters } from './activityFilters'

describe('parseActivityFilters', () => {
  it('reads a record history link', () => {
    const f = parseActivityFilters({ subject_type: 'Post', subject_id: '12' })
    expect(f.subject_type).toBe('Post')
    expect(f.subject_id).toBe(12)
    expect(f.page).toBe(1)
  })

  it('drops malformed values instead of sending them', () => {
    const f = parseActivityFilters({
      subject_type: 'Post;drop', subject_id: '12', user_id: '-3',
      action: 'hacked', from: '2026/01/01', page: 'abc',
    })
    expect(f).toEqual({
      subject_type: null, subject_id: null, user_id: null, action: null,
      from: null, to: null, q: null, page: 1,
    })
  })

  it('ignores an id without a type', () => {
    expect(parseActivityFilters({ subject_id: '5' }).subject_id).toBeNull()
  })

  it('round-trips through the query params, leaving page 1 implicit', () => {
    const f = parseActivityFilters({ action: 'deleted', q: ' gig ', page: '1' })
    expect(activityQueryParams(f)).toEqual({ action: 'deleted', q: 'gig' })
    expect(activityQueryParams({ ...f, page: 3 })).toMatchObject({ page: '3' })
  })
})

describe('formatDiffValue', () => {
  it('prints null as the given placeholder', () => {
    expect(formatDiffValue(null, '—')).toBe('—')
  })

  it('reads a translation bag per locale', () => {
    expect(formatDiffValue({ en: 'Hello', pl: 'Cześć' }, '—')).toBe('en: Hello · pl: Cześć')
    expect(formatDiffValue({ en: null, pl: null }, '—')).toBe('—')
  })

  it('reads a list one item per line', () => {
    expect(formatDiffValue([{ type: 'text' }, 2], '—')).toBe('{"type":"text"}\n2')
    expect(formatDiffValue([], '—')).toBe('—')
  })

  it('falls back to JSON for other structures', () => {
    expect(formatDiffValue({ a: 1 }, '—')).toBe('{"a":1}')
  })
})

describe('humanizeType', () => {
  it('splits a class basename into words', () => {
    expect(humanizeType('BandMember')).toBe('Band member')
    expect(humanizeType('Post')).toBe('Post')
  })
})
