import { createI18n } from 'vue-i18n'
import { DEFAULT_UI_LOCALE, type UiLang } from './locales'
import { readStoredLocale } from '@/utils/uiLocale'
import { pluralRules } from './plural'
import en from './en'
import pl from './pl'
import './schema'

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: readStoredLocale(),
  // en is complete relative to pl by the schema typing, and every *static* call
  // site is checked by scripts/check-i18n-keys.mjs in the build. Neither covers
  // a dynamically built key, so this still earns its place.
  fallbackLocale: DEFAULT_UI_LOCALE,
  // Typed against UI_LOCALES: a catalogue missing from either side fails here.
  messages: { en, pl } satisfies Record<UiLang, typeof en>,
  pluralRules,
})

export default i18n
