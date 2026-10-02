#!/usr/bin/env node
/**
 * Pins the contrast floors of the admin palette in both themes.
 *
 * Every token the panel uses as a *text* colour must read at >= 4.5:1 (WCAG AA
 * for body-size text) against the surfaces it sits on. The grey ramp used to
 * sit at 1.8–2.5:1 — slate-700 on near-black, and its mirror in light mode —
 * which is why the sidebar, column headers and every hint were unreadable in
 * both themes. This script fails `pnpm build` the moment a value in
 * src/admin-palette.css slides back under the floor.
 *
 * The ramp order is pinned too (primary > secondary > muted > faint): a token
 * that passes the floor but jumps above its neighbour silently flattens the
 * hierarchy, which is the other way the retune could rot.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const css = readFileSync(path.join(here, '../src/admin-palette.css'), 'utf8')

const [darkBlock, lightBlock] = css.split(':root[data-admin-theme="light"]')
const parse = (block) =>
  Object.fromEntries([...block.matchAll(/--c-([0-9a-f]{6}):\s*#([0-9a-f]{6});/g)].map((m) => [m[1], m[2]]))
const themes = { dark: parse(darkBlock), light: parse(lightBlock) }

const lum = (hex) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Surfaces text actually sits on: page, sidebar/card, input, hover row, active nav. */
const SURFACES = ['0a0a0a', '111111', '141414', '1a1a1a', '1f1f1f']

/**
 * Every --c-* used as a `color:` value anywhere in src/ is checked — the list
 * is scanned, not written by hand. A hand-kept list claimed to be exhaustive
 * and was not: placeholders, delete buttons and hints at 1.0–2.5:1 sat outside
 * it while the build passed.
 *
 * Two ways out, both carrying a reason:
 * - ON_FILL: a token that only ever labels a coloured fill, never the page
 *   surfaces, so the surface ratio means nothing for it.
 * - `contrast-ignore: <reason>` on the line, for one decorative or disabled use.
 */
const ON_FILL = {
  '111111': 'dark label on light fills (--c-e8e8e8 buttons and chips)',
  'ffffff': 'white label on saturated buttons — checked by WHITE_LABEL_FILLS',
}
const IGNORE_MARKER = 'contrast-ignore'

const SRC = path.join(here, '../src')
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n)
  return statSync(p).isDirectory() ? walk(p) : /\.(vue|css)$/.test(n) && n !== 'admin-palette.css' ? [p] : []
})

/** token → first file:line using it as text */
const textUses = new Map()
/** Non-text uses of a token that has a `-line` twin: those must use the twin. */
const twinMisuses = []
const twins = new Set([...css.matchAll(/--c-([0-9a-f]{6})-line:/g)].map((m) => m[1]))
for (const file of walk(SRC)) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const at = `${path.relative(path.join(here, '..'), file)}:${i + 1}`
    if (!line.includes(IGNORE_MARKER)) {
      for (const m of line.matchAll(/(?<![-\w])color\s*:\s*var\(--c-([0-9a-f]{6})\)/g)) {
        if (!ON_FILL[m[1]] && !textUses.has(m[1])) textUses.set(m[1], at)
      }
    }
    for (const m of line.matchAll(/(?:border|background|outline|box-shadow|fill|stroke)[a-z-]*\s*:([^;{}]*)/g)) {
      for (const t of m[1].matchAll(/var\(--c-([0-9a-f]{6})\)/g)) {
        if (twins.has(t[1])) twinMisuses.push(`${at}: non-text use of --c-${t[1]}; use var(--c-${t[1]}-line)`)
      }
    }
  })
}
const TEXT_TOKENS = [...textUses.keys()].sort()
const FLOOR = 4.5

/** Lighter-than (dark) / darker-than (light) ordering that carries the hierarchy. */
const RAMPS = [
  ['e2e8f0', 'c0c0c0', 'aaaaaa', '888888', '555555'],
  ['e2e8f0', '94a3b8', '64748b', '475569', '334155'],
]

/** Saturated buttons carry a literal white label; the fill has to earn it. */
const WHITE_LABEL_FILLS = ['0d9488', '14b8a6', '2563eb', 'b91c1c']

const failures = [...twinMisuses]
for (const [theme, tokens] of Object.entries(themes)) {
  for (const t of TEXT_TOKENS) {
    if (!tokens[t]) { failures.push(`${theme}: --c-${t} is missing from the palette (used at ${textUses.get(t)})`); continue }
    for (const s of SURFACES) {
      const r = ratio(tokens[t], tokens[s])
      if (r < FLOOR) failures.push(`${theme}: --c-${t} (#${tokens[t]}) on --c-${s} (#${tokens[s]}) is ${r.toFixed(2)}:1, floor is ${FLOOR}:1 — first used as text at ${textUses.get(t)}`)
    }
  }
  for (const ramp of RAMPS) {
    for (let i = 1; i < ramp.length; i++) {
      const prev = lum(tokens[ramp[i - 1]]), cur = lum(tokens[ramp[i]])
      const ok = theme === 'dark' ? cur < prev : cur > prev
      if (!ok) failures.push(`${theme}: --c-${ramp[i]} should sit ${theme === 'dark' ? 'below' : 'above'} --c-${ramp[i - 1]} in the ramp`)
    }
  }
  for (const f of WHITE_LABEL_FILLS) {
    const r = ratio(tokens[f], 'ffffff')
    if (r < FLOOR) failures.push(`${theme}: white text on --c-${f} (#${tokens[f]}) is ${r.toFixed(2)}:1, floor is ${FLOOR}:1`)
  }
}

if (failures.length) {
  console.error(`check-admin-contrast: ${failures.length} failure(s)\n  ` + failures.join('\n  '))
  process.exit(1)
}
console.log(`check-admin-contrast: ${TEXT_TOKENS.length} text tokens × ${SURFACES.length} surfaces × 2 themes pass at >= ${FLOOR}:1`)
