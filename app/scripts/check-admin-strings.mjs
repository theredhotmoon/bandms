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
import { copyHits } from './lib/template-scan.mjs'

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
  'components/rig',
  'views/admin/BandMembersAdminView.vue',
  'views/admin/MyProfileView.vue',
  'views/admin/MySetupsView.vue',
  'components/admin/forms/BandMemberForm.vue',
  'components/band-member',
  'views/admin/ReleasesAdminView.vue',
  'components/admin/forms/ReleaseForm.vue',
  'components/admin/forms/ImageDropZone.vue',
  'views/admin/PhotosAdminView.vue',
  'views/admin/SetlistsAdminView.vue',
  'components/setlist',
  'components/ui/InstrumentIconPicker.vue',
  'components/tech-rider/TechRiderStagePlot.vue',
  'components/tech-rider/PlacementModal.vue',
  'components/tech-rider/StagePlotMemberSelector.vue',
  'components/tech-rider/RiderRequirements.vue',
  'components/tech-rider/RiderSourceBadge.vue',
  'components/tech-rider/RiderChannelList.vue',
  'components/tech-rider/RiderConfirmations.vue',
  'components/tech-rider/RiderPublishModal.vue',
  'components/tech-rider/RiderVersionHistory.vue',
  'components/tech-rider/TechRiderCompleteness.vue',
  'components/tech-rider/TechRiderCover.vue',
  'components/tech-rider/TechRiderPaFoh.vue',
  'components/tech-rider/TechRiderSidebar.vue',
  'views/admin/TechRiderAdminView.vue',
  'views/admin/MusicVideosAdminView.vue',
  'components/admin/forms/BatchPhotoUpload.vue',
  'composables/useTechRiderEditor.ts',
  'views/admin/BandProfileAdminView.vue',
  'views/admin/AdminDashboard.vue',
  'views/admin/AdminEntry.vue',
]


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
