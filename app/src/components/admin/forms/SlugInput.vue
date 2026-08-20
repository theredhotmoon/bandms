<script setup lang="ts">
import { ref, watch } from 'vue'
import Slugify from 'slugify'

const props = defineProps<{
  modelValue: string
  modelValuePl?: string
  sourceEn?: string
  sourcePl?: string
  bilingual?: boolean
}>()

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
</script>

<template>
  <div class="slug-wrap">
    <div class="slug-row">
      <span class="lang-badge">EN</span>
      <div class="slug-input-wrap flex-1">
        <input
          :value="modelValue"
          @input="onEnInput"
          class="field-input slug-field"
          placeholder="url-slug"
          autocomplete="off"
          spellcheck="false"
        />
        <button type="button" class="slug-regen" @click="regenerateEn" title="Auto-generate from title">
          <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    </div>
    <div v-if="bilingual" class="slug-row">
      <span class="lang-badge lang-badge--pl">PL</span>
      <div class="slug-input-wrap flex-1">
        <input
          :value="modelValuePl ?? ''"
          @input="onPlInput"
          class="field-input slug-field"
          placeholder="url-slug-pl"
          autocomplete="off"
          spellcheck="false"
        />
        <button type="button" class="slug-regen" @click="regeneratePl" title="Auto-generate from Polish title">
          <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

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

.lang-badge {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em;
  padding: 0.2rem 0.45rem; border-radius: 0.25rem; flex-shrink: 0;
  background: #1e3a5f; color: #60a5fa; width: 2rem; text-align: center;
}
.lang-badge--pl { background: #3f1010; color: #f87171; }
</style>
