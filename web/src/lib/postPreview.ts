import type { Post } from '@/types/post'

/** The path segment every draft preview is baked under: /{lang}/post-preview/{token}/. */
export const PREVIEW_SEGMENT = 'post-preview'

/** A token as the API mints it (Str::random(40)). Anything else is not built. */
const TOKEN = /^[A-Za-z0-9]{20,48}$/

/**
 * The drafts worth a preview page: each carries a well-formed token, and is
 * still a draft. The token becomes a path segment, so a malformed one (or a
 * missing one, from an API without the column) is dropped, never built.
 */
export function previewableDrafts(posts: readonly Post[]): Post[] {
  return posts.filter(p => !p.published_at && typeof p.preview_token === 'string' && TOKEN.test(p.preview_token))
}

export function previewPath(lang: string, token: string): string {
  return `/${lang}/${PREVIEW_SEGMENT}/${token}/`
}
