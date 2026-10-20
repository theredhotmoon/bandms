import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { scanProblems, tailwindPackages, tailwindScan } from './tailwind-scan.mjs'
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
const FROM = fileURLToPath(new URL('../../../app/package.json', import.meta.url))
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
    expect(new Set(Object.values(versions)).size).toBe(1)
    // The three are the copies the plugin asked for — its package.json pins each at an exact version — found through its own directory, and real paths.
    const plugin = JSON.parse(readFileSync(join(dirs[PLUGIN], 'package.json'), 'utf8'))
    for (const name of ['tailwindcss', '@tailwindcss/node', '@tailwindcss/oxide']) {
      expect(plugin.dependencies[name]).toMatch(/^\d/)
      expect(versions[name]).toBe(plugin.dependencies[name])
      expect(dirs[name]).toBe(realpathSync.native(dirs[name]))
    }
  })

  it('says which package is missing when one is', () => {
    expect(() => tailwindPackages(FROM, '@tailwindcss/no-such-plugin')).toThrow(/@tailwindcss\/no-such-plugin is not installed/)
  })
})

describe('tailwindScan', () => {
  it('lists what the scanner reads for a source(none) stylesheet with @source lines', async () => {
    write(['@tailwind utilities source(none);', '@source "../pages";', '@source "../index.html";', '@source not "../pages/**/*.spec.ts";'])
    const s = await scan()
    expect(s.root).toBe('none')
    expect(s.sources.map((x: { pattern: string; negated: boolean }) => [x.pattern, x.negated]))
      .toEqual([['../pages', false], ['../index.html', false], ['../pages/**/*.spec.ts', true]])
    expect(s.files.map(rel)).toEqual(['index.html', 'pages/Home.vue', 'pages/notes.md'])
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
    expect(problems).toContainEqual(expect.stringMatching(/^Tailwind reads README\.md — outside pages\/ and index\.html, so/))
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

  it('names a file read from outside the allowed trees, and the file among them as a file', () => {
    const s = { ...clean(), files: [...clean().files, canonical(join(dir, 'scripts', 'guard.mjs'))] }
    expect(scanProblems(s, rules())).toEqual([expect.stringMatching(/^Tailwind reads scripts\/guard\.mjs — outside pages\/ and index\.html, so/)])
  })

  it('names a fixture read from inside them, by its name', () => {
    const s = { ...clean(), files: [...clean().files, canonical(join(dir, 'pages', 'other.spec.ts'))] }
    expect(scanProblems(s, rules())).toEqual([expect.stringMatching(/reads pages\/other\.spec\.ts — a fixture by its name/)])
  })

  it('names a required file the scan did not reach, with the count', () => {
    const s = { ...clean(), files: [canonical(join(dir, 'index.html'))] }
    expect(scanProblems(s, rules())).toEqual([expect.stringMatching(/does not read pages\/Home\.vue — 1 file\(s\) read/)])
    expect(scanProblems({ ...clean(), files: [] }, rules())).toEqual([
      expect.stringMatching(/does not read pages\/Home\.vue — it reads no file at all/),
      expect.stringMatching(/does not read index\.html — it reads no file at all/),
    ])
  })

  it('names a source Tailwind took that the check does not expect, and one it did not take', () => {
    const extra = { ...clean(), sources: [...clean().sources, { base: join(dir, 'styles'), pattern: '../README.md', negated: false }] }
    expect(scanProblems(extra, rules())).toEqual([expect.stringMatching(/a source this check does not expect: `\.\.\/README\.md` from styles\/, which is README\.md/)])
    const missing = { ...clean(), sources: clean().sources.slice(0, 2) }
    expect(scanProblems(missing, rules())).toEqual([expect.stringMatching(/took no `@source not "\.\.\/pages\/\*\*\/\*\.spec\.ts"`/)])
  })
})
