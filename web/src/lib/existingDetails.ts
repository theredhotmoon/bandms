/**
 * Fetch each listed item's detail record, at most `limit` at a time, and keep
 * only the items whose record still exists.
 *
 * The detail route lists records in getStaticPaths and renders their pages
 * later. A record deleted in between (an admin's delete, a parallel E2E
 * spec's cleanup) used to be fetched by its page, which 404'd, and the
 * all-or-nothing build failed every page on the site ("CMS 404: /posts/722").
 * Fetching the detail here, and building from what comes back, makes the
 * path and the page read one answer, the way getMembers() already does for
 * member pages. A record that is gone is simply not built, which is what the
 * next rebuild would do anyway.
 *
 * `fetchDetail` resolves null for a record that is gone (the cms `find*`
 * fetchers) and throws for anything else, which still fails the build: an
 * API that is down must not quietly publish an empty site. A dropped record
 * is logged by `label`, so a list and a detail endpoint that disagree for
 * good (a scope on one side only) show up in the build log rather than as a
 * page that silently never exists.
 *
 * The pool matters. getStaticPaths would otherwise fire every detail request
 * at once (each concert, post, release and item, times each locale) into
 * php-fpm's 20 workers. Pages render one at a time, so this is no slower
 * than fetching from the page was.
 */
export async function existingDetails<T, D>(
  items: readonly T[],
  fetchDetail: (item: T) => Promise<D | null>,
  { label, limit = 4 }: { label: (item: T) => string; limit?: number },
): Promise<{ item: T; detail: D }[]> {
  const found: ({ item: T; detail: D } | null)[] = new Array(items.length).fill(null)
  let next = 0
  // Once one fetch throws the build has failed; stop the other workers
  // rather than keep loading a backend that is already in trouble.
  let failed = false

  async function worker(): Promise<void> {
    while (!failed && next < items.length) {
      const i = next++
      try {
        const detail = await fetchDetail(items[i])
        if (detail !== null) found[i] = { item: items[i], detail }
        else console.warn(`[build] ${label(items[i])} is listed but gone; not building its page`)
      } catch (e) {
        failed = true
        throw e
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  // Listing order, whatever order the fetches finished in.
  return found.filter((x): x is { item: T; detail: D } => x !== null)
}

/**
 * One item's detail in every locale, or null when any locale's is gone.
 *
 * An item is built in all of its locales or in none: built in one only, its
 * page would carry an hreflang alternate and a language-switcher link to a
 * twin that was never built.
 */
export async function inEveryLocale<L extends string, D>(
  locales: readonly L[],
  fetchDetail: (locale: L) => Promise<D | null>,
): Promise<Record<L, D> | null> {
  const details = await Promise.all(locales.map(fetchDetail))
  if (details.some((d) => d === null)) return null
  return Object.fromEntries(locales.map((l, i) => [l, details[i]])) as Record<L, D>
}
