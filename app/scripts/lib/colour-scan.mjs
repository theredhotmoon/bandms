/**
 * What counts as a hardcoded colour in admin styles — shared by
 * check-admin-colours.mjs and its spec.
 *
 * Every admin colour is meant to be a `var(--c-…)` from src/admin-palette.css,
 * which is what lets the light theme redefine it. A literal renders correctly
 * in the dark theme everyone develops in and silently ignores the switch, so
 * nothing but a scan notices.
 *
 * A scanner, not a CSS parser. It reads:
 *   - .css files, and <style> blocks in .vue files: declaration values only,
 *     so a selector like `#app` is never mistaken for a colour;
 *   - style="…" / :style="…" attributes in the template;
 *   - Tailwind arbitrary colours in class lists (`bg-[#141414]`).
 * Comments are skipped. <script> is not read — brand colours and data
 * palettes live there on purpose (see app/CLAUDE.md).
 */

export const IGNORE_MARKER = 'token-lint-ignore'

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g
const FUNC = /\b(?:rgba?|hsla?)\(([^)]*)\)/g
const NAMED = /(?<![\w-])(?:white|black)(?![\w-])/g
const COLOUR_PROPS = /(?:^|[;{\s])(color|background(?:-color)?|border(?:-[a-z]+)*-color|border(?:-(?:top|right|bottom|left))?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration-color)\s*:\s*([^;}]*)/g
/**
 * `text-[#fff]` is the documented way to keep a label white on a saturated
 * button — `text-white` follows the theme and turns near-black. It is allowed
 * without a marker because a marker cannot go inside a Vue tag's class list
 * without breaking the tag, and the class says exactly what it means.
 */
const PINNED_WHITE = /^(?:[a-z]+:)*text-\[#fff(?:fff)?\]$/
const TW_ARBITRARY = /(?<![\w-])(?:[a-z]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|placeholder|accent|caret|shadow)-\[([^\]]+)\]/g

/** rgba(0,0,0,a) is a shadow or a scrim — the same in either theme. */
function isBlackFunc(args) {
  const [r, g, b] = args.split(/[\s,/]+/).filter(Boolean)
  return [r, g, b].every((v) => Number(v) === 0)
}

/** Colour literals in one CSS value or declaration list. */
export function literalsIn(css) {
  const hits = []
  for (const m of css.matchAll(HEX)) hits.push(m[0])
  for (const m of css.matchAll(FUNC)) if (!isBlackFunc(m[1])) hits.push(m[0])
  // Named colours only where they are a colour value — `white-space: nowrap`
  // and `font: … black` must not count.
  for (const m of css.matchAll(COLOUR_PROPS)) {
    for (const n of m[2].matchAll(NAMED)) hits.push(`${m[1]}: ${n[0]}`)
  }
  return hits
}

function stripComments(line, state) {
  let out = ''
  let i = 0
  while (i < line.length) {
    if (state.inComment) {
      const end = line.indexOf('*/', i)
      if (end === -1) return out
      state.inComment = false
      i = end + 2
    } else {
      const start = line.indexOf('/*', i)
      const html = line.indexOf('<!--', i)
      if (start === -1 && html === -1) return out + line.slice(i)
      if (html !== -1 && (start === -1 || html < start)) {
        out += line.slice(i, html)
        const end = line.indexOf('-->', html)
        if (end === -1) return out
        i = end + 3
      } else {
        out += line.slice(i, start)
        state.inComment = true
        i = start + 2
      }
    }
  }
  return out
}

/** The part of a CSS line that is a declaration, not a selector. */
function declarationPart(line) {
  const brace = line.lastIndexOf('{')
  if (brace !== -1) return line.slice(brace + 1)
  // A selector line (`.a:hover,` / `.b {` handled above) has no declaration.
  return /^\s*[^:]*[,{]?\s*$/.test(line) || /,\s*$/.test(line) ? '' : line
}

/**
 * Scan one file's source. `kind` is 'css' or 'vue'.
 * Returns [{ line, hits }] with 1-based line numbers.
 */
export function colourHits(source, kind) {
  const out = []
  const lines = source.split(/\r?\n/)
  let region = kind === 'css' ? 'style' : 'none'
  const state = { inComment: false }

  lines.forEach((raw, idx) => {
    let line = raw
    if (kind === 'vue') {
      if (/<style\b/.test(line)) { region = 'style'; line = line.replace(/^.*?<style[^>]*>/, '') }
      else if (/<template\b/.test(line) && region === 'none') region = 'template'
      else if (/<script\b/.test(line)) region = 'script'
      if (/<\/style>/.test(line)) { line = line.replace(/<\/style>.*$/, ''); if (region === 'style') region = 'end-style' }
      if (/<\/script>/.test(line) && region === 'script') { region = 'none'; return }
    }
    if (raw.includes(IGNORE_MARKER)) { if (region === 'end-style') region = 'none'; return }

    let hits = []
    if (region === 'style' || region === 'end-style') {
      hits = literalsIn(declarationPart(stripComments(line, state)))
      if (region === 'end-style') region = 'none'
    } else if (region === 'template') {
      const text = stripComments(line, state)
      for (const m of text.matchAll(/(?:^|\s):?style="([^"]*)"/g)) hits.push(...literalsIn(m[1]))
      for (const m of text.matchAll(TW_ARBITRARY)) {
        if (PINNED_WHITE.test(m[0])) continue
        if (literalsIn(m[1]).length) hits.push(m[0])
      }
    }
    if (hits.length) out.push({ line: idx + 1, hits: [...new Set(hits)] })
  })
  return out
}
