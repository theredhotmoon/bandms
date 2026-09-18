import type { EmbedProviderName } from './post'
import type { TranslationMap } from './shared'

export type ClipOwnerType = 'concert' | 'release' | 'shop_item' | 'album'

export interface ClipOwner {
  type: ClipOwnerType
  id: number
  label: string
  slug_en?: string
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
  recorded_on: string | null
  show_in_epk: boolean
  translations: { title: TranslationMap }
  owners: ClipOwner[]
}

export interface ClipAttach { type: ClipOwnerType; id: number }

export interface ClipPayload {
  url: string
  title?: TranslationMap
  category?: string
  recorded_on?: string | null
  show_in_epk?: boolean
  /** Full owner list — omitted means "leave attachments alone". */
  attach?: ClipAttach[]
}
