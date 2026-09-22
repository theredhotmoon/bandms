import { ref } from 'vue'
import { i18n } from '@/i18n'
import { resolveStoredLocale, UI_LANG_STORAGE_KEY } from '@/utils/uiLocale'
import type { Lang } from '@/locales'

export type { Lang }

// Module-level singleton, read once at load — the same shape as useLang and
// useAuth. Read via the pure resolver so an unknown stored value degrades.
const uiLang = ref<Lang>(resolveStoredLocale(localStorage.getItem(UI_LANG_STORAGE_KEY)))

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
  function setUiLang(l: Lang): void {
    uiLang.value = l
    localStorage.setItem(UI_LANG_STORAGE_KEY, l)
    i18n.global.locale.value = l
  }

  return { uiLang, setUiLang }
}
