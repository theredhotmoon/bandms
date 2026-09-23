#!/usr/bin/env node
/**
 * Every t()/$t()/keypath= reference must exist in the English catalogue.
 *
 * This is NOT covered by the type system, contrary to what the design doc and
 * app/CLAUDE.md claimed until this script existed. `MessageSchema = typeof en`
 * forces `pl` to mirror `en` — a missing Polish translation is a real TS2322 —
 * but vue-i18n's DefineLocaleMessage augmentation does not key-check call
 * sites here. Verified: `t('shows.totally.bogus.key')` compiles clean under
 * `vue-tsc -b`, and renders the raw dotted key on screen.
 *
 * So a typo in any of the ~200 $t('shows.…') references was invisible to the
 * lint, the type-check and the build. This closes that.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const NL = String.fromCharCode(10)
const EN_DIR = join(ROOT, 'src', 'i18n', 'en')
const SRC = join(ROOT, 'src')

/**
 * Flatten a catalogue module into dotted keys.
 *
 * The catalogues are plain nested object literals written in a consistent
 * shape, so indentation is a reliable structure signal. A real parser would be
 * better; this is deliberately small, and it fails loudly (a mis-parse shows up
 * as a flood of "unknown key" reports, not as silence).
 */
function keysOf(file, prefix) {
  const keys = new Set()
  const stack = []
  for (const raw of readFileSync(file, 'utf8').split(NL)) {
    const line = raw.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
    // \b on the keywords: without it a key named `exportCsv:` starts with
    // "export" and is skipped as a statement, so the key never lands in the
    // catalogue and every reference to it reports as unresolvable.
    if (!line.trim() || /^\s*(?:import\b|export\b|[})/])/.test(line.trim()) && !/:\s*\{/.test(line)) {
      if (/^\s*\},?\s*$/.test(line)) stack.pop()
      continue
    }
    const indent = line.match(/^\s*/)[0].length
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()

    const open = line.match(/^\s*'?([A-Za-z0-9_-]+)'?\s*:\s*\{\s*$/)
    if (open) { stack.push({ name: open[1], indent }); continue }

    // inline object on one line: `columns: { id: 'ID', poster: 'Poster' },`
    const inline = line.match(/^\s*'?([A-Za-z0-9_-]+)'?\s*:\s*\{(.+)\}\s*,?\s*$/)
    if (inline) {
      const path = [prefix, ...stack.map(s => s.name), inline[1]].join('.')
      for (const m of inline[2].matchAll(/'?([A-Za-z0-9_-]+)'?\s*:/g)) keys.add(`${path}.${m[1]}`)
      continue
    }

    const leaf = line.match(/^\s*'?([A-Za-z0-9_-]+)'?\s*:\s*['"`]/)
    if (leaf) keys.add([prefix, ...stack.map(s => s.name), leaf[1]].join('.'))
  }
  return keys
}

const catalogue = new Set()
for (const name of readdirSync(EN_DIR)) {
  if (name === 'index.ts' || !name.endsWith('.ts')) continue
  for (const k of keysOf(join(EN_DIR, name), name.replace(/\.ts$/, ''))) catalogue.add(k)
}

/** Only static, single-quoted keys — a computed key cannot be checked here. */
const REFS = [
  /\$?\bt\(\s*'([A-Za-z0-9_.-]+)'/g,
  /keypath="([A-Za-z0-9_.-]+)"/g,
  /key:\s*'([A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+)'/g,
]

const files = []
const walk = (dir) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (n !== 'i18n') walk(p) }
    else if (p.endsWith('.vue') || p.endsWith('.ts')) files.push(p)
  }
}
walk(SRC)

const bad = []
let checked = 0
for (const file of files) {
  readFileSync(file, 'utf8').split(NL).forEach((line, i) => {
    for (const re of REFS) {
      re.lastIndex = 0
      for (const m of line.matchAll(re)) {
        const key = m[1]
        if (!key.includes('.')) continue
        checked++
        if (!catalogue.has(key)) {
          bad.push({ file: relative(ROOT, file).split(sep).join('/'), line: i + 1, key })
        }
      }
    }
  })
}

if (catalogue.size === 0) {
  console.error('✗ i18n keys: parsed zero keys from the English catalogue — the parser is broken')
  process.exit(1)
}

if (bad.length === 0) {
  console.log(`✓ i18n keys: ${checked} reference(s) resolve against ${catalogue.size} catalogue key(s)`)
  process.exit(0)
}

console.error(`${NL}✗ i18n keys: ${bad.length} reference(s) with no catalogue entry${NL}`)
for (const b of bad) console.error(`  ${b.file}:${b.line}  ${b.key}`)
console.error(`
These render as the raw dotted key on screen. The type system does not catch
them — MessageSchema only forces pl to mirror en, not call sites to be valid.
`)
process.exit(1)
