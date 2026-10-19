#!/usr/bin/env node
/**
 * Keeps admin cards on the 0.75rem corner DESIGN.md gives them — written as
 * the one token that holds it: `var(--radius-card)` in a stylesheet,
 * `rounded-card` in a class list, both from the `@theme` key in src/style.css.
 *
 * The radius scale is xs/sm/md/lg (0.25/0.375/0.5/0.75rem) and the role picks
 * the step: cards, table cards, drop zones and the modal panel take lg. Every
 * value here is on the scale, so a card at 6px or 0.5rem looks deliberate in
 * review — that is how nine cards, nine card-like containers and five drop
 * zones drifted to the input/button radius while the rest stayed at 0.75rem
 * (#197). A card rule that writes the token cannot drift by a typo, and a
 * card rule that writes a literal 0.75rem fails here even though the shape
 * is right, so the corner has one source rather than ~45 agreeing numbers.
 * The same for the template side: Tailwind's `rounded-xl` is 0.75rem, the
 * step the scale reserves for cards, so every use of it in the admin is a
 * card written as a literal and is told to use `rounded-card`.
 *
 * What counts as a card rule, and which corners count as the card corner, is
 * lib/radius-scan.mjs (pinned by its spec). Which files are admin chrome is
 * lib/admin-files.mjs, shared with check-admin-colours.mjs: the fan pages and
 * the printable rider are outside the admin design system.
 *
 * Two lists live here because they are design decisions, not parsing. Both
 * are keyed by file, because a class name inside a scoped <style> is only
 * meaningful in that component: `form-panel` elsewhere may not be a card, and
 * a future `.role-card` elsewhere may not be a control. An entry whose class
 * the scan never meets fails the build, so a rename cannot quietly drop a
 * surface from the guard.
 *   - OPTION_TILES: classes named `*-card` that are selectable controls and
 *     so take the 0.5rem control corner (DESIGN.md, Cards).
 *   - CONTAINERS: card surfaces whose class does not say `card`.
 *
 * The token itself is pinned too: src/style.css must define it exactly once,
 * as 0.75rem, and no other stylesheet in the SPA may define it — not only the
 * admin files, because App.vue's unscoped <style> and admin-palette.css are
 * global and `:root { --radius-card: 4px }` in either would round every card
 * while every rule still read as correct. Comments are not definitions.
 */
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { adminStyleFiles, posix, styleFilesUnder } from './lib/admin-files.mjs'
import { CARD_RADIUS, CARD_TOKEN, CARD_VAR, IGNORE_MARKER, UTILITY_CARD, scanCards, tokenDefinitions, utilityCardLiterals } from './lib/radius-scan.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const TOKEN_FILE = 'style.css'

/** Named `*-card` but a selectable option, so they take the control radius — paths relative to src/. */
const OPTION_TILES = {
  'components/admin/forms/BandMemberForm.vue': ['main-inst-card'],
  'views/admin/BandProfileAdminView.vue': ['career-level-card'],
  'views/admin/UsersAdminView.vue': ['role-card'],
}

/**
 * Card surfaces whose class does not say so — paths relative to src/.
 * Drop zones are here too: DESIGN.md (Shapes) gives them the card corner.
 */
const CONTAINERS = {
  'components/admin/BandLogoManager.vue': ['blm-upload-preview-wrap'],
  'components/admin/ConcertTicketsManager.vue': ['form-panel'],
  'components/admin/EntityRelationsPanel.vue': ['assoc-sections'],
  'components/admin/forms/BandMemberForm.vue': ['aside-drop'],
  'components/admin/forms/ConcertForm.vue': ['band-pool', 'lineup-panel', 'poster-drop'],
  'components/admin/forms/ImageDropZone.vue': ['drop-zone'],
  'components/admin/forms/PostBlockEditor.vue': ['block-row'],
  'components/admin/forms/PressReleaseForm.vue': ['og-preview'],
  'components/admin/forms/ReleaseForm.vue': ['cover-drop', 'track-block'],
  'components/admin/forms/SingleImageUpload.vue': ['siu-drop', 'siu-preview'],
  'components/admin/forms/blocks/ImageBlockEditor.vue': ['img-drop'],
  'components/setlist/SetlistEditor.vue': ['add-panel'],
  'views/admin/DoorCheckView.vue': ['scan-log'],
  'views/admin/PhotosAdminView.vue': ['photo-item'],
}

const { files, problems } = adminStyleFiles(SRC)
const violations = [...problems]
const kindOf = (rel) => (rel.endsWith('.css') ? 'css' : 'vue')

