import type { EmbedProviderName } from './post'

export interface Clip {
  id: number
  provider: EmbedProviderName
  url: string
  /** null when the URL names no single video — render a link, not an iframe. */
  embed_id: string | null
  title: string | null
  category: string
  recorded_on: string | null
  show_in_epk: boolean
}

/**
 * What a clip needs to render: everything but the admin-only flag. The EPK
 * snapshot freezes clips in this shape, so ClipsGrid takes it rather than Clip.
 */
export type RenderableClip = Omit<Clip, 'show_in_epk'>
