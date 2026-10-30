import type { Lang, TranslationBag } from '@/locales'
import type { TranslateFormat, TranslateItem } from '@/types/assistant'
import { isFilled, sourceFor } from './translationSource'

/** Locales of a bag with nothing in them, in content order. */
export function emptyTargets(bag: TranslationBag, order: readonly Lang[]): Lang[] {
  return order.filter(l => !isFilled(bag[l]))
}

/** The key one planned item travels under: `<field>.<targetLocale>`. */
export function fillKey(field: string, target: Lang): string {
  return `${field}.${target}`
}

/**
 * What "Translate empty fields" sends: one item per empty locale of every
 * field that has a source to read from. A field with nothing filled in any
 * locale plans nothing — there is nothing to translate.
 */
export function planFill(
  fields: Record<string, TranslationBag>,
  order: readonly Lang[],
  formats: Record<string, TranslateFormat>,
): TranslateItem[] {
  const items: TranslateItem[] = []
  for (const [field, bag] of Object.entries(fields)) {
    for (const target of emptyTargets(bag, order)) {
      const source = sourceFor(bag, target, order)
      if (source === null) continue
      items.push({ key: fillKey(field, target), text: bag[source], format: formats[field] ?? 'text', source, target })
    }
  }
  return items
}

/**
 * Merge translated items back — but only into a locale that is STILL empty.
 * The band may have typed into a row while the request was in flight, and a
 * fill must never overwrite what they wrote. Returns new bags; the input is
 * left alone.
 */
export function applyFill(
  fields: Record<string, TranslationBag>,
  translated: Record<string, string>,
): Record<string, TranslationBag> {
  const out: Record<string, TranslationBag> = {}
  for (const [field, bag] of Object.entries(fields)) {
    const next = { ...bag }
    for (const l of Object.keys(bag) as Lang[]) {
      const text = translated[fillKey(field, l)]
      if (text !== undefined && !isFilled(next[l])) next[l] = text
    }
    out[field] = next
  }
  return out
}
