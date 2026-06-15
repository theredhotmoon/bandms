import type { BandMember } from './bandMember'
import type { SocialLink } from './socialLink'
import type { ReleaseType, ReleasePlatform } from './release'
import type { BandLogo } from './bandLogo'
import type { TranslationMap } from './shared'

export interface BandProfileTranslations {
  bio_short:          { en?: string | null; pl?: string | null }
  bio_medium:         { en?: string | null; pl?: string | null }
  bio_long:           { en?: string | null; pl?: string | null }
  bio_full:           { en?: string | null; pl?: string | null }
  artistic_statement: { en?: string | null; pl?: string | null }
}

export interface BandProfile {
  id: number
  name: string
  bio_short: string | null
  bio_medium: string | null
  bio_long: string | null
  bio_full: string | null
  formation_year: number | null
  hometown: string | null
  genres: string | null
  comparable_artists: string | null
  booking_email: string | null
  press_email: string | null
  tech_contact_phone: string | null
  tech_contact_email: string | null
  tech_rider_notes: string | null
  artistic_statement: string | null
  translations?: BandProfileTranslations
  stat_spotify_monthly: number | null
  stat_instagram_followers: number | null
  stat_tiktok_followers: number | null
  stat_youtube_subscribers: number | null
  stat_facebook_followers: number | null
  facebook_likes: number | null
  facebook_likes_synced_at: string | null
  tech_rider_url: string | null
  stage_plot_url: string | null
  epk_release_id: number | null
  epk_album_id: number | null
  logo_url: string | null              // current default logo URL (convenience)
  epk_logo_id: number | null
  tech_rider_logo_id: number | null
  website_logo_id: number | null
  logos?: BandLogo[]                   // non-deprecated logos (public API)
  career_level: 1 | 2 | 3 | 4
  members?: BandMember[]
  social_links?: SocialLink[]
  updated_at: string
}

export interface FacebookSyncResult {
  message: string
  likes: number
  synced_at: string
}

export interface CalendarBusyMember {
  id: number
  name: string
  role: string
}

export interface CalendarAvailability {
  date: string
  available: boolean
  total_members: number
  busy_count: number
  busy_members: CalendarBusyMember[]
}

export interface CalendarEventExtendedProps {
  memberId: number
  memberName: string
  memberRole: string
  description: string | null
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string | null
  allDay: boolean
  color: string
  extendedProps: CalendarEventExtendedProps
}

export interface BandProfilePayload {
  name?: string
  bio_short?: string | TranslationMap | null
  bio_medium?: string | TranslationMap | null
  bio_long?: string | TranslationMap | null
  bio_full?: string | TranslationMap | null
  formation_year?: number | null
  hometown?: string | null
  genres?: string | null
  comparable_artists?: string | null
  booking_email?: string | null
  press_email?: string | null
  tech_contact_phone?: string | null
  tech_contact_email?: string | null
  tech_rider_notes?: string | null
  artistic_statement?: string | TranslationMap | null
  stat_spotify_monthly?: number | null
  stat_instagram_followers?: number | null
  stat_tiktok_followers?: number | null
  stat_youtube_subscribers?: number | null
  stat_facebook_followers?: number | null
  epk_release_id?: number | null
  epk_album_id?: number | null
  epk_logo_id?: number | null
  tech_rider_logo_id?: number | null
  website_logo_id?: number | null
  career_level?: 1 | 2 | 3 | 4
}

// ── EPK data shape (from GET /api/band-profile/epk) ─────────────────────────

export interface EpkSocialLink {
  platform: string
  url: string
  label: string | null
}

export interface EpkTrackLink {
  platform: ReleasePlatform
  url: string
}

export interface EpkTrack {
  id: number
  title: string
  duration: string | null
  sort_order: number
  links: EpkTrackLink[]
}

export interface EpkReleaseLink {
  platform: ReleasePlatform
  url: string
}

export interface EpkRelease {
  id: number
  title: string
  type: ReleaseType
  release_date: string | null
  cover_image: string | null
  description: string | null
  links: EpkReleaseLink[]
  tracks: EpkTrack[]
}

export interface EpkPhoto {
  id: number
  image_url: string | null
  caption: string | null
}


export interface EpkPressArticle {
  id: number
  url: string
  og_title: string | null
  og_description: string | null
  og_image: string | null
  og_site_name: string | null
  published_at: string | null
  tags: { id: number; name: string }[]
}

export interface EpkConcertVenue {
  name: string
  city: string | null
  country: string | null
}

export interface EpkConcert {
  id: number
  date: string
  start_time: string | null
  venue: EpkConcertVenue | null
  links: { label: string; url: string }[]
}

export interface EpkTestimonial {
  id: number
  name: string
  role: string | null
  company: string | null
  quote: string
}

export interface EpkMusicVideo {
  id: number
  title: string
  video_url: string
  published_at: string | null
}

export interface EpkData {
  name: string
  bio_short: string | null
  bio_medium: string | null
  bio_long: string | null
  formation_year: number | null
  hometown: string | null
  genres: string | null
  comparable_artists: string | null
  booking_email: string | null
  press_email: string | null
  stat_spotify_monthly: number | null
  stat_instagram_followers: number | null
  stat_tiktok_followers: number | null
  stat_youtube_subscribers: number | null
  stat_facebook_followers: number | null
  tech_rider_url: string | null
  stage_plot_url: string | null
  logo_url: string | null
  social_links: EpkSocialLink[]
  testimonials: EpkTestimonial[]
  music_videos: EpkMusicVideo[]
  featured_release: EpkRelease | null
  press_photos: EpkPhoto[]
  press_articles: EpkPressArticle[]
  upcoming_concerts: EpkConcert[]
}
