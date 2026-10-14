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
  slug?: string
  translations?: {
    name?: Partial<Record<Lang, string | null>> | null
    slug?: Partial<Record<Lang, string | null>> | null
  } | null
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

/**
 * Every language of a tag's name and slug, lowercased, for search. A tag is
 * findable by any spelling: a Polish-first band still types "live". An embed
 * without translations falls back to its resolved name and slug, so a
 * partial tag in the cache narrows the search instead of throwing.
 */
export function tagTerms(tag: TagNameSource): string[] {
  const values = [
    ...Object.values(tag.translations?.name ?? {}),
    ...Object.values(tag.translations?.slug ?? {}),
    tag.name,
    tag.slug,
  ]
  return [...new Set(values.filter((v): v is string => !!v).map(v => v.toLowerCase()))]
}

/**
 * Every language of a tag's NAME, lowercased: for lists that search other
 * records by their tags (posts, press releases). Unlike `tagTerms` it skips
 * slugs, so a row never matches on text its tag pills do not show.
 */
export function tagNames(tag: TagNameSource): string[] {
  const values = [...Object.values(tag.translations?.name ?? {}), tag.name]
  return [...new Set(values.filter((v): v is string => !!v).map(v => v.toLowerCase()))]
}

/**
 * Tags in the order a person reads them: by the name they are shown under,
 * compared in the band's first language. The API sorts by the request
 * language's name, so once pickers showed Polish names they came out in
 * English alphabetical order — unsorted to the reader.
 */
export function sortTagsByLabel<T extends TagNameSource>(tags: readonly T[], order: readonly Lang[]): T[] {
  return [...tags].sort((a, b) => tagLabel(a, order).localeCompare(tagLabel(b, order), order[0]))
}
