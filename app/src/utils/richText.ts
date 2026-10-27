/**
 * Helpers for RichEditor's input and output.
 *
 * Mirrors web/src/lib/richText.ts on purpose rather than sharing it: the
 * public site must render plain text it will never see an editor for, and the
 * admin must load it into one — the two only need to agree that a blank line
 * is a paragraph and a single newline a <br>.
 */

const TAG = /<\/?(?:p|br|ul|ol|li|h[1-6]|blockquote|strong|b|em|i|a|div|span|code|pre|hr)\b[^>]*>/i

const escape = (v: string): string =>
  v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/**
 * A stored value as HTML Tiptap can load. Editor output passes through; plain
 * text from a former <textarea> becomes paragraphs, so its line breaks survive
 * the first save instead of collapsing into one run-on paragraph.
 */
export function toEditorHtml(value: string | null | undefined): string {
  if (!value || !value.trim()) return ''
  if (TAG.test(value)) return value
  return value
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/**
 * What the link bar's input means. Blank removes the link; a bare domain gets
 * https:// (typing "band.pl" should not produce a link relative to the admin).
 * Anything with a scheme or an in-site path is kept as typed — Tiptap's own
 * protocol check still refuses `javascript:` and the like.
 */
export function normaliseLinkHref(input: string): string {
  const href = input.trim()
  if (!href) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('/') || href.startsWith('#')) return href
  return `https://${href}`
}
