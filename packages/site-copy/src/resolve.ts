import type { CopyField, CopyKeys, ResolvedCopy } from './types'

/**
 * Identity helper that keeps the field list's literal `key` types, so
 * `resolveCopy()` returns an object whose properties TypeScript can check.
 * Without it a `CopyField[]` annotation widens every key to `string` and a
 * typo in `t.upcomingTitle` becomes an undefined rendered on the page.
 */
export function defineCopy<const F extends readonly CopyField[]>(fields: F): F {
  return fields
}

/**
 * Merge the band's overrides over the registry defaults for one locale.
 *
 * `settings` is `module_config.<slug>.settings` from `GET /api/site-config`,
 * already resolved to a single string per key (the controller walks the
 * fallback chain). A key the band never touched is absent; a key they cleared
 * in one locale is absent for that locale — both mean "print the default".
 * Whitespace-only counts as empty, so a stray space in the admin cannot blank
 * a heading.
 *
 * A locale with no default of its own reads `en`. That is the one deliberate
 * fallback: the registry, not a scan of other locales, decides.
 */
export function resolveCopy<F extends readonly CopyField[]>(
  fields: F,
  lang: string,
  settings?: Readonly<Record<string, unknown>> | null,
): ResolvedCopy<F> {
  const out: Record<string, string> = {}

  for (const field of fields) {
    const override = settings?.[field.key]
    out[field.key] =
      typeof override === 'string' && override.trim() !== ''
        ? override
        : (field.defaults[lang] ?? field.defaults.en)
  }

  return out as Record<CopyKeys<F>, string>
}

/**
 * The default text of one field for one locale — what the admin shows as a
 * placeholder so an editor can see what the page currently says before
 * overriding it.
 */
export function defaultFor(field: CopyField, lang: string): string {
  return field.defaults[lang] ?? field.defaults.en
}

/**
 * Substitute `{name}` tokens. Templates stay templates in the registry (the
 * band edits "Booking request — {date}", not a date), and the consumer fills
 * them in at render time.
 */
export function fillCopy(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}
