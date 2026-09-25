import { describe, it, expect } from 'vitest'
import { MODULE_COPY } from '@bandms/site-copy'
import { COPY_FIELD_PL } from './copyFields.pl'
import { copyFieldGroup, copyFieldHelp, copyFieldLabel } from './copyFields'

/**
 * The overlay is keyed by the English string, so a reworded label in
 * `@bandms/site-copy` silently orphans its translation and the field quietly
 * reverts to English. Nothing else would notice: the three build guards do not
 * read `packages/`, and `MessageSchema` only governs the vue-i18n catalogues.
 */
const english = (() => {
  const labels = new Set<string>()
  const helps = new Set<string>()
  const groups = new Set<string>()
  for (const fields of Object.values(MODULE_COPY)) {
    for (const f of fields) {
      labels.add(f.label)
      groups.add(f.group)
      if (f.help) helps.add(f.help)
    }
  }
  return { labels, helps, groups, all: new Set([...labels, ...helps, ...groups]) }
})()

describe('copy-field overlay', () => {
  it('the registry is big enough to be worth an overlay', () => {
    expect(english.labels.size).toBeGreaterThan(250)
  })

  it('has no orphaned keys', () => {
    // Every key must still appear in the registry. This is the check that
    // catches a label being reworded upstream.
    const orphans = Object.keys(COPY_FIELD_PL).filter((k) => !english.all.has(k))
    expect(orphans, `\n  no longer in the registry:\n  ${orphans.join('\n  ')}\n`).toEqual([])
  })

  it('covers every label, help and group', () => {
    const missing = [...english.all].filter((s) => !(s in COPY_FIELD_PL))
    expect(missing, `\n  untranslated:\n  ${missing.join('\n  ')}\n`).toEqual([])
  })

  it('never returns an empty string for a field that has text', () => {
    // An empty override would blank a form label, which is worse than English.
    const blank = Object.entries(COPY_FIELD_PL).filter(([, v]) => !v.trim())
    expect(blank.map(([k]) => k)).toEqual([])
  })

  it('keeps every {token} the English text carried', () => {
    // The public site substitutes these; a dropped token prints a literal gap
    // in the admin's hint about what the field accepts.
    const wrong: string[] = []
    for (const [en, pl] of Object.entries(COPY_FIELD_PL)) {
      const a = [...en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      const b = [...pl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
      if (a.join(',') !== b.join(',')) wrong.push(`${en} — [${a}] vs [${b}]`)
    }
    expect(wrong, `\n  ${wrong.join('\n  ')}\n`).toEqual([])
  })

  it('resolves, and falls through to English for an unknown locale', () => {
    const field = Object.values(MODULE_COPY)[0][0]
    expect(copyFieldLabel(field, 'pl')).not.toBe(field.label)
    expect(copyFieldLabel(field, 'en')).toBe(field.label)
    // Fail open: a language with no overlay reads English rather than blank.
    expect(copyFieldLabel(field, 'de')).toBe(field.label)
    expect(copyFieldGroup('Hero', 'pl')).toBe('Nagłówek strony')
    expect(copyFieldGroup('Hero', 'de')).toBe('Hero')
  })

  it('returns an empty help for a field that has none', () => {
    const noHelp = Object.values(MODULE_COPY).flat().find((f) => !f.help)!
    expect(copyFieldHelp(noHelp, 'pl')).toBe('')
  })
})
