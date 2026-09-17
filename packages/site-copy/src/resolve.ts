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

function filled(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * Merge the band's overrides over the registry defaults for one locale.
 *
 * `settings` is `module_config.<slug>.settings` from `GET /api/site-config`:
 * this locale's overrides only. A key the band never touched is absent; a
 * key they cleared in one locale is absent for that locale — both mean
 * "print the default". Whitespace-only counts as empty, so a stray space in
 * the admin cannot blank a heading.
 *
 * `fallback` is `module_config.<slug>.settings_fallback` — the same bag with
 * the server's locale chain applied (a Polish-only value shows up under
 * `en`). It is consulted for one case only: a field whose registry default
 * for this locale is *empty*. "Print the default" would mean "print
 * nothing" there, and a band that wrote the Contact kicker in one language
 * has always seen it on both. For every other field the other language's
 * override is deliberately ignored — the registry default wins, exactly as
 * the admin's placeholder promises.
 *
 * A locale with no default of its own reads `en`. That is the one deliberate
 * registry-level fallback.
 */
export function resolveCopy<F extends readonly CopyField[]>(
  fields: F,
  lang: string,
  settings?: Readonly<Record<string, unknown>> | null,
  fallback?: Readonly<Record<string, unknown>> | null,
): ResolvedCopy<F> {
  const out: Record<string, string> = {}

  for (const field of fields) {
    const own = settings?.[field.key]
    const dflt = field.defaults[lang] ?? field.defaults.en
    const chained = fallback?.[field.key]
    out[field.key] = filled(own) ? own : dflt === '' && filled(chained) ? chained : dflt
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
