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
 * The compiler, the core and the scanner are resolved from the *plugin's* own
 * directory — `@tailwindcss/vite` for the admin, `@tailwindcss/postcss` for
 * the public site — not from the app. The plugin pins the three at its own
 * version, and under pnpm they sit beside it in .pnpm/<plugin>/node_modules,
 * so what answers here is the copy the build runs even if the app ever
 * declares a different tailwindcss directly. The four versions are compared
 * all the same: a scanner one release behind the compiler answers for a
 * build that does not run.
 *
 * compile() runs with @tailwindcss/node's own resolver, which is the PostCSS
 * plugin's exactly and the Vite plugin's minus Vite's aliases — so an entry
 * stylesheet must import by relative path or package name, never `@/`.
 */
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { canonical, posix } from './paths.mjs'

/** What a Tailwind plugin depends on, at its own version. */
const PLUGIN_DEPS = ['tailwindcss', '@tailwindcss/node', '@tailwindcss/oxide']

/**
 * The installed directory of `name` as Node resolves it from `from`, as a
 * real path — found by its package.json rather than its entry point, because
 * @tailwindcss/vite exports no `require` entry and @tailwindcss/node no
 * `./package.json` subpath.
 */
function packageDir(from, name) {
  for (const dir of createRequire(from).resolve.paths(name) ?? []) {
    const candidate = join(dir, name)
    if (existsSync(join(candidate, 'package.json'))) return realpathSync.native(candidate)
  }
  throw new Error(`${name} is not installed anywhere ${from} resolves packages from`)
}

const versionIn = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version

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
 * scanner reads for it, as canonical posix paths, sorted.
 *
 *   plugin      — the plugin the build runs: '@tailwindcss/vite' or
 *                 '@tailwindcss/postcss'. The compiler and scanner are the
 *                 copies it resolves.
 *   projectRoot — what automatic detection reads when the import carries no
 *                 source() clause: the Vite root for the admin, the PostCSS
 *                 working directory for the public site. Named so the list is
 *                 the build's even when the configuration is wrong.
 *   from        — where to resolve the plugin from. The stylesheet itself,
 *                 unless a test's fixture lives outside any project.
 */
export async function tailwindScan(styleFile, { plugin, projectRoot = dirname(styleFile), from = styleFile }) {
  const { dirs, versions } = tailwindPackages(from, plugin)
  const req = createRequire(join(dirs[plugin], 'package.json'))
  const { compile } = req('@tailwindcss/node')
  const { Scanner } = req('@tailwindcss/oxide')
  const { root, sources } = await compile(readFileSync(styleFile, 'utf8'), { base: dirname(styleFile), onDependency() {} })
  // The scanner's sources as @tailwindcss/vite and @tailwindcss/postcss build
  // them: the root first — nothing, the whole project, or the one named — then
  // every @source line.
  const detection = root === 'none' ? [] : root === null ? [{ base: projectRoot, pattern: '**/*', negated: false }] : [{ ...root, negated: false }]
  const scanner = new Scanner({ sources: [...detection, ...sources] })
  scanner.scan()
  return { root, sources, files: scanner.files.map(canonical).sort(), versions }
}

const isFile = (p) => statSync(p, { throwIfNoEntry: false })?.isFile() ?? false

/**
 * Holds what Tailwind reads to what renders. Returns the problems, as lines.
 *
 *   scan        — tailwindScan()'s answer: { root, sources, files, versions }
 *   styleFile   — the entry stylesheet, which `expected` is relative to
 *   expected    — the @source lines as css-sources.mjs holds them, [{ path, not }]
 *   allowed     — the directories (or single files) Tailwind may read, absolute
 *   isFixture   — names, by project-relative path, a file Tailwind must not read (fixtureTest)
 *   required    — files that must be among those read: the proof the sources point at the tree that renders
 *   excluded    — files that must not be: the proof the `not` lines work
 *   projectRoot — what paths are shown relative to
 *   label       — the stylesheet's name in the messages
 *
 * Every path is compared in canonical form (paths.mjs): the scanner answers
 * with real paths in on-disk casing, whatever spelling the configuration used.
 */
export function scanProblems(scan, { label, styleFile, expected, allowed, isFixture = () => false, required = [], excluded = [], projectRoot }) {
  const out = []
  const root = canonical(projectRoot)
  const rel = (p) => posix(relative(root, canonical(p))) || '.'

  const versions = Object.entries(scan.versions)
  if (new Set(versions.map(([, v]) => v)).size > 1) {
    out.push(`the Tailwind asked is not one Tailwind: ${versions.map(([name, v]) => `${name} ${v}`).join(', ')} — the plugin and the three packages it runs must be one version, or the scanner answers for a build that does not run`)
  }

  if (scan.root === null) out.push(`Tailwind reads ${label} with automatic detection — every non-ignored file under ${rel(projectRoot)}/ is a source; the import must carry \`source(none)\``)
  else if (scan.root !== 'none') out.push(`Tailwind reads ${label} with \`source(${JSON.stringify(scan.root.pattern)})\` from ${rel(scan.root.base)}/ — the import must carry \`source(none)\`, with the sources as @source lines`)

  // The sources as Tailwind resolved them against the ones this check expects,
  // by canonical path, so `./../src` and `../src` are one source either side.
  const have = new Map(scan.sources.map((s) => [`${s.negated ? 'not ' : ''}${canonical(resolve(s.base, s.pattern))}`, s]))
  const want = new Map(expected.map((s) => [`${s.not ? 'not ' : ''}${canonical(resolve(dirname(styleFile), s.path))}`, s]))
  for (const [key, s] of want) if (!have.has(key)) out.push(`Tailwind took no \`@source ${s.not ? 'not ' : ''}"${s.path}"\` from ${label} — nothing it reads resolves to ${s.not ? 'not ' : ''}${rel(key.replace(/^not /, ''))}`)
  for (const [key, s] of have) if (!want.has(key)) out.push(`Tailwind reads ${label} with a source this check does not expect: \`${s.negated ? 'not ' : ''}${s.pattern}\` from ${rel(s.base)}/, which is ${rel(key.replace(/^not /, ''))}`)

  const dirs = allowed.map(canonical)
  const inside = (f) => dirs.some((d) => f === d || f.startsWith(d + '/'))
  const where = allowed.map((a) => rel(a) + (isFile(a) ? '' : '/')).join(' and ')
  const files = new Set(scan.files.map(canonical))
  const banned = new Set(excluded.map(canonical))
  for (const f of files) {
    if (!inside(f)) out.push(`Tailwind reads ${rel(f)} — outside ${where}, so a class-shaped word there is a rule in the build`)
    else if (banned.has(f)) out.push(`Tailwind reads ${rel(f)} — the file the \`@source not\` line exists to keep out; its fixtures are in the build`)
    else if (isFixture(rel(f))) out.push(`Tailwind reads ${rel(f)} — a fixture by its name, which an \`@source not\` line in ${label} should exclude`)
  }
  for (const f of required) {
    if (files.has(canonical(f))) continue
    out.push(`Tailwind does not read ${rel(f)} — ${files.size ? `${files.size} file(s) read, this not among them` : 'it reads no file at all'}; the sources in ${label} no longer point at what renders`)
  }
  return out
}
