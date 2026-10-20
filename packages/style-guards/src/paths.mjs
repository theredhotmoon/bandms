/**
 * One spelling of a path, for every guard that compares two.
 *
 * A path arrives in as many shapes as there are ways to name a file: the
 * platform's separators, a `\\?\` prefix from a Windows API, the casing the
 * shell was given rather than the one on disk, a junction or symlink in
 * place of the directory behind it. Tailwind's scanner answers with the
 * canonical form — real path, stored casing — so a guard that compares its
 * answer against `resolve()` of its own configuration fails every file the
 * moment the project is reached through `c:\projects` or a linked folder.
 */
import { realpathSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

/** Forward slashes, and no `\\?\` prefix. */
export const posix = (p) => p.split('\\').join('/').replace(/^\/\/\?\//, '')

/**
 * The path as the disk knows it — links followed, casing as stored — in
 * posix form. A path that does not exist (a glob, a file not yet written) is
 * canonicalised down to its longest existing ancestor, with the rest kept.
 */
export function canonical(p) {
  let dir = resolve(p)
  let tail = ''
  for (;;) {
    try {
      return posix(join(realpathSync.native(dir), tail))
    } catch {
      /* not there — try the parent */
    }
    const up = dirname(dir)
    if (up === dir) return posix(join(dir, tail))
    tail = tail ? join(basename(dir), tail) : basename(dir)
    dir = up
  }
}
