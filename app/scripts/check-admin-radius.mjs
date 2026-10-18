#!/usr/bin/env node
/**
 * Keeps admin cards on the 0.75rem corner DESIGN.md gives them.
 *
 * The radius scale is xs/sm/md/lg (0.25/0.375/0.5/0.75rem) and the role picks
 * the step: cards, table cards, drop zones and the modal panel take lg. Every
 * value here is on the scale, so a card at 6px or 0.5rem looks deliberate in
 * review — that is how nine cards and five card-like containers drifted to
 * the input/button radius while the rest stayed at 0.75rem.
 *
 * What counts as a card rule, and which corners count as 0.75rem, is
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
 * Blind spot, by design of a stylesheet scan: a card rounded with a Tailwind
 * utility in its class list (`rounded-lg`) is never seen. Those are few in
 * the admin and are a template question, not a stylesheet one.
 */
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { adminStyleFiles, posix } from './lib/admin-files.mjs'
import { CARD_RADIUS, cardRules } from './lib/radius-scan.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')

/** Named `*-card` but a selectable option, so they take the control radius — paths relative to src/. */
const OPTION_TILES = {
  'components/admin/forms/BandMemberForm.vue': ['main-inst-card'],
  'views/admin/BandProfileAdminView.vue': ['career-level-card'],
  'views/admin/UsersAdminView.vue': ['role-card'],
}

/** Card surfaces whose class does not say so — paths relative to src/. */
const CONTAINERS = {
  'components/admin/ConcertTicketsManager.vue': ['form-panel'],
  'components/admin/forms/PressReleaseForm.vue': ['og-preview'],
  'components/admin/forms/ReleaseForm.vue': ['track-block'],
  'views/admin/DoorCheckView.vue': ['scan-log'],
  'views/admin/PhotosAdminView.vue': ['photo-item'],
}

const { files, problems } = adminStyleFiles(SRC)
const violations = [...problems]

const sources = new Map(files.map((f) => [posix(relative(SRC, f)), readFileSync(f, 'utf8')]))

// A listed class that no longer appears in its file is rot: the surface it
// named has been renamed or removed, and the guard would silently stop
// covering it (or stop exempting it) while the list still reads as complete.
for (const [name, list] of [['OPTION_TILES', OPTION_TILES], ['CONTAINERS', CONTAINERS]]) {
  for (const [path, classes] of Object.entries(list)) {
    const source = sources.get(path)
    if (source === undefined) {
      violations.push(`src/${path}: ${name} entry no longer exists — update ${name}`)
      continue
    }
    for (const cls of classes) {
      if (!new RegExp(`\\.${cls}(?![\\w-])`).test(source)) {
        violations.push(`src/${path}: .${cls} is listed in ${name} but the file has no such class — update ${name}`)
      }
    }
  }
}

let cards = 0
for (const [rel, source] of sources) {
  const options = { optionTiles: new Set(OPTION_TILES[rel] ?? []), containers: new Set(CONTAINERS[rel] ?? []) }
  const kind = rel.endsWith('.css') ? 'css' : 'vue'
  for (const { line, card, radius, ok } of cardRules(source, kind, options)) {
    cards++
    if (!ok) violations.push(`src/${rel}:${line}  .${card} { border-radius: ${radius} }`)
  }
}

// Zero cards found means the parser broke, not that every card is right.
if (cards < 10) violations.push(`only ${cards} card rule(s) found — the style scan is broken`)

if (violations.length) {
  console.error(`✗ admin radius: ${violations.length} card(s) off the ${CARD_RADIUS} corner DESIGN.md gives cards\n`)
  for (const v of violations) console.error('  ' + v)
  console.error(`
Cards, table cards, drop zones and the modal panel use ${CARD_RADIUS}; inputs and
buttons use 0.5rem, row buttons 0.375rem, badges 0.25rem (app/DESIGN.md, Shapes).
A selectable option tile named *-card takes the control radius — add it to
OPTION_TILES under its file. A card surface not named *-card belongs in
CONTAINERS, under its file.`)
  process.exit(1)
}

console.log(`✓ admin radius: ${cards} card rule(s) in ${files.length} file(s), all at ${CARD_RADIUS}`)
