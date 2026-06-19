export type SocialPlatform =
  | 'spotify'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'tiktok'
  | 'bandcamp'
  | 'soundcloud'
  | 'twitter'
  | 'website'

export interface SocialLink {
  id: number
  band_id: number
  member_id: number | null
  platform: SocialPlatform
  url: string
}

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  spotify:    'Spotify',
  instagram:  'Instagram',
  facebook:   'Facebook',
  youtube:    'YouTube',
  tiktok:     'TikTok',
  bandcamp:   'Bandcamp',
  soundcloud: 'SoundCloud',
  twitter:    'Twitter / X',
  website:    'Website',
}
