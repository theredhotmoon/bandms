import type { Lang } from '@/locales'

/**
 * A stored translation bag. Derived from the locale registry, so a new language
 * becomes a key here with no edit — it used to be a literal `{ en?, pl? }`,
 * copied inline into a dozen types.
 */
export type TranslationMap = Partial<Record<Lang, string | null>>
