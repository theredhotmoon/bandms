import type { EmbedProviderName } from './post'
import type { TranslationMap } from './shared'
import type { ClipSource } from '@/utils/clipSources'

export type ClipOwnerType = 'concert' | 'release' | 'shop_item' | 'album' | 'post'

export interface ClipOwner {
  type: ClipOwnerType
  id: number
  label: string
  /** concert and shop_item owners: the default-locale slug. */
  slug?: string
  date?: string | null
}

export interface Clip {
  id: number
  provider: EmbedProviderName
  url: string
  embed_id: string | null
  /** Resolved for the request locale — display only. */
  title: string | null
  category: string
  /** `official`: the band made it. `fan`: someone else did; the site credits the channel. */
  source: ClipSource
  channel_name: string | null
  channel_url: string | null
  thumbnail_url: string | null
  duration: string | null
  /** YouTube only, and only once synced or retrieved with an API key. */
  view_count: number | null
  views_synced_at: string | null
  recorded_on: string | null
  show_in_epk: boolean
  /** Band members in the clip — any number. */
  member_ids?: number[]
  translations: { title: TranslationMap }
  owners: ClipOwner[]
}

export interface ClipAttach { type: ClipOwnerType; id: number }

export interface ClipPayload {
  url: string
  title?: TranslationMap
  category?: string
  source?: ClipSource
  channel_name?: string | null
  channel_url?: string | null
  thumbnail_url?: string | null
  duration?: string | null
  view_count?: number | null
  recorded_on?: string | null
  show_in_epk?: boolean
  member_ids?: number[]
  /** Full owner list — omitted means "leave attachments alone". */
  attach?: ClipAttach[]
}

/** What the video's own site says about it — the form's Retrieve button. */
export interface VideoMetadata {
  title: string | null
  thumbnail_url: string | null
  channel_name: string | null
  channel_url: string | null
  provider_name: string | null
  view_count: number | null
  duration: string | null
}

export interface YouTubeSyncResult {
  message: string
  updated: number
  total_views: number
  synced_at: string
  results: { id: number; title: string | null; view_count: number }[]
}
