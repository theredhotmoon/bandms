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

/** The MIGRATED entries, read from the string lint so there is one list. */
function migratedPaths() {
  const src = readFileSync(LINT, 'utf8')
  const start = src.indexOf('const MIGRATED = [')
  const end = src.indexOf(']', start)
  if (start === -1 || end === -1) {
    console.error('✗ i18n coverage: could not find MIGRATED in check-admin-strings.mjs')
    process.exit(1)
  }
  return [...src.slice(start, end).matchAll(/'([^']+)'/g)].map((m) => m[1])
}

const MIGRATED = migratedPaths()

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name !== 'i18n') walk(p)
    } else if (p.endsWith('.vue') || p.endsWith('.ts')) {
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
const RENDERS = /useI18n\s*\(|\$t\s*\(|keypath\s*=|<i18n-t/

const toRel = (abs) => relative(SRC, abs).split(sep).join('/')
const covered = (rel) => MIGRATED.some((m) => rel === m || rel.startsWith(m + '/'))

const gaps = []
for (const file of files) {
  const rel = toRel(file)
  if (covered(rel)) continue
  if (RENDERS.test(readFileSync(file, 'utf8'))) gaps.push(rel)
}

if (MIGRATED.length === 0) {
  console.error('✗ i18n coverage: parsed zero MIGRATED entries — the parser is broken')
  process.exit(1)
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
