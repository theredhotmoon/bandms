import { computed, ref, type ComputedRef } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { fetchAssistantCapabilities, rewriteText, translateItems } from '@/api/assistant'
import { saveErrorMessage } from '@/api/client'
import type { AssistantCapabilities, RewriteBody, TranslateItem } from '@/types/assistant'
import { useAuth } from './useAuth'

const QUERY_KEY = ['assistant-capabilities']
const NONE: AssistantCapabilities = { translate: false, rewrite: false }

// ONE pending set for the whole admin, not one per caller: the form-level
// "Translate empty fields" and the row's own button must see each other's
// requests, so the row shows a spinner and refuses a second request for the
// same key while the first is in flight. Keys are `<fieldKey>.<locale>`.
const pending = ref<Set<string>>(new Set())

/**
 * What the server's assistant can do, read once per session. Until the answer
 * arrives — or if it never does — nothing is offered: a button that appears
 * and then vanishes, or one that 503s, is worse than one that shows up a
 * moment late.
 */
export function useAssistantCapabilities(): {
  capabilities: ComputedRef<AssistantCapabilities>
  canTranslate: ComputedRef<boolean>
} {
  const { token, user } = useAuth()
  // Per user: the answer depends on who is signed in (a superadmin switches
  // access per person), so the key carries the user id — a sign-out/in as
  // someone else never reuses another person's answer. Refetched on window
  // focus after five minutes, and invalidated by useUsers when access changes,
  // so a switch flipped elsewhere reaches an open session without a reload.
  const query = useQuery({
    queryKey: computed(() => [...QUERY_KEY, user.value?.id ?? null]),
    queryFn: () => fetchAssistantCapabilities(token.value!),
    enabled: () => token.value !== null,
    staleTime: 5 * 60 * 1000,
  })
  const capabilities = computed<AssistantCapabilities>(() => query.data.value ?? NONE)
  return { capabilities, canTranslate: computed(() => capabilities.value.translate) }
}

/**
 * The translate call behind every Translate button. `pending` is the shared
 * set of item keys in flight (above), so each row shows its own spinner for
 * requests any caller started; a failure toasts the server's message and
 * rethrows, so a caller can leave the field alone.
 */
export function useTranslate(): {
  /** `quiet` leaves the toast to the caller — a form-level fill toasts once, not once per field. */
  translate: (items: TranslateItem[], opts?: { quiet?: boolean }) => Promise<Record<string, string>>
  /** Whether an item with this key is in flight — from ANY caller. */
  isPending: (key: string) => boolean
  /** The toast the composable would have shown for this error. */
  failureMessage: (e: unknown) => string
} {
  const { token } = useAuth()
  const { t } = useI18n()
  const failureMessage = (e: unknown): string => saveErrorMessage(e, t('common.assistant.translateFailed'))

  async function translate(items: TranslateItem[], opts: { quiet?: boolean } = {}): Promise<Record<string, string>> {
    pending.value = new Set([...pending.value, ...items.map(i => i.key)])
    try {
      const { items: translated } = await translateItems(token.value!, items)
      return translated
    } catch (e) {
      if (!opts.quiet) toast.error(failureMessage(e))
      throw e
    } finally {
      const keys = new Set(items.map(i => i.key))
      pending.value = new Set([...pending.value].filter(k => !keys.has(k)))
    }
  }

  return { translate, isPending: (key: string) => pending.value.has(key), failureMessage }
}

/**
 * The rewrite call behind every Enhance menu. Shares the module-level pending
 * set with translate (key `rewrite:<fieldKey>.<locale>`), so a row in either
 * kind of request shows one spinner and refuses a second request.
 */
export function useEnhance(): {
  rewrite: (body: RewriteBody) => Promise<string>
  isPending: (key: string) => boolean
} {
  const { token } = useAuth()
  const { t } = useI18n()

  async function rewrite(body: RewriteBody): Promise<string> {
    const key = `rewrite:${body.fieldKey}.${body.locale}`
    pending.value = new Set([...pending.value, key])
    try {
      const { text } = await rewriteText(token.value!, body)
      return text
    } catch (e) {
      toast.error(saveErrorMessage(e, t('common.assistant.rewriteFailed')))
      throw e
    } finally {
      pending.value = new Set([...pending.value].filter(k => k !== key))
    }
  }

  return { rewrite, isPending: (key: string) => pending.value.has(key) }
}
