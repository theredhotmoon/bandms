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
 *     that leaked: an arbitrary value that is just the docs' `…` placeholder
 *     (`bg-[#…]`, `[--radius-card:…]`), or a class that sets --radius-card
 *     (`[--radius-card:4px]`), which check-admin-radius.mjs rejects in every
 *     src file.
 */
export const PLACEHOLDER = '…'
/** The placeholder as the whole arbitrary value — `\[\#…\]`, `\:…\]` — not an ellipsis inside a real value such as `content-['…']`. */
const PLACEHOLDER_VALUE = /…\\\]/
export const CARD_TOKEN_CLASS = /\\\[--radius-card\\:/
/** A utility src is known to use (check-admin-radius.mjs requires it on every Tailwind-styled card), so its absence means Tailwind read nothing. */
export const SENTINEL = '.rounded-card'

const isClassSelector = (s) => s.startsWith('.') || s.startsWith(':is(.') || s.startsWith(':where(.')

/**
 * Every class selector in compiled CSS, nested rules included, as strings.
 * A small tokenizer rather than a regex: a `;` or `}` inside a quoted string
 * or a url() is not a rule boundary, and a comment ahead of a rule (an
 * unminified build) must not hide it.
 */
export function classSelectors(css) {
  const out = []
  let buf = ''
  const n = css.length
  for (let i = 0; i < n; ) {
    const c = css[i]
    // A backslash escapes the next character anywhere in CSS: the `\'` in an
    // escaped selector such as `.content-\[\'…\'\]` is not a string opening.
    if (c === '\\') {
      buf += css.slice(i, i + 2)
      i += 2
      continue
    }
    if (c === '/' && css[i + 1] === '*') {
      const e = css.indexOf('*/', i + 2)
      i = e < 0 ? n : e + 2
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n && css[j] !== c) j += css[j] === '\\' ? 2 : 1
      buf += css.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (c === 'u' && css.startsWith('url(', i)) {
      const e = css.indexOf(')', i)
      const j = e < 0 ? n : e + 1
      buf += css.slice(i, j)
      i = j
      continue
    }
    if (c === '{') {
      const s = buf.trim()
      if (isClassSelector(s)) out.push(s)
      buf = ''
    } else if (c === '}' || c === ';') {
      buf = ''
    } else {
      buf += c
    }
    i++
  }
  return out
}

/** Why a selector cannot have come from src/, or null when it can. */
export function strayReason(selector) {
  if (PLACEHOLDER_VALUE.test(selector)) return `an arbitrary value that is just "${PLACEHOLDER}", the documentation placeholder — read from a .md file`
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

const TAILWIND_IMPORT = /@import\s+["']tailwindcss["']\s*(?:source\(\s*(none|["'][^"']*["'])\s*\))?\s*;/
const SOURCE = /@source\s+(not\s+)?["']([^"']+)["']\s*;/g

/**
 * Comments removed, strings kept whole. Not colour-scan's stripCssComments:
 * that one is for declaration bodies and would take the `/**\/` inside the
 * glob `"../src/**\/*.spec.ts"` for a comment.
 */
function stripComments(css) {
  let out = ''
  const n = css.length
  for (let i = 0; i < n; ) {
    const c = css[i]
    if (c === '\\') {
      out += css.slice(i, i + 2)
      i += 2
      continue
    }
    if (c === '/' && css[i + 1] === '*') {
      const e = css.indexOf('*/', i + 2)
      i = e < 0 ? n : e + 2
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n && css[j] !== c) j += css[j] === '\\' ? 2 : 1
      out += css.slice(i, j + 1)
      i = j + 1
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * The Tailwind source configuration a stylesheet declares:
 *   { imported, detection, sources: [{ path, not }] }
 * `detection` is 'none' for `source(none)`, 'auto' for a bare import (every
 * non-ignored file under the project), or the quoted base path of a
 * `source("…")`; null when tailwindcss is not imported at all.
 */
export function sourceDirectives(css) {
  const clean = stripComments(css)
  const imp = clean.match(TAILWIND_IMPORT)
  const detection = !imp ? null : imp[1] === undefined ? 'auto' : imp[1] === 'none' ? 'none' : imp[1].slice(1, -1)
  const sources = [...clean.matchAll(SOURCE)].map((m) => ({ path: m[2], not: Boolean(m[1]) }))
  return { imported: Boolean(imp), detection, sources }
}
