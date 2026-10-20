/**
 * Which files Tailwind reads for class names — asked of Tailwind, not read
 * from the directives.
 *
 * css-sources.mjs reads `source(none)` and the `@source` lines back out of
 * the entry stylesheet with this repo's own grammar, and the admin's guard
 * judges the built CSS for two selector shapes. Between them sits the question
 * neither answers in general: given this stylesheet, which files does the
 * installed Tailwind open? A `not` glob that this repo and Tailwind resolve
 * differently, a file type the scanner starts reading in a new release, a
 * source whose base moved — each puts a fixture back into the build in a shape
 * the output check does not know. So this asks: `@tailwindcss/node`'s
 * compile() parses the stylesheet exactly as the Vite and PostCSS plugins do
 * and hands back `root` and `sources`; `@tailwindcss/oxide`'s Scanner, built
 * from them the way both plugins build it, lists the files it reads.
 * scanProblems() then holds that list to the trees that render.
 *
 * Which Tailwind answers matters, and there are two of them in every build:
 *   - the plugin's — `@tailwindcss/vite` for the admin, `@tailwindcss/postcss`
 *     for the public site — pins tailwindcss, @tailwindcss/node and
 *     @tailwindcss/oxide at its own version, and under pnpm they sit beside it
 *     in .pnpm/<plugin>/node_modules. The compiler and scanner are taken from
 *     there, not from the app, so they are the copies the build runs even if
 *     the app ever declared a different tailwindcss directly;
 *   - the stylesheet's — `@import "tailwindcss"` resolves from the stylesheet,
 *     in the guard as in the build, to the tailwindcss the *app* declares.
 * The versions of all of them must agree, and the run stops before anything is
 * scanned if they do not: a scanner one release behind the compiler, or a core
 * ahead of both, answers for a build that does not run.
 *
 * compile() runs with @tailwindcss/node's own resolver, which is the PostCSS
 * plugin's exactly and the Vite plugin's minus Vite's aliases — so an entry
 * stylesheet must import by relative path or package name, never `@/`.
 *
 * Every path is compared in canonical form (paths.mjs): the scanner answers
 * with real paths in on-disk casing, whatever spelling the shell used.
 */
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { sourceKey } from './css-sources.mjs'
import { canonical, posix } from './paths.mjs'

/** What a Tailwind plugin depends on, at its own version. */
const PLUGIN_DEPS = ['tailwindcss', '@tailwindcss/node', '@tailwindcss/oxide']
/** The core the stylesheet imports, as it is named in `versions`. */
const IMPORTED = 'tailwindcss (imported by the stylesheet)'
/** How many paths a collapsed message shows before "and N more". */
const SHOWN = 5

/**
 * The installed directory of `name` as Node would resolve it from `from`, as
 * a real path: the first `<ancestor>/node_modules/<name>` above `from`, found
 * by its package.json rather than its entry point, because @tailwindcss/vite
 * exports no `require` entry and @tailwindcss/node no `./package.json`
 * subpath. Only the ancestor chain is searched — never Node's global
 * fallbacks (~/.node_modules and friends), where a copy of the plugin would
 * answer for a build that cannot load it.
 */
function packageDir(from, name) {
  for (let dir = dirname(resolve(from)); ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name)
    if (existsSync(join(candidate, 'package.json'))) return realpathSync.native(candidate)
    if (dirname(dir) === dir) throw new Error(`${name} is not installed in any node_modules above ${posix(from)}`)
  }
}

/** The package directory a file belongs to, if it belongs to one named `name`. */
function packageAbove(file, name) {
  for (let dir = dirname(file); dirname(dir) !== dir; dir = dirname(dir)) {
    const manifest = join(dir, 'package.json')
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name === name) return dir
  }
  return null
}

const versionIn = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version

