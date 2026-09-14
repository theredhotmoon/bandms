import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import { useDirtyGuard } from './useDirtyGuard'

describe('useDirtyGuard', () => {
  it('starts clean', () => {
    const state = reactive({ name: 'a' })
    const { isDirty } = useDirtyGuard(() => state)
    expect(isDirty.value).toBe(false)
  })

  it('becomes dirty when the tracked state changes', () => {
    const state = reactive({ name: 'a' })
    const { isDirty } = useDirtyGuard(() => state)
    state.name = 'b'
    expect(isDirty.value).toBe(true)
  })

  it('becomes clean again after markClean()', () => {
    const state = reactive({ name: 'a' })
    const { isDirty, markClean } = useDirtyGuard(() => state)
    state.name = 'b'
    markClean()
    expect(isDirty.value).toBe(false)
  })

  it('is dirty again after a further change past markClean()', () => {
    const state = reactive({ name: 'a' })
    const { isDirty, markClean } = useDirtyGuard(() => state)
    state.name = 'b'
    markClean()
    state.name = 'c'
    expect(isDirty.value).toBe(true)
  })

  it('stays clean when undefined-valued keys are present (JSON.stringify cloneState regression)', () => {
    const state = reactive({ name: 'a', venueId: undefined })
    const { isDirty, markClean } = useDirtyGuard(() => state)
    // Should start clean despite undefined key
    expect(isDirty.value).toBe(false)
    // Should stay clean after markClean with no real change
    markClean()
    expect(isDirty.value).toBe(false)
    // Should only become dirty on an actual value change
    state.name = 'b'
    expect(isDirty.value).toBe(true)
  })
})
