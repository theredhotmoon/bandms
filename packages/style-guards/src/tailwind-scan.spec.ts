import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { importedCoreNote, scanProblems, tailwindPackages, tailwindScan, versionProblem } from './tailwind-scan.mjs'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { fixtureTest } from './css-sources.mjs'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { canonical } from './paths.mjs'

/**
 * The real compiler and scanner run against a throwaway tree in the OS temp
 * directory, which has no node_modules of its own — the plugin is resolved
 * from the admin, whose vitest this runs under, and the compiler and scanner
 * from the plugin. The stylesheet starts Tailwind with `@tailwind utilities`,
 * the root form that needs no import resolved. The temp path is taken as the
 * disk knows it (on macOS tmpdir() is /var/…, which is /private/var/…).
 */
const APP = fileURLToPath(new URL('../../../app/', import.meta.url))
const FROM = join(APP, 'package.json')
const PLUGIN = '@tailwindcss/vite'

let dir: string
let style: string
const rel = (f: string) => canonical(f).slice(canonical(dir).length + 1)
const write = (lines: string[]) => writeFileSync(style, lines.join('\n') + '\n')
const scan = () => tailwindScan(style, { plugin: PLUGIN, projectRoot: dir, from: FROM })

beforeAll(() => {
  dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'style-guards-scan-')))
  mkdirSync(join(dir, 'pages', 'deep'), { recursive: true })
  mkdirSync(join(dir, 'styles'))
  style = join(dir, 'styles', 'entry.css')
  writeFileSync(join(dir, 'pages', 'Home.vue'), '<div class="flex rounded-card">hi</div>')
  writeFileSync(join(dir, 'pages', 'deep', 'thing.spec.ts'), 'const x = "[--radius-card:4px] bg-[#…]"')
  writeFileSync(join(dir, 'pages', 'notes.md'), 'text-zinc-400')
  writeFileSync(join(dir, 'README.md'), 'rounded-xl')
  writeFileSync(join(dir, 'index.html'), '<p class="grid">x</p>')
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

const EXPECTED = [
  { path: '../pages', not: false },
  { path: '../index.html', not: false },
  { path: '../pages/**/*.spec.ts', not: true },
]
const rules = () => ({
  label: 'styles/entry.css',
  styleFile: style,
  expected: EXPECTED,
  allowed: [join(dir, 'pages'), join(dir, 'index.html')],
  isFixture: fixtureTest(EXPECTED),
  required: [join(dir, 'pages', 'Home.vue'), join(dir, 'index.html')],
  excluded: [join(dir, 'pages', 'deep', 'thing.spec.ts')],
  projectRoot: dir,
})

describe('tailwindPackages', () => {
  it('finds the plugin and, from its own directory, the core, compiler and scanner it runs, at one version', () => {
    const { dirs, versions } = tailwindPackages(FROM, PLUGIN)
    expect(Object.keys(versions)).toEqual([PLUGIN, 'tailwindcss', '@tailwindcss/node', '@tailwindcss/oxide'])
    for (const version of Object.values(versions)) expect(version).toMatch(/^\d+\.\d+\.\d+/)
    expect(versionProblem(versions)).toBeNull()
    // The three are the copies the plugin asked for — its package.json pins each at an exact version — found through its own directory, and real paths.
    const plugin = JSON.parse(readFileSync(join(dirs[PLUGIN], 'package.json'), 'utf8'))
    for (const name of ['tailwindcss', '@tailwindcss/node', '@tailwindcss/oxide']) {
      expect(plugin.dependencies[name]).toMatch(/^\d/)
      expect(versions[name]).toBe(plugin.dependencies[name])
      expect(dirs[name]).toBe(realpathSync.native(dirs[name]))
    }
  })

  it('says which package is missing when one is, and looks only up the ancestor chain', () => {
    expect(() => tailwindPackages(FROM, '@tailwindcss/no-such-plugin')).toThrow(/@tailwindcss\/no-such-plugin is not installed in any node_modules above/)
    expect(() => tailwindPackages(join(dir, 'styles', 'entry.css'), PLUGIN)).toThrow(/is not installed/)
  })
})