/** The one-version rule, as a problem line or null. */
export function versionProblem(versions) {
  const entries = Object.entries(versions)
  if (new Set(entries.map(([, v]) => v)).size <= 1) return null
  return `the Tailwind asked is not one Tailwind: ${entries.map(([name, v]) => `${name} ${v}`).join(', ')} — the plugin, the three packages it runs and the core the stylesheet imports must be one version, or the scanner answers for a build that does not run`
}

/**
 * The plugin the build runs, as resolved from `from`, and the compiler, core
 * and scanner the plugin itself resolves: { dirs, versions }, the plugin
 * first in each.
 */
export function tailwindPackages(from, plugin) {
  const dirs = { [plugin]: packageDir(from, plugin) }
  for (const name of PLUGIN_DEPS) dirs[name] = packageDir(join(dirs[plugin], 'package.json'), name)
  return { dirs, versions: Object.fromEntries(Object.entries(dirs).map(([name, dir]) => [name, versionIn(dir)])) }
}

/**
 * Compile `styleFile` with Tailwind's own compiler and list the files its own
 * scanner reads for it, as canonical posix paths, sorted. Throws, before
 * anything is scanned, when the Tailwinds involved are not one version.
 *
 *   plugin      — the plugin the build runs: '@tailwindcss/vite' or
 *                 '@tailwindcss/postcss'. The compiler and scanner are the
 *                 copies it resolves.
 *   projectRoot — what automatic detection reads when the import carries no
 *                 source() clause: the Vite root for the admin, the PostCSS
 *                 working directory for the public site. Required, because
 *                 no default matches either plugin, and a wrong one lists the
 *                 files of a build that does not exist.
 *   from        — where to resolve the plugin from. The stylesheet itself,
 *                 unless a test's fixture lives outside any project.
 */
export async function tailwindScan(styleFile, { plugin, projectRoot, from = styleFile } = {}) {
  if (!plugin) throw new Error('tailwindScan: `plugin` is required — @tailwindcss/vite or @tailwindcss/postcss, whichever the build runs')
  if (!projectRoot) throw new Error('tailwindScan: `projectRoot` is required — the Vite root or the PostCSS working directory, which automatic detection reads')
  const { dirs, versions } = tailwindPackages(from, plugin)
  const drift = versionProblem(versions)
  if (drift) throw new Error(drift)

  const req = createRequire(join(dirs[plugin], 'package.json'))
  const { compile } = req('@tailwindcss/node')
  const { Scanner } = req('@tailwindcss/oxide')
  const dependencies = []
  const { root, sources } = await compile(readFileSync(styleFile, 'utf8'), { base: dirname(styleFile), onDependency: (p) => dependencies.push(p) })

  // The core the stylesheet itself imported — resolved from the stylesheet,
  // as in the build — joins the versions. A stylesheet that starts Tailwind
  // with `@tailwind utilities` imports none.
  const core = dependencies.map((p) => packageAbove(p, 'tailwindcss')).find(Boolean)
  if (core) versions[IMPORTED] = versionIn(core)
  const split = versionProblem(versions)
  if (split) throw new Error(split)

  // The scanner's sources as @tailwindcss/vite and @tailwindcss/postcss build
  // them: the root first — nothing, the whole project, or the one named — then
  // every @source line.
  const detection = root === 'none' ? [] : root === null ? [{ base: projectRoot, pattern: '**/*', negated: false }] : [{ ...root, negated: false }]
  const scanner = new Scanner({ sources: [...detection, ...sources] })
  scanner.scan()
  return { root, sources, files: scanner.files.map(canonical).sort(), versions }
}

