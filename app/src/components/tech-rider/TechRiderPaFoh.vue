<script setup lang="ts">
import type { PaFohRequirements } from '@bandms/rider-core'

interface Props { modelValue: PaFohRequirements }
const props = defineProps<Props>()
const emit  = defineEmits<{ 'update:modelValue': [value: PaFohRequirements] }>()

function update(field: keyof PaFohRequirements, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div class="pafoh-section">
    <div class="section-hint">{{ $t('rider.paFoh.hint') }}</div>

    <div class="form-grid">
      <div class="field-group field-group--wide">
        <label class="field-label">{{ $t('rider.paFoh.coverage') }}</label>
        <textarea
          :value="modelValue.room_coverage_notes"
          class="field-input"
          rows="3"
          :placeholder="$t('rider.paFoh.coveragePlaceholder')"
          @input="update('room_coverage_notes', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>

      <div class="field-group field-group--wide">
        <label class="field-label">{{ $t('rider.paFoh.subs') }}</label>
        <input
          :value="modelValue.subwoofer_notes"
          class="field-input"
          :placeholder="$t('rider.paFoh.subsPlaceholder')"
          @input="update('subwoofer_notes', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-group field-group--wide">
        <label class="field-label">{{ $t('rider.paFoh.processing') }}</label>
        <input
          :value="modelValue.processing_notes"
          class="field-input"
          :placeholder="$t('rider.paFoh.processingPlaceholder')"
          @input="update('processing_notes', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-group">
        <label class="field-label">{{ $t('rider.paFoh.console') }}</label>
        <input
          :value="modelValue.console_preference"
          class="field-input"
          :placeholder="$t('rider.paFoh.consolePlaceholder')"
          @input="update('console_preference', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-group">
        <label class="field-label">{{ $t('rider.paFoh.showFile') }}</label>
        <input
          :value="modelValue.show_file_format"
          class="field-input"
          :placeholder="$t('rider.paFoh.showFilePlaceholder')"
          :disabled="!modelValue.brings_show_file"
          @input="update('show_file_format', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-group">
        <label class="field-label">{{ $t('rider.paFoh.ownEngineer') }}</label>
        <label class="toggle-label">
          <input
            type="checkbox"
            :checked="modelValue.brings_own_foh_engineer"
            class="toggle-input"
            @change="update('brings_own_foh_engineer', ($event.target as HTMLInputElement).checked)"
          />
          <span class="toggle-text">{{ modelValue.brings_own_foh_engineer ? $t('rider.paFoh.ownEngineerYes') : $t('rider.paFoh.ownEngineerNo') }}</span>
        </label>
        <input
          v-if="modelValue.brings_own_foh_engineer"
          :value="modelValue.foh_engineer_name"
          class="field-input mt-1"
          :placeholder="$t('rider.paFoh.engineerName')"
          @input="update('foh_engineer_name', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-group">
        <label class="field-label">{{ $t('rider.paFoh.ownShowFile') }}</label>
        <label class="toggle-label">
          <input
            type="checkbox"
            :checked="modelValue.brings_show_file"
            class="toggle-input"
            @change="update('brings_show_file', ($event.target as HTMLInputElement).checked)"
          />
          <span class="toggle-text">{{ modelValue.brings_show_file ? $t('rider.paFoh.ownShowFileYes') : $t('rider.paFoh.ownShowFileNo') }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pafoh-section { display: flex; flex-direction: column; gap: 0.75rem; }
.section-hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #141414; border: 1px solid #2a2a2a; border-radius: 0.375rem;
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.field-group { display: flex; flex-direction: column; gap: 0.3rem; }
.field-group--wide { grid-column: 1 / -1; }
.field-label { font-size: 0.75rem; font-weight: 600; color: #7c8fa6; }
.field-input {
  display: block; width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem;
  border: 1px solid #2a2a2a; background: #141414; color: #e2e8f0;
  font-size: 0.875rem; outline: none; font-family: inherit;
  transition: border-color 150ms; resize: vertical;
}
.field-input:focus   { border-color: #888888; }
.field-input:disabled { opacity: 0.4; cursor: not-allowed; }
.field-input::placeholder { color: #2a3050; }
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.toggle-input { accent-color: #888888; width: 1rem; height: 1rem; cursor: pointer; }
.toggle-text  { font-size: 0.8rem; color: #94a3b8; }
.mt-1 { margin-top: 0.35rem; }
</style>
