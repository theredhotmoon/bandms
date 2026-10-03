import { describe, expect, it } from 'vitest'
import { rebuildProgress, EXPECTED_BUILD_MS, DONE_VISIBLE_MS, ERROR_VISIBLE_MS } from './rebuildProgress'

const T0 = 1_000_000

describe('rebuildProgress', () => {
  it('is hidden when nothing is building and nothing just finished', () => {
    expect(rebuildProgress({ status: 'idle', startedAt: null, finishedAt: null }, T0)).toEqual({ visible: false, percent: 0, tone: 'building' })
  })

  it('starts at zero and reaches 90% at the expected build time', () => {
    const building = { status: 'building' as const, startedAt: T0, finishedAt: null }
    expect(rebuildProgress(building, T0).percent).toBe(0)
    expect(rebuildProgress(building, T0 + EXPECTED_BUILD_MS / 2).percent).toBeCloseTo(45, 0)
    expect(rebuildProgress(building, T0 + EXPECTED_BUILD_MS).percent).toBeCloseTo(90, 0)
  })

  it('keeps creeping past 90% on a slow build but never claims 100%', () => {
    const building = { status: 'building' as const, startedAt: T0, finishedAt: null }
    const late = rebuildProgress(building, T0 + EXPECTED_BUILD_MS * 2).percent
    const later = rebuildProgress(building, T0 + EXPECTED_BUILD_MS * 10).percent
    expect(late).toBeGreaterThan(90)
    expect(later).toBeGreaterThan(late)
    expect(later).toBeLessThan(100)
  })

  it('shows a building bar even before the start time arrives', () => {
    // A status poll can land before startedAt is known.
    const p = rebuildProgress({ status: 'building', startedAt: null, finishedAt: null }, T0)
    expect(p).toMatchObject({ visible: true, tone: 'building' })
  })

  it('fills green right after a successful build, then hides', () => {
    const done = { status: 'done' as const, startedAt: T0 - 40_000, finishedAt: T0 }
    expect(rebuildProgress(done, T0 + 1000)).toEqual({ visible: true, percent: 100, tone: 'done' })
    expect(rebuildProgress(done, T0 + DONE_VISIBLE_MS + 1).visible).toBe(false)
  })

  it('turns red after a failed build and stays longer than a success', () => {
    const failed = { status: 'error' as const, startedAt: T0 - 40_000, finishedAt: T0 }
    expect(rebuildProgress(failed, T0 + DONE_VISIBLE_MS + 1)).toEqual({ visible: true, percent: 100, tone: 'error' })
    expect(rebuildProgress(failed, T0 + ERROR_VISIBLE_MS + 1).visible).toBe(false)
  })

  it('does not show an old success when the page is opened later', () => {
    const done = { status: 'done' as const, startedAt: T0 - 40_000, finishedAt: T0 }
    expect(rebuildProgress(done, T0 + 3_600_000).visible).toBe(false)
  })
})
