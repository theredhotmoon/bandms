/**
 * Which style rules are admin cards, and what corner they set — shared by
 * check-admin-radius.mjs and its spec.
 *
 * DESIGN.md gives cards, table cards, drop zones and the modal panel a
 * 0.75rem corner, held in one token: `--radius-card` in src/style.css. Every
 * value on the radius scale looks deliberate in review, so cards drift to the
 * 0.5rem control corner without anyone noticing; this scanner is what
 * notices. A card rule must write `var(--radius-card)` for each rounded
 * corner — a literal `0.75rem` is the right shape and still fails, because a
 * literal is one edit away from being the wrong one, and the token is what
 * makes "the card corner" a single source rather than 40 agreeing numbers.
 *
 * A scanner, not a CSS parser, in the same shape as colour-scan.mjs, whose
 * helpers it shares for "where is the CSS" and "what is a comment". Strings
 * and `url(…)` bodies are blanked before the walk, so a `}` inside
 * `content: "}"` or a data URI cannot close a block early. It then walks the
 * braces of each stylesheet so nested rules (`.a-card { &:hover { … } }`)
 * and rules inside `@media` are seen as their own blocks, with a nested
 * block's declarations never counted for its parent. For each block it
 * decides whether the rule styles a card and, if so, resolves the four
 * corners the cascade actually applies:
 *
 *   - Only the LAST compound of each selector is judged. `.venue-card .map`
 *     styles the map, not the card; `.venue-card.is-open` and `.x-card:hover`
 *     still style the card. A pseudo-element (`.x-card::before`) is its own
 *     box and is never a card. `:deep(…)`, `:global(…)`, `:is(…)` and
 *     `:where(…)` are looked inside, because they name the styled element;
 *     `:not(…)` and `:has(…)` are not, because they name something else. A
 *     nested selector is resolved against its parent first (`&` or an
 *     implied descendant); a nested at-rule inherits the parent's. In a
 *     selector list, any card member makes the rule a card rule, because the
 *     card really does take that radius.
 *   - A class is a card when it ends in `card` (`.rp-card`, not
 *     `.rp-card-thumb` or `.card-btn`) and is not a selectable option tile,
 *     or when the caller names it as a card container under another name.
 *   - The shorthand and every longhand (`border-top-left-radius`, the logical
 *     `border-start-start-radius` family) are applied to four corners in
 *     source order, last declaration per property winning as in CSS, with
 *     `!important` dropped. Each length is the token, `0`, or a rem/px
 *     literal; `em` is not read, because it scales with the element's font
 *     size and is only 12px by coincidence. Another `var(…)` is unknown and
 *     fails — the scanner does not resolve custom properties.
 *   - The corners pass when all four are the card corner, or one EDGE is
 *     flat (both corners on one side 0, the other two the card corner — a
 *     card butted against a sibling strip), AND every rounded corner was
 *     written as the token. Two square corners on a diagonal, or a fully
 *     square card, fail. A deliberate exception — a card flush to the
 *     viewport edge on phones — takes `radius-lint-ignore: <reason>` on the
 *     declaration's line, the way colour-scan's `token-lint-ignore` works.
 *
 * The rule scan reads <style> blocks and .css files. A card rounded with a
 * Tailwind utility in its class list is a separate, simpler question —
 * `rounded-xl` is 0.75rem and so always the card corner as a literal — and
 * utilityCardLiterals() below finds those; `rounded-card` is the token's
 * utility. The token's own definitions are tokenDefinitions().
 */
import { blank, stripCssComments, styleRuns } from './colour-scan.mjs'

export const CARD_RADIUS = '0.75rem'
export const CARD_TOKEN = '--radius-card'
export const CARD_VAR = `var(${CARD_TOKEN})`
export const IGNORE_MARKER = 'radius-lint-ignore'
const CARD_PX = 12

/* ── Selectors ─────────────────────────────────────────────────────────── */

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
/** A compound that is nothing but a wrapper around another selector (list). */
const WRAPPER = /^:(?:deep|global|is|where)\(([\s\S]*)\)$/

/**
 * The card class a selector (or selector list) styles, or null.
 * `optionTiles` are `*-card` classes that are really controls; `containers`
 * are card surfaces whose class does not say so. Both are Sets of class names.
 */
export function cardClassOf(selector, { optionTiles = new Set(), containers = new Set() } = {}) {
  for (const one of splitTop(selector, (ch) => ch === ',')) {
    const compound = lastCompound(one)
    const wrapped = compound.match(WRAPPER)
    if (wrapped) {
      // `:deep(.x-card .thumb)` styles the thumb: judge what is inside.
      const inner = cardClassOf(wrapped[1], { optionTiles, containers })
      if (inner) return inner
      continue
    }
    if (PSEUDO_ELEMENT.test(compound)) continue
    const classes = [...withoutNegations(compound).matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1])
    const card = classes.find((c) => (/(^|-)card$/.test(c) && !optionTiles.has(c)) || containers.has(c))
    if (card) return card
  }
  return null
}

