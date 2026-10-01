<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Slugify from 'slugify'
import { useI18n } from 'vue-i18n'
import { useContentLocales } from '@/composables/useContentLocales'
import { shortLabel, type Lang } from '@/locales'

const props = withDefaults(defineProps<{
  modelValue: string
  modelValuePl?: string
  sourceEn?: string
  sourcePl?: string
  bilingual?: boolean
  placeholderEn?: string
  placeholderPl?: string
  /** Shown under the row when there's no error — e.g. a resolved path preview. */
  hintEn?: string
  hintPl?: string
  errorEn?: string
  errorPl?: string
  maxlength?: number
}>(), {
  placeholderEn: 'url-slug',
  placeholderPl: 'url-slug-pl',
})

const emit = defineEmits<{
  'update:modelValue': [string]
  'update:modelValuePl': [string]
}>()

function makeSlug(str: string): string {
  return Slugify(str, { lower: true, strict: true, trim: true })
}

const autoEn = ref(!props.modelValue)
const autoPl = ref(!props.modelValuePl)

watch(() => props.modelValue, (val) => {
  if (val) autoEn.value = false
})

watch(() => props.modelValuePl, (val) => {
  if (val) autoPl.value = false
})

watch(() => props.sourceEn, (val) => {
  if (autoEn.value && val !== undefined) {
    emit('update:modelValue', val ? makeSlug(val) : '')
  }
})

watch(() => props.sourcePl, (val) => {
  if (autoPl.value && val !== undefined && props.bilingual) {
    emit('update:modelValuePl', val ? makeSlug(val) : '')
  }
})

function onEnInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  autoEn.value = v === ''
  emit('update:modelValue', v)
}

function onPlInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  autoPl.value = v === ''
  emit('update:modelValuePl', v)
}

function regenerateEn() {
  autoEn.value = true
  emit('update:modelValue', props.sourceEn ? makeSlug(props.sourceEn) : '')
}

function regeneratePl() {
  autoPl.value = true
  emit('update:modelValuePl', props.sourcePl ? makeSlug(props.sourcePl) : '')
}

// The props stay per-column because the slugs ARE per-column (slug_en,
// slug_pl) until those become a translatable bag; only the row order follows
// the band's content order. A third locale is a compile error in this map.
interface SlugRow {
  value: string
  source: string | undefined
  placeholder: string
  hint: string | undefined
  error: string | undefined
  regenTitle: string
  onInput: (e: Event) => void
  regenerate: () => void
}

const { t } = useI18n()
const { order: contentLocales } = useContentLocales()

const byLocale = computed<Record<Lang, SlugRow>>(() => ({
  en: {
    value: props.modelValue, source: props.sourceEn, placeholder: props.placeholderEn,
    hint: props.hintEn, error: props.errorEn, regenTitle: t('common.slug.autoGenerate'),
    onInput: onEnInput, regenerate: regenerateEn,
  },
  pl: {
    value: props.modelValuePl ?? '', source: props.sourcePl, placeholder: props.placeholderPl,
    hint: props.hintPl, error: props.errorPl, regenTitle: t('common.slug.autoGeneratePl'),
    onInput: onPlInput, regenerate: regeneratePl,
  },
}))

// `bilingual: false` has only ever meant "the English slug alone".
const rows = computed(() =>
  (props.bilingual ? contentLocales.value : (['en'] as Lang[])).map(locale => ({ locale, ...byLocale.value[locale] })),
)
</script>

<template>
  <div class="slug-wrap">
    <template v-for="row in rows" :key="row.locale">
      <div class="slug-row" :data-locale="row.locale">
        <span class="lang-badge" :class="`lang-badge--${row.locale}`">{{ shortLabel(row.locale) }}</span>
        <div class="slug-input-wrap flex-1">
          <input
            :value="row.value"
            @input="row.onInput"
            class="field-input slug-field"
            :class="{ 'field-input--error': row.error }"
            :placeholder="row.placeholder"
            :maxlength="maxlength"
            :aria-invalid="Boolean(row.error)"
            autocomplete="off"
            spellcheck="false"
          />
          <button v-if="row.source !== undefined" type="button" class="slug-regen" @click="row.regenerate" :title="row.regenTitle">
            <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
          </button>
        </div>
      </div>
      <p v-if="row.error" class="field-error">{{ row.error }}</p>
      <p v-else-if="row.hint" class="field-hint">{{ row.hint }}</p>
    </template>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.slug-wrap { display: flex; flex-direction: column; gap: 0.375rem; }
.slug-row  { display: flex; align-items: center; gap: 0.5rem; }

.slug-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.slug-field {
  padding-right: 2.25rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8125rem;
}
.field-input--error { border-color: #f87171 !important; }

.slug-regen {
  position: absolute;
  right: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: color 120ms, background 120ms;
  flex-shrink: 0;
}

.slug-regen:hover {
  color: #60a5fa;
  background: #1e3a5f33;
}
</style>
