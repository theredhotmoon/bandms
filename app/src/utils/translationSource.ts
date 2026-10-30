import type { Lang, TranslationBag } from '@/locales'

/**
 * Whether a translated value has anything to translate from. Whitespace does
 * not count, and neither does the empty document Tiptap leaves behind
 * (`<p></p>`, `<p><br></p>`) — RichEditor sends '' for an empty doc, but a
 * loaded record may still carry the markup.
 */
export function isFilled(value: string | null | undefined): boolean {
  if (!value) return false
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== ''
}

/**
 * Which locale a Translate button on `target` reads from: the FIRST filled
 * locale in the band's content order that is not the target itself.
 *
 * Not "the primary". The band's backlog is the opposite shape to the one a
 * primary-only rule serves — records written in English before the order was
 * switched to Polish-first, where PL is the empty row. A primary-only rule
 * would hide the button on exactly those rows. So the primary row carries a
 * button too, whenever another locale has text.
 */
export function sourceFor(bag: TranslationBag, target: Lang, order: readonly Lang[]): Lang | null {
  return order.find(l => l !== target && isFilled(bag[l])) ?? null
}
