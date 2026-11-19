/**
 * The welcome screen's show rule — pure functions, no DOM, no Vue.
 *
 * The island decides *whether* and *what* with these; the consent banner
 * shares the same storage key so the two never stack.
 */
import { LOCALES } from './locales'

export type WelcomeBlock = 'concerts' | 'news' | 'newsletter' | 'account'

export interface WelcomeConfig {
  blocks: WelcomeBlock[]
  concert_count: 1 | 2 | 3
  frequency: 'interval' | 'once'
  reshow_days: number
  campaign: number
  geo: { enabled: boolean; radius_km: number; far_visitors: 'hide_gigs' | 'no_screen' }
}

export interface WelcomeSeen { seenAt: string; campaign: number }

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>

const KEY = 'bandms:welcome'
const DAY_MS = 86_400_000
const locales = LOCALES.join('|')

/** Pages that must never be covered: tokens, legal, account, confirmations. */
export const EXCLUDED_PATHS: RegExp[] = [
  /^\/rider(\/|$)/,
  new RegExp(`^/(${locales})/privacy/?$`),
  /^\/account(\/|$)/,
  /^\/newsletter(\/|$)/,
  /^\/tickets(\/|$)/,
  // Stripe's return pages: unlocalised, fixed routes (pages/merch/success|cancel).
  /^\/merch\/(success|cancel)\/?$/,
]

export function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATHS.some(re => re.test(pathname))
}

export function isDue(seen: WelcomeSeen | null, cfg: WelcomeConfig, now: Date): boolean {
  if (!seen) return true
  if (seen.campaign !== cfg.campaign) return true
  if (cfg.frequency === 'once') return false
  const at = Date.parse(seen.seenAt)
  if (Number.isNaN(at)) return true
  return now.getTime() - at >= cfg.reshow_days * DAY_MS
}

export function selectBlocks(
  cfg: WelcomeConfig,
  available: Record<WelcomeBlock, boolean>,
  nearby: { located: boolean; concertIds: number[] } | null,
  upcomingIds: number[],
): { blocks: WelcomeBlock[]; concertIds: number[] } | null {
  const geo = cfg.geo.enabled && nearby?.located === true
  let concertIds: number[]
  if (geo) {
    // Only shows this page was built with: one created since the build, past
    // the island's cap or no longer upcoming has nothing to render. Server
    // (date) order kept; none left counts as far.
    const known = new Set(upcomingIds)
    concertIds = nearby!.concertIds.filter(id => known.has(id)).slice(0, cfg.concert_count)
    if (concertIds.length === 0 && cfg.geo.far_visitors === 'no_screen') return null
  } else {
    concertIds = upcomingIds.slice(0, cfg.concert_count)
  }

  const blocks = cfg.blocks.filter(b => available[b] && (b !== 'concerts' || concertIds.length > 0))
  return blocks.length > 0 ? { blocks, concertIds } : null
}

/**
 * Drops shows dated before today on the visitor's own calendar. The page is
 * baked, so without this a show stays "upcoming" in the island until the next
 * rebuild, which may be days away. `isoDate` is `YYYY-MM-DD`; a show today
 * stays, and one with an unreadable date is kept rather than guessed away.
 */
export function dropPastConcerts<T extends { isoDate: string }>(concerts: T[], now: Date): T[] {
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return concerts.filter(c => !/^\d{4}-\d{2}-\d{2}$/.test(c.isoDate) || c.isoDate >= today)
}

/**
 * Whether to record the visitor as decided. A shown screen always is; a
 * nearby lookup that came back with nothing to show is too, or every page view
 * would repeat the lookup. A screen that was never due is not.
 */
export function shouldMarkSeen(picked: unknown, lookedUp: boolean): boolean {
  return picked !== null && picked !== undefined ? true : lookedUp
}

/**
 * localStorage that accepts a write. A choice that cannot be stored would be
 * asked for again on every page, so callers treat `false` as "do not show".
 */
export function storageWritable(storage: Pick<Storage, 'setItem' | 'removeItem'> | null): boolean {
  if (!storage) return false
  try {
    storage.setItem('bandms:probe', '1')
    storage.removeItem('bandms:probe')
    return true
  } catch {
    return false
  }
}

/** `'unavailable'` = storage missing or throwing: the caller must not show. */
export function readSeen(storage: ReadStorage | null): WelcomeSeen | null | 'unavailable' {
  if (!storage) return 'unavailable'
  let raw: string | null
  try {
    raw = storage.getItem(KEY)
  } catch {
    return 'unavailable'
  }
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    if (v && typeof v.seenAt === 'string' && typeof v.campaign === 'number') {
      return { seenAt: v.seenAt, campaign: v.campaign }
    }
  } catch { /* corrupt — treat as never seen */ }
  return null
}

export function writeSeen(storage: WriteStorage | null, campaign: number, now: Date): void {
  if (!storage) return
  try {
    storage.setItem(KEY, JSON.stringify({ seenAt: now.toISOString(), campaign } satisfies WelcomeSeen))
  } catch { /* quota / private mode — a failed write is not worth throwing */ }
}
