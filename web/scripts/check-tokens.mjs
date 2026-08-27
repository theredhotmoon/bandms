#!/usr/bin/env node
/**
 * Guards the base/theme split.
 *
 * Two failure modes, both invisible to `astro build` and `vue-tsc`:
 *
 * 1. A **raw value** — `text-zinc-400`, `#121212`, `rounded-xl`, `'Anton'`,
 *    `rgba(239,231,214,.7)`. Loud once you know to look, and it makes that
 *    element permanently untheme-able.
 * 2. An **undefined token** — `hover:bg-accent-dark` when no such token exists.
 *    This one is silent: it reads as correct, Tailwind emits nothing, and the
 *    style simply never applies. Seven dead hover states shipped this way.
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
    re: /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g,
    what: 'hex colour',
  },
  {
    re: /\brounded-(?:sm|md|lg|xl|2xl|3xl|full)\b/g,
    what: 'hardcoded radius',
  },
  {
    // The design's faces. Naming one pins a band's typography into markup just
    // as surely as a hex pins its colour.
    re: /'(?:Anton|Archivo|Bungee|Barlow|Oswald|Work Sans|Bebas Neue)'/g,
    what: 'hardcoded font family',
  },
  {
    // Brand-tinted overlays: paper-on-ink and ink-on-paper.
    re: /rgba\(\s*(?:239,\s*231,\s*214|18,\s*18,\s*18)\s*,[^)]*\)/g,
    what: 'brand rgba',
  },
]

/**
 * Token namespaces we own. Only suffixes beginning with one of these are judged,
 * so Tailwind's own keywords (`bg-transparent`, `text-center`, `border-none`,
 * `text-sm`) are never mistaken for tokens.
 */
const OUR_NAMESPACES = [
  'accent', 'surface', 'inverse', 'muted', 'subtle', 'body', 'page', 'ink',
  'danger', 'success', 'border', 'card', 'pill', 'emphasis',
]

// Any stack of Tailwind variants may precede the utility: hover:, focus-visible:,
// sm:, group-hover: and so on.
const UTILITY_RE =
  /\b(?:[a-z][a-z0-9-]*:)*(?:text|bg|border|placeholder|shadow|rounded|ring|divide|decoration|from|to|via)-([a-z][a-z0-9-]*)\b/g

const tokenSource = readFileSync(join(SRC, 'styles', 'tokens.css'), 'utf8')
const declared = new Set(
  [...tokenSource.matchAll(/--(?:color|radius|shadow|font)-([a-z0-9-]+)\s*:/g)].map(m => m[1]),
)

function undefinedTokens(line) {
  const hits = []
  for (const match of line.matchAll(UTILITY_RE)) {
    const suffix = match[1]
    const isOurs = OUR_NAMESPACES.some(ns => suffix === ns || suffix.startsWith(`${ns}-`))
    if (isOurs && !declared.has(suffix)) hits.push(match[0])
  }
  return hits
}

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

  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      // An eslint-style escape hatch, for the rare genuinely-fixed value.
      if (line.includes('token-lint-ignore')) return

      const record = (what, hits) =>
        violations.push({
          file: relative(ROOT, file),
          line: i + 1,
          what,
          hits: [...new Set(hits)].join(', '),
        })

      const undef = undefinedTokens(line)
      if (undef.length) record('undefined token', undef)

      for (const { re, what } of PATTERNS) {
        re.lastIndex = 0
        const hits = line.match(re)
        if (hits) record(what, hits)
      }
    })
}

if (violations.length === 0) {
  console.log(`✓ tokens: ${declared.size} declared, no raw or undefined values in src/`)
  process.exit(0)
}

console.error(`\n✗ tokens: ${violations.length} value(s) that no theme can override\n`)
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ${v.what}: ${v.hits}`)
}
console.error(`
Use the semantic tokens in src/styles/tokens.css — text-muted, bg-surface,
border-border, rounded-card, shadow-card and friends. An "undefined token" means
the utility looks right but no such token exists, so it silently does nothing.
If a value is genuinely fixed (a brand SVG fill, say), append token-lint-ignore.
`)
process.exit(1)
