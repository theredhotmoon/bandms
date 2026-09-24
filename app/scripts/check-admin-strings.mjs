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
  'components/admin/EntityRelationsPanel.vue',
  'components/admin/forms/SingleImageUpload.vue',
  'components/admin/forms/ClipForm.vue',
  'components/AppNavbar.vue',
  'views/admin/BandProfileAdminView.vue',
  'views/admin/AdminDashboard.vue',
  'views/admin/AdminEntry.vue',
]

import {
  HAS_WORDS, KEYPATH, hasTwoLetters, looksLikeCopy, COPY_ATTRS, STATIC_ATTR, BOUND_ATTR,
  LITERAL, OTHER_DIRECTIVE, copyLiterals, templateOf, textRuns,
} from './lib/template-scan.mjs'

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