describe('versionProblem', () => {
  it('passes one version and names every package when they differ', () => {
    expect(versionProblem({ a: '4.3.3', b: '4.3.3' })).toBeNull()
    expect(versionProblem({ [PLUGIN]: '4.3.3', tailwindcss: '4.3.3', '@tailwindcss/oxide': '4.3.2' }))
      .toMatch(/^the Tailwind asked is not one Tailwind: @tailwindcss\/vite 4\.3\.3, tailwindcss 4\.3\.3, @tailwindcss\/oxide 4\.3\.2 —/)
  })
})

describe('tailwindScan', () => {
  it('requires the plugin and the project root', async () => {
    await expect(tailwindScan(style, { projectRoot: dir, from: FROM })).rejects.toThrow(/`plugin` is required/)
    await expect(tailwindScan(style, { plugin: PLUGIN, from: FROM })).rejects.toThrow(/`projectRoot` is required/)
  })

  it('lists what the scanner reads for a source(none) stylesheet with @source lines', async () => {
    write(['@tailwind utilities source(none);', '@source "../pages";', '@source "../index.html";', '@source not "../pages/**/*.spec.ts";'])
    const s = await scan()
    expect(s.root).toBe('none')
    expect(s.sources.map((x: { pattern: string; negated: boolean }) => [x.pattern, x.negated]))
      .toEqual([['../pages', false], ['../index.html', false], ['../pages/**/*.spec.ts', true]])
    expect(s.files.map(rel)).toEqual(['index.html', 'pages/Home.vue', 'pages/notes.md'])
    expect(Object.keys(s.versions)).toHaveLength(4)
    expect(s.imported).toBeNull()
    expect(importedCoreNote(s)).toBeNull()
    expect(scanProblems(s, rules())).toEqual([])
  })

  it('reads the spec once the not line is gone, and the judgement names it once', async () => {
    write(['@tailwind utilities source(none);', '@source "../pages";', '@source "../index.html";'])
    const s = await scan()
    expect(s.files.map(rel)).toContain('pages/deep/thing.spec.ts')
    const problems = scanProblems(s, rules())
    expect(problems.filter((p: string) => p.includes('thing.spec.ts'))).toHaveLength(1)
    expect(problems.find((p: string) => p.includes('thing.spec.ts'))).toMatch(/exists to keep out/)
    expect(problems.find((p: string) => p.includes('took no'))).toMatch(/@source not "\.\.\/pages\/\*\*\/\*\.spec\.ts"/)
  })

  it('reads the whole project under automatic detection, and says so', async () => {
    write(['@tailwind utilities;'])
    const s = await scan()
    expect(s.root).toBeNull()
    expect(s.files.map(rel)).toContain('README.md')
    expect(s.files.map(rel)).toContain('pages/deep/thing.spec.ts')
    const problems = scanProblems(s, rules())
    expect(problems[0]).toMatch(/automatic detection/)
    // Which files automatic detection takes beyond README.md is the scanner's business (today it reads .css too); the guard's is to name them as outside.
    expect(problems).toContainEqual(expect.stringMatching(/^Tailwind reads \d+ files? outside pages\/ and index\.html, so .*README\.md/))
  })

  it('reports a named root as the configuration Tailwind read', async () => {
    write(['@tailwind utilities source("../pages");'])
    const s = await scan()
    expect(s.root).toEqual({ base: expect.any(String), pattern: '../pages' })
    expect(scanProblems(s, rules())[0]).toMatch(/source\("\.\.\/pages"\)/)
  })

  it('compares sources by where they resolve, not by spelling', async () => {
    write(['@tailwind utilities source(none);', '@source "./../pages/";', '@source "../index.html";', '@source not "../pages/**/*.spec.ts";'])
    expect(scanProblems(await scan(), rules())).toEqual([])
  })

  it.skipIf(process.platform !== 'win32')('passes a project named in another casing than the disk holds', async () => {
    write(['@tailwind utilities source(none);', '@source "../pages";', '@source "../index.html";', '@source not "../pages/**/*.spec.ts";'])
    const shouted = dir.toUpperCase()
    const s = await tailwindScan(join(shouted, 'styles', 'entry.css'), { plugin: PLUGIN, projectRoot: shouted, from: FROM })
    expect(scanProblems(s, {
      ...rules(),
      styleFile: join(shouted, 'styles', 'entry.css'),
      allowed: [join(shouted, 'pages'), join(shouted, 'index.html')],
      required: [join(shouted, 'pages', 'Home.vue')],
      excluded: [join(shouted, 'pages', 'deep', 'thing.spec.ts')],
      projectRoot: shouted,
    })).toEqual([])
  })

  it('reports the core the admin stylesheet imports — the app’s own tailwindcss, not the plugin’s — beside the plugin’s versions', async () => {
    // The real admin entry, as the guard calls it: the import resolves from src/ to app/node_modules/tailwindcss.
    const s = await tailwindScan(join(APP, 'src', 'style.css'), { plugin: PLUGIN, projectRoot: APP })
    expect(s.plugin).toBe(PLUGIN)
    // Its shape, not its equality with the plugin's: a one-sided bump is a note in the build, and must not become a red suite here.
    expect(s.imported).toMatch(/^\d+\.\d+\.\d+/)
    expect(Object.keys(s.versions)).toHaveLength(4)
    expect(s.files.length).toBeGreaterThan(100)
  })
})

