import { computed, ref, toValue, watch, type ComputedRef, type MaybeRefOrGetter, type WatchSource } from 'vue'

const batchOf = (perPage: number | null | undefined): number => (perPage && perPage > 0 ? perPage : Infinity)

/**
 * Attributes for item `index` of a static list paged by ShowMore.astro: an
 * item past the first batch is marked, and the button reveals it later.
 */
export function pagedAttrs(index: number, perPage: number | null | undefined): Record<string, string> {
  return index >= batchOf(perPage) ? { 'data-more-hidden': '' } : {}
}

/**
 * Items per page for a Vue island.
 *
 * Every item is still rendered — the caller binds
 * `:data-more-hidden="heldBack(i)"` — so the baked HTML keeps a link to each
 * one, and a visitor without JS, who could never run the button, sees them
 * all (the hiding rule in base.css hangs off html.js). "Pages" are batches revealed in place: the site is static,
 * so there is no next page to load.
 *
 * `perPage` null, absent or non-positive ("Default" in the admin) shows
 * everything. A change to any `resetOn` source (a filter, a search) starts
 * again from the first batch.
 */
export function useShowMore<T>(
  items: () => readonly T[],
  perPage: MaybeRefOrGetter<number | null | undefined>,
  resetOn: WatchSource[] = [],
): { heldBack: (index: number) => '' | undefined; hasMore: ComputedRef<boolean>; showMore: () => void } {
  const batch = computed(() => batchOf(toValue(perPage)))
  const limit = ref(batch.value)
  watch([batch, ...resetOn], () => { limit.value = batch.value })

  return {
    // '' sets the attribute, undefined removes it.
    heldBack: index => (index < limit.value ? undefined : ''),
    hasMore: computed(() => items().length > limit.value),
    showMore: () => { limit.value += batch.value },
  }
}
