#!/usr/bin/env node
/**
 * Every file that renders a translation must be on the string lint's ratchet.
 *
 * Translating a file and guarding a file are two separate acts, and doing the
 * first without the second is the single most repeated defect in this sweep.
 * Six reviews found five instances: ClipCategoryPicker (a child of the
 * Reference block's add-clip panel), TicketStatusBadge (translated in the very
 * commit answering a review finding about this), TableToolbar, and the shared
 * form children AttachedClipsField / SlugInput / SocialLinksEditor.
 *
 * Each time the area read as "done" while a component inside it still rendered
 * English, because MIGRATED is a hand-maintained list and nothing checked it
 * against reality. This does.
 *
 * The inverse — a guarded file with no translations — is fine and not reported:
 * SortHeader takes all its copy as props, and listing it still holds it to the
 * lint if someone adds a literal later.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { coveredBy, isScannable, MIGRATED } from './lib/ratchet.mjs'
import { copyHits } from './lib/template-scan.mjs'
import { join, relative, sep, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath, not .pathname: the latter keeps percent-encoding, so a
// checkout under a path with a space resolves to a directory that does not
// exist and the walk throws — failing the build CI actually runs.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')

// Before the scan, not after: an empty ratchet must not first report every
// file in src/ as an uncovered gap. Unreachable while ratchet.mjs holds a
// literal array — which is the point of it being one — but a bad merge that
// emptied the export would otherwise turn every guard green by having nothing
// to check.
if (MIGRATED.length === 0) {
  console.error('✗ i18n coverage: ratchet.mjs exports an empty MIGRATED list')
  process.exit(1)
}

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name !== 'i18n') walk(p)
    } else if (isScannable(p)) {
      // Specs are excluded deliberately. A spec that calls useI18n() or
      // asserts on catalogue text would be reported as a gap, and the only
      // remedy this guard offers — add it to MIGRATED — then makes the string
      // lint flag the assertions themselves. There is no exit from that short
      // of i18n-ignore on every assertion line.
      files.push(p)
    }
  }
}
walk(SRC)

/**
 * Renders a translation.
 *
 * Detect the *import*, not the call shape. The first version of this matched
 * `t(` followed by a quote — and so missed TicketStatusBadge, which calls
 * `t(entry.key)` with a computed key, i.e. precisely the file this guard was
 * written to catch. It reported a clean tree and I nearly shipped it.
 */
