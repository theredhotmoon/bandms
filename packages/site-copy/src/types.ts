/**
 * One editable string on the public site.
 *
 * The same record drives two things that used to live apart: the Astro
 * section's default text (formerly an inline `COPY = { en, pl }` dict per
 * page) and the admin's form for overriding it (formerly
 * `app/src/config/moduleSettings.ts`, which listed keys with no idea what the
 * site would print when a field was left empty). Keeping them together is
 * what lets the admin show the current text as the placeholder, and what
 * makes "add a string" a one-place change.
 */
export interface CopyField {
  /**
   * Key inside `website_modules.settings`, and the property the section reads
   * off the resolved copy. Never renamed once shipped — the band's overrides
   * are stored under it.
   */
  readonly key: string
  /** Form label in the admin. */
  readonly label: string
  /**
   * Fieldset the admin puts the input in. Groups follow the page's own
   * sections ("Upcoming shows", "Press & booking") so an editor can find a
   * string by where it appears on the page.
   */
  readonly group: string
  /** Single-line input (default) or a textarea. */
  readonly type?: 'text' | 'textarea'
  /** Client-side cap. The server enforces 2000 regardless. */
  readonly maxLength?: number
  /** Shown under the input — say where the copy appears, not what it is. */
  readonly help?: string
  /**
   * What the site prints when the band has not overridden the field, keyed by
   * locale code. `en` is required; a locale with no entry falls back to it,
   * so adding a third language does not blank every section until someone
   * has translated 250 strings. An empty string is a legitimate default: it
   * means "this element is hidden until the band writes something".
   */
  readonly defaults: Readonly<Record<string, string>> & { readonly en: string }
}

/** The literal union of a field list's keys, for a typed resolved-copy object. */
export type CopyKeys<F extends readonly CopyField[]> = F[number]['key']

/** What a section reads: every key of the registry, always a string. */
export type ResolvedCopy<F extends readonly CopyField[]> = Readonly<Record<CopyKeys<F>, string>>
