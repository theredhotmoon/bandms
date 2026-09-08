import { describe, it, expect } from 'vitest'
import { defaultPayload, move, providerLabel } from './postBlocks'

describe('move', () => {
  it('moves an item down', () => {
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('moves an item up', () => {
    expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('returns an equal list when from === to', () => {
    expect(move(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c']
    move(input, 0, 2)
    expect(input).toEqual(['a', 'b', 'c'])
  })

  // A drag that lands outside the list must be a no-op, not a hole in the array.
  it('ignores an out-of-range index', () => {
    expect(move(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
    expect(move(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(move(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
  })
})

describe('defaultPayload', () => {
  it('gives a text block an empty translation bag', () => {
    expect(defaultPayload('text')).toEqual({ body: { en: '', pl: '' } })
  })

  it('gives an image block empty alt and caption bags', () => {
    expect(defaultPayload('image')).toEqual({
      path: '', alt: { en: '', pl: '' }, caption: { en: '', pl: '' },
    })
  })

  it('gives an embed block a url and a null label', () => {
    expect(defaultPayload('embed')).toEqual({ url: '', label: null })
  })

  it('defaults a ref block to a concert with no id', () => {
    expect(defaultPayload('ref')).toEqual({ entity: 'concert', id: 0 })
  })
})

describe('providerLabel', () => {
  it('labels each provider for the badge', () => {
    expect(providerLabel('youtube')).toBe('YouTube')
    expect(providerLabel('vimeo')).toBe('Vimeo')
    expect(providerLabel('instagram')).toBe('Instagram')
    expect(providerLabel('tiktok')).toBe('TikTok')
    expect(providerLabel('link')).toBe('Link')
  })
})
