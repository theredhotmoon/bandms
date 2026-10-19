/**
 * Which files are admin chrome — shared by every style guard that walks src/.
 *
 * check-admin-colours.mjs and check-admin-radius.mjs ask the same question
 * ("is this file part of the admin design system?") and used to each keep
 * their own answer. Two lists drift: the next fan page or printable view added
 * to one and not the other makes the guards disagree about what they cover.
 * So the list, its reasons and the walk live here once.
 */
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** Not admin chrome, so not themed. Paths relative to src/, with the reason. */
export const EXCLUDED = {
  'admin-palette.css': 'the palette itself — the one place literals belong',
  'style.css': 'SPA-wide base styles and the Tailwind light-theme overrides',
  'App.vue': 'SPA root: skip link and chrome shared with the fan pages',
  'components/AppNavbar.vue': 'navbar of the fan pages',
  'components/TicketDownloadCard.vue': 'fan ticket card',
  'components/fan': 'fan portal',
  'views/FanAccountView.vue': 'fan portal',
  'views/TicketClaimView.vue': 'fan ticket claim',
  'views/TechRiderPreviewView.vue': 'printable rider document, black on white by design',
}

export const posix = (p) => p.split(sep).join('/')

/** How a guard should read a file: a .css file is a stylesheet; anything else is an SFC with <style> blocks. */
export const kindOf = (path) => (path.endsWith('.css') ? 'css' : 'vue')

export const isExcluded = (rel) =>
  Object.keys(EXCLUDED).some((path) => rel === path || rel.startsWith(path + '/'))

/**
 * Every .vue and .css file under `src` (or every file matching `ext`), as
 * absolute paths, minus those whose src-relative path `skip` returns true for.
 * The admin walk passes isExcluded; a guard that must see the whole SPA (the
 * token-redefinition check) passes only the file it is pinning.
 */
export function styleFilesUnder(src, skip = () => false, ext = /\.(vue|css)$/) {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      const rel = posix(relative(src, abs))
      if (skip(rel)) continue
      if (statSync(abs).isDirectory()) walk(abs)
      else if (ext.test(name)) files.push(abs)
    }
  }
  walk(src)
  return files
}

/**
 * Every .vue and .css file under `src` that is admin chrome, as absolute paths.
 *
 * Returns `{ files, problems }`: a problem is an EXCLUDED entry whose path no
 * longer exists, which a guard reports as a violation so the list cannot
 * silently rot. A walk that finds fewer than 50 files is also a problem — it
 * would otherwise print a green tick for having checked nothing.
 */
export function adminStyleFiles(src) {
  const problems = []
  for (const path of Object.keys(EXCLUDED)) {
    if (!existsSync(join(src, path))) problems.push(`src/${path}: excluded path no longer exists — update EXCLUDED`)
  }

  const files = styleFilesUnder(src, isExcluded)

  if (files.length < 50) problems.push(`only ${files.length} file(s) found under src/ — the walk is broken`)
  return { files, problems }
}
