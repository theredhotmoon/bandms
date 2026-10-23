import { describe, expect, it } from 'vitest'
import { enterModal, isTopmostModal, leaveModal } from './modalStack'

describe('modalStack', () => {
  it('the last modal to open is the only topmost one', () => {
    const outer = Symbol('outer')
    const inner = Symbol('inner')
    enterModal(outer)
    expect(isTopmostModal(outer)).toBe(true)

    enterModal(inner)
    expect(isTopmostModal(inner)).toBe(true)
    expect(isTopmostModal(outer)).toBe(false)

    leaveModal(inner)
    expect(isTopmostModal(outer)).toBe(true)
    leaveModal(outer)
    expect(isTopmostModal(outer)).toBe(false)
  })

  it('an outer modal closing under an open inner one leaves the inner on top', () => {
    const outer = Symbol('outer')
    const inner = Symbol('inner')
    enterModal(outer)
    enterModal(inner)
    leaveModal(outer)
    expect(isTopmostModal(inner)).toBe(true)
    leaveModal(inner)
  })

  it('re-entering moves a modal to the top rather than listing it twice', () => {
    const a = Symbol('a')
    const b = Symbol('b')
    enterModal(a)
    enterModal(b)
    enterModal(a)
    expect(isTopmostModal(a)).toBe(true)
    leaveModal(a)
    expect(isTopmostModal(b)).toBe(true)
    leaveModal(b)
  })

  it('leaving a modal that never entered is a no-op', () => {
    const a = Symbol('a')
    enterModal(a)
    leaveModal(Symbol('stranger'))
    expect(isTopmostModal(a)).toBe(true)
    leaveModal(a)
  })
})