const isFile = (p) => statSync(p, { throwIfNoEntry: false })?.isFile() ?? false
const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`

/**
 * Holds what Tailwind reads to what renders. Returns the problems, as lines.
 *
 *   scan        — tailwindScan()'s answer: { root, sources, files, versions },
 *                 `files` canonical as that function returns them
 *   styleFile   — the entry stylesheet, which `expected` is relative to
 *   expected    — the @source lines as css-sources.mjs holds them, [{ path, not }]
 *   allowed     — the directories (or single files) Tailwind may read, absolute
 *   isFixture   — names, by project-relative path, a file Tailwind must not read (fixtureTest)
 *   required    — files that must be among those read: the proof the sources point at the tree that renders
 *   excluded    — files that must not be: the proof the `not` lines work
 *   projectRoot — what paths are shown relative to
 *   label       — the stylesheet's name in the messages
 */
export function scanProblems(scan, { label, styleFile, expected, allowed, isFixture = () => false, required = [], excluded = [], projectRoot }) {
  const out = []
  const root = canonical(projectRoot)
  /** A canonical path, shown relative to the project. */
  const show = (c) => posix(relative(root, c)) || '.'
  const rel = (p) => show(canonical(p))
  const some = (paths) => paths.slice(0, SHOWN).map(show).join(', ') + (paths.length > SHOWN ? ` … and ${paths.length - SHOWN} more` : '')

  const drift = versionProblem(scan.versions)
  if (drift) out.push(drift)

  if (scan.root === null) out.push(`Tailwind reads ${label} with automatic detection — every non-ignored file under ${rel(projectRoot)}/ is a source; the import must carry \`source(none)\``)
  else if (scan.root !== 'none') out.push(`Tailwind reads ${label} with \`source(${JSON.stringify(scan.root.pattern)})\` from ${rel(scan.root.base)}/ — the import must carry \`source(none)\`, with the sources as @source lines`)

  // The sources as Tailwind resolved them against the ones this check expects,
  // by the same identity css-sources.mjs gives a written line.
  const have = new Map(scan.sources.map((s) => [sourceKey(s.base, s.pattern, s.negated), s]))
  const want = new Map(expected.map((s) => [sourceKey(dirname(styleFile), s.path, s.not), s]))
  const path = (key) => show(key.replace(/^not /, ''))
  let notLinesTaken = true
  for (const [key, s] of want) {
    if (have.has(key)) continue
    if (s.not) notLinesTaken = false
    out.push(`Tailwind took no \`@source ${s.not ? 'not ' : ''}"${s.path}"\` from ${label} — nothing it reads resolves to ${s.not ? 'not ' : ''}${path(key)}`)
  }
  for (const [key, s] of have) if (!want.has(key)) out.push(`Tailwind reads ${label} with a source this check does not expect: \`${s.negated ? 'not ' : ''}${s.pattern}\` from ${rel(s.base)}/, which is ${path(key)}`)

  const dirs = allowed.map(canonical)
  const inside = (f) => dirs.some((d) => f === d || f.startsWith(d + '/'))
  const where = allowed.map((a) => rel(a) + (isFile(a) ? '' : '/')).join(' and ')
  const files = new Set(scan.files)
  const banned = new Set(excluded.map(canonical))
  const outside = []
  const fixtures = []
  for (const f of files) {
    if (!inside(f)) outside.push(f)
    else if (banned.has(f)) out.push(`Tailwind reads ${show(f)} — the file the \`@source not\` line exists to keep out; its fixtures are in the build`)
    else if (isFixture(show(f))) fixtures.push(f)
  }
  if (outside.length) out.push(`Tailwind reads ${count(outside.length, 'file')} outside ${where}, so a class-shaped word there is a rule in the build: ${some(outside)}`)
  if (fixtures.length) {
    out.push(`Tailwind reads ${count(fixtures.length, 'fixture file')} by name, which the \`@source not\` line${expected.filter((s) => s.not).length === 1 ? '' : 's'} in ${label} should exclude${notLinesTaken ? ' — every not line was taken, so Tailwind reads the glob differently from this check' : ''}: ${some(fixtures)}`)
  }
  for (const f of required) {
    if (files.has(canonical(f))) continue
    if (!existsSync(f)) out.push(`${rel(f)} is not on disk — the required list in this check names a file that moved; update the list, not the sources`)
    else out.push(`Tailwind does not read ${rel(f)} — ${files.size ? `${count(files.size, 'file')} read, this not among them` : 'it reads no file at all'}; the sources in ${label} no longer point at what renders`)
  }
  return out
}
