import type { EmbedProviderName } from './post'
import type { TranslationMap } from './shared'

export type ClipOwnerType = 'concert' | 'release' | 'shop_item' | 'album'

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
  recorded_on?: string | null
  show_in_epk?: boolean
  member_ids?: number[]
  /** Full owner list — omitted means "leave attachments alone". */
  attach?: ClipAttach[]
}