/* ── Corners ───────────────────────────────────────────────────────────── */

/**
 * `var(--radius-card)`, with any spacing inside the parentheses, with or
 * without a fallback. `var(--radius-card, 12px)` is the token: the guard
 * keeps the token defined, so the fallback never fires inside the SPA, and a
 * card that may render outside it (a print sheet, a Teleport target) is
 * entitled to one.
 */
const TOKEN_REF = new RegExp(String.raw`var\(\s*${CARD_TOKEN}\s*(?:,[^()]*)?\)`, 'g')

/**
 * One length as { px, token }: its CSS pixels (NaN for anything that is not
 * the token, `0` or a rem/px literal) and whether it was written as the token.
 */
function lengthOf(text) {
  if (text === CARD_VAR) return { px: CARD_PX, token: true }
  const m = text.match(/^(\d*\.?\d+)(rem|px)?$/)
  if (!m) return { px: NaN, token: false }
  const n = Number(m[1])
  if (!m[2]) return { px: n === 0 ? 0 : NaN, token: false }
  return { px: m[2] === 'px' ? n : n * 16, token: false }
}

const UNKNOWN = { px: NaN, token: false }

/** `border-radius` shorthand → [tl, tr, br, bl]; an elliptical corner whose radii differ is unknown. */
function expandShorthand(value) {
  const sides = value.split('/').map((side) => side.trim().split(/\s+/).filter(Boolean).map(lengthOf))
  const four = (t) => {
    if (t.length === 1) return [t[0], t[0], t[0], t[0]]
    if (t.length === 2) return [t[0], t[1], t[0], t[1]]
    if (t.length === 3) return [t[0], t[1], t[2], t[1]]
    if (t.length === 4) return t
    return [UNKNOWN, UNKNOWN, UNKNOWN, UNKNOWN]
  }
  const h = four(sides[0] ?? [])
  if (sides.length === 1) return h
  const v = four(sides[1])
  // Both radii of a corner must agree; a token on one axis and a literal on the other is a literal.
  return h.map((r, i) => (r.px === v[i].px ? { px: r.px, token: r.token && v[i].token } : UNKNOWN))
}

/** Longhand → corner index. Logical names assume horizontal-tb LTR, which the admin is. */
const CORNER_OF = {
  'border-top-left-radius': 0,
  'border-start-start-radius': 0,
  'border-top-right-radius': 1,
  'border-start-end-radius': 1,
  'border-bottom-right-radius': 2,
  'border-end-end-radius': 2,
  'border-bottom-left-radius': 3,
  'border-end-start-radius': 3,
}

const ZERO = { px: 0, token: false }

/**
 * The four corners [tl, tr, br, bl] as { px, token } that a sequence of radius
 * declarations ([property, value] pairs, in source order) resolves to.
 */
function resolveCorners(decls) {
  let corners = [UNKNOWN, UNKNOWN, UNKNOWN, UNKNOWN]
  let set = false
  for (const [prop, raw] of decls) {
    const value = raw.replace(/!\s*important/g, '').replace(TOKEN_REF, CARD_VAR).trim()
    if (prop === 'border-radius') {
      corners = expandShorthand(value)
    } else if (prop in CORNER_OF) {
      if (!set) corners = [ZERO, ZERO, ZERO, ZERO] // longhands alone: the others are the initial 0
      corners[CORNER_OF[prop]] = lengthOf(value)
    } else {
      continue
    }
    set = true
  }
  return corners
}

/** The four corners in px — see resolveCorners. */
export function cornersOf(decls) {
  return resolveCorners(decls).map((c) => c.px)
}

const isCardSize = (s) => Math.abs(s - CARD_PX) < 0.01

/** All four corners the card size, or one edge flat and the other two the card size. */
export function isCardCorners([tl, tr, br, bl]) {
  const c = [tl, tr, br, bl]
  if (c.some(Number.isNaN)) return false
  const r = c.map(isCardSize)
  const z = c.map((s) => s === 0)
  if (r.every(Boolean)) return true
  const top = z[0] && z[1] && r[2] && r[3]
  const bottom = r[0] && r[1] && z[2] && z[3]
  const left = z[0] && r[1] && r[2] && z[3]
  const right = r[0] && z[1] && z[2] && r[3]
  return top || bottom || left || right
}

