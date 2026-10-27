import type { QueryClient, QueryKey } from '@tanstack/vue-query'

/**
 * After a create: put the new row into the cached list at once, then ask for
 * a refetch without waiting for it.
 *
 * The append is what lets a picker (a venue select, a tag checkbox, a post's
 * reference block) show and select the row the moment the create resolves,
 * before any refetch lands — and keeps it selectable when that refetch is
 * the thing that is failing. The refetch is deliberately not awaited: a
 * mutation's `mutateAsync` resolves only after `onSuccess`, so returning
 * the invalidate promise would hold "Saving…" through every retry.
 *
 * `invalidateKey` is for a list cached per language (`['releases', lang]`),
 * where the row goes into the current language's list but every language's
 * list is stale.
 */
export function appendToList<T>(
  qc: QueryClient,
  key: QueryKey,
  row: T,
  invalidateKey: QueryKey = key,
): void {
  qc.setQueryData<T[]>(key, (old) => [...(old ?? []), row])
  void qc.invalidateQueries({ queryKey: invalidateKey })
}
