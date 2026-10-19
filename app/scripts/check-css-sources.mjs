#!/usr/bin/env node
/**
 * Keeps the shipped stylesheet free of rules that came from files that are
 * not sources. Runs AFTER `vite build`, unlike the other guards, because half
 * of it reads dist/: the question is what Tailwind actually emitted, not only
 * what the sources say.
 *
 * Tailwind v4 finds class names by reading files, and by default it reads
 * every file under app/ that git does not ignore. That included scripts/ (the
 * guards and their specs), e2e/ and CLAUDE.md, so a fixture like
 * `[--radius-card:4px]` in radius-scan.spec.ts, `bg-[#141414]` in
 * colour-scan.spec.ts or the `bg-[#…]` example in the guard table each became
 * a real rule in production CSS — dead, since no element carries the class,
 * but shipped on every admin page load all the same. src/style.css now turns
 * detection off (`source(none)`) and names what renders — src/ minus its
 * specs, and index.html — as the only sources.
 *
 * Two checks, in order:
 *   1. The configuration, read back out of src/style.css: the bare keyword
 *      `source(none)` on the import, exactly the expected `@source` lines (an
 *      `inline()` safelist counts as a source and is unexpected too), and
 *      every positive path resolving to something. A path that resolves to
 *      nothing is the failure that needs this most — Tailwind reads no file,
 *      throws nothing, and emits zero utilities into a build that is
 *      otherwise green. Tailwind also honours `@source` in any stylesheet the
 *      entry imports, so every other .css under src/ must declare none, and
 *      must not import tailwindcss itself: one file holds the configuration.
 *   2. The output in dist/: one of the sentinel utilities the admin cannot
 *      render without is present (so Tailwind read src/ at all, and the
 *      selector scan reads the minifier's output), and no selector has one of
 *      the two shapes only a non-source can produce (lib/css-sources.mjs) —
 *      the layer that still holds if a Tailwind upgrade reads the same
 *      configuration differently. src/utils/cssSourcesCanary.spec.ts
 *      carries both shapes on purpose: it is the one src file Tailwind must
 *      not read, so the `@source not` line is proven here rather than merely
 *      present.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { posix, styleFilesUnder } from './lib/admin-files.mjs'
import { styleRuns } from './lib/colour-scan.mjs'
import { SENTINELS, classSelectors, sentinelIn, sourceDirectives, strayRules } from './lib/css-sources.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const STYLE = join(SRC, 'style.css')
const ASSETS = join(ROOT, 'dist', 'assets')

/** What src/style.css must declare — paths relative to the stylesheet, as Tailwind reads them. */
const EXPECTED_SOURCES = [
  { path: '../src', not: false },
  { path: '../index.html', not: false },
  { path: '../src/**/*.spec.ts', not: true },
]

