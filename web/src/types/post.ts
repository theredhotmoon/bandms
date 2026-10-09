import type { TranslationBag } from '@/lib/locales'
import type { Tag } from './tag'

export type RefEntity = 'concert' | 'album' | 'release' | 'music_video' | 'press_release' | 'shop_item' | 'clip'
export type EmbedProviderName =
  | 'youtube' | 'vimeo' | 'instagram' | 'tiktok' | 'facebook'
  | 'spotify' | 'soundcloud' | 'apple_music'
  | 'link'

interface BlockBase { id: number; position: number }

export interface TextBlock  extends BlockBase { type: 'text';  body: string | null }
export interface ImageBlock extends BlockBase { type: 'image'; url: string | null; alt: string | null; caption: string | null }
export interface EmbedBlock extends BlockBase { type: 'embed'; provider: EmbedProviderName; url: string | null; label: string | null; embed_id: string | null }
export interface RefBlock   extends BlockBase { type: 'ref';   entity: RefEntity; data: Record<string, any> | null }

export type PostBlock = TextBlock | ImageBlock | EmbedBlock | RefBlock

export interface PostSummary {
  id: number
  title: string
  /** The default locale's slug, never blank. Per-locale URLs: postSlug(). */
  slug: string
  intro: string | null
  /** Main image, rendered on the list card and as the article hero. */
  image: string | null
  excerpt: string
  published_at: string | null
  event_dates: string[]
  event_date_display: 'range' | 'list'
  tags: Tag[]
  created_at: string
  updated_at: string
  translations?: {
    title: TranslationBag
    intro: TranslationBag
    /** One slug per locale — what postSlug() resolves a post's URL from. */
    slug?: TranslationBag
  }
}

export interface Post extends PostSummary {
  blocks: PostBlock[]
  translations?: {
    title: TranslationBag
    intro: TranslationBag
    /** One slug per locale — what postSlug() resolves a post's URL from. */
    slug?: TranslationBag
  }
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}
