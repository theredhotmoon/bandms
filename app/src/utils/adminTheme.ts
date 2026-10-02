/**
 * Pure helpers behind the admin's colour theme — a util rather than part of
 * `useAdminTheme` for the same reason as `uiLocale.ts`: vitest runs in `node`,
 * and a composable touching localStorage at module load dies on import.
 */
export const ADMIN_THEMES = ['dark', 'light'] as const
export type AdminTheme = (typeof ADMIN_THEMES)[number]

/** Dark is what the panel looked like before the switch existed. */
export const DEFAULT_ADMIN_THEME: AdminTheme = 'dark'

export const ADMIN_THEME_STORAGE_KEY = 'admin_theme'

export function isAdminTheme(value: unknown): value is AdminTheme {
  return typeof value === 'string' && (ADMIN_THEMES as readonly string[]).includes(value)
}

export function resolveStoredTheme(raw: string | null): AdminTheme {
  return isAdminTheme(raw) ? raw : DEFAULT_ADMIN_THEME
}

/** Guarded like the UI-language preference: storage can throw, not just miss. */
export function readStoredTheme(): AdminTheme {
  try {
    return resolveStoredTheme(localStorage.getItem(ADMIN_THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_ADMIN_THEME
  }
}

export function writeStoredTheme(theme: AdminTheme): void {
  try {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme)
  } catch {
    // Not persisted — the session still switches.
  }
}
