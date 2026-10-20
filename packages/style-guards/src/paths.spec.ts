import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error — a plain .mjs build script, no type declarations
import { canonical, posix } from './paths.mjs'

let dir: string
beforeAll(() => {
  dir = realpathSync.native(mkdtempSync(join(tmpdir(), 'style-guards-paths-')))
  mkdirSync(join(dir, 'real', 'pages'), { recursive: true })
  // A junction on Windows needs no privilege; a symlink elsewhere.
  symlinkSync(join(dir, 'real'), join(dir, 'link'), 'junction')
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('posix', () => {
  it('turns backslashes into slashes and drops the extended-length prefix', () => {
    expect(posix('C:\\Projects\\x\\y.css')).toBe('C:/Projects/x/y.css')
    expect(posix('\\\\?\\C:\\Projects\\x')).toBe('C:/Projects/x')
    expect(posix('\\\\?\\UNC\\server\\share\\x')).toBe('//server/share/x')
    expect(posix('/already/posix')).toBe('/already/posix')
  })
})

describe('canonical', () => {
  it('follows a link to the directory behind it', () => {
    expect(canonical(join(dir, 'link', 'pages'))).toBe(canonical(join(dir, 'real', 'pages')))
    expect(canonical(join(dir, 'link', 'pages'))).toBe(posix(join(dir, 'real', 'pages')))
  })

  it('keeps the part of a path that does not exist, below the ancestor that does', () => {
    expect(canonical(join(dir, 'link', 'pages', '**', '*.spec.ts'))).toBe(posix(join(dir, 'real', 'pages', '**', '*.spec.ts')))
    expect(canonical(join(dir, 'link', 'later.html'))).toBe(posix(join(dir, 'real', 'later.html')))
  })

  it.skipIf(process.platform !== 'win32')('restores the casing the disk holds', () => {
    expect(canonical(join(dir, 'REAL', 'PAGES').toLowerCase())).toBe(posix(join(dir, 'real', 'pages')))
  })
})
