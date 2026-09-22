#!/usr/bin/env node
/**
 * Stops a translated area regressing to hardcoded English.
 *
 * Scoped to MIGRATED rather than all of src/, because PRs 2-6 have not run
 * yet. Each area PR appends its paths, which makes the sweep a one-way
 * ratchet: a view cannot quietly go back to literals once it has been done.
 *
 * This is a ratchet, not a proof. It reads templates with regexes, not the Vue
 * compiler's AST, so it will miss exotic shapes. Append `i18n-ignore` to a line
 * whose text is genuinely fixed — a wordmark, a glyph, punctuation.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
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
  'views/admin/AdminDashboard.vue',
  'views/admin/AdminEntry.vue',
]

const ATTRS = /(?<!:)\b(?:placeholder|aria-label|title)="([^"]*)"/g
const HAS_WORDS = /[A-Za-zÀ-ž]{2,}/

function templateOf(src) {
  const start = src.indexOf('<template>')
  const end = src.lastIndexOf('</template>')
  return start === -1 || end === -1 ? '' : src.slice(start, end)
}

/** Text between tags, with mustaches and HTML comments removed. */
function bareText(line) {
  const hits = []
  // Lazy up to `}}`, NOT `[^}]*` — an interpolation routinely carries an
  // object literal (`$t('k', { from, to })`), and a negated-brace class stops
  // at its first inner `}`, leaving the tail to look like bare text.
  const stripped = line.replace(/\{\{[\s\S]*?\}\}/g, '').replace(/<!--[\s\S]*?-->/g, '')
  for (const m of stripped.matchAll(/>([^<>]+)</g)) {
    const text = m[1].trim()
    if (HAS_WORDS.test(text)) hits.push(text)
  }
  return hits
}

function attrText(line) {
  const hits = []
  for (const m of line.matchAll(ATTRS)) {
    if (HAS_WORDS.test(m[1])) hits.push(m[0])
  }
  return hits
}

function filesFor(entry) {
  const abs = join(ROOT, 'src', entry)
  if (!statSync(abs).isDirectory()) return [abs]
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith('.vue')) out.push(p)
    }
  }
  walk(abs)
  return out
}

const violations = []

for (const entry of MIGRATED) {
  for (const file of filesFor(entry)) {
    const tpl = templateOf(readFileSync(file, 'utf8'))
    if (!tpl) continue

    tpl.split('\n').forEach((line, i) => {
      if (line.includes('i18n-ignore')) return
      const hits = [...bareText(line), ...attrText(line)]
      if (hits.length) {
        violations.push({
          file: relative(ROOT, file).split(sep).join('/'),
          line: i + 1,
          hits: [...new Set(hits)].join(' | '),
        })
      }
    })
  }
}

if (violations.length === 0) {
  console.log(`✓ admin strings: ${MIGRATED.length} migrated path(s), no hardcoded text`)
  process.exit(0)
}

console.error(`\n✗ admin strings: ${violations.length} hardcoded string(s) in migrated files\n`)
// Line numbers count from the file's opening <template>, not from line 1.
for (const v of violations) console.error(`  ${v.file}:+${v.line}  ${v.hits}`)
console.error(`
Move the text into app/src/i18n/en/<area>.ts and its pl/ counterpart, then read
it with $t('<area>.<key>'). If the string is genuinely fixed — a wordmark, a
glyph, punctuation — append i18n-ignore to that line.
Line numbers are offsets from the file's opening <template>.
`)
process.exit(1)
