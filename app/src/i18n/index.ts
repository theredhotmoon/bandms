import { createI18n } from 'vue-i18n'
import { DEFAULT_LOCALE } from '@/locales'
import { resolveStoredLocale, UI_LANG_STORAGE_KEY } from '@/utils/uiLocale'
import { pluralRules } from './plural'
import en from './en'
import pl from './pl'
import './schema'

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveStoredLocale(localStorage.getItem(UI_LANG_STORAGE_KEY)),
  // Should never fire — the schema typing makes a missing key impossible. It
  // exists so a runtime surprise degrades to English rather than a raw key.
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en, pl },
  pluralRules,
})

export default i18n
