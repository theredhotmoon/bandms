import type { RenderableClip } from '@/types/clip'
import type { ClipCategoryCopy } from '@/lib/clipCategory'
import { clipCategoryLabel, clipCredit } from '@/lib/clipCategory'
import { embedSrc, isVideoProvider } from '@/lib/embed'
import { formatNumber } from '@/lib/i18n'

/** One card in the VideoGallery island. Props are JSON, so everything is precomputed here. */
export interface GalleryVideo {
  id: number
  title: string
  /** Category line above the title — "Music video", "Live". Empty renders nothing. */
  kind: string
  /** Set on a fan video: the label the card wears ("Fan video"). */
  fanLabel: string | null
  /** "Filmed by …", linking to the channel when there is one. */
  credit: { text: string; href: string | null } | null
  /** Player URL, or null when the provider has none — the card links out instead. */
  embedUrl: string | null
  /** The video on its own site, always present. */
  watchUrl: string
  thumb: string | null
  duration: string | null
  meta: string
}

export interface GalleryCopy extends ClipCategoryCopy {
  /** "views" unit after a YouTube count. */
  views: string
}

/**
 * The library as the gallery shows it: videos only — an audio player
 * (Spotify, SoundCloud) has no frame to open in a 16:9 lightbox, and a plain
 * link (Bandcamp) has nothing to play — official and fan footage mixed, in
 * the API's order (newest first).
 */
export function toGalleryVideos(clips: readonly RenderableClip[], copy: GalleryCopy): GalleryVideo[] {
  return clips
    .filter(c => isVideoProvider(c.provider))
    .map(c => {
      // rel=0: end on the band's own channel, not someone else's suggestions.
      const player = (src: string | null) => (src && c.provider === 'youtube' ? `${src}?rel=0` : src)
      return {
        id: c.id,
        title: c.title?.trim() || c.channel_name || c.url,
        kind: clipCategoryLabel(c.category, copy),
        fanLabel: c.source === 'fan' ? copy.clipFan : null,
        credit: clipCredit(c, copy),
        embedUrl: player(embedSrc(c.provider, c.embed_id)),
        watchUrl: c.url,
        thumb: c.thumbnail_url ?? (c.provider === 'youtube' && c.embed_id ? `https://img.youtube.com/vi/${c.embed_id}/hqdefault.jpg` : null),
        duration: c.duration ?? null,
        meta: [
          c.view_count ? `${formatNumber(c.view_count)} ${copy.views}` : null,
          c.recorded_on ? c.recorded_on.slice(0, 4) : null,
        ].filter(Boolean).join(' · '),
      }
    })
}
