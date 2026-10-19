#!/usr/bin/env node
/**
 * Keeps the shipped stylesheet free of rules that came from files that are
 * not sources. Runs AFTER `vite build`, unlike the other guards, because it
 * reads dist/: the question is what Tailwind actually emitted, not what the
 * sources say.
 *
 * Tailwind v4 finds class names by reading files, and by default it reads
 * every file under app/ that git does not ignore. That included scripts/ (the
 * guards and their specs), e2e/ and CLAUDE.md, so a fixture like
 * `[--radius-card:4px]` in radius-scan.spec.ts, `bg-[#141414]` in
 * colour-scan.spec.ts or the `bg-[#…]` example in the guard table each became
 * a real rule in production CSS — dead, since no element carries the class,
 * but shipped on every admin page load all the same. src/style.css now turns
 * detection off (`source(none)`) and names src/ minus its specs as the only
 * source. This checks the output for the two selector shapes that only a
 * non-source can produce (lib/css-sources.mjs), so loosening that
 * configuration — or moving it, or a Tailwind upgrade that reads it
 * differently — fails the build with the selector that leaked.
 *
 * What it cannot see: a dropped `@source not "../src/**\/*.spec.ts"` alone.
 * The specs beside the source hold ordinary utility names (`sepia`,
 * `rounded-2xl`), which are dead weight but not provably foreign, and this
 * check deliberately judges shapes rather than keeping a list of fixtures.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { classSelectors, strayRules } from './lib/css-sources.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ASSETS = join(ROOT, 'dist', 'assets')

let files
try {
  files = readdirSync(ASSETS).filter((f) => f.endsWith('.css'))
} catch {
  files = []
}
if (files.length === 0) {
  console.error('✗ css sources: no stylesheet in dist/assets — run this after vite build')
  process.exit(1)
}

let rules = 0
const violations = []
for (const file of files) {
  const css = readFileSync(join(ASSETS, file), 'utf8')
  rules += classSelectors(css).length
  for (const { selector, reason } of strayRules(css)) violations.push(`dist/assets/${file}  ${selector}  — ${reason}`)
}

// Too few means the selector scan broke, not that the output is clean.
if (rules < 100) violations.push(`only ${rules} class rule(s) found across ${files.length} stylesheet(s) — the selector scan is broken`)

if (violations.length) {
  console.error(`✗ css sources: ${violations.length} rule(s) in the built CSS came from outside src/\n`)
  for (const v of violations) console.error('  ' + v)
  console.error(`
Tailwind reads only src/ (minus *.spec.ts) for class names: \`@import "tailwindcss"
source(none)\` and the @source lines in src/style.css. A rule here that no
component could have produced means that narrowing was lost — a spec fixture,
a guard's example or a line of CLAUDE.md is being read as a template again.`)
  process.exit(1)
}

console.log(`✓ css sources: ${rules} class rule(s) in ${files.length} stylesheet(s), none from outside src/`)
