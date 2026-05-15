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

export interface SocialLinkPayload {
  platform: SocialPlatform
  url: string
}

export const SOCIAL_PLATFORMS: { key: SocialPlatform; label: string; color: string }[] = [
  { key: 'spotify',    label: 'Spotify',    color: '#1db954' },
  { key: 'instagram',  label: 'Instagram',  color: '#e1306c' },
  { key: 'facebook',   label: 'Facebook',   color: '#1877f2' },
  { key: 'youtube',    label: 'YouTube',    color: '#ff0000' },
  { key: 'tiktok',     label: 'TikTok',     color: '#69c9d0' },
  { key: 'bandcamp',   label: 'Bandcamp',   color: '#1da0c3' },
  { key: 'soundcloud', label: 'SoundCloud', color: '#ff5500' },
  { key: 'twitter',    label: 'Twitter / X', color: '#94a3b8' },
  { key: 'website',    label: 'Website',    color: '#6366f1' },
]
