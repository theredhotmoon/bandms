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
 *   1. The configuration, read back out of src/style.css: `source(none)` on
 *      the import, exactly the expected `@source` lines (an `inline()`
 *      safelist counts as a source and is unexpected too), and every positive
 *      path resolving to something. A path that resolves to nothing is the
 *      failure that needs this most — Tailwind reads no file, throws nothing,
 *      and emits zero utilities into a build that is otherwise green.
 *   2. The output in dist/: the sentinel utility src is known to use is
 *      present (so Tailwind read src/ at all), the stylesheet that holds it
 *      has enough utility rules for the selector scan to be trusted, and no
 *      selector has one of the two shapes only a non-source can produce
 *      (lib/css-sources.mjs) — the layer that still holds if a Tailwind
 *      upgrade reads the same configuration differently.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SENTINEL, classSelectors, hasSentinel, sourceDirectives, strayRules } from './lib/css-sources.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const STYLE = join(ROOT, 'src', 'style.css')
const ASSETS = join(ROOT, 'dist', 'assets')

/** What src/style.css must declare — paths relative to the stylesheet, as Tailwind reads them. */
const EXPECTED_SOURCES = [
  { path: '../src', not: false },
  { path: '../index.html', not: false },
  { path: '../src/**/*.spec.ts', not: true },
]

const isGlob = (p) => /[*?{]/.test(p)
/** A comparable identity: globs and inline lists by their text, plain paths resolved, so `../src/` and `./../src` are one source. */
const key = (s) => `${s.not ? 'not ' : ''}${s.inline ? `inline(${s.path})` : isGlob(s.path) ? s.path : resolve(dirname(STYLE), s.path)}`
const spell = (s) => `@source ${s.not ? 'not ' : ''}${s.inline ? `inline("${s.path}")` : `"${s.path}"`};`

// ── 1. configuration ─────────────────────────────────────────────────────
const broken = []
const { imported, detection, sources } = sourceDirectives(readFileSync(STYLE, 'utf8'))
if (!imported) broken.push('src/style.css does not import tailwindcss — nothing here can be judged')
else if (detection !== 'none') broken.push(`src/style.css imports tailwindcss with ${detection === 'auto' ? 'no source() clause' : `source("${detection}")`} — it must be \`source(none)\`, or Tailwind reads every non-ignored file under app/ as a template`)
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

if (broken.length) {
  console.error('✗ css sources: the Tailwind source configuration cannot be trusted\n')
  for (const b of broken) console.error('  ' + b)
  console.error(`
src/style.css imports Tailwind with \`source(none)\` and names what renders as
the only sources: \`@source "../src"\`, \`@source "../index.html"\`, and
\`@source not "../src/**/*.spec.ts"\` for the fixtures beside the source. This
check reads that back before it looks at the build.`)
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

const sheets = files.map((file) => ({ file, selectors: classSelectors(readFileSync(join(ASSETS, file), 'utf8')) }))
const tailwind = sheets.find((s) => hasSentinel(s.selectors))
// Vue's scoped rules carry [data-v-…]; what is left in Tailwind's own stylesheet is its utilities plus the global stylesheets.
const utilities = tailwind ? tailwind.selectors.filter((s) => !s.includes('data-v-')).length : 0
const health = []
if (!tailwind) health.push(`${SENTINEL} is in no stylesheet under dist/assets — Tailwind emitted no utilities, so it read no source`)
else if (utilities < 100) health.push(`only ${utilities} non-scoped class rule(s) in ${tailwind.file}, the stylesheet that holds ${SENTINEL} — the selector scan is broken`)

if (health.length) {
  console.error('✗ css sources: the built CSS cannot be judged\n')
  for (const h of health) console.error('  ' + h)
  console.error(`
The configuration in src/style.css reads correctly, so if Tailwind emitted no
utilities, check what this Tailwind version makes of \`source(none)\` and the
@source lines; if it did, the selector scan in lib/css-sources.mjs no longer
understands the minifier's output.`)
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

console.log(`✓ css sources: ${utilities} utility rule(s) in ${tailwind.file}, ${files.length} stylesheet(s) clean, ${sources.length} source line(s) as expected`)
