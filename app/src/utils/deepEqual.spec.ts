import { describe, it, expect } from 'vitest'
import { deepEqual, cloneState } from './deepEqual'

describe('deepEqual', () => {
  it('treats two structurally identical objects as equal', () => {
    expect(deepEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toBe(true)
  })

  it('treats a changed nested value as unequal', () => {
    expect(deepEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 3] })).toBe(false)
  })

  it('treats a different key count as unequal', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('treats null and an object as unequal', () => {
    expect(deepEqual(null, {})).toBe(false)
  })

  it('treats two nulls as equal', () => {
    expect(deepEqual(null, null)).toBe(true)
  })

  it('treats an undefined-valued key equivalent to an absent key', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true)
  })
})

describe('cloneState', () => {
  it('produces a deep copy that mutation does not affect', () => {
    const original = { a: [1, 2] }
    const clone = cloneState(original)
    original.a.push(3)
    expect(clone.a).toEqual([1, 2])
  })
})
