/**
 * Long-form text from the admin, as HTML ready for `set:html`.
 *
 * Two editors write these fields. RichEditor (Tiptap) stores HTML; a plain
 * <textarea> stores text whose line breaks are the formatting. Handing the
 * second to `set:html` collapsed every newline into one run-on paragraph,
 * which is how news text blocks written before the block editor gained a
 * rich editor still render — so plain text is converted, never passed raw.
 *
 * Only for admin-authored fields. Member bios are written by the `member`
 * role and are never rendered as markup — see bioParagraphs() in ./bio.
 */

import { hasBioText } from './bio'

const TAG = /<\/?(?:p|br|ul|ol|li|h[1-6]|blockquote|strong|b|em|i|a|div|span|code|pre|hr)\b[^>]*>/i

/** True when the value carries markup an editor would produce. */
export function looksLikeHtml(value: string): boolean {
  return TAG.test(value)
}

const escape = (v: string): string =>
  v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/** Plain text as paragraphs: a blank line starts one, a single newline is a <br>. */
export function plainTextHtml(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function richTextHtml(value: string | null | undefined): string {
  // hasBioText, not a truthy check: a cleared RichEditor saves `<p></p>`,
  // which would render as an empty, margined block — a gap in the article.
  if (!hasBioText(value)) return ''
  return looksLikeHtml(value!) ? value! : plainTextHtml(value!)
}
