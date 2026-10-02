import { ref } from 'vue'
import { readStoredTheme, writeStoredTheme, type AdminTheme } from '@/utils/adminTheme'

// Module-level singleton, read once at load — the useUiLang shape.
const theme = ref<AdminTheme>(readStoredTheme())

/**
 * The admin's colour theme. Every admin colour is a `--c-*` variable from
 * `src/admin-palette.css`, redefined under `<html data-admin-theme="light">`.
 *
 * The attribute is not set here — App.vue watches `theme` and owns it, so
 * there is one writer, as with `<html lang>`.
 */
export function useAdminTheme() {
  function setTheme(next: AdminTheme): void {
    theme.value = next
    writeStoredTheme(next)
  }

  function toggleTheme(): void {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme, setTheme, toggleTheme }
}
