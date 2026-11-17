import { describe, it, expect } from 'vitest'
import { toGalleryVideos } from './videoGallery'
import type { RenderableClip } from '@/types/clip'

const copy = {
  clipCategoryMusicVideo: 'Music video', clipCategoryLive: 'Live', clipCategoryStudio: 'Studio',
  clipCategoryBackstage: 'Backstage', clipCategoryInterview: 'Interview', clipCategoryOther: 'Other',
  clipFan: 'Fan video', clipFilmedBy: 'Filmed by {name}', views: 'views',
}

function clip(over: Partial<RenderableClip>): RenderableClip {
  return {
    id: 1, provider: 'youtube', url: 'https://www.youtube.com/watch?v=qyRvEO_o6z0', embed_id: 'qyRvEO_o6z0',
    title: 'Live at Klub Studio', category: 'live', recorded_on: '2026-03-14', ...over,
  }
}

describe('toGalleryVideos', () => {
  it('labels and credits a fan video', () => {
    const [v] = toGalleryVideos([clip({ source: 'fan', channel_name: 'Gig Goer', channel_url: 'https://www.youtube.com/@giggoer' })], copy)
    expect(v.fanLabel).toBe('Fan video')
    expect(v.credit).toEqual({ text: 'Filmed by Gig Goer', href: 'https://www.youtube.com/@giggoer' })
    expect(v.kind).toBe('Live')
  })

  it('shows the band’s own video with no fan label or credit', () => {
    const [v] = toGalleryVideos([clip({ source: 'official', category: 'music_video', channel_name: 'Skanking Storks' })], copy)
    expect(v.fanLabel).toBeNull()
    expect(v.credit).toBeNull()
    expect(v.kind).toBe('Music video')
  })

  it('opens YouTube in the privacy-enhanced player and falls back to its thumbnail', () => {
    const [v] = toGalleryVideos([clip({})], copy)
    expect(v.embedUrl).toBe('https://www.youtube-nocookie.com/embed/qyRvEO_o6z0?rel=0')
    expect(v.thumb).toBe('https://img.youtube.com/vi/qyRvEO_o6z0/hqdefault.jpg')
  })

  it('opens other providers in their own player', () => {
    const [v] = toGalleryVideos([clip({ provider: 'vimeo', url: 'https://vimeo.com/76979871', embed_id: '76979871' })], copy)
    expect(v.embedUrl).toBe('https://player.vimeo.com/video/76979871')
    expect(v.thumb).toBeNull()
  })

  it('links out when the URL names no single video', () => {
    const [v] = toGalleryVideos([clip({ provider: 'vimeo', url: 'https://vimeo.com/channels/x', embed_id: null })], copy)
    expect(v.embedUrl).toBeNull()
    expect(v.watchUrl).toBe('https://vimeo.com/channels/x')
  })

  it('leaves audio players and plain links out of a video gallery', () => {
    expect(toGalleryVideos([clip({ provider: 'spotify', embed_id: 'track/x' })], copy)).toEqual([])
    expect(toGalleryVideos([clip({ provider: 'link', url: 'https://band.bandcamp.com/album/x', embed_id: null })], copy)).toEqual([])
  })

  it('prints views and year, and falls back to the channel for an untitled video', () => {
    const [v] = toGalleryVideos([clip({ title: null, channel_name: 'Gig Goer', view_count: 12_400 })], copy)
    expect(v.title).toBe('Gig Goer')
    expect(v.meta).toBe('12.4K views · 2026')
  })
})
