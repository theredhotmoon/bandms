import { dateLocale, type Locale, type TranslationBag } from './locales'

export type { Locale }

/**
 * Pick one locale out of a translation bag, else the caller's fallback.
 *
 * Deliberately does NOT walk the locale chain: `fallback` is normally the
 * already-resolved field from the API, which the server chained through
 * config/locales.php. Chaining again here would prefer a raw bag entry over the
 * value the server chose, so the two sides would disagree on a half-translated
 * field. Use resolveTranslation() from ./locales when there is no server-side
 * resolved value to fall back to.
 */
export function t(
  translations: TranslationBag | null | undefined,
  fallback: string | null | undefined,
  lang: Locale,
): string | null {
  if (translations) {
    const val = translations[lang]
    if (val) return val
  }
  return fallback ?? null
}

/**
 * Resolves a post's per-locale URL slug. slug_en/slug_pl are plain DB columns
 * (not a translation bag), and slug_pl is null whenever the post has no Polish
 * title — generateSlug() only produces it from a Polish title on save. Falling
 * back to slug_en keeps every post reachable under /pl/ even half-translated.
 */
export function postSlug(post: { slug_en: string; slug_pl?: string | null }, lang: Locale): string {
  return lang === 'pl' ? (post.slug_pl || post.slug_en) : post.slug_en
}

export function fmtDate(dateStr: string | null | undefined, lang: Locale = 'en'): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(dateLocale(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function fmtDateShort(dateStr: string | null | undefined, lang: Locale = 'en'): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(dateLocale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Splits a free-text, comma-separated field (`genres`, `comparable_artists`)
 * into its entries. Defensive: a trailing comma is common and would
 * otherwise produce an empty entry.
 */
export function splitCommaList(value: string | null | undefined): string[] {
  return (value ?? '').split(',').map(v => v.trim()).filter(Boolean)
}

/**
 * Formats the Band Profile's `genres` field as a page-header kicker line —
 * e.g. `"Ska, Ska-Jazz, Rocksteady"` becomes `"SKA · SKA-JAZZ · ROCKSTEADY"`.
 *
 * Display-only: the stored value must stay comma-separated, since
 * `AboutSection`'s genre chips and the admin's pitch generator both split the
 * same field on commas via splitCommaList(). Returns null (not '') when
 * there's nothing to show, so `PageHero`'s `{kicker && …}` hides the line
 * rather than rendering an empty one.
 */
export function formatGenreKicker(genres: string | null | undefined): string | null {
  const list = splitCommaList(genres)
  return list.length > 0 ? list.join(' · ').toUpperCase() : null
}

/**
 * Formats a post's linked-concert dates for display. Empty when no concert is
 * linked — callers must gate rendering on that, since an event date is only
 * ever shown when a post is tied to a concert or festival.
 */
export function formatEventDates(
  dates: string[],
  display: 'range' | 'list',
  lang: Locale = 'en',
): string {
  if (dates.length === 0) return ''

  // Date-only strings ('2099-01-10') parse as UTC midnight, which renders as
  // the previous day west of UTC — appending a local time-of-day, as every
  // other date-only field in this codebase does (see ConcertDetail.astro),
  // forces local-time parsing instead.
  const toLocalDate = (d: string) => new Date(d + 'T00:00:00')
  const sorted = [...dates].sort()
  const formatter = new Intl.DateTimeFormat(dateLocale(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  if (sorted.length === 1) return formatter.format(toLocalDate(sorted[0]))
  if (display === 'list') return sorted.map(d => formatter.format(toLocalDate(d))).join(', ')
  return formatter.formatRange(toLocalDate(sorted[0]), toLocalDate(sorted[sorted.length - 1]))
}

export function fmtTime(timeStr: string | null | undefined): string {
  if (!timeStr) return ''
  return timeStr.substring(0, 5)
}

export function isUpcoming(dateStr: string): boolean {
  return new Date(dateStr) >= new Date()
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export function youtubeEmbedUrl(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/) ??
    url.match(/youtube\.com\/embed\/([\w-]+)/)
  if (!m) return null
  return `https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1`
}

export function youtubeThumbnail(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (!m) return null
  return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`
}
