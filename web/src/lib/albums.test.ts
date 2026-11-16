import { describe, it, expect } from 'vitest'
import { albumHref, isAlbumOnSite, linkedHref } from './albums'
import type { SlugMap } from './slugs'
import type { AlbumLink } from '@/types/album'

// Different slugs per locale, so a URL built from the wrong locale's map
// cannot look right by accident.
const slugMap = {
  en: { photos: 'gallery', posts: 'news', concerts: 'concerts', releases: 'music', merch: 'shop' },
  pl: { photos: 'galeria', posts: 'aktualnosci', concerts: 'koncerty', releases: 'muzyka', merch: 'sklep' },
} as unknown as SlugMap

const photo = (image_url: string | null) => ({ id: 1, image_url, sort_order: 0, caption: null })

describe('isAlbumOnSite', () => {
  it('is true only for a published album with a photo that has a file', () => {
    expect(isAlbumOnSite({ published_at: '2026-01-01', photos: [photo('/storage/a.jpg')] })).toBe(true)
    expect(isAlbumOnSite({ published_at: null, photos: [photo('/storage/a.jpg')] })).toBe(false)
    expect(isAlbumOnSite({ published_at: '2026-01-01', photos: [] })).toBe(false)
    expect(isAlbumOnSite({ published_at: '2026-01-01', photos: [photo(null)] })).toBe(false)
  })
})

describe('albumHref', () => {
  it('builds the album page under the locale gallery slug', () => {
    expect(albumHref({ slug: 'live-in-krakow' }, 'pl', slugMap, {})).toBe('/pl/galeria/live-in-krakow')
  })

  it('is null when the gallery module is off — every album page is unbuilt with it', () => {
    expect(albumHref({ slug: 'x' }, 'en', slugMap, { photos: false })).toBeNull()
  })

  it('is null without a slug', () => {
    expect(albumHref({ slug: null }, 'en', slugMap, {})).toBeNull()
  })
})

describe('linkedHref', () => {
  const post: AlbumLink = {
    type: 'post', id: 4, title: 'Diary', slug: 'diary', translations: { slug: { en: 'diary', pl: 'dziennik' } },
  }

  it('routes a post per language', () => {
    expect(linkedHref(post, 'pl', slugMap, {})).toBe('/pl/aktualnosci/dziennik')
    expect(linkedHref(post, 'en', slugMap, {})).toBe('/en/news/diary')
  })

  it('routes a release by id, and concerts and merch by slug', () => {
    expect(linkedHref({ type: 'release', id: 9, title: 'LP', slug: null }, 'en', slugMap, {})).toBe('/en/music/9')
    expect(linkedHref({ type: 'concert', id: 2, title: null, slug: 'gig', date: null, venue: null }, 'pl', slugMap, {}))
      .toBe('/pl/koncerty/gig')
    expect(linkedHref({ type: 'shop_item', id: 3, title: 'Tee', slug: 'tee' }, 'en', slugMap, {})).toBe('/en/shop/tee')
  })

  it('is null when the linking record\'s module is off', () => {
    expect(linkedHref(post, 'en', slugMap, { posts: false })).toBeNull()
    expect(linkedHref({ type: 'shop_item', id: 3, title: 'Tee', slug: 'tee' }, 'en', slugMap, { merch: false })).toBeNull()
  })
})
