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
 * Scope is everything under src/ EXCEPT the EXCLUDED list in
 * lib/admin-files.mjs, so a new admin folder is checked from its first file
 * rather than needing to be registered. What counts as a colour lives in
 * lib/colour-scan.mjs.
 *
 * For a colour that is genuinely the same in both themes — a white label on a
 * teal button — append `token-lint-ignore` and the reason to that line.
 */
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { colourHits, IGNORE_MARKER } from './lib/colour-scan.mjs'
import { adminStyleFiles, posix } from './lib/admin-files.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')

// Which files are admin chrome is lib/admin-files.mjs, shared with the radius
// guard so the two cannot disagree about what they cover. A problem is a
// stale EXCLUDED entry or a walk that found nothing — the failure shape
// check-admin-strings guards against too. It is reported alongside the
// colour violations rather than instead of them, so one run shows everything.
const { files, problems } = adminStyleFiles(SRC)
const violations = [...problems]

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