/**
 * The verdict on a card rule's radius declarations:
 *   shape   — the corners are the card shape (all rounded, or one flat edge)
 *   literal — a rounded corner was written as a number rather than the token
 *   ok      — shape && !literal: what the build accepts
 */
export function judge(decls) {
  const corners = resolveCorners(decls)
  const shape = isCardCorners(corners.map((c) => c.px))
  const literal = shape && corners.some((c) => !c.token && isCardSize(c.px))
  return { shape, literal, ok: shape && !literal }
}

/** Whether a `border-radius` shorthand value alone is what a card rule may write. */
export function isCardRadius(value) {
  return judge([['border-radius', value]]).ok
}

/* ── Blocks ────────────────────────────────────────────────────────────── */

/** Quoted strings and unquoted url() bodies, blanked so their braces and semicolons are inert. */
const blankStrings = (css) =>
  css.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, blank).replace(/url\(\s*[^)"']*\)/g, (m) => 'url(' + blank(m.slice(4, -1)) + ')')

/**
 * A nested selector as the full selector it stands for. A nested at-rule
 * (`.a-card { @media (…) { border-radius: 8px } }`) has no selector of its
 * own: its declarations apply to the parent, so it inherits the parent's.
 */
function resolveNested(parent, own) {
  if (parent && own.trim().startsWith('@')) return parent
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

/** Shorthand and every physical or logical longhand, at a property boundary (not `--x-border-radius`). */
const RADIUS_DECL = /(?<![\w-])(border(?:-(?:top|bottom)-(?:left|right)|-(?:start|end)-(?:start|end))?-radius)\s*:\s*([^;]+)/g

/** 1-based line of an offset, from a newline table built once per file. */
function lineIndex(source) {
  const nl = []
  for (let i = source.indexOf('\n'); i !== -1; i = source.indexOf('\n', i + 1)) nl.push(i)
  return (offset) => {
    let lo = 0
    let hi = nl.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (nl[mid] < offset) lo = mid + 1
      else hi = mid
    }
    return lo + 1
  }
}

/* ── Scan ──────────────────────────────────────────────────────────────── */

/**
 * One pass over one file's source. `kind` is 'css' or 'vue'. Returns
 *   rules   — [{ line, card, radius, ok, literal? }] in source order, one per
 *             card rule that sets a corner; `line` points at the winning
 *             declaration, and `literal: true` marks a card that has the
 *             right shape written as a number instead of the token. Rules
 *             without a radius are not reported, so a modifier like
 *             `.song-card--encore { background: … }` is never a violation,
 *             and a declaration line carrying IGNORE_MARKER is skipped.
 *   classes — the Set of listed classes (containers and option tiles) that
 *             are the last compound of at least one real rule, so a caller
 *             can tell a list entry that no longer names anything.
 */
export function scanCards(source, kind, { optionTiles = new Set(), containers = new Set() } = {}) {
  const rules = []
  const classes = new Set()
  const listed = { containers: new Set([...containers, ...optionTiles]) }
  const lines = source.split('\n')
  const lineOf = lineIndex(source)

  for (const { css, base } of styleRuns(source, kind)) {
    const clean = blankStrings(stripCssComments(css))
    for (const { selector, body, bodyAt } of blocks(clean)) {
      const named = cardClassOf(selector, listed)
      if (named && (containers.has(named) || optionTiles.has(named))) classes.add(named)

      const card = cardClassOf(selector, { optionTiles, containers })
      if (!card) continue
      const decls = []
      let last = null
      for (const m of body.matchAll(RADIUS_DECL)) {
        decls.push([m[1], m[2]])
        last = m
      }
      if (!last) continue
      const line = lineOf(base + bodyAt + last.index)
      if (lines[line - 1].includes(IGNORE_MARKER)) continue
      const byProp = new Map(decls)
      const radius = byProp.size === 1 && byProp.has('border-radius')
        ? byProp.get('border-radius').trim()
        : [...byProp].map(([p, v]) => `${p}: ${v.trim()}`).join('; ')
      const { ok, literal } = judge(decls)
      rules.push({ line, card, radius, ok, ...(literal && { literal: true }) })
    }
  }
  rules.sort((a, b) => a.line - b.line)
  return { rules, classes }
}

/** The card rules alone — see scanCards. */
export function cardRules(source, kind, options) {
  return scanCards(source, kind, options).rules
}

/* ── The token itself ──────────────────────────────────────────────────── */

const TOKEN_DECL = new RegExp(String.raw`(?<![\w-])${CARD_TOKEN}\s*:\s*([^;}]+)`, 'g')
/** The same in a template: `style="--radius-card: 0"`, `:style="{ '--radius-card': '0' }"`, `[--radius-card:0.5rem]`. */
const TOKEN_ATTR = new RegExp(String.raw`(?<![\w-])${CARD_TOKEN}['"]?\s*:\s*['"]?\s*([^;'"}\]]+)`, 'g')

/** The block a definition must sit in: Tailwind emits an unused `@theme` variable only when it is `static`. */
export const TOKEN_SCOPE = '@theme static'

/**
 * Every definition of `--radius-card` in a file, as [{ line, value, scope }]:
 * each stylesheet declaration with the selector or at-rule of the block that
 * holds it, comments and strings blanked first (a comment that quotes the
 * token is not a definition; a quoted attribute value inside the scope's
 * selector comes back as spaces), plus — for a .vue file — each inline `style`
 * attribute, `:style` binding or arbitrary-property class in the template,
 * with scope 'template'. src/style.css must hold exactly one, inside
 * TOKEN_SCOPE; any other definition anywhere would re-round every card inside
 * its scope while each card rule still read as correct.
 */
export function tokenDefinitions(source, kind) {
  const lineOf = lineIndex(source)
  const out = []
  for (const { css, base } of styleRuns(source, kind)) {
    const clean = blankStrings(stripCssComments(css))
    for (const { selector, body, bodyAt } of blocks(clean)) {
      for (const m of body.matchAll(TOKEN_DECL)) {
        out.push({ line: lineOf(base + bodyAt + m.index), value: m[1].trim(), scope: selector.trim() })
      }
    }
  }
  if (kind === 'vue') {
    const template = templateOf(source)
    for (const m of template.matchAll(TOKEN_ATTR)) out.push({ line: lineOf(m.index), value: m[1].trim(), scope: 'template' })
  }
  return out.sort((a, b) => a.line - b.line)
}

/* ── Utility-styled cards ──────────────────────────────────────────────── */

/** The Tailwind utility `--radius-card` yields: `rounded-card`, the card corner in a class list. */
export const UTILITY_CARD = `rounded-${CARD_TOKEN.replace(/^--radius-/, '')}`

/**
 * Tailwind's `rounded-xl` (any side, any variant prefix) is 0.75rem — the
 * card corner as a literal, in a class list rather than a stylesheet. It is
 * the one radius utility DESIGN.md's scale reserves for cards, so every use
 * of it in the admin is a card that should write `rounded-card`.
 */
const SIDE = String.raw`(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?`
const ROUNDED_XL = new RegExp(String.raw`(?<![\w-])((?:[a-z-]+:)*rounded${SIDE}-xl)(?![\w-])`, 'g')
/** The token's utility in a class list, any side, any variant prefix — for counting what the guard covers. */
export const UTILITY_CARD_REF = new RegExp(String.raw`(?<![\w-])(?:[a-z-]+:)*rounded${SIDE}-${UTILITY_CARD.slice('rounded-'.length)}(?![\w-])`, 'g')
const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script>/g
const HTML_COMMENT = /<!--[\s\S]*?-->/g

/** What `rounded-xl` should have been: the same side, on the token (`rounded-t-xl` → `rounded-t-card`). */
export function utilityCardFix(utility) {
  return utility.replace(new RegExp(String.raw`rounded(${SIDE})-xl$`), `rounded$1-${UTILITY_CARD.slice('rounded-'.length)}`)
}

/**
 * A .vue file's template alone, offsets preserved: <style> and <script>
 * blocks and HTML comments blanked — the scripts first, so a `'<!--'` string
 * in one cannot open a comment that swallows the template.
 */
function templateOf(source) {
  let live = source
  for (const { css, base } of styleRuns(source, 'vue')) live = live.slice(0, base) + blank(css) + live.slice(base + css.length)
  return live.replace(SCRIPT_BLOCK, blank).replace(HTML_COMMENT, blank)
}

/**
 * Every `rounded-xl` utility in a file's template and script — class
 * attributes, `:class` bindings and class strings held in script constants,
 * in a .vue file or a plain .ts module — as [{ line, utility }]. <style>
 * blocks and HTML comments are blanked; script is scanned as-is, because a
 * class string in a constant is live code and a `//` comment naming the
 * utility is a rare enough false positive to prefer over missing the constant.
 */
export function utilityCardLiterals(source) {
  const lineOf = lineIndex(source)
  const hits = []
  const scan = (text, base) => {
    for (const m of text.matchAll(ROUNDED_XL)) hits.push({ line: lineOf(base + m.index), utility: m[1] })
  }
  scan(templateOf(source), 0)
  for (const m of source.matchAll(SCRIPT_BLOCK)) scan(m[0], m.index)
  return hits.sort((a, b) => a.line - b.line)
}
