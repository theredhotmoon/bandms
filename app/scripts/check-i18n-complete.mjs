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
 *
 * It deliberately does **not** honour `i18n-ignore`: a line-level opt-out in a
 * file nobody has migrated is not yet meaningful, which is the rule
 * template-scan.mjs already states. That only works because the ratchet is read
 * correctly — see lib/migrated.mjs for the version of this that did not.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyHits } from './lib/template-scan.mjs'
import { coveredBy, migratedPaths } from './lib/migrated.mjs'

// Anchored to this file, not to the cwd, the way all three sibling guards are.
// `resolve('src')` worked only from app/ and died with ENOENT when a root-level
// wrapper invoked it — which is the shape scripts/test-all.sh already uses.
// fileURLToPath, not .pathname: the latter keeps percent-encoding, so a
// checkout under a path with a space resolves to a directory that does not
// exist and the walk throws — failing the build CI actually runs.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = resolve(ROOT, 'src')
const LINT = join(ROOT, 'scripts', 'check-admin-strings.mjs')

const rel = (abs) => relative(SRC, abs).split('\\').join('/')

let onRatchet
try {
  onRatchet = coveredBy(migratedPaths(LINT))
} catch (e) {
  console.error(`\u2717 i18n completeness: ${e.message}`)
  process.exit(1)
}

/**
 * Files whose "copy" is not copy, with the reason. Each one is a decision
 * someone made on purpose, and the reason is the point of the list — an
 * entry without one is how a guard rots into a formality.
 *
 * Enforced below: an entry must name a file that exists and still produces at
 * least one hit. An exemption that has stopped being needed fails the build
 * instead of quietly licensing whatever English is added to that file next.
 */
const EXEMPT = new Map([
  ['utils/signalChainPresets.ts', 'rig data seeded into a musician\'s saved setup, not chrome — translating it would put Polish rows on an English rider'],
  ['locales.ts', 'language names, written in their own language on purpose'],
  ['utils/formatDate.ts', '"UTC" is an IANA timezone identifier passed to Intl, not text'],
  ['utils/basemap.ts', 'map tile attribution — OpenStreetMap and CARTO require it verbatim'],
])

/**
 * Whole trees that carry no user-facing copy, with the same reason rule.
 *
 * A tree exemption hides far more than a file one, so the reason has to be
 * true of the whole tree. `api/`'s used to claim every message it threw went
 * through handleResponse; bandProfile.ts still threw its own English literal,
 * which reached a Polish admin through saveErrorMessage. Fixed there rather
 * than papered over here.
 */
// `types/` used to be listed here. The staleness rule above rejected it: the
// tree produces no hits at all, so the entry suppressed nothing and only
// reserved the right to. Scanning it instead turns "a label table in types/ is
// a bug" from a comment into something the build enforces.
const EXEMPT_DIRS = new Map([
  ['api/', 'HTTP verbs, header names, `Bearer `, and param guards that fire on a programmer error rather than a user action — every message a user can actually read is thrown empty so the call site\'s translated fallback wins'],
  ['i18n/', 'the catalogues themselves — src/i18n/catalogue.spec.ts is what checks these'],
])

const files = []
;(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(vue|ts)$/.test(entry) && !/\.spec\.ts$/.test(entry)) files.push(p)
  }
})(SRC)

const hitCount = (r, abs) =>
  copyHits(readFileSync(abs, 'utf8'), { isTs: r.endsWith('.ts') })
    .reduce((a, h) => a + h.hits.length, 0)

const byPath = new Map(files.map((abs) => [rel(abs), abs]))

// Every exemption must still be earning its place.
const stale = []
for (const [path, reason] of EXEMPT) {
  if (!reason.trim()) stale.push(`${path} — no reason given`)
  else if (!byPath.has(path)) stale.push(`${path} — no such file (renamed or deleted?)`)
  else if (hitCount(path, byPath.get(path)) === 0) stale.push(`${path} — no copy left to exempt`)
}
for (const [dir, reason] of EXEMPT_DIRS) {
  const under = [...byPath.keys()].filter((r) => r.startsWith(dir))
  if (!reason.trim()) stale.push(`${dir} — no reason given`)
  else if (under.length === 0) stale.push(`${dir} — no such directory (renamed or deleted?)`)
  else if (!under.some((r) => hitCount(r, byPath.get(r)) > 0)) {
    stale.push(`${dir} — no copy left to exempt in any file under it`)
  }
}
if (stale.length) {
  console.error('\n\u2717 i18n completeness: the exemption list has rotted\n')
  for (const s of stale) console.error(`  ${s}`)
  console.error(`
Remove the entry. An exemption for copy that is no longer there licenses
whatever English is added to that file next, which is the opposite of the point.
`)
  process.exit(1)
}

const offenders = []
let checked = 0

for (const [r, abs] of byPath) {
  if (onRatchet(r) || EXEMPT.has(r) || [...EXEMPT_DIRS.keys()].some((d) => r.startsWith(d))) continue
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
app/scripts/check-admin-strings.mjs — a directory entry there covers its files.
If its strings are genuinely not chrome — data seeded into a record, an ISO
code, an HTTP verb — add it to EXEMPT in this script *with the reason*, which is
what stops the list becoming a dumping ground.
`)
  process.exit(1)
}

console.log(
  `\u2713 i18n completeness: nothing unmigrated (${migratedPaths(LINT).length} on the ratchet, ` +
  `${checked} other file(s) checked, ${EXEMPT.size + EXEMPT_DIRS.size} exemption(s))`,
)
