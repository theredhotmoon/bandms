import type { Tag } from './tag'
import type { TranslationMap } from './shared'

export type PostBlockType     = 'text' | 'image' | 'embed' | 'ref'
export type EmbedProviderName = 'youtube' | 'vimeo' | 'instagram' | 'tiktok' | 'link'
export type RefEntity = 'concert' | 'album' | 'release' | 'music_video' | 'press_release' | 'shop_item'

interface BlockBase { id: number; position: number }
type Bag = { en?: string | null; pl?: string | null }

export interface TextBlock extends BlockBase {
  type: 'text'
  body: string | null
  translations: { body: Bag }
}

export interface ImageBlock extends BlockBase {
  type: 'image'
  path: string | null
  url: string | null
  alt: string | null
  caption: string | null
  translations: { alt: Bag; caption: Bag }
}

export interface EmbedBlock extends BlockBase {
  type: 'embed'
  provider: EmbedProviderName
  url: string | null
  label: string | null
  /** null when the URL names no single item — render as a link, not an iframe. */
  embed_id: string | null
}

export interface RefBlock extends BlockBase {
  type: 'ref'
  entity: RefEntity
  /** null when the referenced record was deleted. */
  data: Record<string, unknown> | null
}

export type PostBlock = TextBlock | ImageBlock | EmbedBlock | RefBlock

/** What the editor holds and submits — no id, no server-derived fields. */
export interface PostBlockDraft {
  type: PostBlockType
  payload: Record<string, unknown>
  /**
   * UI-only, never submitted (PostForm's submit() rebuilds {type, payload}
   * from scratch). Set during hydration when a ref block's target entity was
   * deleted, so the editor can warn rather than silently defaulting to id 0
   * — indistinguishable, otherwise, from a freshly-added block nobody has
   * configured yet.
   */
  dangling?: boolean
}

/** Returned in list responses — no image, content replaced by excerpt. */
export interface PostSummary {
  id: number
  title: string
  slug_en: string
  slug_pl: string | null
  intro: string | null
  excerpt: string
  published_at: string | null
  event_date: string | null
  tags: Tag[]
  created_at: string
  updated_at: string
  translations?: {
    title: { en?: string | null; pl?: string | null }
    intro: { en?: string | null; pl?: string | null }
  }
}

export interface PostPressRelease { id: number; title: string; url: string; site: string | null }

/** Returned in detail response — includes image and ordered content blocks. */
export interface Post extends PostSummary {
  image: string | null
  blocks: PostBlock[]
  press_releases: PostPressRelease[]
  translations?: {
    title: { en?: string | null; pl?: string | null }
    intro: { en?: string | null; pl?: string | null }
  }
}

export interface PostPayload {
  title: string | TranslationMap
  slug_en?: string | null
  slug_pl?: string | null
  intro?: string | TranslationMap | null
  image?: string | null
  published_at?: string | null
  event_date?: string | null
  tag_ids?: number[]
  blocks?: PostBlockDraft[]
}
