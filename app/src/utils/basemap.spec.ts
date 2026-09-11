import { describe, expect, it } from 'vitest'
import { basemapTileUrl } from './basemap'

/**
 * The interesting case is the *unkeyed* one, because it doesn't fail loudly.
 * CARTO answers an unkeyed tile request with `200 OK` and a real PNG that
 * happens to be watermarked, so a bug here can't be caught by a status check,
 * by Leaflet, or by the build — it has to be pinned in a test.
 */
describe('basemapTileUrl', () => {
  it('appends the key as a `key` query parameter', () => {
    expect(basemapTileUrl('abc123')).toBe(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=abc123',
    )
  })

  it('returns a bare URL when no key is configured', () => {
    expect(basemapTileUrl()).not.toContain('?')
    expect(basemapTileUrl()).toMatch(/\.png$/)
  })

  it('treats an empty key the same as an absent one', () => {
    expect(basemapTileUrl('')).toBe(basemapTileUrl())
  })

  it("preserves Leaflet's template placeholders", () => {
    const url = basemapTileUrl('abc123')
    for (const token of ['{s}', '{z}', '{x}', '{y}', '{r}']) {
      expect(url).toContain(token)
    }
  })

  it('encodes a key containing URL-significant characters', () => {
    expect(basemapTileUrl('a b&c')).toContain('?key=a%20b%26c')
  })
})
