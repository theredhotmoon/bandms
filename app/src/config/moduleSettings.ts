/**
 * Which editable copy fields each module exposes in the admin.
 *
 * `website_modules.settings` is a free-form bag on the server — it validates
 * shape (`{field: {en, pl}}`) but not which fields exist, so a module can gain
 * a field without a migration. This map is what turns that bag into a form.
 *
 * A module absent from here simply shows no copy fields, which is why adding
 * one is additive and safe.
 *
 * The keys must match what the public site reads from
 * `module_config.<slug>.settings` — see web/src/components/sections/.
 */

export interface ModuleSettingField {
  /** Key inside the settings bag. Must match what the Astro section reads. */
  key: string
  label: string
  /** Single-line input vs. a textarea. */
  type: 'text' | 'textarea'
  /** Mirrors the server's `settings.*.en|pl` max:2000 rule. */
  maxLength?: number
  /** Shown under the input — say where the copy appears, not what it is. */
  help?: string
  placeholder?: string
}

/**
 * Modules that are chrome rather than a page.
 *
 * They have no route, so a URL slug and a per-page count would be inputs that
 * do nothing. The admin hides those fields for these.
 */
export const NON_PAGE_MODULES = new Set(['footer'])

/**
 * Every page module gets an H1 field for its page header.
 */
function pageTitleField(placeholder: string): ModuleSettingField {
  return {
    key: 'title',
    label: 'Page title',
    type: 'text',
    maxLength: 60,
    help: 'Shown as the H1 at the top of the page header.',
    placeholder,
  }
}

/**
 * Every page module gets these two — the H1 in the page's header and the
 * wording shown below it. Prepended to a module's own fields so the header
 * inputs always come first in the form.
 */
function pageHeaderFields(titlePlaceholder: string): ModuleSettingField[] {
  return [
    pageTitleField(titlePlaceholder),
    {
      key: 'lead',
      label: 'Wording below title',
      type: 'textarea',
      maxLength: 400,
      help: 'Sits under the title in the page header.',
    },
  ]
}

export const MODULE_SETTINGS_SCHEMA: Record<string, ModuleSettingField[]> = {
  about: pageHeaderFields('About'),
  concerts: pageHeaderFields('Shows'),
  releases: pageHeaderFields('Music'),
  posts: pageHeaderFields('News'),
  photos: pageHeaderFields('Gallery'),
  videos: pageHeaderFields('Videos'),
  press: pageHeaderFields('Press'),
  merch: pageHeaderFields('Merch'),
  epk: pageHeaderFields('EPK'),
  newsletter: pageHeaderFields('Newsletter'),
  contact: [
    pageTitleField('Contact'),
    {
      key: 'kicker',
      label: 'Kicker',
      type: 'text',
      maxLength: 60,
      help: 'Small line above the page title. Set in caps in the design.',
      placeholder: 'GET IN TOUCH',
    },
    {
      key: 'lead',
      label: 'Lead paragraph',
      type: 'textarea',
      maxLength: 400,
      help: 'Sits under the title in the hero, and doubles as the page meta description.',
    },
    {
      key: 'reply_time_label',
      label: 'Reply-time badge',
      type: 'text',
      maxLength: 60,
      help: 'Shown as a hero pill and again beside the send button. Leave empty to hide both.',
      placeholder: 'Replies within 48h',
    },
    {
      key: 'booking_note',
      label: 'Booking note',
      type: 'text',
      maxLength: 120,
      help: 'Caption under the booking email. Hidden if the profile has no booking address.',
    },
    {
      key: 'press_note',
      label: 'Press note',
      type: 'text',
      maxLength: 120,
      help: 'Caption under the press email.',
    },
    {
      key: 'general_note',
      label: 'General note',
      type: 'text',
      maxLength: 120,
      help: 'Caption under the general contact email.',
    },
  ],
  footer: [
    {
      key: 'tagline',
      label: 'Tagline',
      type: 'text',
      maxLength: 120,
      help: 'Sits under the band name in the footer’s first column.',
      placeholder: 'SKA · SKA-JAZZ · ROCKSTEADY',
    },
    {
      key: 'booking_title',
      label: 'Booking column heading',
      type: 'text',
      maxLength: 60,
      placeholder: 'Booking & contact',
    },
    {
      key: 'booking_text',
      label: 'Booking blurb',
      type: 'textarea',
      maxLength: 300,
      help: 'Shown above the booking email, which comes from the band profile.',
    },
    {
      key: 'follow_title',
      label: 'Links column heading',
      type: 'text',
      maxLength: 60,
      placeholder: 'Follow',
    },
    {
      key: 'rights',
      label: 'Rights line',
      type: 'text',
      maxLength: 120,
      help: 'Right-hand side of the bottom bar. The copyright and year are automatic.',
      placeholder: 'All rights reserved.',
    },
  ],
}

export function settingsFieldsFor(slug: string): ModuleSettingField[] {
  return MODULE_SETTINGS_SCHEMA[slug] ?? []
}
