<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Faq, FaqPayload } from '@/types/faq'
import type { WebsiteModule } from '@/types/website-module'
import { LOCALES, DEFAULT_LOCALE, emptyBag, type Lang as Locale } from '@/locales'

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
  },
  { immediate: true },
)

/** Trimmed draft for one field, one key per registered locale, '' becoming null. */
function bagFrom(field: 'question' | 'answer'): Record<Locale, string | null> {
  return Object.fromEntries(
    LOCALES.map(l => [l, draft[field][l].trim() || null]),
  ) as Record<Locale, string | null>
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

const INPUT_BASE =
  'w-full rounded-lg bg-zinc-800 border px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors'

function inputClass(key: string) {
  return props.errors[key]
    ? `${INPUT_BASE} border-red-500`
    : `${INPUT_BASE} border-zinc-700 focus:border-teal-500`
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
        <label class="text-xs text-zinc-600" for="faq-module">Subpage</label>
        <select
          id="faq-module"
          v-model="draftModule"
          class="w-52 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
        >
          <option v-for="m in modules" :key="m.slug" :value="m.slug">
            {{ m.custom_name?.en || m.display_name }}{{ m.enabled ? '' : ' (off)' }}
          </option>
        </select>
        <span v-if="errors['module_slug']" class="text-xs text-red-400">{{ errors['module_slug'][0] }}</span>
      </div>

      <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none pb-1.5">
        <input v-model="published" type="checkbox" class="w-4 h-4 rounded accent-teal-500" />
        Published
      </label>
    </div>

    <div class="flex flex-col gap-1">
      <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Question</span>
      <div class="flex flex-col gap-2">
        <div v-for="l in LOCALES" :key="l" class="flex flex-col gap-1">
          <label class="lang-tag" :class="{ 'lang-tag--pl': l !== DEFAULT_LOCALE }" :for="`faq-q-${l}`">{{ l.toUpperCase() }}</label>
          <input
            :id="`faq-q-${l}`"
            v-model="draft.question[l]"
            type="text"
            maxlength="300"
            :aria-invalid="Boolean(errors[`question.${l}`])"
            :class="inputClass(`question.${l}`)"
          />
          <span v-if="errors[`question.${l}`]" class="text-xs text-red-400">
            {{ errors[`question.${l}`][0] }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Answer</span>
      <div class="flex flex-col gap-2">
        <div v-for="l in LOCALES" :key="l" class="flex flex-col gap-1">
          <label class="lang-tag" :class="{ 'lang-tag--pl': l !== DEFAULT_LOCALE }" :for="`faq-a-${l}`">{{ l.toUpperCase() }}</label>
          <textarea
            :id="`faq-a-${l}`"
            v-model="draft.answer[l]"
            rows="4"
            maxlength="4000"
            :aria-invalid="Boolean(errors[`answer.${l}`])"
            :class="`${inputClass(`answer.${l}`)} resize-y`"
          />
          <span v-if="errors[`answer.${l}`]" class="text-xs text-red-400">
            {{ errors[`answer.${l}`][0] }}
          </span>
        </div>
      </div>
    </div>

    <span class="text-xs text-zinc-600">
      A question with only one language filled in still shows on the other — the public
      site falls back rather than rendering an empty row. Changes appear after a rebuild.
    </span>

    <div class="flex justify-end gap-2 pt-1">
      <button
        type="button"
        class="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="pending"
      >
        {{ pending ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
/* Pixel-identical to the shared .lang-badge in form-styles.css (same
   convention as WebsiteModulesView.vue's .lang-tag) — this editor is
   Tailwind-styled rather than importing that stylesheet, so the badge is
   duplicated here rather than pulling in the whole dark-form CSS for one
   element. Keep the values in sync by hand if .lang-badge ever changes. */
.lang-tag {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.45rem;
  border-radius: 0.25rem;
  flex-shrink: 0;
  background: #1e3a5f;
  color: #60a5fa;
  width: 2rem;
  text-align: center;
}
.lang-tag--pl { background: #3f1010; color: #f87171; }
</style>
