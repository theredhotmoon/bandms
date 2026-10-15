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
 * A "card" is any rule whose selector names a class ending in `card`
 * (`.rp-card`, not `.rp-card-thumb` or `.card-btn`), plus the containers in
 * CONTAINERS that play the role under another name. A rule without
 * border-radius is ignored, so a modifier like `.song-card--encore` passes.
 * Scope and exclusions match check-admin-colours.mjs: the fan pages and the
 * printable rider are outside the admin design system.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')
const CARD_RADIUS = '0.75rem'

const EXCLUDED = [
  'admin-palette.css',
  'style.css',
  'App.vue',
  'components/AppNavbar.vue',
  'components/TicketDownloadCard.vue',
  'components/fan',
  'views/FanAccountView.vue',
  'views/TicketClaimView.vue',
  'views/TechRiderPreviewView.vue',
]

/** Named `*-card` but a selectable option, so they take the control radius. */
const OPTION_TILES = new Set(['main-inst-card', 'career-level-card', 'role-card'])

/** Card surfaces whose class does not say so. */
const CONTAINERS = new Set(['form-panel', 'scan-log', 'photo-item', 'og-preview', 'track-block'])

const posix = (p) => p.split(sep).join('/')
const violations = []

for (const path of EXCLUDED) {
  if (!existsSync(join(SRC, path))) violations.push(`src/${path}: excluded path no longer exists — update EXCLUDED`)
}

const isExcluded = (rel) => EXCLUDED.some((path) => rel === path || rel.startsWith(path + '/'))

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    const rel = posix(relative(SRC, abs))
    if (isExcluded(rel)) continue
    if (statSync(abs).isDirectory()) walk(abs)
    else if (/\.(vue|css)$/.test(name)) files.push(abs)
  }
}
walk(SRC)

if (files.length < 50) {
  console.error(`✗ admin radius: only ${files.length} file(s) found under src/ — the walk is broken`)
  process.exit(1)
}

/** Blank out everything but CSS (and comments inside it), keeping offsets so line numbers hold. */
function cssOf(text, kind) {
  const blank = (s) => s.replace(/[^\n]/g, ' ')
  let css = text
  if (kind === 'vue') {
    css = ''
    let at = 0
    for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      const bodyAt = m.index + m[0].indexOf(m[1])
      css += blank(text.slice(at, bodyAt)) + m[1]
      at = bodyAt + m[1].length
    }
    css += blank(text.slice(at))
  }
  return css.replace(/\/\*[\s\S]*?\*\//g, blank)
}

let cards = 0
for (const file of files) {
  const css = cssOf(readFileSync(file, 'utf8'), file.endsWith('.css') ? 'css' : 'vue')
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const classes = [...m[1].matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((c) => c[1])
    const card = classes.find((c) => (/(^|-)card$/.test(c) && !OPTION_TILES.has(c)) || CONTAINERS.has(c))
    if (!card) continue
    const radius = m[2].match(/border-radius\s*:\s*([^;]+)/)
    if (!radius) continue
    cards++
    if (radius[1].trim() !== CARD_RADIUS) {
      const line = css.slice(0, m.index + m[0].indexOf(radius[0])).split('\n').length
      violations.push(`${posix(relative(ROOT, file))}:${line}  .${card} { border-radius: ${radius[1].trim()} }`)
    }
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
OPTION_TILES. A card surface not named *-card belongs in CONTAINERS.`)
  process.exit(1)
}

console.log(`✓ admin radius: ${cards} card rule(s) in ${files.length} file(s), all at ${CARD_RADIUS}`)
