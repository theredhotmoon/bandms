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
 * beside its lib. This holds that configuration to exactly those lines, and
 * makes sure no other stylesheet or component <style> under src/ starts a
 * Tailwind root of its own (each one would be a second scan, with automatic
 * detection) or names a source.
 *
 * The reader is packages/style-guards — the same one the admin's
 * check-css-sources.mjs uses, with its spec — because both images carry
 * packages/ (web/Dockerfile copies packages/ and web/, nothing of app/), and
 * one reader of `@import`, `@tailwind` and `@source` is better than two that
 * drift. The admin's guard also judges the built CSS; this one does not: the
 * public site is built at container start (web/docker/start.sh), and a check
 * that reads dist/ there would turn a guard failure into a crash-looping site.
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { entryProblems, strayRootProblems } from '../../packages/style-guards/src/css-sources.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const STYLE = join(SRC, 'styles', 'global.css')
const LABEL = 'src/styles/global.css'

/** What global.css must declare — paths relative to it, as Tailwind reads them: src/, minus the tests beside src/lib. */
const EXPECTED_SOURCES = [
  { path: '../', not: false },
  { path: '../**/*.test.ts', not: true },
]

const { problems, sources, spell } = entryProblems(STYLE, EXPECTED_SOURCES, { label: LABEL, tree: 'web/', quote: "'" })
const broken = [...problems, ...strayRootProblems(SRC, STYLE, { label: LABEL, quote: "'" })]

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

console.log(`✓ css sources: ${sources.length} source line(s) in ${LABEL} as expected, no other Tailwind root under src/`)
