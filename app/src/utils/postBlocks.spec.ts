import { describe, it, expect } from 'vitest'
import { defaultPayload, move, providerLabel, detectProvider } from './postBlocks'

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

describe('detectProvider', () => {
  it('detects youtube from both hosts', () => {
    expect(detectProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube')
  })

  it('detects vimeo, instagram and tiktok', () => {
    expect(detectProvider('https://vimeo.com/76979871')).toBe('vimeo')
    expect(detectProvider('https://www.instagram.com/p/CxYzAbC1234/')).toBe('instagram')
    expect(detectProvider('https://www.tiktok.com/@band/video/7234567890123456789')).toBe('tiktok')
  })

  it('falls back to link for any other host', () => {
    expect(detectProvider('https://www.facebook.com/band/posts/123')).toBe('link')
    expect(detectProvider('https://example.com/news')).toBe('link')
  })

  it('falls back to link rather than throwing on an unparseable url', () => {
    expect(detectProvider('not a url at all')).toBe('link')
    expect(detectProvider('')).toBe('link')
  })

  // A whole-string substring match would badge this YouTube — 'youtube.com'
  // appears in the URL, just not as the host — while the server's host-based
  // EmbedProvider::detect() correctly resolves it to 'link'. Matching that
  // is the entire point of this helper: the two must agree.
  it('matches by host, not by substring anywhere in the url', () => {
    expect(detectProvider('https://example.com/share?ref=https://youtube.com/x')).toBe('link')
  })
})
