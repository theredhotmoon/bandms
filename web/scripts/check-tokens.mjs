#!/usr/bin/env node
/**
 * Fails the build on raw palette values in markup.
 *
 * The base/theme split only holds while components reference the semantic
 * contract in src/styles/tokens.css and nothing else. A single `text-zinc-400`
 * is invisible in review, passes vue-tsc and astro build, and silently makes
 * that element untheme-able — so it is caught here instead.
 *
 * Theme files are exempt: holding brand primitives is their whole job.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const SRC = join(ROOT, 'src')

const EXEMPT_DIR = `${sep}themes${sep}`
const EXEMPT_FILES = ['tokens.css', 'base.css', 'global.css']

const PATTERNS = [
  {
    // Tailwind palette utilities — the main way theming gets broken.
    re: /\b(?:text|bg|border|from|to|via|ring|divide|placeholder|decoration|outline|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    what: 'palette utility',
  },
  {
    re: /\b(?:text|bg|border)-(?:black|white)\b/g,
    what: 'black/white utility',
  },
  {
    // Hex literals inside scoped <style> blocks and inline styles.
    re: /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g,
    what: 'hex colour',
  },
  {
    re: /\brounded-(?:sm|md|lg|xl|2xl|3xl|full)\b/g,
    what: 'hardcoded radius',
  },
]

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(astro|vue|ts|css)$/.test(entry)) out.push(full)
  }
  return out
}

const violations = []

for (const file of walk(SRC)) {
  if (file.includes(EXEMPT_DIR)) continue
  if (EXEMPT_FILES.includes(file.split(sep).pop())) continue

  const source = readFileSync(file, 'utf8')
  source.split('\n').forEach((line, i) => {
    // An eslint-style escape hatch, for the rare genuinely-fixed colour.
    if (line.includes('token-lint-ignore')) return

    for (const { re, what } of PATTERNS) {
      re.lastIndex = 0
      const hits = line.match(re)
      if (hits) {
        violations.push({
          file: relative(ROOT, file),
          line: i + 1,
          what,
          hits: [...new Set(hits)].join(', '),
        })
      }
    }
  })
}

if (violations.length === 0) {
  console.log('✓ tokens: no raw palette values in src/')
  process.exit(0)
}

console.error(`\n✗ tokens: ${violations.length} raw value(s) that no theme can override\n`)
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ${v.what}: ${v.hits}`)
}
console.error(`
Use the semantic tokens in src/styles/tokens.css instead — text-muted,
bg-surface, border-border, rounded-card, shadow-card and friends. If a value is
genuinely fixed (a brand SVG fill, say), append a token-lint-ignore comment.
`)
process.exit(1)
