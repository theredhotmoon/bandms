/**
 * The News grid's batches, fetched from `GET /api/posts?limit=…`.
 *
 * Shared by the build (PostsSection bakes the first batch, `base` = the
 * internal API origin) and the island (each "Show more" and each filter
 * change, `base` = '' — the web container's nginx proxies /api like Caddy
 * does). Kept apart from cms.ts so an island bundle does not pull in the
 * build-time client.
 *
 * Batches follow a cursor — the last post shown — not a page number: a post
 * published after the site was built would otherwise shift every page by
 * one, and the visitor would see a card twice or never.
 */
import type { PostSummary } from '@/types/post'

/** The API's cap on `limit`; also the batch size while Items per page is "Default". */
export const MAX_BATCH = 50

export interface PostBatchQuery {
  lang: string
  limit: number
  /** The post on top of the page, which the grid must not repeat. */
  exclude?: number | null
  /** `meta.next_cursor` of the previous batch; none for the first. */
  cursor?: string | null
  tagId?: number | null
  search?: string
  /**
   * When the site was built (ISO). Posts created or published after it have
   * no article page yet, so the API leaves them out rather than serve a card
   * that 404s until the next rebuild.
   */
  builtAt?: string | null
}

export interface PostBatch {
  posts: PostSummary[]
  /** Null once the last batch has been served. */
  nextCursor: string | null
}

export function postBatchUrl(base: string, q: PostBatchQuery): string {
  const params = new URLSearchParams({ lang: q.lang, limit: String(Math.min(Math.max(1, q.limit), MAX_BATCH)) })
  if (q.exclude) params.set('exclude', String(q.exclude))
  if (q.cursor) params.set('cursor', q.cursor)
  if (q.tagId) params.set('tag_id', String(q.tagId))
  const search = q.search?.trim()
  if (search) params.set('search', search)
  if (q.builtAt) params.set('built_at', q.builtAt)
  return `${base.replace(/\/$/, '')}/api/posts?${params}`
}

export async function fetchPostBatch(base: string, q: PostBatchQuery, init: { signal?: AbortSignal } = {}): Promise<PostBatch> {
  const url = postBatchUrl(base, q)
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: init.signal })
  if (!res.ok) throw new Error(`CMS ${res.status}: /posts`)
  const json = (await res.json()) as { data: PostSummary[]; meta?: { next_cursor?: string | null } }
  return { posts: json.data, nextCursor: json.meta?.next_cursor ?? null }
}
