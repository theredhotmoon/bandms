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
  'components/admin/forms/AuthorForm.vue',
  'components/admin/forms/PostForm.vue',
  'components/admin/forms/PressReleaseForm.vue',
  'components/admin/forms/ClipCategoryPicker.vue',
  'components/admin/forms/SlugInput.vue',
  'components/admin/forms/AttachedClipsField.vue',
  'components/admin/forms/SocialLinksEditor.vue',
  'components/admin/RichEditor.vue',
  'components/admin/TableToolbar.vue',
  'components/admin/TicketStatusBadge.vue',
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
  'components/admin/forms/PostBlockEditor.vue',
  'components/admin/forms/blocks',
  'views/admin/AuthorsAdminView.vue',
  'views/admin/NewsletterAdminView.vue',
  'views/admin/PostsAdminView.vue',
  'views/admin/PressReleasesAdminView.vue',
  'views/admin/PitchGeneratorView.vue',
  'views/admin/ClipsAdminView.vue',
  'components/admin/BandLogoManager.vue',
  'components/admin/CareerLevelWidget.vue',
  'components/admin/forms/AboutBioVariantSelect.vue',
  'views/admin/BandProfileAdminView.vue',
  'views/admin/AdminDashboard.vue',
  'views/admin/AdminEntry.vue',
]

const HAS_WORDS = /[A-Za-zÀ-ž]{2,}/
const HAS_INNER_SPACE = /\S\s+\S/
/** A dotted path like shows.venues.title — a key, not copy. */
const KEYPATH = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_-]+)+$/

/**
 * Does this string literal look like something a person reads?
 *
 * Copy either starts with a capital ("Save", "New tour") or contains a space
 * ("✓ Mark as Scanned"). The technical literals sharing these lines —
 * 'main', 'pending', 'T', class names, key paths — do neither. 'PLN' and
 * friends are the residue; mark those i18n-ignore.
 */
/** Two letters ANYWHERE, not two consecutive — "e.g. 500" has no adjacent pair. */
const hasTwoLetters = (v) => !!v && !KEYPATH.test(v) && (v.match(/[A-Za-zÀ-ž]/g) ?? []).length >= 2

function looksLikeCopy(v) {
  if (!hasTwoLetters(v)) return false
  return /^[^a-zà-ž]*[A-ZÀ-Ž]/.test(v) || HAS_INNER_SPACE.test(v)
}

/** Attributes whose value is copy. Bound forms (:title="…") are checked too. */
const COPY_ATTRS = 'placeholder|aria-label|title|label|message|alt'
// Built from a regex literal, NOT a template literal: in a template literal
// `\w` collapses to the literal character `w`, so the lookbehind compiled to
// (?<![:w-]) and excluded only the letter w — meaning `:subtitle="…"` was
// scanned as if it were a static `title="…"`.
const STATIC_ATTR = new RegExp('(?<![:\\w-])(?:' + COPY_ATTRS + ')="([^"]*)"', 'g')
const BOUND_ATTR = new RegExp(`:(?:${COPY_ATTRS})="([^"]*)"`, 'g')
// Escaped quotes ARE handled. Without it, `toast.error('Couldn\'t save', 'Failed
// to publish')` consumes `'Couldn\'` as the first literal, re-anchors mid-line,
// and the second string is never produced — so one apostrophe silently stops a
// whole line being checked. That is hiding a hit, not truncating one.
const LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n]|\\.)*)`/g

/** Any other directive expression: @click="…", :data-tip="…", v-bind:x="…". */
const OTHER_DIRECTIVE = /(?:@|v-on:|v-bind:|:)([A-Za-z0-9_.-]+)="([^"]*)"/g

/**
 * Every string literal inside an expression, filtered to copy.
 *
 * `${…}` is stripped first: the interpolated expression is code, never copy.
 * Without that, `:style="\`width:${pct}%\`"` reads as copy because the
 * identifier supplies the letters. Real copy survives it — `\`v${n} deleted\``
 * becomes "v deleted", which still has a space and letters.
 */
function copyLiterals(expr) {
  LITERAL.lastIndex = 0
  return [...expr.matchAll(LITERAL)]
    .map(m => (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, ''))
    .filter(looksLikeCopy)
}

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

const NL = String.fromCharCode(10)

/** 1-based line count of a prefix. */
const countLines = (prefix) => prefix.split(NL).length

/** Literals inside {{ … }} — where "Save" and every ternary label hides. */
function mustacheHits(tpl, offset) {
  const out = []
  const re = /\{\{([\s\S]*?)\}\}/g
  let m
  while ((m = re.exec(tpl)) !== null) {
    const hits = copyLiterals(m[1])
    if (hits.length) out.push({ line: offset + countLines(tpl.slice(0, m.index)) - 1, hits })
  }
  return out
}

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

    const tpl = templateOf(src)
    if (tpl) {
      for (const run of textRuns(tpl.body)) {
        const abs = tpl.offset + run.line - 1
        if (!exempt(abs)) record(file, abs, [run.text])
      }
      for (const m of mustacheHits(tpl.body, tpl.offset)) {
        if (!exempt(m.line)) record(file, m.line, m.hits)
      }
      tpl.body.split(NL).forEach((l, i) => {
        const abs = tpl.offset + i
        if (exempt(abs)) return
        // A STATIC copy attribute's whole value is user-facing by definition,
        // so the capital-or-space heuristic must NOT apply here — it would let
        // placeholder="unlimited" through, which is exactly the regression the
        // ratchet exists to stop. Any two letters is enough.
        STATIC_ATTR.lastIndex = 0
        const stat = [...l.matchAll(STATIC_ATTR)].map(m => m[1]).filter(hasTwoLetters)
        BOUND_ATTR.lastIndex = 0
        const bound = [...l.matchAll(BOUND_ATTR)].flatMap(m => copyLiterals(m[1]))
        // Literals in any other directive expression — @click="err = 'Try again'",
        // :data-tip="'Not on sale'" — which no attribute list would cover.
        OTHER_DIRECTIVE.lastIndex = 0
        const other = [...l.matchAll(OTHER_DIRECTIVE)].flatMap(m => copyLiterals(m[2]))
        const hits = [...stat, ...bound, ...other]
        if (hits.length) record(file, abs, hits)
      })
    }

    // Script side: any copy literal, not just toasts. A modal title built in a
    // computed is exactly as user-facing as one in the template.
    const sStart = src.indexOf('<script')
    const sEnd = src.lastIndexOf('</script>')
    const scriptRange = file.endsWith('.ts')
      ? [0, lines.length]
      : (sStart === -1 ? null : [countLines(src.slice(0, sStart)) - 1, countLines(src.slice(0, sEnd))])
    if (scriptRange) {
      for (let i = scriptRange[0]; i < scriptRange[1]; i++) {
        const l = lines[i]
        if (!l || exempt(i + 1)) continue
        if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue        // comments
        // Anchored: the old `from\s+['"]` alternative was unanchored, so ANY
        // line containing `from '` was skipped whole — including
        // toast.success(`Imported ${n} rows from "${f}"`) and any line with a
        // trailing `// lifted from 'X'` comment.
        if (/^\s*(?:import\b|export\s+(?:\*|\{|type\b))/.test(l)) continue
        const hits = copyLiterals(l)
        if (hits.length) record(file, i + 1, hits)
      }
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
