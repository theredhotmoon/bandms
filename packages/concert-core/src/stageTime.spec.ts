import { describe, expect, it } from 'vitest'
import { ourStageTime, resolveStageTime } from './stageTime'

describe('resolveStageTime', () => {
  it("is our own slot when set, whatever the show's start", () => {
    expect(resolveStageTime({ start_time: '19:00:00', own_play_time: '23:00:00' })).toEqual({ time: '23:00:00', fallback: false })
  })

  it('borrows the start time when our slot is unset, and says so', () => {
    expect(resolveStageTime({ start_time: '21:00', own_play_time: null })).toEqual({ time: '21:00', fallback: true })
    // A concert served without the key at all (an older API mid-deploy).
    expect(resolveStageTime({ start_time: '21:00' })).toEqual({ time: '21:00', fallback: true })
  })

  it('is nothing when the concert has neither time — an empty string included', () => {
    expect(resolveStageTime({ start_time: null, own_play_time: null })).toEqual({ time: null, fallback: false })
    expect(resolveStageTime({ start_time: '', own_play_time: '' })).toEqual({ time: null, fallback: false })
  })
})

describe('ourStageTime', () => {
  it('is the resolved time alone', () => {
    expect(ourStageTime({ start_time: '20:00', own_play_time: '22:15' })).toBe('22:15')
    expect(ourStageTime({ start_time: '20:00', own_play_time: null })).toBe('20:00')
    expect(ourStageTime({ start_time: null })).toBeNull()
  })
})
