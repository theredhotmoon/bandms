import { describe, expect, it } from 'vitest'
import { isoDay, postDates } from './postDates'

const post = (over: Partial<Parameters<typeof postDates>[0]> = {}) => ({
  published_at: '2026-04-01T23:55:00.000000Z',
  created_at: '2026-10-22T21:55:00.000000Z',
  content_updated_at: null,
  ...over,
})

describe('isoDay', () => {
  it('is the day the page shows, whatever the time of day', () => {
    expect(isoDay('2026-04-01T23:55:00.000000Z')).toBe('2026-04-01')
  })
})

describe('postDates', () => {
  it('gives the published day alone for an article never edited', () => {
    expect(postDates(post())).toEqual({ published: '2026-04-01' })
  })

  it('adds the day of a later edit', () => {
    expect(postDates(post({ content_updated_at: '2026-04-03T08:00:00.000000Z' })))
      .toEqual({ published: '2026-04-01', modified: '2026-04-03' })
  })

  it('leaves out an edit on the same day, or before a republish', () => {
    expect(postDates(post({ content_updated_at: '2026-04-01T22:10:00.000000Z' }))).toEqual({ published: '2026-04-01' })
    expect(postDates(post({ content_updated_at: '2026-03-01T22:10:00.000000Z' }))).toEqual({ published: '2026-04-01' })
  })

  it('falls back to the created day, and takes an API without the field', () => {
    expect(postDates(post({ published_at: null, content_updated_at: undefined }))).toEqual({ published: '2026-10-22' })
  })
})
