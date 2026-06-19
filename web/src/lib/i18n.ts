import type { Locale } from '@/types/shared'

export type { Locale }

export function t(
  translations: { en?: string | null; pl?: string | null } | null | undefined,
  fallback: string | null | undefined,
  lang: Locale,
): string | null {
  if (translations) {
    const val = translations[lang]
    if (val) return val
  }
  return fallback ?? null
}

export function fmtDate(dateStr: string | null | undefined, lang: Locale = 'en'): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function fmtDateShort(dateStr: string | null | undefined, lang: Locale = 'en'): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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
