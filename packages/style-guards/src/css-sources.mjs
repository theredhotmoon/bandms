/**
 * Which files Tailwind reads for class names, and which rules in a built
 * stylesheet could only have come from a file it should not — shared by the
 * admin's and the public site's check-css-sources.mjs, and pinned by the spec
 * beside this file.
 *
 * Tailwind emits a utility for every class-shaped token it finds in the files
 * it reads, and left to itself it reads every file under the project that git
 * does not ignore: build guards and their specs, Playwright specs, markdown.
 * Each frontend's entry stylesheet narrows that with `source(none)` on the
 * import and `@source` lines naming what renders. Three parts here:
 *
 *   - sourceDirectives() reads that configuration back out of a stylesheet;
 *     entryProblems() holds the entry file to an expected list of sources,
 *     and strayRootProblems() makes sure no other stylesheet or component
 *     <style> under src/ starts a Tailwind root of its own or names a source
 *     — the general check, and the only one that sees a dropped `@source not`
 *     or a path that resolves to nothing (Tailwind reads no file and says
 *     nothing);
 *   - classSelectors() / strayRules() judge built CSS for the two selector
 *     shapes only a non-source can produce, so a Tailwind upgrade that reads
 *     the configuration differently still fails the build with the selector
 *     that leaked: an arbitrary value holding the docs' `…` placeholder
 *     outside any quoted text (`bg-[#…]`, `[--radius-card:…]`,
 *     `rounded-[…px]`), or a class that sets --radius-card
 *     (`[--radius-card:4px]`), which the admin's radius guard rejects in
 *     every rendered src file;
 *   - sentinelIn() finds, in a sheet that carries Tailwind's own
 *     `@layer utilities`, one of the utilities a frontend cannot render
 *     without — the proof that Tailwind read src/ at all.
 *
 * The CSS grammar — strings, comments, urls, escapes — is css-walk.mjs; the
 * single-file-component split is sfc.mjs.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { blankStrings, compounds, segments, stripCssComments } from './css-walk.mjs'
import { styleRuns } from './sfc.mjs'

/* ── Output ────────────────────────────────────────────────────────────── */

