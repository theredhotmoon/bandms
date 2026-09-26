#!/usr/bin/env node
/**
 * Stops a translated area regressing to hardcoded English.
 *
 * Scoped to MIGRATED rather than all of src/, because PRs 2-6 have not run
 * yet. Each area PR appends its paths, which makes the sweep a one-way
 * ratchet: a view cannot quietly go back to literals once it has been done.
 *
 * Two shapes are checked:
 *
 *  1. Template text — bare text nodes and hardcoded placeholder/aria-label/
 *     title attributes.
 *  2. Script strings that are unambiguously user-facing: toast bodies and
 *     reportSaveError messages. The template is only half the surface; a
 *     migrated file that still toasts English is exactly as broken to a Polish
 *     user, and without this the file is locked in as "done".
 *
 * The template scan tracks tag state across the WHOLE template rather than
 * line by line. A per-line `>text<` regex cannot see the dominant shape in
 * this codebase — a nav label alone on its own line between an <svg> and a
 * </RouterLink>, where the line holds no angle bracket at all. That gap let a
 * reverted $t() pass with exit 0.
 *
 * Still a ratchet, not a proof: this is a scanner, not the Vue compiler's AST.
 * Append `i18n-ignore` to a line whose text is genuinely fixed — a wordmark, a
 * glyph, punctuation.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyHits } from './lib/template-scan.mjs'
import { isScannable, MIGRATED } from './lib/ratchet.mjs'

// The same floor check-i18n-coverage has, and this guard runs first.
// Without it an empty ratchet makes the loop below run zero times and print
// "✓ 0 migrated path(s), no hardcoded text" — a green tick for having
// checked nothing. Moving the list out of this file is exactly what makes an
// accidentally empty export plausible.
if (MIGRATED.length === 0) {
  console.error('✗ admin strings: ratchet.mjs exports an empty MIGRATED list')
  process.exit(1)
}

// fileURLToPath, not .pathname: the latter keeps percent-encoding, so a
// checkout under a path with a space resolves to a directory that does not
// exist and the walk throws — failing the build CI actually runs.
const ROOT = fileURLToPath(new URL('..', import.meta.url))



function filesFor(entry) {
  const abs = join(ROOT, 'src', entry)
  if (!existsSync(abs)) return { missing: entry }
  if (!statSync(abs).isDirectory()) return { files: [abs] }
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (isScannable(p)) out.push(p)
    }
  }
  walk(abs)
  return { files: out }
}

const violations = []
const record = (file, line, hits) =>
  violations.push({ file: relative(ROOT, file).split(sep).join('/'), line, hits: [...new Set(hits)].join(' | ') })

const NL = String.fromCharCode(10)

for (const entry of MIGRATED) {
  const { files, missing } = filesFor(entry)
  if (missing) {
    violations.push({ file: `src/${missing}`, line: 0, hits: 'MIGRATED path no longer exists — update the list' })
    continue
  }

  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const lines = src.split(NL)
    const exempt = (n) => (lines[n - 1] ?? '').includes('i18n-ignore')

    for (const { line, hits } of copyHits(src, { isTs: file.endsWith('.ts') })) {
      if (!exempt(line)) record(file, line, hits)
    }
  }
}

if (violations.length === 0) {
  console.log(`✓ admin strings: ${MIGRATED.length} migrated path(s), no hardcoded text`)
  process.exit(0)
}

violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
console.error(`\n✗ admin strings: ${violations.length} hardcoded string(s) in migrated files\n`)
for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.hits}`)
console.error(`
Move the text into app/src/i18n/en/<area>.ts and its pl/ counterpart, then read
it with $t('<area>.<key>') in a template or useI18n().t elsewhere. If the
string is genuinely fixed — a wordmark, a glyph, punctuation — append
i18n-ignore to that line.
`)
process.exit(1)
