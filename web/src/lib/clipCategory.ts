/**
 * Preset clip categories map to editable copy on the `site` module; anything
 * else the band typed prints as typed. Mirrors api/app/Support/ClipCategory.
 */
export interface ClipCategoryCopy {
  clipCategoryLive: string
  clipCategoryStudio: string
  clipCategoryBackstage: string
  clipCategoryInterview: string
  clipCategoryOther: string
}

const KEY: Record<string, keyof ClipCategoryCopy> = {
  live: 'clipCategoryLive',
  studio: 'clipCategoryStudio',
  backstage: 'clipCategoryBackstage',
  interview: 'clipCategoryInterview',
  other: 'clipCategoryOther',
}

export function clipCategoryLabel(category: string, copy: ClipCategoryCopy): string {
  const key = KEY[category]
  return key ? copy[key] : category
}
