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

/**
 * EPK data, or null if it cannot be fetched.
 *
 * `getEpk` throws on a non-2xx, and the Astro build is all-or-nothing — one page
 * that throws kills all of them. Use this anywhere the EPK is supplementary to a
 * page rather than the point of it.
 */
export async function getEpkOptional(lang: Locale = 'en'): Promise<EpkData | null> {
  try {
    return await getEpk(lang)
  } catch {
    return null
  }
}

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

// ── Site config ───────────────────────────────────────────────────────────────

export interface ModuleConfig {
  enabled: boolean
  label: string
  /**
    * URL segment for this locale, with the module-key fallback already resolved
    * by the API. Optional because an API that predates the slug migration omits
    * it entirely — see the fallback in slugs.ts.
    */
  slug?: string
  per_page: number | null
  /**
   * Editable copy for this module, with the locale already resolved by the API.
   * Optional because an API predating the settings migration omits it — read
   * through `settings?.field ?? ''`, never bare.
   */
  settings?: Record<string, string>
}

export interface SiteConfig {
  modules: Record<string, boolean>
  module_order: string[]
  module_config: Record<string, ModuleConfig>
  /**
   * Active theme name. Reserved — the API does not serve this yet, so it is
   * always undefined today and `getTheme()` falls through to the env var.
   */
  theme?: string
}

/**
 * Memoised per locale for the life of the build.
 *
 * Every <ThemeSlot> resolves the active theme, which reads this — so an
 * unmemoised call meant one /api/site-config request per ornament on every page,
 * hundreds of round trips across a build. The config cannot change mid-build.
 */
const _siteConfigCache = new Map<Locale, Promise<SiteConfig>>()

export function getSiteConfig(lang: Locale = 'en'): Promise<SiteConfig> {
  const hit = _siteConfigCache.get(lang)
  if (hit) return hit

  // Only a *successful* config is cached. The fail-open value is returned but
  // the entry is evicted, so the next page retries instead of inheriting one
  // blip for the whole build — which would leave Header and Footer with no
  // labels and slugs falling back to module keys (/pl/shop, not /pl/sklep).
  //
  // An earlier attempt evicted on rejection, which never fired: fetchSiteConfig
  // caught its own failures and *resolved* with the fallback, so the fallback
  // was cached exactly as before. Failure has to leave this function as a
  // rejection for the distinction to exist at all.
  const pending = fetchSiteConfig(lang).catch(() => {
    _siteConfigCache.delete(lang)
    return { modules: {}, module_order: [], module_config: {} } as SiteConfig
  })

  _siteConfigCache.set(lang, pending)
  return pending
}

/**
 * Throws on any failure. Deliberately: `getSiteConfig` owns both the fail-open
 * value and the decision not to cache it, and it can only tell success from
 * failure if failure arrives as a rejection.
 */
async function fetchSiteConfig(lang: Locale): Promise<SiteConfig> {
  const res = await fetch(`${BASE}/api/site-config?lang=${lang}`, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) throw new Error(`site-config ${res.status}`)

  return (await res.json()) as SiteConfig
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

export interface Faq {
  id: number
  module_slug: string
  question: string
  answer: string
}

/**
 * Published questions for one subpage.
 *
 * Fails open to an empty list rather than throwing: an FAQ block is
 * supplementary, and the Astro build is all-or-nothing — letting this reject
 * would take down all 35 pages over a section that is allowed to be absent.
 */
export async function getFaqs(module: string, lang: Locale = 'en'): Promise<Faq[]> {
  try {
    const res = await fetch(`${BASE}/api/faqs?module=${encodeURIComponent(module)}&lang=${lang}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: Faq[] }
    return json.data ?? []
  } catch {
    return []
  }
}
