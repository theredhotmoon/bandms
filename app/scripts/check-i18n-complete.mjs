/**
 * The fourth build guard: is anything still *unmigrated*?
 *
 * The other three all ask questions about files already on the MIGRATED
 * ratchet — "does this file still hold English", "does this key resolve",
 * "is this component's parent guarded". None of them can answer "is the sweep
 * finished", because a file nobody has touched is invisible to all of them.
 *
 * That gap is not theoretical. Twice during the sweep the honest answer to
 * "are we done?" had to be found by running a throwaway script, and twice it
 * turned up something real — the version-diff modal was entirely English long
 * after the tech rider was declared finished.
 *
 * So this walks every source file, skips the ratchet and the exemptions
 * below, and fails on any copy it finds. Adding a view now means adding it to
 * MIGRATED or explaining why not; neither can be forgotten quietly.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { copyHits } from './lib/template-scan.mjs'

const SRC = resolve('src')
const rel = (abs) => relative(SRC, abs).split('\\').join('/')

const MIGRATED = new Set(
  [...readFileSync('scripts/check-admin-strings.mjs', 'utf8')
    .matchAll(/^\s*'([^']+\.(?:vue|ts))',/gm)].map((m) => m[1]),
)

/**
 * Files whose "copy" is not copy, with the reason. Each one is a decision
 * someone made on purpose, and the reason is the point of the list — an
 * entry without one is how a guard rots into a formality.
 */
const EXEMPT = new Map([
  ['utils/signalChainPresets.ts', 'rig data seeded into a musician\'s saved setup, not chrome — translating it would put Polish rows on an English rider'],
  ['router/index.ts', 'route paths and component names'],
  ['locales.ts', 'language names, written in their own language on purpose'],
  ['utils/postBlocks.ts', 'provider brand names — the one ordinary word in that table, Link, was moved out and is passed in translated'],
  ['utils/formatDate.ts', '"UTC" is an IANA timezone identifier passed to Intl, not text'],
  ['utils/basemap.ts', 'map tile attribution — OpenStreetMap and CARTO require it verbatim'],
])

/** Whole trees that carry no user-facing copy. */
const EXEMPT_DIRS = [
  // HTTP verbs, header names, `Bearer `, and guards that fire on a
  // programmer error rather than a user action. The user-facing messages
  // these files used to throw now go through handleResponse.
  'api/',
  // Shapes and unions. A label table here is a bug, and the two that existed
  // (SHOP_ITEM_TYPE_LABELS, INSTRUMENT_TYPE_LABELS) were moved out.
  'types/',
  'i18n/',
]

const files = []
;(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(vue|ts)$/.test(entry) && !/\.spec\.ts$/.test(entry)) files.push(p)
  }
})(SRC)

const offenders = []
let checked = 0

for (const abs of files) {
  const r = rel(abs)
  if (MIGRATED.has(r) || EXEMPT.has(r) || EXEMPT_DIRS.some((d) => r.startsWith(d))) continue
  checked++
  const hits = copyHits(readFileSync(abs, 'utf8'), { isTs: r.endsWith('.ts') })
  const n = hits.reduce((a, h) => a + h.hits.length, 0)
  if (n) offenders.push({ rel: r, n, sample: hits[0].hits[0] })
}

if (offenders.length) {
  console.error(`\n\u2717 i18n completeness: ${offenders.length} unmigrated file(s) hold copy\n`)
  for (const o of offenders.sort((a, b) => b.n - a.n)) {
    console.error(`  ${String(o.n).padStart(4)}  src/${o.rel}`)
    console.error(`        e.g. ${JSON.stringify(o.sample)}`)
  }
  console.error(`
Migrate the file and add its path to MIGRATED in
app/scripts/check-admin-strings.mjs. If its strings are genuinely not chrome —
data seeded into a record, an ISO code, an HTTP verb — add it to EXEMPT in this
script *with the reason*, which is what stops the list becoming a dumping
ground.
`)
  process.exit(1)
}

console.log(
  `\u2713 i18n completeness: nothing unmigrated (${MIGRATED.size} on the ratchet, ` +
  `${checked} other file(s) checked, ${EXEMPT.size + EXEMPT_DIRS.length} exemption(s))`,
)
