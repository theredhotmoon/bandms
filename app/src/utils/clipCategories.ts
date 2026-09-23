/**
 * Suggested clip categories. Mirrors api/app/Support/ClipCategory::PRESETS —
 * the column is free text, so these drive the chips, not validation.
 * Lives in utils/ so vitest can import it (no composable dependencies).
 */
export const CLIP_CATEGORY_PRESETS = ['live', 'studio', 'backstage', 'interview', 'other'] as const
export type ClipCategoryPreset = (typeof CLIP_CATEGORY_PRESETS)[number]

export function isPresetCategory(value: string): value is ClipCategoryPreset {
  return (CLIP_CATEGORY_PRESETS as readonly string[]).includes(value)
}

/**
 * The catalogue key for a preset, or null when the category is custom text.
 *
 * A key rather than a label, and null rather than the raw value, for the same
 * reason as rebuildAreaMessageKey: this util is imported by vitest under
 * `environment: 'node'`, so it cannot call useI18n, and returning a key that
 * does not exist would render the key itself. The caller decides how a custom
 * category degrades — it prints as the band typed it.
 *
 * The public site has its own bilingual copy for these (site module,
 * clipCategory*); this is the admin-facing half.
 */
export function presetMessageKey(value: string): string | null {
  return isPresetCategory(value) ? `common.clipCategory.${value}` : null
}
