import type { Lang } from '@/locales'

/** 'html' protects markup (Tiptap output); 'text' is a plain string. */
export type TranslateFormat = 'text' | 'html'

/**
 * One string for POST /api/admin/assistant/translate. `key` is ours — the
 * admin uses `<field>.<targetLocale>` — and comes back on the answer so a
 * request may carry several fields and locales at once.
 */
export interface TranslateItem {
  key: string
  text: string
  format: TranslateFormat
  source: Lang
  target: Lang
}

/**
 * What the server can do. A capability reported false means the button is
 * not rendered at all — a disabled control nobody can enable from the UI is
 * a control pretending to be one.
 */
export interface AssistantCapabilities {
  translate: boolean
  rewrite: boolean
}
