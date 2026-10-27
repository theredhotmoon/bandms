import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { enterModal, isTopmostModal, leaveModal, modalDepth } from './modalStack'

describe('modalStack', () => {
  it('depth counts from the bottom and is -1 for a closed modal', () => {
    const outer = Symbol('outer')
    const inner = Symbol('inner')
    expect(modalDepth(outer)).toBe(-1)
    enterModal(outer)
    enterModal(inner)
    expect(modalDepth(outer)).toBe(0)
    expect(modalDepth(inner)).toBe(1)
    leaveModal(inner)
    leaveModal(outer)
  })

  it('is reactive, so a computed in a modal follows another modal opening', () => {
    const outer = Symbol('outer')
    const inner = Symbol('inner')
    const outerOnTop = computed(() => isTopmostModal(outer))
    enterModal(outer)
    expect(outerOnTop.value).toBe(true)
    enterModal(inner)
    expect(outerOnTop.value).toBe(false)
    leaveModal(inner)
    expect(outerOnTop.value).toBe(true)
    leaveModal(outer)
  })

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
