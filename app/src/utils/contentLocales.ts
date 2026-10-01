import { isLocale, LOCALES, type Lang } from '@/locales'

/**
 * Coerce whatever the API (or a stale cache) holds into a full permutation of
 * the registry — the admin mirror of `ContentLocales::normalise()` in the API.
 *
 * Unknown codes are dropped and registered-but-unmentioned ones are appended in
 * registry order, so a language added after the band saved their order still
 * gets an input in every form. Never returns a list missing a registered
 * locale: a form built from it would silently have no field for that language.
 *
 * A util rather than part of the composable so vitest's node environment can
 * import it without the `localStorage` that `useAuth` reads at module load.
 */
export function normaliseContentOrder(stored: unknown): Lang[] {
  const kept = Array.isArray(stored) ? [...new Set(stored.filter(isLocale))] : []
  return [...kept, ...LOCALES.filter(l => !kept.includes(l))]
}

/** Move one locale a step towards the front (-1) or back (+1). Returns a new list. */
export function moveLocale(order: readonly Lang[], locale: Lang, step: -1 | 1): Lang[] {
  const from = order.indexOf(locale)
  const to = from + step
  if (from === -1 || to < 0 || to >= order.length) return [...order]

  const next = [...order]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}
