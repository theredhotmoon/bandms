/**
 * Who made a video. Mirrors api/app/Support/ClipSource — `official` is the
 * band's own, `fan` is someone else's footage the band chose to show, with a
 * credit. Lives in utils/ so vitest can import it.
 */
export const CLIP_SOURCES = ['official', 'fan'] as const
export type ClipSource = (typeof CLIP_SOURCES)[number]

/** The catalogue key for a source's label. */
export function sourceMessageKey(source: ClipSource): string {
  return `band.clips.source.${source}`
}

/**
 * The career checklist's "a music video" item: the band's own, in the music
 * video category. A fan's live footage does not tick it.
 */
export function countOfficialMusicVideos(clips: readonly { source: ClipSource; category: string }[]): number {
  return clips.filter(c => c.source === 'official' && c.category === 'music_video').length
}

type Statted = { source: ClipSource; view_count: number | null; views_synced_at: string | null }

/** The list narrowed to one source; '' is every video. */
export function filterBySource<T extends { source: ClipSource }>(clips: readonly T[], source: '' | ClipSource): T[] {
  return source ? clips.filter(c => c.source === source) : [...clips]
}

/**
 * The header's "total views": the band's own videos only. A fan's upload is
 * synced too (its card shows its count), but its views are not the band's reach.
 */
export function officialViewTotal(clips: readonly Statted[]): number {
  return clips.reduce((sum, c) => sum + (c.source === 'official' ? (c.view_count ?? 0) : 0), 0)
}

/** The most recent sync time across the library (ISO), or null when nothing was synced. */
export function lastSyncedAt(clips: readonly Statted[]): string | null {
  return clips.map(c => c.views_synced_at).filter((v): v is string => !!v).sort().at(-1) ?? null
}

/** Providers the API can read a title, channel and thumbnail from (keyless oEmbed). */
const RETRIEVABLE = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)$/i

export function canRetrieveMetadata(url: string): boolean {
  try {
    return RETRIEVABLE.test(new URL(url.trim()).hostname)
  } catch {
    return false
  }
}
