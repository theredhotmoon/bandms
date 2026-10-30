import { describe, expect, it } from 'vitest'
import { canRestore, snapshot } from './enhanceUndo'

describe('enhance undo', () => {
  it('can restore while the row still shows the rewrite', () => {
    const state = snapshot('before', 'after')
    expect(canRestore(state, 'after')).toBe(true)
  })

  it('cannot restore once the band edited the row, or with no snapshot', () => {
    const state = snapshot('before', 'after')
    expect(canRestore(state, 'after, edited')).toBe(false)
    expect(canRestore(null, 'after')).toBe(false)
  })

  it('a second rewrite restores to the text before the LATEST rewrite, not the original', () => {
    const first = snapshot('original', 'first rewrite')
    const second = snapshot(first.after, 'second rewrite')
    expect(second.before).toBe('first rewrite')
    expect(canRestore(second, 'second rewrite')).toBe(true)
  })
})
