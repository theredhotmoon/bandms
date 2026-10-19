/**
 * Which files Tailwind reads for class names, and which rules in the built
 * stylesheet could only have come from a file it should not — shared by
 * check-css-sources.mjs and its spec.
 *
 * Tailwind emits a utility for every class-shaped token it finds in the files
 * it reads, and left to itself it reads every file under app/ that git does
 * not ignore: the build guards and their specs, the Playwright specs, the
 * markdown. src/style.css narrows that with `source(none)` on the import and
 * `@source` lines naming what renders. Two halves here:
 *
 *   - sourceDirectives() reads that configuration back out of a stylesheet,
 *     so the guard can assert it directly — the general check, and the only
 *     one that sees a dropped `@source not` or a path that resolves to
 *     nothing (Tailwind reads no file and says nothing);
 *   - classSelectors() / strayRules() judge the output for the two selector
 *     shapes only a non-source can produce, so a Tailwind upgrade that reads
 *     the configuration differently still fails the build with the selector
 *     that leaked: an arbitrary value holding the docs' `…` placeholder
 *     outside any quoted text (`bg-[#…]`, `[--radius-card:…]`,
 *     `rounded-[…px]`), or a class that sets --radius-card
 *     (`[--radius-card:4px]`), which check-admin-radius.mjs rejects in every
 *     rendered src file.
 *
 * The CSS grammar — strings, comments, urls, escapes — is css-walk.mjs, the
 * same walk the colour and radius guards read through.
 */
import { compounds, segments, stripCssComments } from './css-walk.mjs'

export const PLACEHOLDER = '…'
export const CARD_TOKEN_CLASS = /\\\[--radius-card\\:/
/**
 * Utilities the admin cannot render without — any one of them in the built
 * CSS proves Tailwind read src/ and that the selector scan reads the
 * minifier's output. A set, not one class, so no single design choice
 * (every `rounded-card` moving into a stylesheet) can break the proof.
 */
export const SENTINELS = ['.flex', '.hidden', '.grid', '.rounded-card']

const isClassCompound = (s) => s.startsWith('.') || s.startsWith(':is(.') || s.startsWith(':where(.')
/** A selector list counts when any compound in it is a class: the minifier merges same-body rules, so `dialog,.rounded-card` is a class rule too. */
const isClassSelector = (s) => compounds(s).some(isClassCompound)

/**
 * Every class selector in compiled CSS, nested rules included, as strings.
 * Only a `{`, `}` or `;` in plain text is a rule boundary — not one inside
 * a string, a url() or a comment.
 */
export function classSelectors(css) {
  const out = []
  let buf = ''
  for (const s of segments(css)) {
    if (s.type === 'comment') continue
    if (s.type !== 'text') {
      buf += s.text
      continue
    }
    for (const c of s.text) {
      if (c === '{') {
        const sel = buf.trim()
        if (isClassSelector(sel)) out.push(sel)
        buf = ''
      } else if (c === '}' || c === ';') {
        buf = ''
      } else {
        buf += c
      }
    }
  }
  return out
}

/** The sentinel found among the selectors, compound by compound, or null. */
export function sentinelIn(selectors) {
  for (const s of selectors) {
    const hit = compounds(s).find((part) => SENTINELS.includes(part))
    if (hit) return hit
  }
  return null
}

const ARBITRARY = /\\\[((?:(?!\\\]).)*)\\\]/g
const QUOTED = /\\(['"])(?:(?!\\\1).)*\\\1/g

/** The placeholder anywhere inside an escaped `[…]` arbitrary value, quoted text (`content-['…']`) set aside. */
function placeholderValue(selector) {
  for (const m of selector.matchAll(ARBITRARY)) {
    if (m[1].replace(QUOTED, '').includes(PLACEHOLDER)) return true
  }
  return false
}

/** Why a selector cannot have come from a rendered src/ file, or null when it can. */
export function strayReason(selector) {
  if (placeholderValue(selector)) return `an arbitrary value holding "${PLACEHOLDER}", the documentation placeholder — read from a doc or a spec`
  if (CARD_TOKEN_CLASS.test(selector)) return 'sets --radius-card from a class, which check-admin-radius.mjs rejects in every rendered src file — read from a spec or a doc'
  return null
}

/** [{ selector, reason }] for every selector in the list that came from outside the sources. */
export function strayRules(selectors) {
  const out = []
  for (const selector of selectors) {
    const reason = strayReason(selector)
    if (reason) out.push({ selector, reason })
  }
  return out
}

const TAILWIND_IMPORT = /@import\s+["']tailwindcss["']([^;]*);/
const SOURCE_CLAUSE = /\bsource\(\s*(none|["'][^"']*["'])\s*\)/
const SOURCE = /@source\s+(not\s+)?(?:["']([^"']+)["']|inline\(\s*["']([^"']*)["']\s*\))\s*;/g

/**
 * The Tailwind source configuration a stylesheet declares:
 *   { imported, detection, base, sources: [{ path, not, inline }] }
 * `detection` is 'none' for the bare keyword `source(none)`, 'auto' for an
 * import with no source() clause (every non-ignored file under the project),
 * or 'path' for `source("…")`, whose quoted value is `base` — and a quoted
 * "none" is a path named none, not the keyword. Other clauses on the import
 * (`prefix()`, `layer()`, `theme()`) are allowed in any order. An
 * `@source inline("…")` safelist is a source too — `inline: true`, with the
 * class list as `path`. Comments are set aside; a string is read whole, so
 * the `/**\/` inside a glob is not a comment.
 */
export function sourceDirectives(css) {
  const clean = stripCssComments(css)
  const imp = clean.match(TAILWIND_IMPORT)
  const clause = imp?.[1].match(SOURCE_CLAUSE)
  const detection = !imp ? null : !clause ? 'auto' : clause[1] === 'none' ? 'none' : 'path'
  const base = detection === 'path' ? clause[1].slice(1, -1) : null
  const sources = [...clean.matchAll(SOURCE)].map((m) => ({ path: m[2] ?? m[3], not: Boolean(m[1]), inline: m[2] === undefined }))
  return { imported: Boolean(imp), detection, base, sources }
}
