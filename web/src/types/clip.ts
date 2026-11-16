import type { EmbedProviderName } from './post'

export interface Clip {
  id: number
  provider: EmbedProviderName
  url: string
  /** null when the URL names no single video — render a link, not an iframe. */
  embed_id: string | null
  title: string | null
  category: string
  /** `official`: the band made it. `fan`: someone else filmed it — label it and credit the channel. */
  source: 'official' | 'fan'
  channel_name: string | null
  channel_url: string | null
  thumbnail_url: string | null
  duration: string | null
  /** YouTube only, once synced. */
  view_count: number | null
  recorded_on: string | null
  show_in_epk: boolean
}

/**
 * What a clip needs to render: everything but the admin-only flag. The EPK
 * snapshot freezes clips in this shape, so ClipsGrid takes it rather than Clip.
 */
export type RenderableClip = Omit<Clip, 'show_in_epk' | ClipExtras> & Partial<Pick<Clip, ClipExtras>>

/**
 * Optional on a RenderableClip: EPK snapshots published before music videos
 * were folded into the library (Nov 2026) carry none of them, and the
 * snapshot never stores the gallery-only stats. An absent `source` means
 * official — the only kind there was.
 */
type ClipExtras = 'source' | 'channel_name' | 'channel_url' | 'thumbnail_url' | 'duration' | 'view_count'