const RENDERS = /useI18n\s*\(|\$t\s*\(|keypath\s*=|<i18n-t|\bi18n\.global\.t\s*\(/

/**
 * Strip comments before testing. Without this a doc comment merely *mentioning*
 * useI18n() reports the file as a gap, since the regex reads raw text.
 */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const toRel = (abs) => relative(SRC, abs).split(sep).join('/')
const covered = coveredBy(MIGRATED)

/**
 * Display path. A workspace-package child resolves outside src/, where
 * relative() yields '../../packages/…' and 'src/' + that reads as nonsense.
 */
const show = (rel) => (rel.startsWith('..') ? rel.replace(/^(?:\.\.\/)+/, '') : 'src/' + rel)

const gaps = []
for (const file of files) {
  const rel = toRel(file)
  if (covered(rel)) continue
  if (RENDERS.test(stripComments(readFileSync(file, 'utf8')))) gaps.push(rel)
}

/**
 * Second check: a component *rendered inside* a migrated area must itself be
 * on the ratchet, even when it renders no translations at all.
 *
 * The check above only sees a file that already calls `$t`. A child with pure
 * hardcoded English and no `useI18n` import matches none of RENDERS, so it is
 * invisible to it — and equally invisible to the string lint, which never
 * looks outside MIGRATED, and to the key guard, which only resolves keys that
 * exist. Three guards, and between them a component could render an entire
 * English form inside a "finished" area.
 *
 * That is not hypothetical. It shipped four times: AboutBioVariantSelect
 * (inside the Bio tab, in the same PR that declared Band Profile done),
 * EntityRelationsPanel, ClipForm and SingleImageUpload. Each sat under an area
 * whose PR had been reviewed and merged.
 *
 * Reachability is transitive: a grandchild is as visible to the reader as a
 * child. The fix for a report is always the same — add the path to MIGRATED,
 * which hands the file to the string lint, where `i18n-ignore` is available
 * for genuinely fixed text (AppNavbar's wordmark is the standing example).
 */
/**
 * Both static and dynamic imports. `defineAsyncComponent(() => import('…'))`
 * is how AdminEntry loads the dashboard — matching only the static form would
 * stop the walk at a lazy boundary, which is precisely where a component is
 * easiest to forget.
 *
 * Still not exhaustive: a component resolved through `<component :is>` from a
 * runtime value cannot be found by reading imports. That is a known limit, not
 * an oversight — the guard is a ratchet, not a proof.
 */
const IMPORTS = /import\s+\w+\s+from\s+['"]([^'"]+\.vue)['"]|import\s*\(\s*['"]([^'"]+\.vue)['"]\s*\)/g

/**
 * Resolve a `.vue` specifier to a path on disk.
 *
 * `@bandms/<pkg>/…` is a workspace package, not a node_modules download — it
 * lives at ../packages/<pkg>. Without this, `RiderSheet.vue` (imported by
 * TechRiderPreviewView) resolved to a path under src/views/ that does not
 * exist, and an unreadable file was indistinguishable from a typo: both hit
 * the same `catch` and vanished. Anything still unresolvable is *reported*,
 * never silently dropped — a guard that skips what it cannot parse is how the
 * blind spot above stayed open.
 */
const PACKAGES = join(ROOT, '..', 'packages')
const resolveSpec = (abs, spec) => {
  if (spec.startsWith('@/')) return join(SRC, spec.slice(2))
  if (spec.startsWith('.')) return resolve(dirname(abs), spec)
  const pkg = spec.match(/^@bandms\/([^/]+)\/(.+)$/)
  if (pkg) return join(PACKAGES, pkg[1], 'src', pkg[2])
  return null
}

const unresolved = []
const importsOf = (abs) => {
  const src = readFileSync(abs, 'utf8')
  const out = []
  for (const m of src.matchAll(IMPORTS)) {
    const spec = m[1] ?? m[2]
    const p = resolveSpec(abs, spec)
    if (p === null) { unresolved.push({ spec, from: toRel(abs) }); continue }
    out.push(p)
  }
  return out
}

/**
 * Does this file show a reader any English?
 *
 * `copyHits` is the string lint's own detection, not a subset of it. The first
 * version of this called `textRuns` alone — 1 of its 4 sources — so a child
 * whose English lived entirely in `placeholder` / `aria-label` / `title`
 * passed silently. `SingleImageUpload`, one of the components this very guard
 * was written to catch, is exactly that shape.
 */
const showsCopy = (abs) => copyHits(readFileSync(abs, 'utf8')).length > 0

const seen = new Set()
const unguarded = []
const queue = files.filter((f) => covered(toRel(f)))

while (queue.length) {
  const parent = queue.pop()
  for (const child of importsOf(parent)) {
    if (seen.has(child)) continue
    seen.add(child)
    let rel
    try { rel = toRel(child); readFileSync(child) } catch { unresolved.push({ spec: rel, from: toRel(parent) }); continue }
    // Enqueue unconditionally. Enqueueing only *covered* children stopped the
    // walk dead at any copy-free wrapper — `<div class="w"><Child/></div>`,
    // which is the shape this admin uses for panels — so a grandchild full of
    // English went unreported while the docstring claimed the walk was
    // transitive. It now actually is. `seen` already handles cycles.
    queue.push(child)
    if (!covered(rel) && showsCopy(child)) unguarded.push({ rel, via: toRel(parent) })
  }
}

// A file caught by check 1 must not be repeated under check 2's heading, which
// says "these render no translations at all" — false for a file that does.
const gapSet = new Set(gaps)
const unguardedOnly = unguarded.filter((u) => !gapSet.has(u.rel))

// Printed whether or not anything failed, and deliberately not fatal: an
// import this resolver cannot follow is a hole in the walk, and a hole nobody
// can see is how the gap above survived four merged PRs. A warning keeps it
// visible without failing a build over a specifier shape that may be perfectly
// legitimate.
if (unresolved.length) {
  const seenSpecs = new Set()
  console.warn(`\n⚠ i18n coverage: ${unresolved.length} .vue import(s) could not be followed\n`)
  for (const u of unresolved) {
    const k = `${u.spec}|${u.from}`
    if (seenSpecs.has(k)) continue
    seenSpecs.add(k)
    console.warn(`  ${u.spec}\n      imported by ${show(u.from)}`)
  }
  console.warn(`
Anything they render is outside the walk. Teach resolveSpec() about the
specifier shape, or migrate the target by hand.
`)
}

if (gaps.length === 0 && unguardedOnly.length === 0) {
  console.log(
    `✓ i18n coverage: every translating file is on the ratchet, and every ` +
      `component they render with it (${MIGRATED.length} path(s))`,
  )
  process.exit(0)
}

if (gaps.length) {
  console.error(`\n✗ i18n coverage: ${gaps.length} file(s) render translations but are not guarded\n`)
  for (const g of gaps) console.error(`  ${show(g)}`)
  console.error(`
Add each to MIGRATED in app/scripts/lib/ratchet.mjs. Until then the
string lint never looks at them, so the area they sit in reads as finished
while they can quietly go back to hardcoded English.
`)
}

if (unguardedOnly.length) {
  console.error(`\n✗ i18n coverage: ${unguardedOnly.length} component(s) render English inside a migrated area\n`)
  for (const u of unguardedOnly) console.error(`  ${show(u.rel)}\n      rendered by ${show(u.via)}`)
  console.error(`
These render no translations at all, so nothing else can see them: the string
lint does not look outside MIGRATED, and the check above only flags files that
already call $t. Migrate each and add its path to MIGRATED — or, if its text is
genuinely fixed (a wordmark, a glyph), add the path anyway and mark the line
i18n-ignore, so the decision is recorded rather than implied.
`)
}

process.exit(1)
