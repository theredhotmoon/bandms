/**
 * What counts as a hardcoded colour in admin styles — shared by
 * check-admin-colours.mjs and its spec.
 *
 * Every admin colour is meant to be a `var(--c-…)` from src/admin-palette.css,
 * which is what lets the light theme redefine it. A literal renders correctly
 * in the dark theme everyone develops in and silently ignores the switch, so
 * nothing but a scan notices.
 *
 * A scanner, not a CSS parser, but it works on whole blocks rather than lines:
 * CSS comments, HTML comments and CSS values all span lines, and the first,
 * line-by-line version got each of those wrong (#158's review). It reads:
 *   - .css files, and <style> blocks in .vue files: the inside of `{ … }`
 *     declaration bodies only, so a selector like `#app` is never a colour;
 *   - style="…" / :style="…" attributes in the template;
 *   - Tailwind arbitrary colours in the template (`bg-[#141414]`).
 * Comments are blanked first — `/* *\/` inside styles only, `<!-- -->` inside
 * the template only, because `accept="image/*"` is not a comment. <script>
 * is never read: brand colours and data palettes live there on purpose.
 *
 * Blanking replaces characters with spaces and keeps newlines, so every
 * offset — and therefore every reported line number — stays true.
 */

export const IGNORE_MARKER = 'token-lint-ignore'

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g
const FUNC = /\b(?:rgba?|hsla?)\(([^)]*)\)/g
const NAMED = /(?<![\w-])(?:white|black)(?![\w-])/g
const COLOUR_PROPS = /(?<![\w-])(color|background(?:-color)?|border(?:-[a-z]+)*-color|border(?:-(?:top|right|bottom|left))?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration-color)\s*:([^;}]*)/dg
const TW_ARBITRARY = /(?<![\w-])(?:[a-z]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|placeholder|accent|caret|shadow)-\[([^\]\s]+)\]/g

/**
 * `text-[#fff]` is the documented way to keep a label white on a saturated
 * button — `text-white` follows the theme and turns near-black. It is allowed
 * without a marker because a marker cannot go inside a Vue tag's class list
 * without breaking the tag, and the class says exactly what it means.
 */
const PINNED_WHITE = /^(?:[a-z]+:)*text-\[#fff(?:fff)?\]$/

/** Replace every character but newlines with a space, so offsets and line numbers hold. */
export const blank = (s) => s.replace(/[^\n]/g, ' ')

/** CSS with its comments blanked. One definition for every style guard. */
export const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, blank)

/** rgba(0,0,0,a) is a shadow or a scrim — the same in either theme. */
function isBlackFunc(args) {
  const [r, g, b] = args.split(/[\s,/]+/).filter(Boolean)
  return [r, g, b].every((v) => Number(v) === 0)
}

/** Colour literals in a run of CSS, with their offsets into it. */
function literalsAt(css) {
  const out = []
  for (const m of css.matchAll(HEX)) out.push({ index: m.index, hit: m[0] })
  for (const m of css.matchAll(FUNC)) if (!isBlackFunc(m[1])) out.push({ index: m.index, hit: m[0] })
  // Named colours only where they are a colour value — `white-space: nowrap`
  // and `font-weight: black` must not count.
  for (const m of css.matchAll(COLOUR_PROPS)) {
    const valueStart = m.indices[2][0]
    for (const n of m[2].matchAll(NAMED)) out.push({ index: valueStart + n.index, hit: `${m[1]}: ${n[0]}` })
  }
  return out
}

/** Colour literals in one CSS value or declaration list. */
export function literalsIn(css) {
  return literalsAt(css).map((l) => l.hit)
}

/** Scan stylesheet text that starts at `base` in the file. */
function scanCss(text, base, found) {
  const clean = stripCssComments(text)
  // Innermost braces are declaration bodies: a rule inside @media nests one
  // level deeper, and a selector is never between braces.
  for (const m of clean.matchAll(/\{([^{}]*)\}/g)) {
    for (const l of literalsAt(m[1])) found.push({ index: base + m.index + 1 + l.index, hit: l.hit })
  }
}

/** Scan template text (the file with <script> and <style> already blanked). */
function scanTemplate(text, found) {
  const clean = text.replace(/<!--[\s\S]*?-->/g, blank)
  for (const m of clean.matchAll(/(?<=\s):?style="([^"]*)"/dg)) {
    for (const l of literalsAt(m[1])) found.push({ index: m.indices[1][0] + l.index, hit: l.hit })
  }
  for (const m of clean.matchAll(TW_ARBITRARY)) {
    if (PINNED_WHITE.test(m[0])) continue
    if (literalsIn(m[1]).length) found.push({ index: m.index, hit: m[0] })
  }
}

// The opening tag must not end in `/>`: a self-closing `<style src="…" />`
// has no body, and matching it would swallow everything up to the next
// </style> — including the real block's opening tag.
const STYLE_BLOCK = /(<style\b(?:[^>/]|\/(?!>))*>)([\s\S]*?)<\/style>/g
const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script>/g
const HTML_COMMENT = /<!--[\s\S]*?-->/g

/**
 * The stylesheet text in one file: the whole of a .css file, or each <style>
 * block of a .vue file, as [{ css, base }] where `base` is the offset of
 * `css` within `source` — so a scanner can map a hit back to a line number.
 * A <style> inside an HTML comment is commented-out code, not a stylesheet.
 * <script> is blanked before the comments are, so a `'<!--'` string literal
 * in script cannot open a "comment" that swallows the real style blocks.
 * Shared with radius-scan.mjs so there is one answer to "where is the CSS".
 */
export function styleRuns(source, kind) {
  if (kind === 'css') return [{ css: source, base: 0 }]
  const live = source.replace(SCRIPT_BLOCK, blank).replace(HTML_COMMENT, blank)
  return [...live.matchAll(STYLE_BLOCK)].map((m) => ({ css: m[2], base: m.index + m[1].length }))
}

/** The <script> blocks of a .vue file, as [{ text, base }] with `base` the offset of `text` in `source`. */
export function scriptBlocks(source) {
  return [...source.matchAll(SCRIPT_BLOCK)].map((m) => ({ text: m[0], base: m.index }))
}

/**
 * A .vue file's template alone, offsets preserved: <script> and <style>
 * blocks and HTML comments blanked — the scripts first, so a `'<!--'` string
 * in one cannot open a comment that swallows the template. One definition
 * for every guard that reads class lists or attributes.
 */
export const templateText = (source) => source.replace(SCRIPT_BLOCK, blank).replace(STYLE_BLOCK, blank).replace(HTML_COMMENT, blank)

/**
 * Scan one file's source. `kind` is 'css' or 'vue'.
 * Returns [{ line, hits }] with 1-based line numbers, in line order.
 */
export function colourHits(source, kind) {
  const found = []
  for (const { css, base } of styleRuns(source, kind)) scanCss(css, base, found)
  if (kind === 'vue') scanTemplate(templateText(source), found)

  const lines = source.split('\n')
  const byLine = new Map()
  for (const { index, hit } of found.sort((a, b) => a.index - b.index)) {
    const line = source.slice(0, index).split('\n').length
    if (lines[line - 1].includes(IGNORE_MARKER)) continue
    if (!byLine.has(line)) byLine.set(line, [])
    if (!byLine.get(line).includes(hit)) byLine.get(line).push(hit)
  }
  return [...byLine.entries()].sort((a, b) => a[0] - b[0]).map(([line, hits]) => ({ line, hits }))
}
