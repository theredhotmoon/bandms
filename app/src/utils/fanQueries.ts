import type { QueryClient } from '@tanstack/vue-query'

type FanList = 'tickets' | 'orders'

/**
 * The query for one of a fan's lists. Keyed by the fan id — never the token,
 * which the devtools would show — so one fan's tickets are never served to
 * another. The token is taken when the query is built, not when it runs: a
 * retry after another fan signed in must still ask as the fan in the key.
 */
export function fanListQuery<T>(
  list: FanList,
  token: string | null,
  fan: { id: number } | null,
  fetcher: (token: string) => Promise<T>,
) {
  return {
    queryKey: ['fan', fan?.id ?? null, list],
    queryFn: () => fetcher(token ?? ''),
    enabled: token !== null && fan !== null,
  }
}

/**
 * Forgets every fan list, and the requests on their way, when another session
 * begins. The same fan's too: a lapsed session's request would otherwise be
 * joined, and its 401 shown under the new session.
 */
export function dropFanLists(client: QueryClient | null): void {
  client?.removeQueries({ queryKey: ['fan'] })
}
