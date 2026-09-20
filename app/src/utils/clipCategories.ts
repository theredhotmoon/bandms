/**
 * Suggested clip categories. Mirrors api/app/Support/ClipCategory::PRESETS —
 * the column is free text, so these drive the chips, not validation.
 * Lives in utils/ so vitest can import it (no composable dependencies).
 */
export const CLIP_CATEGORY_PRESETS = ['live', 'studio', 'backstage', 'interview', 'other'] as const
export type ClipCategoryPreset = (typeof CLIP_CATEGORY_PRESETS)[number]

const LABELS: Record<ClipCategoryPreset, string> = {
  live: 'Live', studio: 'Studio', backstage: 'Backstage', interview: 'Interview', other: 'Other',
}

export function isPresetCategory(value: string): value is ClipCategoryPreset {
  return (CLIP_CATEGORY_PRESETS as readonly string[]).includes(value)
}

/** Admin-facing label; the public site has its own bilingual copy for these. */
export function presetLabel(value: string): string {
  return isPresetCategory(value) ? LABELS[value] : value
}
