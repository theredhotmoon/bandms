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

export const MODULE_SETTINGS_SCHEMA: Record<string, ModuleSettingField[]> = {
  contact: [
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
}

export function settingsFieldsFor(slug: string): ModuleSettingField[] {
  return MODULE_SETTINGS_SCHEMA[slug] ?? []
}
