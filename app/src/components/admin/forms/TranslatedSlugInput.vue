<script setup lang="ts">
import { reactive, watch } from 'vue'
import Slugify from 'slugify'
import { useI18n } from 'vue-i18n'
import { useContentLocales } from '@/composables/useContentLocales'
import { LOCALES, shortLabel, type Lang, type TranslationBag } from '@/locales'

/**
 * A URL slug per content locale, edited as one translation bag — the admin half
 * of the translated-slug series, where `slug_en`/`slug_pl` columns become one
 * `slug` JSON column. Replaces SlugInput (per-column props) table by table;
 * SlugInput goes when the last table has moved.
 *
 * Each locale auto-follows its `sources` entry (usually the title in that
 * language) until the band types a slug of their own; clearing the field hands
 * it back to auto. A locale without a source has no regenerate button.
 */
const props = withDefaults(defineProps<{
  modelValue: TranslationBag
  sources?: Partial<Record<Lang, string>>
  placeholders?: Partial<Record<Lang, string>>
  /** Shown under a row when it has no error — e.g. a resolved path preview. */
  hints?: Partial<Record<Lang, string | undefined>>
  errors?: Partial<Record<Lang, string | undefined>>
  maxlength?: number
}>(), {
  sources: () => ({}),
  placeholders: () => ({}),
  hints: () => ({}),
  errors: () => ({}),
})

const emit = defineEmits<{ 'update:modelValue': [TranslationBag] }>()

const { t } = useI18n()
const { order: contentLocales } = useContentLocales()

const makeSlug = (s: string): string => Slugify(s, { lower: true, strict: true, trim: true })

// What this component last emitted per locale. A value arriving that is NOT
// one of ours (the record loading, a reset) means the slug was set by hand
// elsewhere, so that locale stops auto-following. SlugInput flipped to manual
// on ANY prop change — including its own auto-generated value coming back —
// so it stopped tracking the title after the first keystroke.
const emitted: Partial<Record<Lang, string>> = {}
const auto = reactive(Object.fromEntries(LOCALES.map(l => [l, !props.modelValue[l]])) as Record<Lang, boolean>)

function set(l: Lang, value: string): void {
  emitted[l] = value
  emit('update:modelValue', { ...props.modelValue, [l]: value })
}

for (const l of LOCALES) {
  watch(() => props.modelValue[l], (value) => {
    if (value && value !== emitted[l]) auto[l] = false
    if (!value) auto[l] = true
  })

  watch(() => props.sources[l], (source) => {
    if (auto[l] && source !== undefined) set(l, source ? makeSlug(source) : '')
  })
}

function onInput(l: Lang, e: Event): void {
  const value = (e.target as HTMLInputElement).value
  auto[l] = value === ''
  set(l, value)
}

function regenerate(l: Lang): void {
  auto[l] = true
  set(l, props.sources[l] ? makeSlug(props.sources[l]!) : '')
}
</script>

<template>
  <div class="slug-wrap">
    <template v-for="l in contentLocales" :key="l">
      <div class="slug-row" :data-locale="l">
        <span class="lang-badge" :class="`lang-badge--${l}`">{{ shortLabel(l) }}</span>
        <div class="slug-input-wrap flex-1">
          <input
            :value="modelValue[l]"
            @input="onInput(l, $event)"
            class="field-input slug-field"
            :class="{ 'field-input--error': errors[l] }"
            :placeholder="placeholders[l] ?? 'url-slug'"
            :maxlength="maxlength"
            :aria-invalid="Boolean(errors[l])"
            autocomplete="off"
            spellcheck="false"
          />
          <button
            v-if="sources[l] !== undefined"
            type="button"
            class="slug-regen"
            @click="regenerate(l)"
            :title="t('common.slug.autoGenerate')"
            :aria-label="t('common.slug.autoGenerate')"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
          </button>
        </div>
      </div>
      <p v-if="errors[l]" class="field-error">{{ errors[l] }}</p>
      <p v-else-if="hints[l]" class="field-hint">{{ hints[l] }}</p>
    </template>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.slug-wrap { display: flex; flex-direction: column; gap: 0.375rem; }
.slug-row  { display: flex; align-items: center; gap: 0.5rem; }
.slug-input-wrap { position: relative; display: flex; align-items: center; }
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
.slug-regen:hover { color: #60a5fa; background: #1e3a5f33; }
</style>
