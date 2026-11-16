import { fillCopy } from '@bandms/site-copy'

/**
 * Preset clip categories map to editable copy on the `site` module; anything
 * else the band typed prints as typed. Mirrors api/app/Support/ClipCategory.
 *
 * The same copy carries the fan-video label and credit, so every surface that
 * renders a video (Videos page, show page, news, EPK, member page) labels a
 * fan's footage the same way.
 */
export interface ClipCategoryCopy {
  clipCategoryMusicVideo: string
  clipCategoryLive: string
  clipCategoryStudio: string
  clipCategoryBackstage: string
  clipCategoryInterview: string
  clipCategoryOther: string
  clipFan: string
  /** Template: `{name}` is the channel or author. */
  clipFilmedBy: string
}

const KEY: Record<string, keyof ClipCategoryCopy> = {
  music_video: 'clipCategoryMusicVideo',
  live: 'clipCategoryLive',
  studio: 'clipCategoryStudio',
  backstage: 'clipCategoryBackstage',
  interview: 'clipCategoryInterview',
  other: 'clipCategoryOther',
}

export function clipCategoryLabel(category: string, copy: ClipCategoryCopy): string {
  const key = KEY[category]
  return key ? copy[key] : category
}

/** The fields the credit reads — any rendered clip shape has them, possibly absent. */
export interface CreditableClip {
  source?: 'official' | 'fan'
  channel_name?: string | null
  channel_url?: string | null
}

export interface ClipCredit {
  /** "Filmed by Gig Goer" */
  text: string
  /** The channel, or null when none was given or it is not an http(s) URL. */
  href: string | null
}

/**
 * Who filmed a fan video, or null for the band's own (and for a fan video
 * with no channel name — "Filmed by" with nobody after it says nothing).
 *
 * The link is only ever http(s): it comes from an admin field and lands in an
 * `href`, so a `javascript:` URL must never get through even though the API
 * already validates it as a URL.
 */
export function clipCredit(clip: CreditableClip, copy: ClipCategoryCopy): ClipCredit | null {
  if (clip.source !== 'fan') return null
  const name = clip.channel_name?.trim()
  if (!name) return null
  return { text: fillCopy(copy.clipFilmedBy, { name }), href: safeHttpUrl(clip.channel_url) }
}

function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}
