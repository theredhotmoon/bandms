<script setup lang="ts">
import { useLang } from '@/composables/useLang'
import { computed, reactive, ref, watch } from 'vue'
import type { Faq, FaqPayload } from '@/types/faq'
import type { WebsiteModule } from '@/types/website-module'
import { LOCALES, emptyBag, type Lang as Locale, type TranslationBag } from '@/locales'
import TranslatedField from '@/components/admin/forms/TranslatedField.vue'
import TranslateFormButton from '@/components/admin/forms/TranslateFormButton.vue'
import { useDirtyGuard } from '@/composables/useDirtyGuard'

// Module names are the band's content, so they follow the content locale.
const { lang } = useLang()

interface Props {
  /** The entry being edited, or null when creating. */
  faq: Faq | null
  /** Module this entry belongs to. Used as the default for a new entry. */
  moduleSlug: string
  modules: WebsiteModule[]
  pending: boolean
  /** Laravel validation errors, keyed as `question.en`, `module_slug`, … */
  errors: Record<string, string[]>
}

const props = defineProps<Props>()
const emit = defineEmits<{ save: [FaqPayload]; cancel: [] }>()

// Nested by field then locale so the template can bind `draft.question[l]` —
// v-model needs an assignable expression, which a ternary is not.
const draft = reactive({
  question: emptyBag(),
  answer: emptyBag(),
})

const draftModule = ref(props.moduleSlug)
const published = ref(true)

const { isDirty, markClean } = useDirtyGuard(() => ({
  question: draft.question,
  answer: draft.answer,
  module: draftModule.value,
  published: published.value,
}))

// Re-seed whenever the target changes — the editor is reused across rows, so
// without this, opening a second entry would show the first one's text.
watch(
  () => props.faq,
  (faq) => {
    draftModule.value = faq?.module_slug ?? props.moduleSlug
    published.value = faq?.is_published ?? true
    for (const l of LOCALES) {
      draft.question[l] = faq?.question?.[l] ?? ''
      draft.answer[l] = faq?.answer?.[l] ?? ''
    }
    markClean()
  },
  { immediate: true },
)

/** Trimmed draft for one field, one key per registered locale, '' becoming null. */
function bagFrom(field: 'question' | 'answer'): Record<Locale, string | null> {
  return Object.fromEntries(
    LOCALES.map(l => [l, draft[field][l].trim() || null]),
  ) as Record<Locale, string | null>
}

// "Translate empty fields" hands back the bags it filled, keyed by fieldKey;
// only still-empty locales were written (utils/translationFill.ts).
function onTranslatedFill(bags: Record<string, TranslationBag>): void {
  if (bags['faq.question']) Object.assign(draft.question, bags['faq.question'])
  if (bags['faq.answer']) Object.assign(draft.answer, bags['faq.answer'])
}

function submit() {
  emit('save', {
    module_slug: draftModule.value,
    // Empty becomes null rather than being omitted: the API merges per locale
    // and treats an absent locale as "leave alone", so dropping a cleared field
    // would silently keep the old text.
    // Built from LOCALES, not a literal pair: the template already renders an
    // input per registered locale, so a hardcoded {en, pl} here would show a
    // working field whose text is dropped on save.
    question: bagFrom('question'),
    answer: bagFrom('answer'),
    is_published: published.value,
  })
}

// Every key this form renders inline. Anything else — a bare `question` or
// `answer` from a rule attached to the array rather than to a locale — used to
// be dropped on the floor, so a 422 looked like a silent no-op. Whatever the API
// rejects now gets said out loud somewhere.
const SHOWN_KEYS = [
  'module_slug',
  ...LOCALES.flatMap(l => [`question.${l}`, `answer.${l}`]),
]

const otherErrors = computed(() =>
  Object.entries(props.errors)
    .filter(([key]) => !SHOWN_KEYS.includes(key))
    .flatMap(([, messages]) => messages),
)
</script>

<template>
  <form class="flex flex-col gap-3 border-t border-zinc-800 px-4 py-3" @submit.prevent="submit">
    <p
      v-for="message in otherErrors"
      :key="message"
      class="text-xs text-red-400"
      role="alert"
    >
      {{ message }}
    </p>

    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1">
        <label class="text-xs text-zinc-600" for="faq-module">{{ $t('pages.faqs.subpage') }}</label>
        <select
          id="faq-module"
          v-model="draftModule"
          class="w-52 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
        >
          <option v-for="m in modules" :key="m.slug" :value="m.slug">
            {{ m.custom_name?.[lang] || m.display_name }}{{ m.enabled ? '' : ' ' + $t('pages.faqs.moduleOff') }}
          </option>
        </select>
        <span v-if="errors['module_slug']" class="text-xs text-red-400">{{ errors['module_slug'][0] }}</span>
      </div>

      <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none pb-1.5">
        <input v-model="published" type="checkbox" class="w-4 h-4 rounded accent-teal-500" />
        {{ $t('pages.faqs.published') }}
      </label>
    </div>

    <!-- Fills the question AND the answer, so it sits above both rather than in
         one field's label row. -->
    <TranslateFormButton
      :fields="{ 'faq.question': draft.question, 'faq.answer': draft.answer }"
      :formats="{ 'faq.question': 'text', 'faq.answer': 'text' }"
      @filled="onTranslatedFill"
    />

    <div class="flex flex-col gap-1">
      <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{{ $t('pages.faqs.question') }}</span>
      <TranslatedField
        v-model="draft.question"
        kind="input"
        field-key="faq.question"
        id-prefix="faq-q"
        :label="$t('pages.faqs.question')"
        :maxlength="300"
        :errors="Object.fromEntries(LOCALES.map(l => [l, errors[`question.${l}`]?.[0]]))"
      />
    </div>

    <div class="flex flex-col gap-1">
      <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{{ $t('pages.faqs.answer') }}</span>
      <TranslatedField
        v-model="draft.answer"
        kind="textarea"
        field-key="faq.answer"
        id-prefix="faq-a"
        :label="$t('pages.faqs.answer')"
        :rows="4"
        :maxlength="4000"
        :errors="Object.fromEntries(LOCALES.map(l => [l, errors[`answer.${l}`]?.[0]]))"
      />
    </div>

    <span class="text-xs text-zinc-600">{{ $t('pages.faqs.editorHint') }}</span>

    <div class="flex justify-end gap-2 pt-1">
      <button
        type="button"
        class="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        @click="emit('cancel')"
      >
        {{ $t('common.actions.cancel') }}
      </button>
      <button
        type="submit"
        class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-[#fff] text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="pending || !isDirty"
      >
        {{ pending ? $t('common.actions.saving') : $t('common.actions.save') }}
      </button>
    </div>
  </form>
</template>

<style scoped src="./form-styles.css" />
