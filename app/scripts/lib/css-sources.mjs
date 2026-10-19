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
 *   - sourceDirectives() reads that configuration back out of the stylesheet,
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
 *     src file.
 */

export const PLACEHOLDER = '…'
export const CARD_TOKEN_CLASS = /\\\[--radius-card\\:/
/** A utility src is known to use (check-admin-radius.mjs requires it on every Tailwind-styled card), so its absence means Tailwind read nothing. */
export const SENTINEL = '.rounded-card'

/**
 * One walk over CSS text, shared by everything here so the character rules
 * cannot drift: yields { type, text } segments where `type` is 'comment',
 * 'string' (quotes included), 'url' (an unquoted url(...) token, which may
 * hold ; or } freely) or 'text'. A backslash escapes the next character
 * anywhere in CSS, so `\'` in an escaped selector never opens a string; a
 * quoted url(" … ") is a string segment after a text segment `url(`.
 */
export function* segments(css) {
  const n = css.length
  let text = ''
  const flush = function* () {
    if (text) yield { type: 'text', text }
    text = ''
  }
  for (let i = 0; i < n; ) {
    const c = css[i]
    if (c === '\\') {
      text += css.slice(i, i + 2)
      i += 2
      continue
    }
    if (c === '/' && css[i + 1] === '*') {
      yield* flush()
      const e = css.indexOf('*/', i + 2)
      const j = e < 0 ? n : e + 2
      yield { type: 'comment', text: css.slice(i, j) }
      i = j
      continue
    }
    if (c === '"' || c === "'") {
      yield* flush()
      let j = i + 1
      while (j < n && css[j] !== c) j += css[j] === '\\' ? 2 : 1
      yield { type: 'string', text: css.slice(i, j + 1) }
      i = j + 1
      continue
    }
    if ((c === 'u' || c === 'U') && css.slice(i, i + 4).toLowerCase() === 'url(' && !/["'\s]/.test(css[i + 4] ?? '')) {
      yield* flush()
      const e = css.indexOf(')', i + 4)
      const j = e < 0 ? n : e + 1
      yield { type: 'url', text: css.slice(i, j) }
      i = j
      continue
    }
    text += c
    i++
  }
  yield* flush()
}

/** Comments removed, everything else — strings, urls, escapes — kept whole. */
export function stripComments(css) {
  let out = ''
  for (const s of segments(css)) if (s.type !== 'comment') out += s.text
  return out
}

const isClassCompound = (s) => s.startsWith('.') || s.startsWith(':is(.') || s.startsWith(':where(.')
/** A selector list counts when any compound in it is a class: the minifier merges same-body rules, so `dialog,.rounded-card` is a class rule too. */
const isClassSelector = (s) => s.split(',').some((part) => isClassCompound(part.trim()))

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

/**
 * Whether the sentinel utility is among the selectors. The CSS minifier merges
 * adjacent rules with the same body into one selector list, so `.rounded-card`
 * may sit inside `.x,.rounded-card{…}` — each compound is checked on its own.
 */
export function hasSentinel(selectors) {
  return selectors.some((s) => s.split(',').some((part) => part.trim() === SENTINEL))
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

/** Why a selector cannot have come from src/, or null when it can. */
export function strayReason(selector) {
  if (placeholderValue(selector)) return `an arbitrary value holding "${PLACEHOLDER}", the documentation placeholder — read from a doc or a spec`
  if (CARD_TOKEN_CLASS.test(selector)) return 'sets --radius-card from a class, which no src file may do — read from a spec or a doc'
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
 *   { imported, detection, sources: [{ path, not, inline }] }
 * `detection` is 'none' for `source(none)`, 'auto' for an import with no
 * source() clause (every non-ignored file under the project), or the quoted
 * base path of a `source("…")`; null when tailwindcss is not imported. Other
 * clauses on the import (`prefix()`, `layer()`, `theme()`) are allowed in any
 * order. An `@source inline("…")` safelist is a source too — `inline: true`,
 * with the class list as `path`.
 */
export function sourceDirectives(css) {
  const clean = stripComments(css)
  const imp = clean.match(TAILWIND_IMPORT)
  const clause = imp?.[1].match(SOURCE_CLAUSE)
  const detection = !imp ? null : !clause ? 'auto' : clause[1] === 'none' ? 'none' : clause[1].slice(1, -1)
  const sources = [...clean.matchAll(SOURCE)].map((m) => ({ path: m[2] ?? m[3], not: Boolean(m[1]), inline: m[2] === undefined }))
  return { imported: Boolean(imp), detection, sources }
}