const isGlob = (p) => /[*?{]/.test(p)
/** A path resolved from the stylesheet's directory; for a glob, the directory before its first wildcard is resolved and the pattern kept. */
const normalise = (p) => {
  if (!isGlob(p)) return resolve(dirname(STYLE), p)
  const cut = p.slice(0, p.search(/[*?{]/)).lastIndexOf('/') + 1
  return `${resolve(dirname(STYLE), p.slice(0, cut) || '.')}/${p.slice(cut)}`
}
/** A comparable identity: inline lists by their text, paths and globs normalised, so `../src/`, `./../src` and `./../src/**\/*.spec.ts` are the sources they spell. */
const key = (s) => `${s.not ? 'not ' : ''}${s.inline ? `inline(${s.path})` : normalise(s.path)}`
const spell = (s) => `@source ${s.not ? 'not ' : ''}${s.inline ? `inline("${s.path}")` : `"${s.path}"`};`

// ── 1. configuration ─────────────────────────────────────────────────────
const broken = []
const { roots, sources } = sourceDirectives(readFileSync(STYLE, 'utf8'))
const [root, ...extraRoots] = roots
if (!root) broken.push('src/style.css does not import tailwindcss — nothing here can be judged')
else {
  if (root.directive !== '@import "tailwindcss"') broken.push(`src/style.css starts Tailwind with \`${root.directive}\` — the full \`@import "tailwindcss" source(none)\` is what this check reads`)
  if (root.detection !== 'none') broken.push(`src/style.css imports tailwindcss with ${root.detection === 'auto' ? 'no source() clause' : `source("${root.base}")${root.base === 'none' ? ' — a quoted "none" is a path named none, not the keyword' : ''}`} — it must be \`source(none)\`, or Tailwind reads every non-ignored file under app/ as a template`)
}
for (const r of extraRoots) broken.push(`src/style.css also has \`${r.directive}\` — a second root is a second scan, with its own detection${r.detection === 'auto' ? ' (automatic here)' : ''}; one import holds the configuration`)
const declared = new Set(sources.map(key))
for (const s of EXPECTED_SOURCES) {
  if (!declared.has(key(s))) broken.push(`src/style.css is missing \`${spell(s)}\``)
}
const expected = new Set(EXPECTED_SOURCES.map(key))
for (const s of sources) {
  if (expected.has(key(s))) continue
  broken.push(s.inline
    ? `src/style.css safelists \`${spell(s)}\` — classes no component writes are exactly what this guard keeps out of the build; style the element instead`
    : `src/style.css names \`${spell(s)}\` — only src/ and index.html render; a new source belongs in EXPECTED_SOURCES here, with the reason`)
}
for (const s of sources) {
  if (s.not || s.inline || isGlob(s.path)) continue
  if (!existsSync(resolve(dirname(STYLE), s.path))) broken.push(`src/style.css: \`${spell(s)}\` resolves to nothing from src/ — Tailwind reads no file and says nothing; the path is relative to the stylesheet, not to app/`)
}
// Tailwind merges @source from every stylesheet the entry imports, each
// relative to its own file, and the Vite plugin compiles any stylesheet or
// SFC <style> block that starts Tailwind itself as a root of its own, with
// its own (automatic) detection. One file holds the configuration so this
// check can read it; every other .css and every <style> block declares none.
for (const file of styleFilesUnder(SRC, () => false, /\.(css|vue)$/)) {
  if (file === STYLE) continue
  const source = readFileSync(file, 'utf8')
  // Nothing to find unless one of the three words is there at all — which
  // today is no file, so the tokenizer runs over none of the ~300 SFCs.
  if (!/@source|tailwindcss|@tailwind/.test(source)) continue
  const rel = posix(relative(SRC, file))
  const kind = rel.endsWith('.css') ? 'css' : 'vue'
  for (const { css } of styleRuns(source, kind)) {
    const other = sourceDirectives(css)
    for (const r of other.roots) broken.push(`src/${rel} starts Tailwind with \`${r.directive}\` — that is a second root with its own scan; only src/style.css imports Tailwind, and \`@apply\` in a component needs \`@reference\`, not an import`)
    for (const s of other.sources) broken.push(`src/${rel} declares \`${spell(s)}\` — Tailwind honours it from any stylesheet it compiles, but only src/style.css may name sources`)
  }
}

if (broken.length) {
  console.error('✗ css sources: the Tailwind source configuration cannot be trusted\n')
  for (const b of broken) console.error('  ' + b)
  console.error(`
src/style.css imports Tailwind with \`source(none)\` and names what renders as
the only sources: \`@source "../src"\`, \`@source "../index.html"\`, and
\`@source not "../src/**/*.spec.ts"\` for the fixtures beside the source. No
other stylesheet declares any. This check reads that back before it looks at
the build.`)
  process.exit(1)
}

// ── 2. output ────────────────────────────────────────────────────────────
let files = []
try {
  files = readdirSync(ASSETS).filter((f) => f.endsWith('.css'))
} catch {
  /* no dist — reported below */
}
if (files.length === 0) {
  console.error('✗ css sources: no stylesheet in dist/assets — this guard reads the build, so it runs after `vite build`')
  process.exit(1)
}

/** Tailwind's own output carries its utilities layer; a vendored or component sheet that happens to define `.hidden` does not. */
const TAILWIND_MARK = '@layer utilities'
const sheets = files.map((file) => {
  const css = readFileSync(join(ASSETS, file), 'utf8')
  return { file, tailwind: css.includes(TAILWIND_MARK), selectors: classSelectors(css) }
})
// A sentinel in the sheet Tailwind wrote is the proof that it read src/ and
// that the selector scan reads the minifier's output; a count of rules is
// not, because that sheet also holds the palette, the form styles and every
// unscoped <style>, and the vendored sheets have hundreds of their own — and
// a `.flex` in one of those proves nothing about Tailwind.
const found = sheets.filter((s) => s.tailwind).map((s) => ({ ...s, sentinel: sentinelIn(s.selectors) })).find((s) => s.sentinel)
if (!found) {
  console.error(`✗ css sources: the built CSS cannot be judged\n\n  none of ${SENTINELS.join(', ')} is in a stylesheet under dist/assets that carries \`${TAILWIND_MARK}\` — Tailwind emitted no utilities, so it read no source, or the selector scan no longer understands the minifier's output\n`)
  console.error(`The configuration in src/style.css reads correctly, so check what this
Tailwind version makes of \`source(none)\` and the @source lines, then the
scan in lib/css-sources.mjs against the stylesheet that should hold them.`)
  process.exit(1)
}

const leaks = []
for (const { file, selectors } of sheets) {
  for (const { selector, reason } of strayRules(selectors)) leaks.push(`dist/assets/${file}  ${selector}  — ${reason}`)
}
if (leaks.length) {
  console.error(`✗ css sources: ${leaks.length} rule(s) in the built CSS came from outside the sources\n`)
  for (const l of leaks) console.error('  ' + l)
  console.error(`
The configuration in src/style.css reads correctly, yet a rule that no
component could have produced is in dist/ — Tailwind is reading something it
should not (a spec fixture, a guard's example, a line of CLAUDE.md). Check
what this Tailwind version makes of \`source(none)\` and the @source lines.`)
  process.exit(1)
}

const rules = sheets.reduce((n, s) => n + s.selectors.length, 0)
console.log(`✓ css sources: ${rules} class rule(s) in ${files.length} stylesheet(s) clean (${found.sentinel} in ${found.file}), ${sources.length} source line(s) as expected`)
