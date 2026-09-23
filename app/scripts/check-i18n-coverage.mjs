#!/usr/bin/env node
/**
 * Every file that renders a translation must be on the string lint's ratchet.
 *
 * Translating a file and guarding a file are two separate acts, and doing the
 * first without the second is the single most repeated defect in this sweep.
 * Six reviews found five instances: ClipCategoryPicker (a child of the
 * Reference block's add-clip panel), TicketStatusBadge (translated in the very
 * commit answering a review finding about this), TableToolbar, and the shared
 * form children AttachedClipsField / SlugInput / SocialLinksEditor.
 *
 * Each time the area read as "done" while a component inside it still rendered
 * English, because MIGRATED is a hand-maintained list and nothing checked it
 * against reality. This does.
 *
 * The inverse — a guarded file with no translations — is fine and not reported:
 * SortHeader takes all its copy as props, and listing it still holds it to the
 * lint if someone adds a literal later.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const SRC = join(ROOT, 'src')
const LINT = join(ROOT, 'scripts', 'check-admin-strings.mjs')

/**
 * The MIGRATED entries, read from the string lint so there is one list.
 *
 * The array's end is found by matching brackets, not by the first `]`: a
 * comment or a future nested value inside the region would truncate the list
 * silently, and a *partial* parse does not trip the empty-list check — it just
 * reports already-listed files as gaps, telling you to add what is there.
 */
function migratedPaths() {
  const src = readFileSync(LINT, 'utf8')
  const open = src.indexOf('const MIGRATED = [')
  if (open === -1) {
    console.error('✗ i18n coverage: could not find MIGRATED in check-admin-strings.mjs')
    process.exit(1)
  }
  let depth = 0
  let end = -1
  for (let i = src.indexOf('[', open); i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) {
    console.error('✗ i18n coverage: MIGRATED array is unterminated')
    process.exit(1)
  }
  return [...src.slice(open, end).matchAll(/'([^']+)'/g)].map((m) => m[1])
}

const MIGRATED = migratedPaths()
// Before the scan, not after: a broken parse must not first report every file
// in src/ as an uncovered gap.
if (MIGRATED.length === 0) {
  console.error('✗ i18n coverage: parsed zero MIGRATED entries — the parser is broken')
  process.exit(1)
}

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name !== 'i18n') walk(p)
    } else if (p.endsWith('.vue') || (p.endsWith('.ts') && !p.endsWith('.spec.ts'))) {
      // Specs are excluded deliberately. A spec that calls useI18n() or
      // asserts on catalogue text would be reported as a gap, and the only
      // remedy this guard offers — add it to MIGRATED — then makes the string
      // lint flag the assertions themselves. There is no exit from that short
      // of i18n-ignore on every assertion line.
      files.push(p)
    }
  }
}
walk(SRC)

/**
 * Renders a translation.
 *
 * Detect the *import*, not the call shape. The first version of this matched
 * `t(` followed by a quote — and so missed TicketStatusBadge, which calls
 * `t(entry.key)` with a computed key, i.e. precisely the file this guard was
 * written to catch. It reported a clean tree and I nearly shipped it.
 */
const RENDERS = /useI18n\s*\(|\$t\s*\(|keypath\s*=|<i18n-t|\bi18n\.global\.t\s*\(/

/**
 * Strip comments before testing. Without this a doc comment merely *mentioning*
 * useI18n() reports the file as a gap, since the regex reads raw text.
 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const toRel = (abs) => relative(SRC, abs).split(sep).join('/')
const covered = (rel) => MIGRATED.some((m) => rel === m || rel.startsWith(m + '/'))

const gaps = []
for (const file of files) {
  const rel = toRel(file)
  if (covered(rel)) continue
  if (RENDERS.test(stripComments(readFileSync(file, 'utf8')))) gaps.push(rel)
}

if (gaps.length === 0) {
  console.log(`✓ i18n coverage: every translating file is on the ratchet (${MIGRATED.length} path(s))`)
  process.exit(0)
}

console.error(`\n✗ i18n coverage: ${gaps.length} file(s) render translations but are not guarded\n`)
for (const g of gaps) console.error(`  src/${g}`)
console.error(`
Add each to MIGRATED in app/scripts/check-admin-strings.mjs. Until then the
string lint never looks at them, so the area they sit in reads as finished
while they can quietly go back to hardcoded English.
`)
process.exit(1)
