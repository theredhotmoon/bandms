import type { AlbumCard } from './album'
import type { TranslationBag } from '@/lib/locales'
import type { Tag } from './tag'
import type { RenderableClip } from './clip'

export type RefEntity = 'concert' | 'album' | 'release' | 'press_release' | 'shop_item' | 'clip'
export type EmbedProviderName =
  | 'youtube' | 'vimeo' | 'instagram' | 'tiktok' | 'facebook'
  | 'spotify' | 'soundcloud' | 'apple_music'
  | 'link'

interface BlockBase { id: number; position: number }

export interface TextBlock  extends BlockBase { type: 'text';  body: string | null }
export interface ImageBlock extends BlockBase { type: 'image'; url: string | null; alt: string | null; caption: string | null }
export interface EmbedBlock extends BlockBase { type: 'embed'; provider: EmbedProviderName; url: string | null; label: string | null; embed_id: string | null }
export interface RefBlock   extends BlockBase { type: 'ref';   entity: RefEntity; data: Record<string, unknown> | null }

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
  /** Pinned to the top of the News page in the admin's posts list. */
  is_highlighted?: boolean
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
  /** When the text or pictures last changed after publishing. Absent from an older API. */
  content_updated_at?: string | null
  /** Drafts only, from the build's draft list: the secret of its preview page. */
  preview_token?: string
  /** Whether the page mounts the comments block. Absent from an older API, which counts as on. */
  comments_enabled?: boolean
  /** Linked photo albums the site builds a page for, in the band's order. Absent from an older API. */
  albums?: AlbumCard[]
  /** Clips listed at the foot of the article, in the band's order. Absent from an older API. */
  clips?: RenderableClip[]
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
