import type { PostBlockType, EmbedProviderName, PostBlockDraft } from '@/types/post'

/**
 * Lives in utils/, not a composable, so vitest can import it: the admin's test
 * environment is `node`, and any composable that reaches useAuth dies reading
 * localStorage at module load.
 */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return [...list]
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list]

  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function defaultPayload(type: PostBlockType): PostBlockDraft['payload'] {
  switch (type) {
    case 'text':  return { body: { en: '', pl: '' } }
    case 'image': return { path: '', alt: { en: '', pl: '' }, caption: { en: '', pl: '' } }
    case 'embed': return { url: '', label: null }
    case 'ref':   return { entity: 'concert', id: 0 }
  }
}

const PROVIDER_LABELS: Record<EmbedProviderName, string> = {
  youtube: 'YouTube', vimeo: 'Vimeo', instagram: 'Instagram', tiktok: 'TikTok', link: 'Link',
}

export function providerLabel(p: EmbedProviderName): string {
  return PROVIDER_LABELS[p] ?? 'Link'
}

/** Host suffix => provider. Must mirror api/app/Support/EmbedProvider.php's HOSTS exactly. */
const PROVIDER_HOSTS: Record<string, EmbedProviderName> = {
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'vimeo.com': 'vimeo',
  'instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
}

/**
 * Preview only — the server re-detects and stores the provider on save, this
 * never gets sent. Matches by parsed hostname (suffix match, exact or after a
 * leading "."), the same as EmbedProvider::detect() on the backend.
 *
 * A naive substring check (does the whole URL string contain "youtube.com"?)
 * disagrees with that: a URL like https://example.com/?ref=youtube.com has
 * 'youtube.com' as a substring while example.com is the actual host, so a
 * whole-string match would badge it YouTube while the server correctly
 * stores 'link' — silently hiding the label field the admin needed.
 */
export function detectProvider(url: string): EmbedProviderName {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'link'
  }
  if (!host) return 'link'

  for (const [suffix, provider] of Object.entries(PROVIDER_HOSTS)) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return provider
  }
  return 'link'
}
