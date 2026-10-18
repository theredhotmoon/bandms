/**
 * Which style rules are admin cards, and what corner they set — shared by
 * check-admin-radius.mjs and its spec.
 *
 * DESIGN.md gives cards, table cards, drop zones and the modal panel a
 * 0.75rem corner. Every value on the radius scale looks deliberate in review,
 * so cards drift to the 0.5rem control corner without anyone noticing; this
 * scanner is what notices.
 *
 * A scanner, not a CSS parser, in the same shape as colour-scan.mjs. For each
 * `selector { declarations }` it decides whether the rule styles a card and,
 * if so, reads the corner the cascade actually applies:
 *
 *   - Only the LAST compound of each selector is judged. `.venue-card .map`
 *     styles the map, not the card; `.venue-card.is-open` and `.x-card:hover`
 *     still style the card. A pseudo-element (`.x-card::before`) is its own
 *     box and is never a card. In a selector list, any card member makes the
 *     rule a card rule, because the card really does take that radius.
 *   - A class is a card when it ends in `card` (`.rp-card`, not
 *     `.rp-card-thumb` or `.card-btn`) and is not a selectable option tile,
 *     or when the caller names it as a card container under another name.
 *   - The LAST `border-radius` declaration wins, as it does in CSS, and
 *     `!important` is dropped before comparing.
 *   - A value passes when every corner it names is 0.75rem or 0 and at least
 *     one is 0.75rem: `.75rem`, `12px` and `0.75rem 0.75rem 0 0` (a card with
 *     one flat edge against a sibling strip) are all the DESIGN.md corner.
 */
import { styleRuns } from './colour-scan.mjs'

export const CARD_RADIUS = '0.75rem'
const CARD_PX = 12

const blank = (s) => s.replace(/[^\n]/g, ' ')

/** Split on `sep` at paren depth 0, so `:is(.a, .b)` stays one selector. */
function splitTop(text, isSep) {
  const parts = []
  let depth = 0
  let at = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (depth === 0 && isSep(ch)) {
      parts.push(text.slice(at, i))
      at = i + 1
    }
  }
  parts.push(text.slice(at))
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** The compound a selector finally styles — after the last combinator. */
function lastCompound(selector) {
  const compounds = splitTop(selector, (ch) => /[\s>+~]/.test(ch))
  return compounds[compounds.length - 1] ?? ''
}

const PSEUDO_ELEMENT = /::|:(?:before|after)\b/

/**
 * The card class a selector (or selector list) styles, or null.
 * `optionTiles` are `*-card` classes that are really controls; `containers`
 * are card surfaces whose class does not say so. Both are Sets of class names.
 */
export function cardClassOf(selector, { optionTiles = new Set(), containers = new Set() } = {}) {
  for (const one of splitTop(selector, (ch) => ch === ',')) {
    const compound = lastCompound(one)
    if (PSEUDO_ELEMENT.test(compound)) continue
    const classes = [...compound.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1])
    const card = classes.find((c) => (/(^|-)card$/.test(c) && !optionTiles.has(c)) || containers.has(c))
    if (card) return card
  }
  return null
}

/** One length as CSS pixels, or NaN for anything that is not a plain length. */
function px(token) {
  const m = token.match(/^(\d*\.?\d+)(rem|em|px)?$/)
  if (!m) return NaN
  const n = Number(m[1])
  if (!m[2]) return n === 0 ? 0 : NaN
  return m[2] === 'px' ? n : n * 16
}

/** Whether a `border-radius` value is the card corner. */
export function isCardRadius(value) {
  const tokens = value
    .replace(/!important/g, '')
    .split('/')
    .flatMap((side) => side.trim().split(/\s+/))
    .filter(Boolean)
  if (tokens.length === 0) return false
  const sizes = tokens.map(px)
  return sizes.every((s) => s === 0 || Math.abs(s - CARD_PX) < 0.01) && sizes.some((s) => s !== 0)
}

/**
 * Every card rule in one file's source. `kind` is 'css' or 'vue'.
 * Returns [{ line, card, radius, ok }] in source order, one per card rule
 * that sets a border-radius; `line` is 1-based and points at the winning
 * declaration. Rules without a border-radius are not reported, so a modifier
 * like `.song-card--encore { background: … }` is never a violation.
 */
export function cardRules(source, kind, options = {}) {
  const out = []
  for (const { css, base } of styleRuns(source, kind)) {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, blank)
    for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const card = cardClassOf(m[1], options)
      if (!card) continue
      const decls = [...m[2].matchAll(/border-radius\s*:\s*([^;]+)/g)]
      if (decls.length === 0) continue
      const last = decls[decls.length - 1]
      const radius = last[1].trim()
      const at = base + m.index + m[1].length + 1 + last.index
      const line = source.slice(0, at).split('\n').length
      out.push({ line, card, radius, ok: isCardRadius(radius) })
    }
  }
  return out
}
