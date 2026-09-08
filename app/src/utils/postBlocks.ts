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
