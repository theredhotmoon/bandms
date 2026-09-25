/**
 * Which editable copy fields each module exposes in the admin.
 *
 * `website_modules.settings` is a free-form bag on the server — it validates
 * shape (`{field: {en, pl}}`) but not which fields exist, so a module can gain
 * a field without a migration. What turns that bag into a form is the
 * registry in `@bandms/site-copy`: one entry per public-site string, with its
 * default text per locale. The public site reads the same registry for its
 * defaults, so the placeholder an editor sees here is exactly what the page
 * prints when the field is left empty — and adding a string is one entry in
 * the package, never a change here.
 *
 * A module absent from the registry simply shows no copy fields, which is why
 * adding one is additive and safe.
 */
import { copyFieldsFor, copyGroupsFor, defaultFor, type CopyField } from '@bandms/site-copy'

export interface ModuleSettingField {
  /** Key inside the settings bag. Must match what the Astro section reads. */
  key: string
  label: string
  /** Fieldset the input sits in — follows the page's own sections. */
  group: string
  /** Single-line input vs. a textarea. */
  type: 'text' | 'textarea'
  /** Mirrors the server's `settings.*.en|pl` max:2000 rule. */
  maxLength?: number
  /** Shown under the input — say where the copy appears, not what it is. */
  help?: string
  /** The default text per locale, shown as the placeholder. */
  placeholder: (locale: string) => string
}

/**
 * Modules that are chrome or a fixed route rather than a movable page.
 *
 * `footer` and `site` have no route at all; `home` and `privacy` have one, but
 * it is fixed (`/{lang}`, `/{lang}/privacy`). For all four a URL slug and a
 * per-page count would be inputs that do nothing, so the admin hides them.
 */
export const NON_PAGE_MODULES = new Set(['footer', 'site', 'home', 'privacy'])

/**
 * Rows whose `enabled` flag the public build ignores — there is no homepage
 * to unbuild, and no page for the site-wide labels to belong to. The admin
 * hides the toggle and the Live/Off badge for these rather than presenting a
 * switch that does nothing. `footer` (hides the footer) and `privacy`
 * (unbuilds the policy page and drops the cookie banner's link) keep theirs.
 */
export const ALWAYS_ON_MODULES = new Set(['home', 'site'])

function toField(field: CopyField): ModuleSettingField {
  return {
    key: field.key,
    label: field.label,
    group: field.group,
    type: field.type ?? 'text',
    maxLength: field.maxLength,
    help: field.help,
    placeholder: locale => defaultFor(field, locale),
  }
}

export function settingsFieldsFor(slug: string): ModuleSettingField[] {
  return copyFieldsFor(slug).map(toField)
}

/** The same fields, bucketed by `group` in page order, for the form's fieldsets. */
export function settingsGroupsFor(slug: string): { group: string; fields: ModuleSettingField[] }[] {
  return copyGroupsFor(slug).map(({ group, fields }) => ({ group, fields: fields.map(toField) }))
}

/**
 * Which optional page sections a module can show or hide, independent of the
 * module's own `enabled` flag (which controls the whole page/route, not one
 * section of it). Same "additive, no-migration field" shape as
 * MODULE_SETTINGS_SCHEMA, but no locale dimension — a section is shown or
 * hidden, not translated per language — and no `type`, since every entry
 * renders as a checkbox.
 */
export interface ModuleVisibilityField {
  /**
   * Key inside the visibility bag. Must match what the Astro section reads —
   * and now also names the catalogue entry, `pages.visibility.<slug>.<key>`
   * (with `_help` appended for the hint). The label and help text used to sit
   * here as English; they are form copy, not shape.
   */
  key: string
  /** Whether the toggle has a `<key>_help` entry to render under it. */
  help?: boolean
}

export const MODULE_VISIBILITY_SCHEMA: Record<string, ModuleVisibilityField[]> = {
  about: [
    { key: 'show_stats', help: true },
    { key: 'show_members', help: true },
  ],
}

export function visibilityFieldsFor(slug: string): ModuleVisibilityField[] {
  return MODULE_VISIBILITY_SCHEMA[slug] ?? []
}
