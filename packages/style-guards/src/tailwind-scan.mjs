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
 * The packages are resolved from the stylesheet's own directory by default,
 * so they are the ones the build resolves its plugin from, and the three
 * versions are compared: a scanner one release behind the compiler answers
 * for a build that does not run.
 */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'

const PACKAGES = ['tailwindcss', '@tailwindcss/node', '@tailwindcss/oxide']

/** One spelling of a path for comparison: forward slashes. The scanner answers in the platform's. */
export const slashes = (p) => p.split('\\').join('/')

/**
 * The version of an installed package, found from its entry point upward —
 * `<name>/package.json` is not an exported subpath of @tailwindcss/node.
 */
function versionOf(req, name) {
  const entry = req.resolve(name)
  let dir = dirname(entry)
  for (;;) {
    const file = join(dir, 'package.json')
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, 'utf8'))
      if (pkg.name === name) return pkg.version
    }
    const up = dirname(dir)
    if (up === dir) throw new Error(`${name}: no package.json of that name above ${entry}`)
    dir = up
  }
}

/** The versions of tailwindcss, @tailwindcss/node and @tailwindcss/oxide as Node resolves them from `from`. */
export function tailwindVersions(from) {
  const req = createRequire(from)
  return Object.fromEntries(PACKAGES.map((name) => [name, versionOf(req, name)]))
}

/**
 * Compile `styleFile` with Tailwind's own compiler and list the files its own
 * scanner reads for it, as forward-slashed absolute paths, sorted.
 *
 *   projectRoot — what automatic detection reads when the import carries no
 *                 source() clause: the Vite root for the admin, the PostCSS
 *                 working directory for the public site. Named so the list is
 *                 the build's even when the configuration is wrong.
 *   from        — where to resolve the Tailwind packages from. The stylesheet
 *                 itself, unless a test's fixture lives outside any project.
 */
export async function tailwindScan(styleFile, { projectRoot = dirname(styleFile), from = styleFile } = {}) {
  const req = createRequire(from)
  const { compile } = req('@tailwindcss/node')
  const { Scanner } = req('@tailwindcss/oxide')
  const dependencies = []
  const { root, sources } = await compile(readFileSync(styleFile, 'utf8'), {
    base: dirname(styleFile),
    from: styleFile,
    onDependency: (p) => dependencies.push(slashes(p)),
  })
  // The scanner's sources as @tailwindcss/vite and @tailwindcss/postcss build
  // them: the root first — nothing, the whole project, or the one named — then
  // every @source line.
  const detection = root === 'none' ? [] : root === null ? [{ base: projectRoot, pattern: '**/*', negated: false }] : [{ ...root, negated: false }]
  const scanner = new Scanner({ sources: [...detection, ...sources] })
  scanner.scan()
  return { root, sources, files: scanner.files.map(slashes).sort(), dependencies, versions: tailwindVersions(from) }
}

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
 */
export function scanProblems(scan, { label, styleFile, expected, allowed, isFixture = () => false, required = [], excluded = [], projectRoot }) {
  const out = []
  const norm = (p) => slashes(resolve(p))
  const rel = (p) => slashes(relative(projectRoot, p)) || '.'

  const versions = Object.entries(scan.versions)
  if (new Set(versions.map(([, v]) => v)).size > 1) {
    out.push(`the Tailwind asked is not one Tailwind: ${versions.map(([name, v]) => `${name} ${v}`).join(', ')} — the three packages must be one version, or the scanner answers for a build that does not run`)
  }

  if (scan.root === null) out.push(`Tailwind reads ${label} with automatic detection — every non-ignored file under ${rel(projectRoot)}/ is a source; the import must carry \`source(none)\``)
  else if (scan.root !== 'none') out.push(`Tailwind reads ${label} with \`source(${JSON.stringify(scan.root.pattern)})\` from ${rel(scan.root.base)}/ — the import must carry \`source(none)\`, with the sources as @source lines`)

  // The sources as Tailwind resolved them against the ones this check expects,
  // by resolved path, so `./../src` and `../src` are one source either side.
  const have = new Map(scan.sources.map((s) => [`${s.negated ? 'not ' : ''}${norm(resolve(s.base, s.pattern))}`, s]))
  const want = new Map(expected.map((s) => [`${s.not ? 'not ' : ''}${norm(resolve(dirname(styleFile), s.path))}`, s]))
  for (const [key, s] of want) if (!have.has(key)) out.push(`Tailwind took no \`@source ${s.not ? 'not ' : ''}"${s.path}"\` from ${label} — nothing it reads resolves to ${s.not ? 'not ' : ''}${rel(key.replace(/^not /, ''))}`)
  for (const [key, s] of have) if (!want.has(key)) out.push(`Tailwind reads ${label} with a source this check does not expect: \`${s.negated ? 'not ' : ''}${s.pattern}\` from ${rel(s.base)}/, which is ${rel(key.replace(/^not /, ''))}`)

  const dirs = allowed.map(norm)
  const inside = (f) => dirs.some((d) => f === d || f.startsWith(d + '/'))
  const files = new Set(scan.files.map(norm))
  const banned = new Set(excluded.map(norm))
  for (const f of files) {
    if (!inside(f)) out.push(`Tailwind reads ${rel(f)} — outside ${allowed.map((a) => rel(a) + (f === norm(a) ? '' : '/')).join(' and ')}, so a class-shaped word there is a rule in the build`)
    else if (banned.has(f)) out.push(`Tailwind reads ${rel(f)} — the file the \`@source not\` line exists to keep out; its fixtures are in the build`)
    else if (isFixture(rel(f))) out.push(`Tailwind reads ${rel(f)} — a fixture by its name, which an \`@source not\` line in ${label} should exclude`)
  }
  for (const f of required) {
    if (files.has(norm(f))) continue
    out.push(`Tailwind does not read ${rel(f)} — ${files.size ? `${files.size} file(s) read, this not among them` : 'it reads no file at all'}; the sources in ${label} no longer point at what renders`)
  }
  return out
}
