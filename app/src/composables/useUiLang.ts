import { ref } from 'vue'
import { i18n } from '@/i18n'
import { readStoredLocale, writeStoredLocale } from '@/utils/uiLocale'
import type { Lang } from '@/locales'

export type { Lang }

// Module-level singleton, read once at load — the same shape as useLang and
// useAuth. Read through the guarded helper so an unknown (or unreadable)
// stored value degrades to the default rather than throwing on import.
const uiLang = ref<Lang>(readStoredLocale())

/**
 * The language the admin *chrome* is rendered in.
 *
 * Deliberately separate from useLang(), which selects which translation of the
 * band's content is being edited and feeds every TanStack queryKey. An editor
 * proofreading Polish copy should not have to read the menus in Polish too.
 *
 * `document.documentElement.lang` is not set here — App.vue watches uiLang and
 * owns that attribute, so there is exactly one writer.
 */
export function useUiLang() {
  // Apply before persisting. A storage write that throws must not leave the
  // panel split — <html lang> and the select on the new language while every
  // string is still in the old one.
  function setUiLang(l: Lang): void {
    uiLang.value = l
    i18n.global.locale.value = l
    writeStoredLocale(l)
  }

  return { uiLang, setUiLang }
}
