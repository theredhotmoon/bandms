/**
 * Which answer to "list the comments" may be shown.
 *
 * Two loads can overlap (the page's own and the one after a sign-in), and a
 * list can land after a sign-out or after a comment was posted or deleted
 * here. Only the newest load applies; an answer that is older than the session
 * or than a local change is asked for again rather than shown.
 */
import type { CommentsResponse, PostComment } from './comments'

interface ListHost {
  token: () => string | null
  fetch: (token: string | null) => Promise<CommentsResponse>
  apply: (res: CommentsResponse) => void
  /** The newest load is over, whether it answered or failed. */
  settled: () => void
}

export function commentListLoader(host: ListHost) {
  let newest = 0
  let changes = 0

  async function load(): Promise<void> {
    const id = ++newest
    try {
      for (;;) {
        const asked = host.token()
        const seen = changes
        const res = await host.fetch(asked)
        if (id !== newest) return
        if (host.token() === asked && changes === seen) {
          host.apply(res)
          return
        }
      }
    } catch {
      // The list failing must not take the article down; show the form anyway.
    } finally {
      if (id === newest) host.settled()
    }
  }

  /** A comment was posted, deleted or renamed here: a list in flight predates it. */
  function changed(): void {
    changes++
  }

  return { load, changed }
}

/** The list with a comment just posted; one a list already holds is not repeated. */
export function withComment(comments: PostComment[], created: PostComment): PostComment[] {
  return [...comments.filter((c) => c.id !== created.id), created]
}
