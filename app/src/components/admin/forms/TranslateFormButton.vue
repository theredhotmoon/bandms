<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useAssistantCapabilities, useTranslate } from '@/composables/useAssistant'
import { useContentLocales } from '@/composables/useContentLocales'
import type { Lang, TranslationBag } from '@/locales'
import type { TranslateFormat, TranslateItem } from '@/types/assistant'
import { applyFill, planFill } from '@/utils/translationFill'

/**
 * "Translate empty fields" for a form whose translated content is a flat set
 * of bags. Fills every empty locale of every field from that field's own
 * source, and never touches a filled one.
 *
 * `fields` MUST be keyed by each field's `fieldKey` (`concert.name`, not
 * `name`): the planned item keys are `<fieldKey>.<locale>`, the same keys
 * TranslatedField uses, so the per-row spinners light up through the shared
 * `pending` set and a row in flight here refuses its own second request.
 *
 * One request PER FIELD, in parallel: a slow or failed field leaves the others
 * filled, and no request nears the server's item cap. Renders nothing when
 * the server cannot translate or there is nothing to fill.
 */
const props = defineProps<{
  fields: Record<string, TranslationBag>
  formats: Record<string, TranslateFormat>
  locales?: Lang[]
}>()

const emit = defineEmits<{ filled: [Record<string, TranslationBag>] }>()

const { order } = useContentLocales()
const { canTranslate } = useAssistantCapabilities()
const { translate, isPending, failureMessage } = useTranslate()
const busy = ref(false)

// A row whose own button already fired is left to that request.
const plan = computed<TranslateItem[]>(() =>
  planFill(props.fields, props.locales ?? order.value, props.formats).filter(item => !isPending(item.key)))
// Stays mounted while busy: the plan empties the moment its items go pending,
// and a button that unmounts mid-run reads as a flicker.
const show = computed(() => canTranslate.value && (busy.value || plan.value.length > 0))

async function run(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    // Group the plan by field: one request each, settled independently.
    const byField = new Map<string, TranslateItem[]>()
    for (const item of plan.value) {
      const field = item.key.slice(0, item.key.lastIndexOf('.'))
      byField.set(field, [...(byField.get(field) ?? []), item])
    }
    // Quiet per field: a provider outage would otherwise toast once per field.
    const results = await Promise.allSettled([...byField.values()].map(items => translate(items, { quiet: true })))
    const translated = Object.assign({}, ...results.flatMap(r => (r.status === 'fulfilled' ? [r.value] : [])))
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failed) toast.error(failureMessage(failed.reason))
    if (Object.keys(translated).length > 0) emit('filled', applyFill(props.fields, translated))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    v-if="show"
    type="button"
    class="btn-ghost trans-fill"
    :disabled="busy"
    data-testid="translate-empty-fields"
    @click="run"
  >
    {{ $t('common.assistant.translateEmpty') }}
  </button>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.trans-fill { padding: 0.3rem 0.7rem; font-size: var(--fs-xs); align-self: flex-start; }
</style>
