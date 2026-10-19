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
 * specs, and index.html — as the only sources (lib/css-sources.mjs holds
 * that list).
 *
 * Two checks, in order, on the shared reader in packages/style-guards:
 *   1. The configuration: the bare keyword `source(none)` on the import,
 *      exactly the expected `@source` lines (an `inline()` safelist counts as
 *      a source and is unexpected too), every path starting from a directory
 *      that exists — a path that resolves to nothing is the failure that
 *      needs this most, since Tailwind reads no file, throws nothing, and
 *      emits zero utilities into a build that is otherwise green — and no
 *      other stylesheet or SFC <style> under src/ starting a Tailwind root of
 *      its own or naming a source.
 *   2. The output in dist/: one of the sentinel utilities the admin cannot
 *      render without is present in the sheet that carries Tailwind's own
 *      `@layer utilities` (so Tailwind read src/ at all, and the selector
 *      scan reads the minifier's output), and no selector has one of the two
 *      shapes only a non-source can produce — the layer that still holds if
 *      a Tailwind upgrade reads the same configuration differently.
 *      src/utils/cssSourcesCanary.spec.ts carries both shapes on purpose: it
 *      is the one src file Tailwind must not read, so the `@source not` line
 *      is proven here rather than merely present.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EXPECTED_SOURCES, SENTINELS, TAILWIND_MARK, classSelectors, entryProblems, sentinelIn, strayRootProblems, strayRules,
} from './lib/css-sources.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const STYLE = join(SRC, 'style.css')
const ASSETS = join(ROOT, 'dist', 'assets')
const LABEL = 'src/style.css'

// ── 1. configuration ─────────────────────────────────────────────────────
const { problems, sources, spell } = entryProblems(STYLE, EXPECTED_SOURCES, { label: LABEL, tree: 'app/' })
const broken = [...problems, ...strayRootProblems(SRC, STYLE, { label: LABEL, exts: /\.(css|vue)$/ })]

if (broken.length) {
  console.error('✗ css sources: the Tailwind source configuration cannot be trusted\n')
  for (const b of broken) console.error('  ' + b)
  console.error(`
${LABEL} imports Tailwind with \`source(none)\` and names what renders as the
only sources, the specs beside the source excluded as fixtures:
  ${EXPECTED_SOURCES.map(spell).join('\n  ')}
No other stylesheet declares any. This check reads that back before it looks
at the build.`)
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
  console.error(`The configuration in ${LABEL} reads correctly, so check what this
Tailwind version makes of \`source(none)\` and the @source lines, then the
scan in packages/style-guards against the stylesheet that should hold them.`)
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
The configuration in ${LABEL} reads correctly, yet a rule that no component
could have produced is in dist/ — Tailwind is reading something it should not
(a spec fixture, a guard's example, a line of CLAUDE.md). Check what this
Tailwind version makes of \`source(none)\` and the @source lines.`)
  process.exit(1)
}

const rules = sheets.reduce((n, s) => n + s.selectors.length, 0)
console.log(`✓ css sources: ${rules} class rule(s) in ${files.length} stylesheet(s) clean (${found.sentinel} in ${found.file}), ${sources.length} source line(s) as expected`)
