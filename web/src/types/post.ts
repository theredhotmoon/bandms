import type { Tag } from './tag'

export type RefEntity = 'concert' | 'album' | 'release' | 'music_video' | 'press_release' | 'shop_item'
export type EmbedProviderName = 'youtube' | 'vimeo' | 'instagram' | 'tiktok' | 'link'

interface BlockBase { id: number; position: number }

export interface TextBlock  extends BlockBase { type: 'text';  body: string | null }
export interface ImageBlock extends BlockBase { type: 'image'; url: string | null; alt: string | null; caption: string | null }
export interface EmbedBlock extends BlockBase { type: 'embed'; provider: EmbedProviderName; url: string | null; label: string | null; embed_id: string | null }
export interface RefBlock   extends BlockBase { type: 'ref';   entity: RefEntity; data: Record<string, any> | null }

export type PostBlock = TextBlock | ImageBlock | EmbedBlock | RefBlock

export interface PostSummary {
  id: number
  title: string
  slug_en: string
  slug_pl: string | null
  intro: string | null
  excerpt: string
  published_at: string | null
  event_dates: string[]
  event_date_display: 'range' | 'list'
  tags: Tag[]
  created_at: string
  updated_at: string
  translations?: {
    title: { en?: string | null; pl?: string | null }
    intro: { en?: string | null; pl?: string | null }
  }
}

export interface Post extends PostSummary {
  image: string | null
  blocks: PostBlock[]
  translations?: {
    title: { en?: string | null; pl?: string | null }
    intro: { en?: string | null; pl?: string | null }
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
