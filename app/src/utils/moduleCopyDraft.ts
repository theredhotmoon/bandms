import { LOCALES, compactBag, emptyBag, type TranslationBag } from '@/locales'
import type { ModuleSettings } from '@/types/website-module'

/**
 * The Website Modules editor's page-copy draft: one translation bag per
 * schema field, so each field is a TranslatedField like every other
 * translated input in the admin. It used to be a flat `<field>.<locale>` map
 * with `en:`/`pl:` literals on the way back out.
 *
 * `toDraft` gives every schema field a FULL bag (blank where the module has
 * nothing) — an absent key would render no input. `toPayload` is compactBag()
 * per field — every registry locale, blank as null — because the API's
 * setTranslations() merges, so an omitted locale would silently keep its old
 * text (the trap the slug fields set). Whitespace-only text goes as typed; the
 * API trims and nulls it.
 */
export function toDraft(keys: readonly string[], settings: ModuleSettings | null | undefined): Record<string, TranslationBag> {
  const out: Record<string, TranslationBag> = {}
  for (const key of keys) {
    const bag = emptyBag()
    for (const l of LOCALES) bag[l] = settings?.[key]?.[l] ?? ''
    out[key] = bag
  }
  return out
}

export function toPayload(keys: readonly string[], draft: Record<string, TranslationBag>): ModuleSettings {
  const out: ModuleSettings = {}
  for (const key of keys) out[key] = compactBag(draft[key] ?? emptyBag())
  return out
}
