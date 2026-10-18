/**
 * Which style rules are admin cards, and what corner they set — shared by
 * check-admin-radius.mjs and its spec.
 *
 * DESIGN.md gives cards, table cards, drop zones and the modal panel a
 * 0.75rem corner. Every value on the radius scale looks deliberate in review,
 * so cards drift to the 0.5rem control corner without anyone noticing; this
 * scanner is what notices.
 *
 * A scanner, not a CSS parser, in the same shape as colour-scan.mjs. It walks
 * the braces of each stylesheet so nested rules (`.a-card { &:hover { … } }`)
 * and rules inside `@media` are seen as their own blocks, with a nested
 * block's declarations never counted for its parent. For each block it
 * decides whether the rule styles a card and, if so, reads the corner the
 * cascade actually applies:
 *
 *   - Only the LAST compound of each selector is judged. `.venue-card .map`
 *     styles the map, not the card; `.venue-card.is-open` and `.x-card:hover`
 *     still style the card. A pseudo-element (`.x-card::before`) is its own
 *     box and is never a card. Classes inside `:not(…)` and `:has(…)` name
 *     something other than the styled element and are ignored; `:is(…)` and
 *     `:where(…)` do name it and are kept. A nested selector is resolved
 *     against its parent first (`&` or an implied descendant). In a selector
 *     list, any card member makes the rule a card rule, because the card
 *     really does take that radius.
 *   - A class is a card when it ends in `card` (`.rp-card`, not
 *     `.rp-card-thumb` or `.card-btn`) and is not a selectable option tile,
 *     or when the caller names it as a card container under another name.
 *   - The LAST `border-radius` declaration wins, as it does in CSS, and
 *     `!important` is dropped before comparing.
 *   - A value passes when every corner it names is 0.75rem or 0 and at least
 *     one is 0.75rem: `.75rem`, `12px` and `0.75rem 0.75rem 0 0` (a card with
 *     one flat edge against a sibling strip) are all the DESIGN.md corner.
 *     `em` is not accepted — it scales with the element's font size, so it
 *     is only 12px by coincidence.
 *
 * It reads <style> blocks and .css files only. A card rounded with a Tailwind
 * utility in its class list (`rounded-lg`) is outside what it can see.
 */
import { styleRuns } from './colour-scan.mjs'

export const CARD_RADIUS = '0.75rem'
const CARD_PX = 12

const blank = (s) => s.replace(/[^\n]/g, ' ')

/** Split on `isSep` outside parentheses and brackets, so `:is(.a, .b)` and `[data-x~=y]` stay whole. */
function splitTop(text, isSep) {
  const parts = []
  let depth = 0
  let at = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
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

/** Blank the arguments of `:not(…)` and `:has(…)`: they name other elements, not the styled one. */
function withoutNegations(compound) {
  let out = compound
  const re = /:(?:not|has)\(/g
  let m
  while ((m = re.exec(out))) {
    let depth = 1
    let i = m.index + m[0].length
    while (i < out.length && depth > 0) {
      if (out[i] === '(') depth++
      else if (out[i] === ')') depth--
      i++
    }
    out = out.slice(0, m.index + m[0].length) + blank(out.slice(m.index + m[0].length, i - 1)) + out.slice(i - 1)
  }
  return out
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
    const classes = [...withoutNegations(compound).matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1])
    const card = classes.find((c) => (/(^|-)card$/.test(c) && !optionTiles.has(c)) || containers.has(c))
    if (card) return card
  }
  return null
}

/** One length as CSS pixels, or NaN for anything that is not a rem/px length. */
function px(token) {
  const m = token.match(/^(\d*\.?\d+)(rem|px)?$/)
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

/** A nested selector as the full selector it stands for. */
function resolveNested(parent, own) {
  if (!parent || parent.trim().startsWith('@')) return own
  const first = splitTop(parent, (ch) => ch === ',')[0] ?? ''
  return splitTop(own, (ch) => ch === ',')
    .map((s) => (s.includes('&') ? s.replace(/&/g, first) : `${first} ${s}`))
    .join(', ')
}

/**
 * Every block in a run of CSS, as [{ selector, body, bodyAt }], with each
 * nested block blanked out of its parent's body (offsets preserved) and each
 * nested selector already resolved against its parent.
 */
function blocks(css) {
  const out = []
  const open = []
  let segStart = 0
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    if (ch === '{') {
      const parent = open[open.length - 1]
      const own = css.slice(segStart, i)
      open.push({ selector: resolveNested(parent?.selector, own), from: segStart, bodyAt: i + 1, nested: [] })
      segStart = i + 1
    } else if (ch === '}' || ch === ';') {
      if (ch === '}') {
        const b = open.pop()
        if (b) {
          let body = css.slice(b.bodyAt, i)
          for (const [s, e] of b.nested) {
            body = body.slice(0, s - b.bodyAt) + blank(body.slice(s - b.bodyAt, e - b.bodyAt)) + body.slice(e - b.bodyAt)
          }
          out.push({ selector: b.selector, body, bodyAt: b.bodyAt })
          open[open.length - 1]?.nested.push([b.from, i + 1])
        }
      }
      segStart = i + 1
    }
  }
  return out
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
    for (const { selector, body, bodyAt } of blocks(clean)) {
      const card = cardClassOf(selector, options)
      if (!card) continue
      const decls = [...body.matchAll(/border-radius\s*:\s*([^;]+)/g)]
      if (decls.length === 0) continue
      const last = decls[decls.length - 1]
      const radius = last[1].trim()
      const line = source.slice(0, base + bodyAt + last.index).split('\n').length
      out.push({ line, card, radius, ok: isCardRadius(radius) })
    }
  }
  return out.sort((a, b) => a.line - b.line)
}
