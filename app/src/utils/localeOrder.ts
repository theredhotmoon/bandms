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

/** Anything carrying a tag's name: a full Tag, or one embedded in another
 *  resource. A hand-built embed (press releases) has no translations. */
export interface TagNameSource {
  name: string
  translations?: { name?: Partial<Record<Lang, string | null>> | null }
}

/**
 * A tag's name as every admin surface shows it: in the band's first content
 * language, the language TagForm leads with. The API's `name` is resolved for
 * the request language, so on a Polish-first band it was English, and a tag
 * renamed in Polish kept its old name in every picker and pill.
 */
export function tagLabel(tag: TagNameSource, order: readonly Lang[]): string {
  return firstInOrder(tag.translations?.name, order) ?? tag.name
}