export const PLACEHOLDER = '…'
export const CARD_TOKEN_CLASS = /\\\[--radius-card\\:/
/**
 * Utilities a frontend cannot render without — any one of them in Tailwind's
 * sheet proves it read src/ and that the selector scan reads the minifier's
 * output. A set, not one class, so no single design choice can break the
 * proof.
 */
export const SENTINELS = ['.flex', '.hidden', '.grid', '.rounded-card']
/** The layer Tailwind writes its utilities into, and nothing else does — what tells its sheet from a vendored one that happens to define `.hidden`. */
export const TAILWIND_MARK = '@layer utilities'

/** A `.` that begins a class name: not escaped, not inside a word (`[x=0.5]`), strings already blanked. */
const CLASS_DOT = /(^|[^\w\\-])\./
/** A compound holds a class anywhere in it — `[dir=rtl] .x` and `html .x` as much as `.x` — so a variant that leads with an element or attribute still counts. */
const isClassCompound = (s) => CLASS_DOT.test(blankStrings(s))
/** A selector list counts when any compound in it holds a class: the minifier merges same-body rules, so `dialog,.rounded-card` is a class rule too. */
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

/* ── Configuration ─────────────────────────────────────────────────────── */

/** Every directive that makes a stylesheet emit utilities: the full import, the split `tailwindcss/utilities` import, or a `@tailwind` directive — each with whatever clauses follow it. */
const ROOT = /@import\s+["'](tailwindcss(?:\/utilities(?:\.css)?)?)["']([^;]*);|@tailwind\s+(\w+)([^;]*);/g
const SOURCE_CLAUSE = /\bsource\(\s*(none|["'][^"']*["'])\s*\)/
const SOURCE = /@source\s+(not\s+)?(?:["']([^"']+)["']|inline\(\s*["']([^"']*)["']\s*\))\s*;/g

/**
 * The Tailwind source configuration a stylesheet declares:
 *   { roots: [{ directive, detection, base }], sources: [{ path, not, inline }] }
 * A root is any directive that makes the sheet emit utilities — each one is
 * its own scan: `@import "tailwindcss"`, the split
 * `@import "tailwindcss/utilities.css"`, or `@tailwind utilities;` — with
 * `directive` as written. `detection` is 'none' for the bare keyword
 * `source(none)`, 'auto' for no source() clause (every non-ignored file under
 * the project), or 'path' for `source("…")`, whose quoted value is `base` —
 * a quoted "none" is a path named none, not the keyword. Other clauses on an
 * import (`prefix()`, `layer()`, `theme()`) are allowed in any order. An
 * `@source inline("…")` safelist is a source too — `inline: true`, with the
 * class list as `path`. Comments are set aside; a string is read whole, so
 * the `/**\/` inside a glob is not a comment.
 */
export function sourceDirectives(css) {
  const clean = stripCssComments(css)
  const roots = [...clean.matchAll(ROOT)].map((m) => {
    const directive = m[1] ? `@import "${m[1]}"` : `@tailwind ${m[3]}`
    const clause = (m[1] ? m[2] : m[4]).match(SOURCE_CLAUSE)
    const detection = !clause ? 'auto' : clause[1] === 'none' ? 'none' : 'path'
    return { directive, detection, base: detection === 'path' ? clause[1].slice(1, -1) : null }
  })
  const sources = [...clean.matchAll(SOURCE)].map((m) => ({ path: m[2] ?? m[3], not: Boolean(m[1]), inline: m[2] === undefined }))
  return { roots, sources }
}

/**
 * A file-name test derived from the `not` globs of an expected-sources list,
 * for a path relative to src/ — so a guard that must skip the same files
 * Tailwind skips (the admin's radius guard) reads the one list.
 */
export function fixtureTest(expected) {
  const tests = expected.filter((s) => s.not).map((s) => {
    const tail = s.path.slice(s.path.lastIndexOf('/') + 1) // `*.spec.ts`
    return new RegExp(`${tail.replace(/[.]/g, '\\.').replace(/\*/g, '.*')}$`)
  })
  return (rel) => tests.some((re) => re.test(rel))
}

const isGlob = (p) => /[*?{]/.test(p)
/** How one entry stylesheet's source paths resolve and read. */
function pathsOf(styleFile, quote) {
  const from = dirname(styleFile)
  /** The directory a source starts from: the path itself, or for a glob the part before its first wildcard. */
  const baseOf = (p) => {
    if (!isGlob(p)) return resolve(from, p)
    const cut = p.slice(0, p.search(/[*?{]/)).lastIndexOf('/') + 1
    return resolve(from, p.slice(0, cut) || '.')
  }
  /** A comparable identity: inline lists by their text, paths and globs by resolved base plus pattern, so `../src/` and `./../src` are one source. */
  const key = (s) => {
    if (s.inline) return `${s.not ? 'not ' : ''}inline(${s.path})`
    const rest = isGlob(s.path) ? `/${s.path.slice(s.path.slice(0, s.path.search(/[*?{]/)).lastIndexOf('/') + 1)}` : ''
    return `${s.not ? 'not ' : ''}${baseOf(s.path)}${rest}`
  }
  const spell = (s) => `@source ${s.not ? 'not ' : ''}${s.inline ? `inline(${quote}${s.path}${quote})` : `${quote}${s.path}${quote}`};`
  return { baseOf, key, spell }
}

/**
 * What is wrong with an entry stylesheet's Tailwind configuration, as
 * messages — none when it imports Tailwind once, with the bare keyword
 * `source(none)`, declares exactly `expected` (compared by resolved path),
 * and every path starts from a directory that exists.
 *   label: how to name the file in messages ("src/style.css")
 *   tree:  what the project directory is called ("app/")
 *   quote: the quote style the file uses, for the lines it is told to write
 */
export function entryProblems(styleFile, expected, { label, tree, quote = '"' }) {
  const { baseOf, key, spell } = pathsOf(styleFile, quote)
  const out = []
  const { roots, sources } = sourceDirectives(readFileSync(styleFile, 'utf8'))
  const [root, ...extra] = roots
  if (!root) out.push(`${label} does not import tailwindcss — nothing here can be judged`)
  else {
    if (root.directive !== '@import "tailwindcss"') out.push(`${label} starts Tailwind with \`${root.directive}\` — the full \`@import ${quote}tailwindcss${quote} source(none)\` is what this check reads`)
    if (root.detection !== 'none') out.push(`${label} imports tailwindcss with ${root.detection === 'auto' ? 'no source() clause' : `source(${quote}${root.base}${quote})${root.base === 'none' ? ' — a quoted none is a path named none, not the keyword' : ''}`} — it must be \`source(none)\`, or Tailwind reads every non-ignored file under ${tree} as a template`)
  }
  for (const r of extra) out.push(`${label} also has \`${r.directive}\` — a second root is a second scan, with its own detection${r.detection === 'auto' ? ' (automatic here)' : ''}; one import holds the configuration`)
  const declared = new Set(sources.map(key))
  for (const s of expected) if (!declared.has(key(s))) out.push(`${label} is missing \`${spell(s)}\``)
  const wanted = new Set(expected.map(key))
  for (const s of sources) {
    if (wanted.has(key(s))) continue
    out.push(s.inline
      ? `${label} safelists \`${spell(s)}\` — classes no component writes are exactly what this guard keeps out of the build; style the element instead`
      : `${label} names \`${spell(s)}\` — only what renders is a source; a new one belongs in EXPECTED_SOURCES in the check, with the reason`)
  }
  // Every path — plain or glob, positive or not — must start from a directory
  // that exists: Tailwind reads nothing from a path that resolves to nothing
  // and says so nowhere, and a `not` whose base has moved excludes nothing.
  for (const s of sources) {
    if (s.inline) continue
    if (!existsSync(baseOf(s.path))) out.push(`${label}: \`${spell(s)}\` resolves to nothing from ${label.slice(0, label.lastIndexOf('/') + 1)} — Tailwind reads (or excludes) no file and says nothing; the path is relative to the stylesheet`)
  }
  return { problems: out, sources, spell }
}

const walk = (dir, test, out = []) => {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) walk(abs, test, out)
    else if (test.test(name)) out.push(abs)
  }
  return out
}

/**
 * Every other stylesheet or component <style> under `srcDir` that starts a
 * Tailwind root of its own or names a source, as messages. Tailwind merges
 * @source from every stylesheet the entry imports, each relative to its own
 * file, and the bundler plugins compile any stylesheet or <style> block that
 * starts Tailwind as a root with its own (automatic) detection — so one file
 * holds the configuration, and this makes sure of it.
 */
export function strayRootProblems(srcDir, styleFile, { label, quote = '"', exts = /\.(css|vue|astro)$/ }) {
  const { spell } = pathsOf(styleFile, quote)
  const out = []
  for (const file of walk(srcDir, exts)) {
    if (resolve(file) === resolve(styleFile)) continue
    const source = readFileSync(file, 'utf8')
    // Nothing to find unless one of the three words is there at all — which
    // today is no file, so the tokenizer runs over none of the components.
    if (!/@source|tailwindcss|@tailwind/.test(source)) continue
    const rel = relative(srcDir, file).split('\\').join('/')
    for (const { css } of styleRuns(source, rel.endsWith('.css') ? 'css' : 'vue')) {
      const other = sourceDirectives(css)
      for (const r of other.roots) out.push(`src/${rel} starts Tailwind with \`${r.directive}\` — that is a second root with its own scan; only ${label} imports Tailwind, and \`@apply\` in a component needs \`@reference\`, not an import`)
      for (const s of other.sources) out.push(`src/${rel} declares \`${spell(s)}\` — Tailwind honours it from any stylesheet it compiles, but only ${label} may name sources`)
    }
  }
  return out
}
