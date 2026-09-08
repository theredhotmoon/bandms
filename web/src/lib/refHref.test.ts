import { describe, it, expect } from 'vitest'
import { refHref } from './refHref'
import type { SlugMap } from './slugs'

const slugMap = {
  en: { concerts: 'concerts', releases: 'releases', merch: 'shop', photos: 'gallery' },
  pl: { concerts: 'koncerty', releases: 'wydawnictwa', merch: 'sklep', photos: 'galeria' },
} as unknown as SlugMap

const allOn: Record<string, boolean> = {}

describe('refHref', () => {
  it('builds a concert href from the locale section slug', () => {
    expect(refHref('concert', { slug_en: 'gig-1' }, 'pl', slugMap, allOn))
      .toEqual({ href: '/pl/koncerty/gig-1', external: false })
  })

  it('builds a release href from the id', () => {
    expect(refHref('release', { id: 7 }, 'en', slugMap, allOn))
      .toEqual({ href: '/en/releases/7', external: false })
  })

  // The shop's section key is `merch`; /{lang}/shop/... is never built.
  it('builds a shop item href under the merch section', () => {
    expect(refHref('shop_item', { slug_en: 'tee' }, 'en', slugMap, allOn))
      .toEqual({ href: '/en/shop/tee', external: false })
  })

  // Only concerts, releases, posts and merch have detail routes. An album has
  // no page of its own, so it links to the photos listing.
  it('links an album to the photos listing, not a per-album page', () => {
    expect(refHref('album', { id: 3 }, 'en', slugMap, allOn))
      .toEqual({ href: '/en/gallery', external: false })
  })

  it('returns external hrefs for music videos and press releases', () => {
    expect(refHref('music_video', { video_url: 'https://youtu.be/x' }, 'en', slugMap, allOn))
      .toEqual({ href: 'https://youtu.be/x', external: true })
    expect(refHref('press_release', { url: 'https://pitchfork.com/x' }, 'en', slugMap, allOn))
      .toEqual({ href: 'https://pitchfork.com/x', external: true })
  })

  // A disabled module unbuilds its routes, so the link would 404.
  it('returns null when the target module is switched off', () => {
    expect(refHref('concert', { slug_en: 'gig-1' }, 'en', slugMap, { concerts: false })).toBeNull()
  })

  // getSiteConfig fails open to {} when the API is unreachable mid-build, so an
  // absent key must mean enabled — otherwise one blip strips every reference.
  it('treats an absent module key as enabled', () => {
    expect(refHref('concert', { slug_en: 'gig-1' }, 'en', slugMap, {})).not.toBeNull()
  })

  it('is unaffected by module state for external targets', () => {
    expect(refHref('press_release', { url: 'https://x.example' }, 'en', slugMap, { press: false }))
      .toEqual({ href: 'https://x.example', external: true })
  })

  it('returns null when the identifying field is missing', () => {
    expect(refHref('concert', {}, 'en', slugMap, allOn)).toBeNull()
    expect(refHref('press_release', {}, 'en', slugMap, allOn)).toBeNull()
  })
})