describe('scanProblems', () => {
  const clean = () => ({
    root: 'none',
    sources: [
      { base: join(dir, 'styles'), pattern: '../pages', negated: false },
      { base: join(dir, 'styles'), pattern: '../index.html', negated: false },
      { base: join(dir, 'styles'), pattern: '../pages/**/*.spec.ts', negated: true },
    ],
    files: [join(dir, 'index.html'), join(dir, 'pages', 'Home.vue')].map(canonical),
    versions: { [PLUGIN]: '4.3.3', tailwindcss: '4.3.3', '@tailwindcss/node': '4.3.3', '@tailwindcss/oxide': '4.3.3' },
  })

  it('passes a scan that reads exactly what renders', () => {
    expect(scanProblems(clean(), rules())).toEqual([])
  })

  it('refuses a scanner that is not the version of the plugin', () => {
    const s = { ...clean(), versions: { ...clean().versions, '@tailwindcss/oxide': '4.3.2' } }
    expect(scanProblems(s, rules())).toEqual([expect.stringMatching(/^the Tailwind asked is not one Tailwind: @tailwindcss\/vite 4\.3\.3, tailwindcss 4\.3\.3, @tailwindcss\/node 4\.3\.3, @tailwindcss\/oxide 4\.3\.2 —/)])
  })

  it('names the files read from outside the allowed trees in one line, the file among them as a file, and no more than five', () => {
    const one = { ...clean(), files: [...clean().files, canonical(join(dir, 'scripts', 'guard.mjs'))] }
    expect(scanProblems(one, rules())).toEqual([expect.stringMatching(/^Tailwind reads 1 file outside pages\/ and index\.html, so .*: scripts\/guard\.mjs$/)])
    const seven = { ...clean(), files: [...clean().files, ...'abcdefg'.split('').map((n) => canonical(join(dir, 'scripts', `${n}.mjs`)))] }
    expect(scanProblems(seven, rules())).toEqual([expect.stringMatching(/^Tailwind reads 7 files outside .*: scripts\/a\.mjs, scripts\/b\.mjs, scripts\/c\.mjs, scripts\/d\.mjs, scripts\/e\.mjs … and 2 more$/)])
  })

  it('names fixtures read from inside them by name, in one line, and says when every not line was taken', () => {
    const s = { ...clean(), files: [...clean().files, canonical(join(dir, 'pages', 'other.spec.ts'))] }
    expect(scanProblems(s, rules())).toEqual([expect.stringMatching(/^Tailwind reads 1 fixture file by name, which the `@source not` line in styles\/entry\.css should exclude — every not line was taken, so Tailwind reads the glob differently from this check: pages\/other\.spec\.ts$/)])
    const untaken = { ...s, sources: s.sources.slice(0, 2) }
    expect(scanProblems(untaken, rules())).toEqual([
      expect.stringMatching(/^Tailwind took no `@source not/),
      expect.stringMatching(/^Tailwind reads 1 fixture file by name, which the `@source not` line in styles\/entry\.css should exclude: pages\/other\.spec\.ts$/),
    ])
  })

  it('names a required file the scan did not reach, with the count — or says it is not on disk', () => {
    const s = { ...clean(), files: [canonical(join(dir, 'index.html'))] }
    expect(scanProblems(s, rules())).toEqual([expect.stringMatching(/does not read pages\/Home\.vue — 1 file read/)])
    expect(scanProblems({ ...clean(), files: [] }, rules())).toEqual([
      expect.stringMatching(/does not read pages\/Home\.vue — it reads no file at all/),
      expect.stringMatching(/does not read index\.html — it reads no file at all/),
    ])
    expect(scanProblems(clean(), { ...rules(), required: [join(dir, 'pages', 'Gone.vue')] }))
      .toEqual([expect.stringMatching(/^pages\/Gone\.vue is not on disk — the required list in this check names a file that moved/)])
  })

  it('names a source Tailwind took that the check does not expect, and one it did not take', () => {
    const extra = { ...clean(), sources: [...clean().sources, { base: join(dir, 'styles'), pattern: '../README.md', negated: false }] }
    expect(scanProblems(extra, rules())).toEqual([expect.stringMatching(/a source this check does not expect: `\.\.\/README\.md` from styles\/, which is README\.md/)])
    const missing = { ...clean(), sources: clean().sources.slice(0, 2) }
    expect(scanProblems(missing, rules())).toEqual([expect.stringMatching(/took no `@source not "\.\.\/pages\/\*\*\/\*\.spec\.ts";`/)])
  })

  it('spells the lines it asks for in the stylesheet’s own quotes, as the written check does', () => {
    const missing = { ...clean(), sources: clean().sources.slice(0, 2) }
    expect(scanProblems(missing, { ...rules(), quote: "'" })).toEqual([expect.stringMatching(/took no `@source not '\.\.\/pages\/\*\*\/\*\.spec\.ts';`/)])
    const named = { ...clean(), root: { base: join(dir, 'styles'), pattern: '../pages' } }
    expect(scanProblems(named, { ...rules(), quote: "'" })[0]).toMatch(/source\('\.\.\/pages'\)/)
  })

  it('refuses an excluded file that is not on disk — a proof file that moved proves nothing', () => {
    expect(scanProblems(clean(), { ...rules(), excluded: [join(dir, 'pages', 'moved.spec.ts')] }))
      .toEqual([expect.stringMatching(/^pages\/moved\.spec\.ts is not on disk — the excluded list in this check names a file that moved, so the `@source not` line is no longer proven/)])
  })

  it('does not count a drifted imported core as a problem — that is a note', () => {
    expect(scanProblems({ ...clean(), imported: '4.4.0' }, rules())).toEqual([])
  })
})

describe('importedCoreNote', () => {
  it('is silent for no import or the plugin’s version, and a note — not a problem — for another', () => {
    const base = { plugin: PLUGIN, versions: { [PLUGIN]: '4.3.3', tailwindcss: '4.3.3' } }
    expect(importedCoreNote(base)).toBeNull()
    expect(importedCoreNote({ ...base, imported: null })).toBeNull()
    expect(importedCoreNote({ ...base, imported: '4.3.3' })).toBeNull()
    expect(importedCoreNote({ ...base, imported: '4.4.0' }))
      .toMatch(/^the stylesheet imports tailwindcss 4\.4\.0 while @tailwindcss\/vite runs tailwindcss 4\.3\.3 — the build works with the two/)
  })
})
