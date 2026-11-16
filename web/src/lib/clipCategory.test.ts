import { describe, it, expect } from 'vitest'
import { clipCategoryLabel, clipCredit } from './clipCategory'

const site = {
  clipCategoryMusicVideo: 'Teledysk',
  clipCategoryLive: 'Na żywo', clipCategoryStudio: 'Studio', clipCategoryBackstage: 'Za kulisami',
  clipCategoryInterview: 'Wywiad', clipCategoryOther: 'Inne',
  clipFan: 'Nagranie fana', clipFilmedBy: 'Nagranie: {name}',
}

describe('clipCategoryLabel', () => {
  it('maps a preset to its copy label', () => {
    expect(clipCategoryLabel('live', site)).toBe('Na żywo')
    expect(clipCategoryLabel('backstage', site)).toBe('Za kulisami')
    expect(clipCategoryLabel('music_video', site)).toBe('Teledysk')
  })
  it('prints a custom category as typed', () => {
    expect(clipCategoryLabel('charity gig', site)).toBe('charity gig')
  })
})

describe('clipCredit', () => {
  it('credits a fan video with its channel and link', () => {
    expect(clipCredit({ source: 'fan', channel_name: 'Gig Goer', channel_url: 'https://www.youtube.com/@giggoer' }, site))
      .toEqual({ text: 'Nagranie: Gig Goer', href: 'https://www.youtube.com/@giggoer' })
  })

  it('credits the band’s own video with nothing', () => {
    expect(clipCredit({ source: 'official', channel_name: 'Skanking Storks' }, site)).toBeNull()
    // Snapshots from before the field existed carry no source at all.
    expect(clipCredit({ channel_name: 'Skanking Storks' }, site)).toBeNull()
  })

  it('omits the credit when nobody is named, and the link when there is none', () => {
    expect(clipCredit({ source: 'fan', channel_name: '  ' }, site)).toBeNull()
    expect(clipCredit({ source: 'fan', channel_name: 'Gig Goer', channel_url: null }, site))
      .toEqual({ text: 'Nagranie: Gig Goer', href: null })
  })

  it('never links anything but http(s)', () => {
    expect(clipCredit({ source: 'fan', channel_name: 'X', channel_url: 'javascript:alert(1)' }, site)?.href).toBeNull()
    expect(clipCredit({ source: 'fan', channel_name: 'X', channel_url: 'not a url' }, site)?.href).toBeNull()
  })
})
