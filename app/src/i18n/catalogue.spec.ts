/**
 * Every catalogue message must compile.
 *
 * vue-i18n compiles a message the first time a component renders that key, not
 * at build time. `@` opens a linked-message reference and `|` separates plural
 * forms, so a literal `booking@yourband.com` in a catalogue value is a runtime
 * `Invalid linked format` — which blanks the component that rendered it while
 * `vue-tsc -b` and `vite build` both stay green. That is exactly how the
 * sign-in form went down in PR 1, and nothing in the repo stopped it happening
 * again until this spec.
 *
 * The three build guards cannot see it either: check-admin-strings reads .vue
 * files, check-i18n-keys only resolves that a key *exists*, and
 * check-i18n-coverage skips src/i18n entirely.
 */
import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from './en'
import pl from './pl'

type Leaf = { key: string; value: string }

function leaves(node: unknown, prefix = ''): Leaf[] {
  if (typeof node === 'string') return [{ key: prefix, value: node }]
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
  }
  return []
}

const CATALOGUES = { en, pl } as const

describe('i18n catalogues', () => {
  for (const [locale, messages] of Object.entries(CATALOGUES)) {
    const all = leaves(messages)

    it(`${locale}: has messages to check`, () => {
      expect(all.length).toBeGreaterThan(500)
    })

    it(`${locale}: every message compiles`, () => {
      // One instance, one pass: compilation is what throws, and it happens on
      // first resolve of each key.
      const i18n = createI18n({ legacy: false, locale, messages: { [locale]: messages } })
      const t = i18n.global.t as (k: string) => string

      const broken: string[] = []
      for (const { key, value } of all) {
        try {
          t(key)
        } catch (e) {
          broken.push(`${key} — ${(e as Error).message}\n      value: ${value}`)
        }
      }

      expect(broken, `\n  ${broken.join('\n  ')}\n`).toEqual([])
    })

    it(`${locale}: no unescaped @ in a message`, () => {
      // Compilation alone is not quite enough: `a@b` throws, but some shapes
      // resolve to a *linked message* instead — silently rendering something
      // other than the text that was written. Require the escape everywhere.
      //
      // `|` is deliberately not checked here: it is the plural separator, and
      // several messages use it for exactly that (common.rebuild.pendingChanges,
      // content.newsletter.subscribers). Escape it as {'|'} only in a message
      // that is not meant to be plural.
      const offenders = all
        .filter(({ value }) => /(?<!\{')@(?!'\})/.test(value))
        .map(({ key, value }) => `${key}: ${value}`)

      expect(offenders, `\n  Escape as {'@'}:\n  ${offenders.join('\n  ')}\n`).toEqual([])
    })

    it(`${locale}: an escaped {'@'} renders as a plain @`, () => {
      // The other half of the rule. Escaping stops the throw; this is what
      // proves the reader still sees `booking@yourband.com` and not the
      // escape sequence itself.
      const i18n = createI18n({ legacy: false, locale, messages: { [locale]: messages } })
      const t = i18n.global.t as (k: string) => string

      const escaped = all.filter(({ value }) => value.includes(`{'@'}`))
      expect(escaped.length).toBeGreaterThan(0)

      for (const { key } of escaped) {
        expect(t(key), key).toContain('@')
        expect(t(key), key).not.toContain(`{'@'}`)
      }
    })
  }

  // check-i18n-keys.mjs resolves only *static* $t('…') references, so a key
  // built at render time is checked by nothing. These are the families the
  // admin builds dynamically; each must be complete or a tab renders its own
  // dotted key as visible text.
  describe('dynamically-built keypaths are complete', () => {
    const keys = new Set(leaves(en).map((l) => l.key))
    const has = (k: string) => keys.has(k)

    it('band.profile.tabs covers every Section', () => {
      // Mirrors `type Section` in BandProfileAdminView.vue.
      for (const s of ['bio', 'career', 'social', 'contacts', 'stats', 'epk', 'logo']) {
        expect(has(`band.profile.tabs.${s}`), `band.profile.tabs.${s}`).toBe(true)
      }
    })

    it('band.profile.bio.variants covers every BioVariant', () => {
      for (const v of ['short', 'medium', 'long', 'full']) {
        expect(has(`band.profile.bio.variants.${v}`), v).toBe(true)
      }
    })

    it('band.career.levels covers levels 1–4', () => {
      for (const n of [1, 2, 3, 4]) {
        for (const field of ['name', 'sub', 'tagline']) {
          expect(has(`band.career.levels.l${n}.${field}`), `l${n}.${field}`).toBe(true)
        }
      }
    })
  })

  it('pl mirrors en exactly', () => {
    // MessageSchema already fails the build on a *missing* pl key. This also
    // catches the other direction — a pl-only key is dead weight nothing reads.
    const enKeys = leaves(en).map((l) => l.key).sort()
    const plKeys = leaves(pl).map((l) => l.key).sort()
    expect(plKeys).toEqual(enKeys)
  })
})
