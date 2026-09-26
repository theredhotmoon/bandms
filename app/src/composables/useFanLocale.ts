import { onBeforeUnmount, onMounted } from 'vue'
import { i18n } from '@/i18n'
import type { Lang } from '@/locales'
import { readStoredFanLocale, resolveFanLocale, writeStoredFanLocale } from '@/utils/fanLocale'

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
  let previous: Lang | null = null

  onMounted(() => {
    const resolved = resolveFanLocale({
      search: window.location.search,
      stored: readStoredFanLocale(),
      // `languages` is the full ordered preference list; `language` is only
      // the first. A fan whose browser says [pl, en] should get Polish even
      // if the primary happens to be a locale we do not carry.
      browser: navigator.languages ?? [navigator.language],
    })

    previous = i18n.global.locale.value as Lang
    i18n.global.locale.value = resolved
    document.documentElement.lang = resolved
    writeStoredFanLocale(resolved)
  })

  onBeforeUnmount(() => {
    if (previous) {
      i18n.global.locale.value = previous
      document.documentElement.lang = previous
    }
  })
}
