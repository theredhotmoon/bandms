import { describe, expect, it } from 'vitest'
import { isPlainLeftClick } from './plainClick'

describe('isPlainLeftClick', () => {
  const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }

  it('takes a plain left click', () => {
    expect(isPlainLeftClick(plain)).toBe(true)
  })

  it('leaves every other click to the browser', () => {
    for (const other of [{ button: 1 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
      expect(isPlainLeftClick({ ...plain, ...other })).toBe(false)
    }
  })
})
