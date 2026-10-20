import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { scanProblems, slashes, tailwindScan, tailwindVersions } from './tailwind-scan.mjs'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { fixtureTest } from './css-sources.mjs'

/**
 * The real compiler and scanner run against a throwaway tree in the OS temp
 * directory, which has no node_modules of its own — the packages are resolved
 * from the admin, whose vitest this runs under. The stylesheet starts Tailwind
 * with `@tailwind utilities`, the root form that needs no import resolved.
 */
const FROM = fileURLToPath(new URL('../../../app/package.json', import.meta.url))

let dir: string
let style: string
const rel = (f: string) => slashes(f).slice(slashes(dir).length + 1)
const write = (lines: string[]) => writeFileSync(style, lines.join('\n') + '\n')

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'style-guards-scan-'))
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

describe('tailwindVersions', () => {
  it('finds one version for the compiler, the core and the scanner', () => {
    const v = tailwindVersions(FROM)
    expect(Object.keys(v)).toEqual(['tailwindcss', '@tailwindcss/node', '@tailwindcss/oxide'])
    for (const version of Object.values(v)) expect(version).toMatch(/^\d+\.\d+\.\d+/)
    expect(new Set(Object.values(v)).size).toBe(1)
  })
})

describe('tailwindScan', () => {
  it('lists what the scanner reads for a source(none) stylesheet with @source lines', async () => {
    write(['@tailwind utilities source(none);', '@source "../pages";', '@source "../index.html";', '@source not "../pages/**/*.spec.ts";'])
    const scan = await tailwindScan(style, { projectRoot: dir, from: FROM })
    expect(scan.root).toBe('none')
    expect(scan.sources.map((s: { pattern: string; negated: boolean }) => [s.pattern, s.negated]))
      .toEqual([['../pages', false], ['../index.html', false], ['../pages/**/*.spec.ts', true]])
    expect(scan.files.map(rel)).toEqual(['index.html', 'pages/Home.vue', 'pages/notes.md'])
    expect(scanProblems(scan, rules())).toEqual([])
  })

  it('reads the spec once the not line is gone, and the judgement names it once', async () => {
    write(['@tailwind utilities source(none);', '@source "../pages";', '@source "../index.html";'])
    const scan = await tailwindScan(style, { projectRoot: dir, from: FROM })
    expect(scan.files.map(rel)).toContain('pages/deep/thing.spec.ts')
    const problems = scanProblems(scan, rules())
    expect(problems.filter((p: string) => p.includes('thing.spec.ts'))).toHaveLength(1)
    expect(problems.find((p: string) => p.includes('thing.spec.ts'))).toMatch(/exists to keep out/)
    expect(problems.find((p: string) => p.includes('took no'))).toMatch(/@source not "\.\.\/pages\/\*\*\/\*\.spec\.ts"/)
  })

  it('reads the whole project under automatic detection, and says so', async () => {
    write(['@tailwind utilities;'])
    const scan = await tailwindScan(style, { projectRoot: dir, from: FROM })
    expect(scan.root).toBeNull()
    expect(scan.files.map(rel)).toContain('README.md')
    expect(scan.files.map(rel)).toContain('pages/deep/thing.spec.ts')
    const problems = scanProblems(scan, rules())
    expect(problems[0]).toMatch(/automatic detection/)
    expect(problems.some((p: string) => p.includes('reads README.md') && p.includes('outside'))).toBe(true)
  })

  it('reports a named root as the configuration Tailwind read', async () => {
    write(['@tailwind utilities source("../pages");'])
    const scan = await tailwindScan(style, { projectRoot: dir, from: FROM })
    expect(scan.root).toEqual({ base: expect.any(String), pattern: '../pages' })
    expect(scanProblems(scan, rules())[0]).toMatch(/source\("\.\.\/pages"\)/)
  })

  it('compares sources by where they resolve, not by spelling', async () => {
    write(['@tailwind utilities source(none);', '@source "./../pages/";', '@source "../index.html";', '@source not "../pages/**/*.spec.ts";'])
    const scan = await tailwindScan(style, { projectRoot: dir, from: FROM })
    expect(scanProblems(scan, rules())).toEqual([])
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
    files: [join(dir, 'index.html'), join(dir, 'pages', 'Home.vue')].map(slashes),
    versions: { tailwindcss: '4.3.3', '@tailwindcss/node': '4.3.3', '@tailwindcss/oxide': '4.3.3' },
  })

  it('passes a scan that reads exactly what renders', () => {
    expect(scanProblems(clean(), rules())).toEqual([])
  })

  it('refuses a scanner that is not the version of the compiler', () => {
    const scan = { ...clean(), versions: { ...clean().versions, '@tailwindcss/oxide': '4.3.2' } }
    expect(scanProblems(scan, rules())).toEqual([expect.stringMatching(/not one Tailwind: tailwindcss 4\.3\.3, @tailwindcss\/node 4\.3\.3, @tailwindcss\/oxide 4\.3\.2/)])
  })

  it('names a file read from outside the allowed trees', () => {
    const scan = { ...clean(), files: [...clean().files, slashes(join(dir, 'scripts', 'guard.mjs'))] }
    expect(scanProblems(scan, rules())).toEqual([expect.stringMatching(/reads scripts\/guard\.mjs — outside pages\/ and index\.html/)])
  })

  it('names a fixture read from inside them, by its name', () => {
    const scan = { ...clean(), files: [...clean().files, slashes(join(dir, 'pages', 'other.spec.ts'))] }
    expect(scanProblems(scan, rules())).toEqual([expect.stringMatching(/reads pages\/other\.spec\.ts — a fixture by its name/)])
  })

  it('names a required file the scan did not reach, with the count', () => {
    const scan = { ...clean(), files: [slashes(join(dir, 'index.html'))] }
    expect(scanProblems(scan, rules())).toEqual([expect.stringMatching(/does not read pages\/Home\.vue — 1 file\(s\) read/)])
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
