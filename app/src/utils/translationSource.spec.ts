import { describe, expect, it } from 'vitest'
import type { Lang, TranslationBag } from '@/locales'
import { isFilled, sourceFor } from './translationSource'

// Registry-independent fake locales: the rule is about ORDER, not about which
// languages exist, so the spec must not pass by accident on the real pair.
const [a, b, c] = ['aa', 'bb', 'cc'] as unknown as Lang[]
const bag = (v: Partial<Record<string, string>>): TranslationBag => v as TranslationBag

describe('isFilled', () => {
  it('treats whitespace as empty', () => {
    expect(isFilled('   ')).toBe(false)
    expect(isFilled('')).toBe(false)
    expect(isFilled(null)).toBe(false)
    expect(isFilled(undefined)).toBe(false)
  })

  it('treats empty rich-text html as empty', () => {
    expect(isFilled('<p></p>')).toBe(false)
    expect(isFilled('<p><br></p>')).toBe(false)
    expect(isFilled('<p>Hi</p>')).toBe(true)
  })
})

describe('sourceFor', () => {
  it('picks the first filled locale in content order, skipping the target', () => {
    expect(sourceFor(bag({ [a]: '', [b]: 'x', [c]: 'y' }), a, [c, b, a])).toBe(c)
    expect(sourceFor(bag({ [a]: '', [b]: 'x', [c]: 'y' }), a, [b, c, a])).toBe(b)
  })

  it('offers a source for the primary row too when another locale is filled', () => {
    // EN-only legacy records on a Polish-first band: PL (primary) is empty.
    expect(sourceFor(bag({ [a]: '', [b]: 'english' }), a, [a, b])).toBe(b)
  })

  it('returns null when nothing else is filled', () => {
    expect(sourceFor(bag({ [a]: '   ', [b]: '<p></p>' }), c, [a, b, c])).toBeNull()
  })

  it('never returns the target itself', () => {
    expect(sourceFor(bag({ [a]: 'x' }), a, [a])).toBeNull()
  })
})