// The token is the single source of the card corner, so its definition is
// checked rather than trusted: exactly one, in style.css, at DESIGN.md's
// value. A second definition there (the light-theme block, say) would be a
// per-theme corner nobody asked for.
const defs = tokenDefinitions(readFileSync(join(SRC, TOKEN_FILE), 'utf8'), 'css')
if (defs.length === 0) violations.push(`src/${TOKEN_FILE}: ${CARD_TOKEN} is not defined — every card reads it`)
for (const { line, value } of defs.slice(1)) violations.push(`src/${TOKEN_FILE}:${line}  defines ${CARD_TOKEN} a second time (${value}) — it is set once`)
if (defs.length && defs[0].value !== CARD_RADIUS) violations.push(`src/${TOKEN_FILE}:${defs[0].line}  ${CARD_TOKEN} is ${defs[0].value}, DESIGN.md gives cards ${CARD_RADIUS}`)

// Every other stylesheet in the SPA, admin chrome or not: a redefinition in
// App.vue's global <style> or in the palette reaches every card.
for (const file of styleFilesUnder(SRC, (rel) => rel === TOKEN_FILE)) {
  const rel = posix(relative(SRC, file))
  for (const { line, value } of tokenDefinitions(readFileSync(file, 'utf8'), kindOf(rel))) {
    violations.push(`src/${rel}:${line}  redefines ${CARD_TOKEN} (${value}) — the card corner is set once, in src/${TOKEN_FILE}`)
  }
}

const listsOf = (rel) => ({
  optionTiles: new Set(OPTION_TILES[rel] ?? []),
  containers: new Set(CONTAINERS[rel] ?? []),
})

// One pass per admin file: the card rules to judge, which listed classes are
// still the last compound of a real rule, and any card rounded by utility.
let cards = 0
let utilityCards = 0
const seen = new Map()
for (const file of files) {
  const rel = posix(relative(SRC, file))
  const kind = kindOf(rel)
  const source = readFileSync(file, 'utf8')
  const { rules, classes } = scanCards(source, kind, listsOf(rel))
  seen.set(rel, classes)
  for (const { line, card, radius, ok, literal } of rules) {
    cards++
    if (ok) continue
    // `radius` is a bare value for the shorthand, or `prop: value; ...` when longhands are involved.
    const decl = radius.includes(':') ? radius : `border-radius: ${radius}`
    violations.push(`src/${rel}:${line}  .${card} { ${decl} }${literal ? `  — the right corner, but spell it ${CARD_VAR}` : ''}`)
  }
  if (kind === 'vue') {
    for (const { line, utility } of utilityCardLiterals(source)) {
      violations.push(`src/${rel}:${line}  ${utility} — the card corner as a Tailwind literal; use ${utility.replace(/rounded(-[a-z]+)?-xl$/, UTILITY_CARD)}`)
    }
    utilityCards += (source.match(new RegExp(`(?<![\\w-])(?:[a-z-]+:)*${UTILITY_CARD}(?![\\w-])`, 'g')) ?? []).length
  }
}

// A listed class that no longer heads a rule in its file is rot: the surface
// it named has been renamed or removed, and the guard would silently stop
// covering it (or stop exempting it) while the list still reads as complete.
// A mention in a comment, a template class="..." or a descendant selector
// does not count — only a rule that styles the class itself.
for (const [name, list] of [['OPTION_TILES', OPTION_TILES], ['CONTAINERS', CONTAINERS]]) {
  for (const [path, classes] of Object.entries(list)) {
    if (!seen.has(path)) {
      violations.push(`src/${path}: ${name} entry no longer exists — update ${name}`)
      continue
    }
    for (const cls of classes) {
      if (!seen.get(path).has(cls)) {
        violations.push(`src/${path}: .${cls} is listed in ${name} but no rule there styles it — update ${name}`)
      }
    }
  }
}

// Zero cards found means the parser broke, not that every card is right.
if (cards < 10) violations.push(`only ${cards} card rule(s) found — the style scan is broken`)

if (violations.length) {
  console.error(`✗ admin radius: ${violations.length} card(s) off ${CARD_VAR}, the ${CARD_RADIUS} corner DESIGN.md gives cards\n`)
  for (const v of violations) console.error('  ' + v)
  console.error(`
Cards, table cards, drop zones and the modal panel write ${CARD_VAR} in a
stylesheet or ${UTILITY_CARD} in a class list (${CARD_RADIUS}, defined once in
src/${TOKEN_FILE}); inputs and buttons use 0.5rem, row buttons 0.375rem, badges
0.25rem (app/DESIGN.md, Shapes). A literal ${CARD_RADIUS} or rounded-xl on a card is
the right shape and still fails: the token is what keeps the corner one value.
A selectable option tile named *-card takes the control radius — add it to
OPTION_TILES under its file. A card surface not named *-card belongs in
CONTAINERS, under its file. A deliberate exception on one declaration (a card
flush to the viewport edge on phones) takes ${IGNORE_MARKER}: <reason> on its line.`)
  process.exit(1)
}

console.log(`✓ admin radius: ${cards} card rule(s) and ${utilityCards} ${UTILITY_CARD} utilit${utilityCards === 1 ? 'y' : 'ies'} in ${files.length} file(s), all on ${CARD_TOKEN}`)
