/**
 * Which of a profile's bio lengths actually holds text.
 *
 * `bio_long` and `bio_full` are RichEditor (Tiptap) output, and an editor the
 * band opened and left blank saves `<p></p>` — a non-empty string that reads
 * as "written" to a truthy check and renders as an empty column. The About
 * page's fallback chain, the EPK's long-bio pick and the Contact page's
 * "show the bio" gate all tripped over it the same way. Blank means no text
 * once tags, comments and whitespace entities are gone, whichever editor
 * produced the value.
 */

/** Visible text of an HTML (or plain) string: tags and comments removed, whitespace entities collapsed. */
export function stripHtmlText(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|ensp|emsp|thinsp|#160|#xa0|#x2002|#x2003|#x2009);/gi, ' ') // token-lint-ignore: HTML entities, not colours
    .replace(/\s+/g, ' ')
    .trim()
}

export function hasBioText(value: string | null | undefined): boolean {
  return !!value && stripHtmlText(value) !== ''
}

/** The first candidate, in order, that holds text — or null when none does. */
export function firstBioWithText(candidates: readonly (string | null | undefined)[]): string | null {
  return candidates.find(hasBioText) ?? null
}
