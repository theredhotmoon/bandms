#!/usr/bin/env node
/**
 * Keeps Tailwind reading only what renders on the public site.
 *
 * Tailwind v4 finds class names by reading files, and by default it reads
 * every file under web/ that git does not ignore — scripts/check-tokens.mjs
 * among them, whose own prose examples (`text-zinc-400`, `rounded-xl`,
 * `bg-transparent`, `border-none`) were emitted as real rules in the built
 * CSS: dead, since the token lint forbids the first two anywhere in src/, but
 * downloaded by every visitor. src/styles/global.css now imports Tailwind
 * with `source(none)` and names src/ as the only source, minus the tests
 * beside its lib.
 *
 * Two checks, on packages/style-guards — the same reader and scanner the
 * admin's check-css-sources.mjs uses, with their specs, because both images
 * carry packages/ (web/Dockerfile copies packages/ and web/, nothing of app/)
 * and one reader of `@import`, `@tailwind` and `@source` is better than two
 * that drift:
 *   1. The configuration, as written: `source(none)` on the import, exactly
 *      the expected `@source` lines, every path starting from a directory
 *      that exists, and no other stylesheet or component <style> under src/
 *      starting a Tailwind root of its own (each one would be a second scan,
 *      with automatic detection) or naming a source.
 *   2. The configuration, as Tailwind reads it: its own compiler
 *      (@tailwindcss/node) and scanner (@tailwindcss/oxide) — the copies
 *      @tailwindcss/postcss resolves from its own directory, so they are the
 *      build's, held to the plugin's version — say which files it opens for
 *      that stylesheet. Every one must be under src/, none may be a test, the
 *      layout must be among them (the scan found the tree that renders) and
 *      src/lib/slugs.test.ts must not be (the `not` line works, in Tailwind's
 *      own glob semantics and not only in this repo's reading of it).
 *
 * The admin's guard also judges the built CSS; this one does not: the public
 * site is built at container start (web/docker/start.sh), and a check that
 * reads dist/ there would turn a guard failure into a crash-looping site.
 * Asking the scanner is the general form of that check without the build.
 */
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { entryProblems, fixtureTest, strayRootProblems } from '../../packages/style-guards/src/css-sources.mjs'
import { posix } from '../../packages/style-guards/src/paths.mjs'
import { importedCoreNote, scanAdvice, scanProblems, tailwindScan } from '../../packages/style-guards/src/tailwind-scan.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const STYLE = join(SRC, 'styles', 'global.css')
const LABEL = 'src/styles/global.css'
/** The quote global.css is written in; every message spells a line in it. */
const QUOTE = "'"
/** The plugin postcss.config runs; the compiler and scanner asked below are the copies it resolves. */
const PLUGIN = '@tailwindcss/postcss'
/** A stylesheet-relative source path shown from web/, where every other path in a message is. */
const fromRoot = (p) => posix(relative(ROOT, resolve(dirname(STYLE), p)))

/** What global.css must declare — paths relative to it, as Tailwind reads them: src/, minus the tests beside src/lib. */
const EXPECTED_SOURCES = [
  { path: '../', not: false },
  { path: '../**/*.test.ts', not: true },
]
/** Whether a path is one Tailwind is told not to read, by the `not` lines above. */
const isFixture = fixtureTest(EXPECTED_SOURCES)

/** Every tree whose components this build compiles: its own src/, and the shared rider sheet PublicRider.vue renders. */
const TREES = [
  { dir: SRC, label: 'src' },
  { dir: join(ROOT, '..', 'packages', 'rider-core', 'src'), label: 'packages/rider-core/src' },
]

// ── 1. the configuration as written ──────────────────────────────────────
const { problems, sources, spell } = entryProblems(STYLE, EXPECTED_SOURCES, { label: LABEL, tree: 'web/', quote: QUOTE })
const broken = [...problems, ...strayRootProblems(TREES, STYLE, { label: LABEL, quote: QUOTE })]

if (broken.length) {
  console.error('✗ css sources: the Tailwind source configuration cannot be trusted\n')
  for (const b of broken) console.error('  ' + b)
  console.error(`
${LABEL} imports Tailwind with \`source(none)\` and names what renders as the
only source, the tests beside src/lib excluded as fixtures:
  ${EXPECTED_SOURCES.map(spell).join('\n  ')}
No other stylesheet or <style> block declares any.`)
  process.exit(1)
}

// ── 2. the configuration as Tailwind reads it ────────────────────────────
let scan
try {
  scan = await tailwindScan(STYLE, { plugin: PLUGIN, projectRoot: ROOT })
} catch (e) {
  console.error(`✗ css sources: Tailwind could not be asked about ${LABEL}\n\n  ${e.message}\n`)
  process.exit(1)
}
// Printed before any verdict: when the scan disagrees with the lines, the one
// version that moved is the first thing the reader should know.
const note = importedCoreNote(scan)
if (note) console.warn(`⚠ css sources: ${note}`)
const read = scanProblems(scan, {
  label: LABEL,
  styleFile: STYLE,
  expected: EXPECTED_SOURCES,
  projectRoot: ROOT,
  allowed: [SRC],
  isFixture,
  required: [join(SRC, 'layouts', 'BaseLayout.astro'), join(SRC, 'pages', 'index.astro')],
  excluded: [join(SRC, 'lib', 'slugs.test.ts')],
  quote: QUOTE,
})
if (read.length) {
  console.error(`✗ css sources: Tailwind ${scan.versions.tailwindcss} reads ${LABEL} differently from the lines in it\n`)
  for (const r of read) console.error('  ' + r)
  console.error('\n' + scanAdvice(LABEL))
  process.exit(1)
}

console.log(`✓ css sources: ${sources.length} source line(s) in ${LABEL} as expected, no other Tailwind root under ${TREES.map((t) => t.label).join(' or ')}; Tailwind ${scan.versions.tailwindcss} reads ${scan.files.length} file(s), all under src/, none matching ${EXPECTED_SOURCES.filter((s) => s.not).map((s) => fromRoot(s.path)).join(' or ')}`)
