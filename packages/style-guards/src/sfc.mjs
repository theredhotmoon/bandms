/**
 * Where the CSS, the script and the template are in a single-file component
 * (.vue, and .astro for its <style> blocks) — one answer for every guard that
 * reads one, so no two of them disagree about what a stylesheet is.
 */
import { blank } from './css-walk.mjs'

// The opening tag must not end in `/>`: a self-closing `<style src="…" />`
// has no body, and matching it would swallow everything up to the next
// </style> — including the real block's opening tag.
const STYLE_BLOCK = /(<style\b(?:[^>/]|\/(?!>))*>)([\s\S]*?)<\/style>/g
const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script>/g
const HTML_COMMENT = /<!--[\s\S]*?-->/g

/**
 * The stylesheet text in one file: the whole of a .css file, or each <style>
 * block of a component, as [{ css, base }] where `base` is the offset of
 * `css` within `source` — so a scanner can map a hit back to a line number.
 * A <style> inside an HTML comment is commented-out code, not a stylesheet.
 * <script> is blanked before the comments are, so a `'<!--'` string literal
 * in script cannot open a "comment" that swallows the real style blocks.
 */
export function styleRuns(source, kind) {
  if (kind === 'css') return [{ css: source, base: 0 }]
  const live = source.replace(SCRIPT_BLOCK, blank).replace(HTML_COMMENT, blank)
  return [...live.matchAll(STYLE_BLOCK)].map((m) => ({ css: m[2], base: m.index + m[1].length }))
}

/** The <script> blocks of a component, as [{ text, base }] with `base` the offset of `text` in `source`. */
export function scriptBlocks(source) {
  return [...source.matchAll(SCRIPT_BLOCK)].map((m) => ({ text: m[0], base: m.index }))
}

/**
 * A component's template alone, offsets preserved: <script> and <style>
 * blocks and HTML comments blanked — the scripts first, so a `'<!--'` string
 * in one cannot open a comment that swallows the template.
 */
export const templateText = (source) => source.replace(SCRIPT_BLOCK, blank).replace(STYLE_BLOCK, blank).replace(HTML_COMMENT, blank)
