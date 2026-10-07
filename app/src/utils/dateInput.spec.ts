import { describe, expect, it } from 'vitest'
import { localDateTimeInputValue } from './dateInput'

describe('localDateTimeInputValue', () => {
  it('formats in local time with zero-padded fields and no seconds', () => {
    // Constructed with local components, so the expectation holds in any zone.
    const d = new Date(2026, 0, 5, 9, 7, 59)
    expect(localDateTimeInputValue(d)).toBe('2026-01-05T09:07')
  })

  it('matches the shape a datetime-local input accepts', () => {
    expect(localDateTimeInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})
