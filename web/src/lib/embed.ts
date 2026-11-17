import type { EmbedProviderName } from '@/types/post'

/**
 * Every provider's player URL, from the id the API extracted
 * (`EmbedProvider::embedId()`). Every provider is an iframe — no third-party
 * JavaScript anywhere: Instagram and TikTok also publish blockquote-plus-script
 * embeds, but the public specs run failOnPageError(), so a third-party script
 * that throws would fail specs that have nothing to do with the page.
 *
 * Shared by EmbedBlock (posts, show and release pages) and the Videos page's
 * gallery, so the two cannot disagree about which player a video opens in.
 */
const SRC: Partial<Record<EmbedProviderName, (id: string) => string>> = {
  youtube:     id => `https://www.youtube-nocookie.com/embed/${id}`,
  vimeo:       id => `https://player.vimeo.com/video/${id}`,
  instagram:   id => `https://www.instagram.com/p/${id}/embed`,
  tiktok:      id => `https://www.tiktok.com/embed/v2/${id}`,
  facebook:    id => `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(id)}&show_text=false`,
  spotify:     id => `https://open.spotify.com/embed/${id}`,
  soundcloud:  id => `https://w.soundcloud.com/player/?url=${encodeURIComponent(id)}&visual=false`,
  apple_music: id => `https://embed.music.apple.com${id}`,
}

/** Mirrors api/app/Support/EmbedProvider::AUDIO — fixed-height players, not 16:9. */
export const AUDIO_PROVIDERS: readonly EmbedProviderName[] = ['spotify', 'soundcloud', 'apple_music']

export function isAudioProvider(provider: EmbedProviderName): boolean {
  return AUDIO_PROVIDERS.includes(provider)
}

/**
 * A provider that plays video in a frame. `link` (Bandcamp, an article, any
 * page we cannot embed) and the audio players are not: a video gallery
 * leaves them out rather than show a card with nothing to play.
 */
export function isVideoProvider(provider: EmbedProviderName): boolean {
  return provider !== 'link' && !isAudioProvider(provider)
}

/**
 * The player URL, or null when the provider has none or the URL named no
 * single video — the caller links out instead of framing a broken src.
 */
export function embedSrc(provider: EmbedProviderName, embedId: string | null): string | null {
  const build = SRC[provider]
  return embedId && build ? build(embedId) : null
}
