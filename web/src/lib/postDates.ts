import type { Post } from '@/types/post'

export interface PostDates {
  /** YYYY-MM-DD */
  published: string
  /** YYYY-MM-DD, only when the article changed on a later day than it came out. */
  modified?: string
}

/**
 * The calendar day of an API timestamp, for `<time datetime>` and the dates
 * search engines read.
 *
 * A day, never the full timestamp: `published_at` is what the band typed,
 * stored as if it were UTC (see parseApiDate), so its time of day carries a
 * zone it never had. Sent whole, it told Google a post came out an hour or two
 * later than it did — in the future, for one just published.
 */
export function isoDay(timestamp: string): string {
  return timestamp.slice(0, 10)
}

/**
 * The dates a post is announced with. A modified day no later than the
 * published one is left out: `content_updated_at` is a real instant and the
 * published day is the band's own, so on the same day they cannot be ordered.
 */
export function postDates(post: Pick<Post, 'published_at' | 'created_at' | 'content_updated_at'>): PostDates {
  const published = isoDay(post.published_at ?? post.created_at)
  const modified = post.content_updated_at ? isoDay(post.content_updated_at) : ''
  return modified > published ? { published, modified } : { published }
}
