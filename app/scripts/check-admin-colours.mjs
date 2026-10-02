#!/usr/bin/env node
/**
 * Stops a hardcoded colour creeping back into the admin.
 *
 * The admin's dark and light themes work by redefining the `--c-*` variables
 * in src/admin-palette.css. A literal (`#2a2a2a`, `rgba(255,255,255,.1)`,
 * `bg-[#141414]`) still renders correctly in the dark theme — the one people
 * develop in — and simply stays dark when someone switches to light. Nothing
 * else in the build or the tests would notice.
 *
 * Scope is everything under src/ EXCEPT the list below, so a new admin folder
 * is checked from its first file rather than needing to be registered.
 * What counts as a colour lives in lib/colour-scan.mjs.
 *
 * For a colour that is genuinely the same in both themes — a white label on a
 * teal button — append `token-lint-ignore` and the reason to that line.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { colourHits, IGNORE_MARKER } from './lib/colour-scan.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')

/** Not admin chrome, so not themed. Paths relative to src/. */
const EXCLUDED = {
  'admin-palette.css': 'the palette itself — the one place literals belong',
  'style.css': 'SPA-wide base styles and the Tailwind light-theme overrides',
  'App.vue': 'SPA root: skip link and chrome shared with the fan pages',
  'components/AppNavbar.vue': 'navbar of the fan pages',
  'components/TicketDownloadCard.vue': 'fan ticket card',
  'components/fan': 'fan portal',
  'views/FanAccountView.vue': 'fan portal',
  'views/TicketClaimView.vue': 'fan ticket claim',
  'views/TechRiderPreviewView.vue': 'printable rider document, black on white by design',
}

const posix = (p) => p.split(sep).join('/')
const violations = []

for (const path of Object.keys(EXCLUDED)) {
  if (!existsSync(join(SRC, path))) {
    violations.push(`src/${path}: excluded path no longer exists — update EXCLUDED`)
  }
}

const isExcluded = (rel) =>
  Object.keys(EXCLUDED).some((path) => rel === path || rel.startsWith(path + '/'))

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

// A walk that finds nothing would print a green tick for having checked
// nothing — the failure shape check-admin-strings guards against too.
if (files.length < 50) {
  console.error(`✗ admin colours: only ${files.length} file(s) found under src/ — the walk is broken`)
  process.exit(1)
}

for (const file of files) {
  const kind = file.endsWith('.css') ? 'css' : 'vue'
  for (const { line, hits } of colourHits(readFileSync(file, 'utf8'), kind)) {
    violations.push(`${posix(relative(ROOT, file))}:${line}  ${hits.join(' | ')}`)
  }
}

if (violations.length) {
  console.error(`✗ admin colours: ${violations.length} hardcoded colour(s) would ignore the light/dark switch\n`)
  for (const v of violations) console.error('  ' + v)
  console.error(`
Use a palette variable instead — var(--c-<hex>) from src/admin-palette.css,
named after its dark-mode value. To tint one, use
color-mix(in srgb, var(--c-…) 13%, transparent) rather than an alpha suffix.
If the colour really must be identical in both themes (a white label on a
saturated button), append ${IGNORE_MARKER} and the reason to that line.`)
  process.exit(1)
}

console.log(`✓ admin colours: ${files.length} file(s), no hardcoded colours`)
