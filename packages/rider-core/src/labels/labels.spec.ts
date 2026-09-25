/**
 * The sheet's vocabulary is checked here, not by the admin's i18n guards.
 *
 * Those three scripts walk `app/`: `check-admin-strings` reads .vue files on
 * the ratchet, `check-i18n-keys` resolves `$t('…')` against the vue-i18n
 * catalogue, and `check-i18n-coverage` asks whether a component translates at
 * all. None of them can see this package's bundles — and `RiderSheet.vue`
 * passes all three trivially now, because it holds no strings and calls no
 * `$t`. Everything it prints arrives as a prop, so the only place its wording
 * can be wrong is here.
 *
 * Runs in the admin's vitest, which includes `../packages/*∕src/**∕*.spec.ts`.
 */
import { describe, it, expect } from 'vitest'
import { EN_RIDER_SHEET_LABELS } from './en'
import { PL_RIDER_SHEET_LABELS } from './pl'
import { riderSheetLabels, instrumentLabels, fillLabel } from './index'
import { EN_INSTRUMENT_GROUPS } from './en'
import { PL_INSTRUMENT_GROUPS } from './pl'
import { INSTRUMENT_ICON_CATALOG, searchInstrumentIcons } from '../instrumentIcons'

type Leaf = { key: string; value: string }

function leaves(node: unknown, prefix = ''): Leaf[] {
  if (typeof node === 'string') return [{ key: prefix, value: node }]
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
  }
  return []
}

const BUNDLES = { en: EN_RIDER_SHEET_LABELS, pl: PL_RIDER_SHEET_LABELS } as const

describe('rider sheet labels', () => {
  it('the English bundle is big enough to be the whole sheet', () => {
    // A guard against the bundle being gutted rather than a meaningful count:
    // if this drops sharply, strings went back into the component.
    expect(leaves(EN_RIDER_SHEET_LABELS).length).toBeGreaterThan(90)
  })

  for (const [locale, bundle] of Object.entries(BUNDLES)) {
    it(`${locale}: no empty label`, () => {
      // An empty string is legitimate in `@bandms/site-copy` — it means "hidden
      // until the band writes something". Here it is always a mistake: every
      // one of these is a column heading or a fixed caption, and a blank one
      // prints a nameless column onto a document a venue works from.
      const empty = leaves(bundle).filter(({ value }) => value.trim() === '').map((l) => l.key)
      expect(empty, `\n  empty: ${empty.join(', ')}\n`).toEqual([])
    })

    it(`${locale}: every {token} is one the sheet fills`, () => {
      // fillLabel() leaves an unknown token in place, so a typo prints the
      // literal `{fromat}` on the rider rather than failing anywhere.
      const KNOWN: Record<string, string[]> = {
        'paFoh.showFileValue': ['format'],
        // Filled by riderResolver.ts, not by the sheet — same fillLabel().
        'resolver.guestNamed': ['name'],
        'resolver.unknownMember': ['id'],
      }
      const wrong: string[] = []
      for (const { key, value } of leaves(bundle)) {
        const tokens = [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
        if (!tokens.length) continue
        const allowed = KNOWN[key]
        if (!allowed) { wrong.push(`${key} carries ${tokens.join(', ')} but nothing fills it`); continue }
        for (const tok of tokens) {
          if (!allowed.includes(tok)) wrong.push(`${key}: unexpected {${tok}}`)
        }
      }
      expect(wrong, `\n  ${wrong.join('\n  ')}\n`).toEqual([])
    })
  }

  it('pl mirrors en exactly', () => {
    // The `RiderSheetLabels` annotation already fails the build on a missing
    // Polish key. This catches the other direction — a pl-only key is a string
    // nothing renders, usually the remains of a rename done on one side.
    expect(leaves(PL_RIDER_SHEET_LABELS).map((l) => l.key).sort())
      .toEqual(leaves(EN_RIDER_SHEET_LABELS).map((l) => l.key).sort())
  })

  it('pl actually differs from en', () => {
    // Proper nouns and audio jargon are the same in both by design ("DI",
    // "IEM", "Banjo"), so a per-key comparison would be noise. What matters is
    // that the bundle was translated at all rather than copy-pasted — a
    // duplicated file type-checks perfectly and ships an English rider under a
    // Polish flag.
    const en = leaves(EN_RIDER_SHEET_LABELS)
    const pl = new Map(leaves(PL_RIDER_SHEET_LABELS).map((l) => [l.key, l.value]))
    const differing = en.filter(({ key, value }) => pl.get(key) !== value)
    expect(differing.length / en.length).toBeGreaterThan(0.6)
  })

  it('the icon-picker groups cover every group in the catalogue', () => {
    // Keyed by the catalogue's English `group` string, so a new group (or a
    // renamed one) silently falls back to English rather than failing a type
    // check — this is what notices instead.
    const groups = [...new Set(INSTRUMENT_ICON_CATALOG.map((d) => d.group))]
    for (const g of groups) {
      expect(EN_INSTRUMENT_GROUPS[g], `en: ${g}`).toBeTruthy()
      expect(PL_INSTRUMENT_GROUPS[g], `pl: ${g}`).toBeTruthy()
    }
    expect(Object.keys(EN_INSTRUMENT_GROUPS).sort()).toEqual(groups.sort())
  })

  it('searchInstrumentIcons matches the names actually on screen', () => {
    // Without the labels argument the picker matched only English, so a Polish
    // panel listing "Wokal prowadzacy" found nothing for "wokal" and showed
    // the translated empty state as the one Polish string on the page.
    const pl = PL_RIDER_SHEET_LABELS.instruments
    expect(searchInstrumentIcons('wokal', pl).map((d) => d.type)).toContain('vocalist')
    // The English name still matches, for an engineer who knows the kit by it.
    expect(searchInstrumentIcons('drum kit', pl).map((d) => d.type)).toContain('drums')
    expect(searchInstrumentIcons('zzzznope', pl)).toHaveLength(0)
  })

  it('an unknown locale prints English rather than nothing', () => {
    // Fail-open, the same rule the public site's copy resolution uses: a
    // language nobody has translated should still give a venue a readable
    // document. `de` is a stand-in for any future registry entry.
    expect(riderSheetLabels('de')).toBe(EN_RIDER_SHEET_LABELS)
    expect(instrumentLabels('de').vocalist).toBe('Lead Vocals')
    expect(riderSheetLabels('pl')).toBe(PL_RIDER_SHEET_LABELS)
  })

  it('fillLabel substitutes known tokens and leaves unknown ones visible', () => {
    expect(fillLabel('Yes — format: {format}', { format: '.avtp' })).toBe('Yes — format: .avtp')
    expect(fillLabel('Member #{id}', { id: 7 })).toBe('Member #7')
    // Visible, not swallowed: a blank where a value belongs reads as "the
    // rider has no engineer", which is a different claim from "we have a bug".
    expect(fillLabel('{nope} here', {})).toBe('{nope} here')
  })
})
