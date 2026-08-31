// Locale and its translation-bag shape are derived from the locale registry, so
// adding a language is one entry in web/src/lib/locales.ts rather than an edit
// here plus a grep for 'pl'.
export type { Locale, TranslationBag } from '@/lib/locales'

import type { TranslationBag } from '@/lib/locales'

/** @deprecated prefer TranslationBag — kept so existing imports keep compiling. */
export type TranslationMap = TranslationBag
