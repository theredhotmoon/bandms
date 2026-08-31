import { ref } from 'vue'
import { DEFAULT_LOCALE, isLocale, type Lang } from '@/locales'

export type { Lang }

// An unrecognised stored value falls back to the default rather than being cast
// through: a locale removed from the registry must not leave a user pinned to a
// language the app no longer renders.
const stored = localStorage.getItem('site_lang')
const lang = ref<Lang>(isLocale(stored) ? stored : DEFAULT_LOCALE)

export function useLang() {
  function setLang(l: Lang): void {
    lang.value = l
    localStorage.setItem('site_lang', l)
  }

  return { lang, setLang }
}
