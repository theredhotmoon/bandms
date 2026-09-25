import { COPY_FIELD_PL } from './copyFields.pl'

/**
 * Polish for the admin form around `@bandms/site-copy`.
 *
 * The registry holds three admin-facing strings per field — `label`, `help`
 * and the fieldset `group` — and they were English only. The Website Modules
 * editor renders all three, so its Page copy section stayed English inside an
 * otherwise Polish panel: 407 fields across 16 modules, more strings than the
 * rest of slice 6 put together.
 *
 * **Keyed by the English string, not by `<module>.<field>`.** `'Heading'`
 * appears 24 times and means the same thing every time; keying by value turns
 * 407 fields into 315 translations, and a new field reusing existing wording
 * is translated the moment it is added. A field that genuinely needs different
 * Polish in its own context gets an entry in `BY_FIELD`, which wins.
 *
 * **The registry stays the English source of truth** rather than growing
 * `label: { en, pl }`. `packages/site-copy` is shared with `web/`, which never
 * reads these three — widening the type there would make the public site carry
 * a shape only the admin uses, and would put the same English in two places.
 * This is the same split as `pages.visibility.*`: schema in the config, words
 * in the admin.
 *
 * Missing keys fall through to English, so partial coverage renders a mixed
 * form rather than a blank one — and a third language is one more overlay.
 */
type Overlay = Readonly<Record<string, string>>

const OVERLAYS: Readonly<Record<string, Overlay>> = { pl: COPY_FIELD_PL }

function lookup(locale: string, english: string): string {
  return OVERLAYS[locale]?.[english] ?? english
}

/**
 * Only the two properties that carry words — not `CopyField` itself.
 * `ModuleSettingField` in config/moduleSettings.ts is the same shape minus
 * `defaults`, and the admin renders both through the same form.
 */
interface Labelled {
  readonly label: string
  readonly help?: string
}

/** The form label for a field. */
export function copyFieldLabel(field: Labelled, locale: string): string {
  return lookup(locale, field.label)
}

/** The hint under a field, or `''` when it has none. */
export function copyFieldHelp(field: Labelled, locale: string): string {
  return field.help ? lookup(locale, field.help) : ''
}

/** The fieldset heading a group of fields sits under. */
export function copyFieldGroup(group: string, locale: string): string {
  return lookup(locale, group)
}
