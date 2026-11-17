import { describe, it, expect } from 'vitest'
import { CLIP_SOURCES, canRetrieveMetadata, countOfficialMusicVideos, filterBySource, lastSyncedAt, officialViewTotal, sourceMessageKey } from './clipSources'

describe('clipSources', () => {
  it('mirrors the API: official first, then fan', () => {
    expect(CLIP_SOURCES).toEqual(['official', 'fan'])
  })

  it('names a catalogue key per source', () => {
    expect(sourceMessageKey('fan')).toBe('band.clips.source.fan')
  })

  it('counts only the band\'s own music videos for the career checklist', () => {
    expect(countOfficialMusicVideos([
      { source: 'official', category: 'music_video' },
      { source: 'fan', category: 'music_video' },
      { source: 'official', category: 'live' },
    ])).toBe(1)
  })

  const lib = [
    { id: 1, source: 'official' as const, view_count: 1000, views_synced_at: '2026-11-01T10:00:00Z' },
    { id: 2, source: 'fan' as const, view_count: 250, views_synced_at: '2026-11-02T10:00:00Z' },
    { id: 3, source: 'official' as const, view_count: null, views_synced_at: null },
  ]

  it('filters by source, empty meaning every video', () => {
    expect(filterBySource(lib, 'fan').map(c => c.id)).toEqual([2])
    expect(filterBySource(lib, '').map(c => c.id)).toEqual([1, 2, 3])
  })

  it('totals the band\'s own views only', () => {
    expect(officialViewTotal(lib)).toBe(1000)
  })

  it('reports the latest sync, or null', () => {
    expect(lastSyncedAt(lib)).toBe('2026-11-02T10:00:00Z')
    expect(lastSyncedAt([lib[2]])).toBeNull()
  })

  it('offers Retrieve only for providers with a keyless oEmbed', () => {
    expect(canRetrieveMetadata('https://www.youtube.com/watch?v=qyRvEO_o6z0')).toBe(true)
    expect(canRetrieveMetadata('https://youtu.be/qyRvEO_o6z0')).toBe(true)
    expect(canRetrieveMetadata('https://vimeo.com/76979871')).toBe(true)
    expect(canRetrieveMetadata('https://www.tiktok.com/@a/video/1')).toBe(true)
    expect(canRetrieveMetadata('https://www.instagram.com/p/abc/')).toBe(false)
    // A look-alike host is not YouTube.
    expect(canRetrieveMetadata('https://notyoutube.com/watch?v=x')).toBe(false)
    expect(canRetrieveMetadata('not a url')).toBe(false)
  })
})
