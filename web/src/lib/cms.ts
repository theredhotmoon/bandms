import type { BandProfile, EpkData } from '@/types/bandProfile'
import type { BandMember } from '@/types/bandMember'
import type { SocialLink } from '@/types/socialLink'
import type { Concert } from '@/types/concert'
import type { Release, ReleaseSummary } from '@/types/release'
import type { Post, PostSummary, PaginationMeta } from '@/types/post'
import type { Album } from '@/types/album'
import type { MusicVideo } from '@/types/musicVideo'
import type { PressReleaseSummary } from '@/types/pressRelease'
import type { ShopItem, ShopItemSummary, ShopCategory } from '@/types/shop'
import type { PublicSetlist } from '@/types/setlist'
import type { Locale } from '@/types/shared'

const BASE = (import.meta.env.API_BASE ?? '').replace(/\/$/, '')

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  const res = await fetch(`${BASE}/api${path}${qs}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`CMS ${res.status}: ${path}`)
  }
  const json = (await res.json()) as unknown
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: T }).data
  }
  return json as T
}

async function getOptional<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}/api${path}`, { headers: { Accept: 'application/json' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`CMS ${res.status}: ${path}`)
  const json = (await res.json()) as unknown
  if (json && typeof json === 'object' && 'data' in json) return (json as { data: T }).data
  return json as T
}

// ── Band profile ──────────────────────────────────────────────────────────────

export const getBandProfile = (lang: Locale = 'en') =>
  get<BandProfile>('/band-profile', { lang })

export const getEpk = (lang: Locale = 'en') =>
  get<EpkData>('/band-profile/epk', { lang })

export const getMembers = () =>
  get<BandMember[]>('/band-profile/members')

export const getSocialLinks = () =>
  get<SocialLink[]>('/band-profile/social-links')

// ── Concerts ──────────────────────────────────────────────────────────────────

export const getConcerts = () =>
  get<Concert[]>('/concerts')

export const getConcert = (id: number) =>
  get<Concert>(`/concerts/${id}`)

export const getConcertSetlist = (id: number) =>
  getOptional<PublicSetlist>(`/concerts/${id}/setlist`)

export const getConcertTickets = (id: number) =>
  get<{ id: number; is_on_sale: boolean }[]>(`/concerts/${id}/tickets`)

// ── Releases ──────────────────────────────────────────────────────────────────

export const getReleases = (lang: Locale = 'en') =>
  get<ReleaseSummary[]>('/releases', { lang })

export const getRelease = (id: number, lang: Locale = 'en') =>
  get<Release>(`/releases/${id}`, { lang })

// ── Posts ─────────────────────────────────────────────────────────────────────

export async function getPosts(lang: Locale = 'en', page = 1): Promise<{ data: PostSummary[]; meta: PaginationMeta }> {
  const res = await fetch(`${BASE}/api/posts?lang=${lang}&page=${page}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`CMS ${res.status}: /posts`)
  const json = (await res.json()) as { data: PostSummary[]; meta: PaginationMeta }
  return json
}

export const getPost = (id: number, lang: Locale = 'en') =>
  get<Post>(`/posts/${id}`, { lang })

// ── Albums & Photos ───────────────────────────────────────────────────────────

export const getAlbums = () =>
  get<Album[]>('/albums')

export const getAlbum = (id: number) =>
  get<Album>(`/albums/${id}`)

// ── Music Videos ──────────────────────────────────────────────────────────────

export const getMusicVideos = () =>
  get<MusicVideo[]>('/music-videos')

// ── Press ─────────────────────────────────────────────────────────────────────

export const getPressReleases = () =>
  get<PressReleaseSummary[]>('/press-releases')

// ── Shop ──────────────────────────────────────────────────────────────────────

export const getShopItems = () =>
  get<ShopItemSummary[]>('/shop')

export const getShopItem = (slug: string) =>
  get<ShopItem>(`/shop/by-slug/${slug}`)

export const getShopCategories = () =>
  get<ShopCategory[]>('/shop-categories')
