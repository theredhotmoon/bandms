import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import en from '@/i18n/en'
import pl from '@/i18n/pl'
import { REWRITE_MODES } from './rewriteModes'

describe('rewrite modes', () => {
  // The API validates against its enum; a mode in only one list is either
  // offered and then rejected with a 422, or accepted and never offered.
  // Pest cannot read this file (the test image holds api/ only), so the
  // parity check runs here, the direction contactCodes.spec.ts already uses.
  const php = readFileSync(fileURLToPath(new URL('../../../api/app/Assistant/Text/RewriteMode.php', import.meta.url)), 'utf8')
  const phpCases = [...php.matchAll(/case \w+\s*=\s*'([a-z]+)'/g)].map(m => m[1]!)

  it('mirrors the API enum exactly, in order', () => {
    expect(phpCases.length).toBeGreaterThan(0)
    expect([...REWRITE_MODES]).toEqual(phpCases)
  })

  it('has a label and a hint for every mode in both catalogues', () => {
    for (const mode of REWRITE_MODES) {
      for (const catalogue of [en, pl] as const) {
        const modes = (catalogue as unknown as { common: { assistant: { enhanceModes: Record<string, string> } } }).common.assistant.enhanceModes
        expect(modes[mode], `${mode} label`).toBeTruthy()
        expect(modes[`${mode}Hint`], `${mode} hint`).toBeTruthy()
      }
    }
  })
})
