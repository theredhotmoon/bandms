import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { i18n } from '@/i18n'
import type { Lang } from '@/locales'
import {
  localeFromQuery,
  readStoredFanLocale,
  resolveFanLocale,
  setActiveFanLocale,
  writeStoredFanLocale,
} from '@/utils/fanLocale'

/**
 * Applies the fan-facing locale for as long as a fan page is mounted.
 *
 * `i18n.global.locale` is one value for the whole app, so this restores what
 * it found on unmount. Without that, an admin who opened /account to check a
 * ticket would find the panel in the fan's language afterwards — the bug this
 * is meant to prevent, pointing the other way.
 *
 * It is the second writer of `document.documentElement.lang` — useUiLang's
 * comment says App.vue owns that attribute, and that stays true for every
 * admin route. A fan page is outside the chrome axis entirely: announcing it
 * as English to a screen reader because that is what an admin last chose is
 * the bug. The unmount restore hands the attribute straight back.
 *
 * The resolution itself lives in utils/ so vitest can reach it: the admin's
 * suite runs `environment: 'node'`, where importing anything that touches
 * localStorage at module load dies on import. See app/CLAUDE.md.
 */
export function useFanLocale(): void {
  const route = useRoute()
  let previous: Lang | null = null

  /**
   * Re-run on every route change, not just on mount.
   *
   * A navigation that changes only the query reuses this component instance, so
   * `onMounted` does not fire again — and the request headers *do* follow the
   * new query. Resolving here and publishing through `setActiveFanLocale` is
   * what keeps the page and its requests speaking one language.
   */
  function apply(): void {
    const search = window.location.search
    const resolved = resolveFanLocale({
      search,
      stored: readStoredFanLocale(),
      // `languages` is the full ordered preference list; `language` is only
      // the first. A fan whose browser says [pl, en] should get Polish even
      // if the primary happens to be a locale we do not carry.
      browser: navigator.languages ?? [navigator.language],
    })

    i18n.global.locale.value = resolved
    document.documentElement.lang = resolved
    setActiveFanLocale(resolved)

    // Persist the *choice* only. Storing a browser-derived value would freeze
    // it forever, because resolution reads the store before the browser list.
    const chosen = localeFromQuery(search)
    if (chosen) writeStoredFanLocale(chosen)
  }

  onMounted(() => {
    previous = i18n.global.locale.value as Lang
    apply()
  })

  watch(() => route.fullPath, apply)

  onBeforeUnmount(() => {
    setActiveFanLocale(null)
    if (previous) {
      i18n.global.locale.value = previous
      document.documentElement.lang = previous
    }
  })
}
