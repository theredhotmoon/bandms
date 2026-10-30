<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, reactive, useId, watch } from 'vue'
import { useDirtyGuard, useModalGuard } from '@/composables/useDirtyGuard'
import TranslatedField from '@/components/admin/forms/TranslatedField.vue'
import InstrumentIcon from '@bandms/rider-core/components/InstrumentIcon.vue'
import InstrumentIconPicker from '@/components/ui/InstrumentIconPicker.vue'
import type { Instrument, InstrumentPayload } from '@bandms/rider-core'
import { guessInstrumentType } from '@bandms/rider-core'
import { LOCALES, DEFAULT_LOCALE, emptyBag } from '@/locales'

/**
 * The instrument form, shared by the Instruments page and the band member
 * form's "New instrument" (InstrumentQuickAdd). It used to be inline in
 * InstrumentsAdminView; a form a modal can stack over another modal has to
 * be a component, so the discard guard travels with it (useModalGuard).
 */
const props = defineProps<{
  initial?: Instrument | null
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [InstrumentPayload]; cancel: [] }>()

const { t } = useI18n()
// i18n-ignore: these are seeds for a free-text column, not chrome. They get
// STORED in instruments.category, so translating them would have a Polish
// admin create 'Smyczkowe' where an English one created 'Strings' — two
// categories for one thing. Same rule as utils/signalChainPresets.ts.
const CATEGORY_SUGGESTIONS = ['Strings', 'Brass', 'Woodwind', 'Percussion', 'Keys', 'Electronic', 'Vocal', 'Other'] // i18n-ignore: stored data seeds, see above

// Two of these forms can be mounted at once (the instruments page's modal
// over nothing, or a quick-add over a member form), so the datalist id is
// per instance rather than a fixed string.
const suggestionsId = useId()

const form = reactive({
  name: emptyBag(),
  category: null as string | null,
  stage_plot_type: null as InstrumentPayload['stage_plot_type'],
})

// Icon suggestion derived from the registry's default-locale name —
// guessInstrumentType's keyword catalogue only matches English terms, and
// DEFAULT_LOCALE is 'en' today, but the literal must not be hardcoded here.
const suggestedType = computed(() => guessInstrumentType(form.name[DEFAULT_LOCALE] ?? ''))

const { isDirty, markClean } = useDirtyGuard(() => form)
const { cancel } = useModalGuard(isDirty, () => emit('cancel'))

watch(() => props.initial, (val) => {
  for (const l of LOCALES) form.name[l] = val?.translations?.name[l] ?? ''
  form.category        = val?.category ?? null
  form.stage_plot_type = val?.stage_plot_type ?? null
  markClean()
}, { immediate: true })

function submit() {
  emit('submit', {
    name:            Object.fromEntries(LOCALES.map(l => [l, form.name[l].trim() || null])),
    category:        form.category?.trim() || null,
    stage_plot_type: form.stage_plot_type || null,
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4">
    <div>
      <label class="field-label">{{ $t('more.instruments.name') }} <span class="field-req">*</span></label>
      <TranslatedField
        v-model="form.name"
        kind="input"
        field-key="instrument.name"
        :label="$t('more.instruments.name')"
        :placeholders="Object.fromEntries(LOCALES.map(l => [l, $t('more.instruments.namePlaceholder')]))"
        :errors="Object.fromEntries(LOCALES.map(l => [l, errors?.[`name.${l}`]?.[0]]))"
      />
      <p v-if="errors?.name" class="field-error">{{ errors.name[0] }}</p>
    </div>
    <div>
      <label class="field-label">{{ $t('more.instruments.category') }}</label>
      <input v-model="form.category" class="field-input" :list="suggestionsId" :placeholder="$t('more.instruments.categoryPlaceholder')" />
      <datalist :id="suggestionsId">
        <option v-for="c in CATEGORY_SUGGESTIONS" :key="c" :value="c" />
      </datalist>
    </div>
    <div>
      <label class="field-label">{{ $t('more.instruments.stagePlotIcon') }}</label>
      <InstrumentIconPicker
        :model-value="form.stage_plot_type ?? null"
        clearable
        :placeholder="$t('more.instruments.notMapped')"
        @update:model-value="form.stage_plot_type = $event"
      />
      <button
        v-if="!form.stage_plot_type && suggestedType"
        type="button"
        class="icon-suggestion"
        @click="form.stage_plot_type = suggestedType"
      >
        <InstrumentIcon :type="suggestedType" :size="16" />
        {{ t('more.instruments.useSuggested', { name: form.name[DEFAULT_LOCALE].trim() }) }}
      </button>
    </div>
    <div class="flex gap-2 justify-end pt-1">
      <button type="button" class="btn-ghost" @click="cancel()">{{ $t('common.actions.cancel') }}</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? $t('common.actions.saving') : $t('common.actions.save') }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.field-req { color: var(--c-f87171); }
.icon-suggestion {
  display: inline-flex; align-items: center; gap: 0.375rem;
  margin-top: 0.5rem; padding: 0.25rem 0.5rem;
  border: 1px solid var(--c-334155-line); border-radius: 0.375rem;
  font-size: var(--fs-2xs); color: var(--c-94a3b8); background: transparent;
  cursor: pointer; transition: color .15s, border-color .15s;
}
.icon-suggestion:hover { color: var(--c-e2e8f0); border-color: var(--c-64748b-line); }
</style>
