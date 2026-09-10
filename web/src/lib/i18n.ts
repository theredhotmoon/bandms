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
 * Formats the Band Profile's free-text, comma-separated `genres` field as a
 * page-header kicker line — e.g. `"Ska, Ska-Jazz, Rocksteady"` becomes
 * `"SKA · SKA-JAZZ · ROCKSTEADY"`.
 *
 * Display-only: the stored value must stay comma-separated, since
 * `AboutSection`'s genre chips and the admin's pitch generator both split the
 * same field on commas. Returns null (not '') when there's nothing to show,
 * so `PageHero`'s `{kicker && …}` hides the line rather than rendering an
 * empty one.
 */
export function formatGenreKicker(genres: string | null | undefined): string | null {
  const list = (genres ?? '').split(',').map(g => g.trim()).filter(Boolean)
  return list.length > 0 ? list.join(' · ').toUpperCase() : null
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
