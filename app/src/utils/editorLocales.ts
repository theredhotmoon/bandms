import type { InjectionKey, Ref } from 'vue'
import { isLocale, type Lang } from '@/locales'

/**
 * Which content locales a long-form editor is currently showing.
 *
 * A post is prose: the writer drafts one language end to end, then translates.
 * Rendering every locale's textarea under every paragraph doubles the scroll
 * and interleaves two trains of thought, so the post form lets the writer pick
 * a single locale to work in and provides the choice to the block editors
 * through this key. Nothing is lost by hiding a locale — the bag keeps its
 * text — and `null` (or no provider at all) means "show them all", which is
 * what every other form does.
 *
 * Lives in utils/ so the storage helpers below are importable from vitest's
 * `node` environment; `localStorage` access is guarded for the same reason.
 */
export const VISIBLE_LOCALES: InjectionKey<Ref<Lang[] | null>> = Symbol('visibleLocales')

export type LocaleView = 'all' | Lang

const STORAGE_KEY = 'post_editor_view'

/** Narrow whatever is stored to a value the registry still knows about. */
export function parseLocaleView(raw: unknown): LocaleView {
  return raw === 'all' || isLocale(raw) ? raw : 'all'
}

export function loadLocaleView(): LocaleView {
  try {
    return parseLocaleView(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'all'
  }
}

export function saveLocaleView(view: LocaleView): void {
  try {
    localStorage.setItem(STORAGE_KEY, view)
  } catch {
    /* private mode or disabled storage — the choice simply does not persist */
  }
}

/** The locales a view resolves to, in the band's content order. */
export function visibleFor(view: LocaleView, order: readonly Lang[]): Lang[] {
  return view === 'all' ? [...order] : order.filter(l => l === view)
}
