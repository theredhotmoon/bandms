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
 * Two lists live here because they are design decisions, not parsing:
 *   - OPTION_TILES: classes named `*-card` that are selectable controls and
 *     so take the 0.5rem control corner (DESIGN.md, Cards).
 *   - CONTAINERS: card surfaces whose class does not say `card`. Keyed by
 *     file, because `form-panel` or `photo-item` is a generic name inside a
 *     scoped <style>, and another component may use it for something that is
 *     not a card.
 */
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { adminStyleFiles, posix } from './lib/admin-files.mjs'
import { CARD_RADIUS, cardRules } from './lib/radius-scan.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')

/** Named `*-card` but a selectable option, so they take the control radius. */
const OPTION_TILES = new Set(['main-inst-card', 'career-level-card', 'role-card'])

/** Card surfaces whose class does not say so — paths relative to src/. */
const CONTAINERS = {
  'components/admin/ConcertTicketsManager.vue': ['form-panel'],
  'components/admin/forms/PressReleaseForm.vue': ['og-preview'],
  'components/admin/forms/ReleaseForm.vue': ['track-block'],
  'views/admin/DoorCheckView.vue': ['scan-log'],
  'views/admin/PhotosAdminView.vue': ['photo-item'],
}

const { files, problems } = adminStyleFiles(SRC)
if (problems.length) {
  for (const p of problems) console.error(`✗ admin radius: ${p}`)
  process.exit(1)
}

const violations = []
const rels = new Set(files.map((f) => posix(relative(SRC, f))))
for (const path of Object.keys(CONTAINERS)) {
  if (!rels.has(path)) violations.push(`src/${path}: CONTAINERS entry no longer exists — update CONTAINERS`)
}

let cards = 0
for (const file of files) {
  const rel = posix(relative(SRC, file))
  const options = { optionTiles: OPTION_TILES, containers: new Set(CONTAINERS[rel] ?? []) }
  const kind = file.endsWith('.css') ? 'css' : 'vue'
  for (const { line, card, radius, ok } of cardRules(readFileSync(file, 'utf8'), kind, options)) {
    cards++
    if (!ok) violations.push(`${posix(relative(ROOT, file))}:${line}  .${card} { border-radius: ${radius} }`)
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
OPTION_TILES. A card surface not named *-card belongs in CONTAINERS, under its file.`)
  process.exit(1)
}

console.log(`✓ admin radius: ${cards} card rule(s) in ${files.length} file(s), all at ${CARD_RADIUS}`)
