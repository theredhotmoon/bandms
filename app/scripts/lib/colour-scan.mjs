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

const blank = (s) => s.replace(/[^\n]/g, ' ')

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
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, blank)
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

const STYLE_BLOCK = /(<style\b[^>]*>)([\s\S]*?)<\/style>/g
const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script>/g

/**
 * Scan one file's source. `kind` is 'css' or 'vue'.
 * Returns [{ line, hits }] with 1-based line numbers, in line order.
 */
export function colourHits(source, kind) {
  const found = []
  if (kind === 'css') {
    scanCss(source, 0, found)
  } else {
    for (const m of source.matchAll(STYLE_BLOCK)) scanCss(m[2], m.index + m[1].length, found)
    scanTemplate(source.replace(SCRIPT_BLOCK, blank).replace(STYLE_BLOCK, blank), found)
  }

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
