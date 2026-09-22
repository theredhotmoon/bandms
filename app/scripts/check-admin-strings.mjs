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

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

/** Paths already migrated, relative to app/src. Extend this in every area PR. */
const MIGRATED = [
  'App.vue',
  'components/admin/AdminLayout.vue',
  'components/admin/AdminModal.vue',
  'components/admin/ConfirmDialog.vue',
  'components/admin/EpkVersionHistory.vue',
  'components/admin/Pagination.vue',
  'components/admin/RebuildBar.vue',
  'components/admin/RebuildSettingsModal.vue',
  'components/admin/SortHeader.vue',
  'components/admin/TableToolbar.vue',
  'components/admin/UiLangSwitcher.vue',
  'components/auth/SignInForm.vue',
  'composables/useEpkVersionHistory.ts',
  'components/admin/ConcertTicketsManager.vue',
  'components/admin/forms/ConcertForm.vue',
  'components/admin/forms/TourForm.vue',
  'components/admin/forms/VenueForm.vue',
  'views/admin/ConcertTicketListView.vue',
  'views/admin/ConcertsAdminView.vue',
  'views/admin/DoorCheckView.vue',
  'views/admin/ToursAdminView.vue',
  'views/admin/VenuesAdminView.vue',
  'views/admin/AdminDashboard.vue',
  'views/admin/AdminEntry.vue',
]

const HAS_WORDS = /[A-Za-zÀ-ž]{2,}/
const ATTRS = /(?<!:)\b(?:placeholder|aria-label|title)="([^"]*)"/g

/** Lines that produce user-facing copy outside the template. */
const SCRIPT_CALL = /\b(?:toast\.(?:success|error|info|warning|message)|reportSaveError)\s*\(/
/** Every string literal on such a line, including template literals. */
const ANY_LITERAL = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g
/**
 * Words plus an internal space. User copy has both ("Failed to publish",
 * `v${n} deleted`); the identifiers sharing these lines do not
 * (`version.status === 'pending'`), which is what keeps them unflagged. A
 * genuinely one-word message would slip through — a ratchet, not a proof.
 */
const HAS_INNER_SPACE = /\S\s+\S/

function templateOf(src) {
  const start = src.indexOf('<template>')
  const end = src.lastIndexOf('</template>')
  return start === -1 || end === -1 ? null : { body: src.slice(start, end), offset: src.slice(0, start).split('\n').length }
}

/**
 * Text runs that sit between tags, with their 1-based line within `tpl`.
 *
 * Scans character by character so a run spanning several lines is seen, which
 * a per-line regex cannot do.
 */
function textRuns(tpl) {
  const runs = []
  let i = 0, line = 1, depth = 0, buf = '', bufLine = 1

  const flush = () => {
    if (HAS_WORDS.test(buf)) runs.push({ text: buf.trim().replace(/\s+/g, ' '), line: bufLine })
    buf = ''
  }

  while (i < tpl.length) {
    if (tpl.startsWith('<!--', i)) {
      const end = tpl.indexOf('-->', i)
      const skipped = tpl.slice(i, end === -1 ? tpl.length : end + 3)
      line += (skipped.match(/\n/g) || []).length
      i += skipped.length
      continue
    }
    if (tpl.startsWith('{{', i)) {
      const end = tpl.indexOf('}}', i)
      const skipped = tpl.slice(i, end === -1 ? tpl.length : end + 2)
      line += (skipped.match(/\n/g) || []).length
      i += skipped.length
      continue
    }
    const ch = tpl[i]
    if (ch === '<') { flush(); depth++ }
    else if (ch === '>') { depth = Math.max(depth - 1, 0); buf = ''; bufLine = line }
    else if (depth === 0) {
      if (!buf.trim() && ch.trim()) bufLine = line
      buf += ch
    }
    if (ch === '\n') line++
    i++
  }
  flush()
  return runs
}

function filesFor(entry) {
  const abs = join(ROOT, 'src', entry)
  if (!existsSync(abs)) return { missing: entry }
  if (!statSync(abs).isDirectory()) return { files: [abs] }
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith('.vue') || p.endsWith('.ts')) out.push(p)
    }
  }
  walk(abs)
  return { files: out }
}

const violations = []
const record = (file, line, hits) =>
  violations.push({ file: relative(ROOT, file).split(sep).join('/'), line, hits: [...new Set(hits)].join(' | ') })

for (const entry of MIGRATED) {
  const { files, missing } = filesFor(entry)
  if (missing) {
    violations.push({ file: `src/${missing}`, line: 0, hits: 'MIGRATED path no longer exists — update the list' })
    continue
  }

  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const lines = src.split('\n')
    const exempt = (n) => (lines[n - 1] ?? '').includes('i18n-ignore')

    const tpl = templateOf(src)
    if (tpl) {
      for (const run of textRuns(tpl.body)) {
        const abs = tpl.offset + run.line - 1
        if (!exempt(abs)) record(file, abs, [run.text])
      }
      tpl.body.split('\n').forEach((l, i) => {
        const abs = tpl.offset + i
        if (exempt(abs)) return
        const hits = [...l.matchAll(ATTRS)].filter(m => HAS_WORDS.test(m[1])).map(m => m[0])
        if (hits.length) record(file, abs, hits)
      })
    }

    lines.forEach((l, i) => {
      if (exempt(i + 1) || !SCRIPT_CALL.test(l)) return
      ANY_LITERAL.lastIndex = 0
      const hits = [...l.matchAll(ANY_LITERAL)]
        .map(m => m[1] ?? m[2] ?? m[3])
        .filter(s => s && HAS_WORDS.test(s) && HAS_INNER_SPACE.test(s))
      if (hits.length) record(file, i + 1, hits)
    })
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
