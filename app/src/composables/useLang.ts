import { ref } from 'vue'
import { DEFAULT_LOCALE, isLocale, type Lang } from '@/locales'

export type { Lang }

function loadStoredLang(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('site_lang') : null
  } catch {
    return null
  }
}

// An unrecognised stored value falls back to the default rather than being cast
// through: a locale removed from the registry must not leave a user pinned to a
// language the app no longer renders.
const stored = loadStoredLang()
const lang = ref<Lang>(isLocale(stored) ? stored : DEFAULT_LOCALE)

/**
 * The locale the admin asks the API to resolve the band's content in — sent as
 * `?lang=` by the posts, releases and profile fetches and as `X-Content-Locale`
 * by every other one (`api/client.ts`). It decides which language a list row's
 * concert name or release title arrives in; editors read the raw translation
 * bags and are unaffected.
 *
 * It follows the band's first content language (`useContentLangSync()` keeps
 * it there) and is persisted so a reload starts in the right language instead
 * of fetching everything in English first. It used to be set by the public
 * site's language switcher; when #65 deleted that, nothing set it any more, and
 * a Polish-first band saw every list in English.
 */
export function useLang() {
  function setLang(l: Lang): void {
    lang.value = l
    try {
      localStorage.setItem('site_lang', l)
    } catch {
      // No storage (or it refused): the language still applies for this session.
    }
  }

  return { lang, setLang }
}

/** The current content locale, read at call time — for `api/client.ts`, which holds no state of its own. */
export function currentContentLang(): Lang {
  return lang.value
}
