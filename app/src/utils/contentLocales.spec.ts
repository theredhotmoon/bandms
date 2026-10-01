import { describe, expect, it } from 'vitest'
import { LOCALES } from '@/locales'
import { moveLocale, normaliseContentOrder } from './contentLocales'

describe('normaliseContentOrder', () => {
  it('keeps a valid stored order as it is', () => {
    expect(normaliseContentOrder(['pl', 'en'])).toEqual(['pl', 'en'])
  })

  it('falls back to registry order for anything that is not a list', () => {
    expect(normaliseContentOrder(undefined)).toEqual(LOCALES)
    expect(normaliseContentOrder('pl')).toEqual(LOCALES)
  })

  it('drops unregistered and duplicate codes', () => {
    expect(normaliseContentOrder(['de', 'pl', 'pl', 'en'])).toEqual(['pl', 'en'])
  })

  // An order saved before a language existed must still give that language an
  // input in every form, rather than leaving it out of them all.
  it('appends a registered locale the stored order does not mention', () => {
    expect(normaliseContentOrder(['pl'])).toEqual(['pl', 'en'])
  })
})

describe('moveLocale', () => {
  it('moves a locale towards the front', () => {
    expect(moveLocale(['en', 'pl'], 'pl', -1)).toEqual(['pl', 'en'])
  })

  it('leaves the order alone at either edge', () => {
    expect(moveLocale(['en', 'pl'], 'en', -1)).toEqual(['en', 'pl'])
    expect(moveLocale(['en', 'pl'], 'pl', 1)).toEqual(['en', 'pl'])
  })

  it('does not mutate its input', () => {
    const order = ['en', 'pl'] as const
    moveLocale(order, 'pl', -1)
    expect(order).toEqual(['en', 'pl'])
  })
})
