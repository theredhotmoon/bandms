import type { Lang } from '@/locales'

/**
 * The value in the band's first content language that has one, walking
 * `order` (from `useContentLocales()`). Lists use it so a row reads in the
 * language the band writes in, not in the site's default locale: on a
 * Polish-first band, a tag renamed in Polish must show the new name.
 *
 * Returns null when every language is blank, so the caller picks the
 * placeholder.
 */
export function firstInOrder(
  bag: Partial<Record<Lang, string | null>> | null | undefined,
  order: readonly Lang[],
): string | null {
  for (const l of order) {
    const v = bag?.[l]?.trim()
    if (v) return v
  }
  return null
}
