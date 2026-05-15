<script setup lang="ts">
import type { PaFohRequirements } from '@/types/techRider'

interface Props { modelValue: PaFohRequirements }
const props = defineProps<Props>()
const emit  = defineEmits<{ 'update:modelValue': [value: PaFohRequirements] }>()

function update(field: keyof PaFohRequirements, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div class="pafoh-section">
    <div class="section-hint">
      Minimum PA specification and front-of-house expectations for the venue.
      Be specific — "line array, L-Acoustics or equivalent" is more useful than "good PA".
    </div>

    <div class="form-grid">
      <div class="field-group field-group--wide">
        <label class="field-label">Room coverage / PA requirement</label>
        <textarea
          :value="modelValue.room_coverage_notes"
          class="field-input"
          rows="3"
          placeholder="e.g. Full line array covering all seating. Stereo L/R rig capable of 105 dB SPL at mix position."
          @input="update('room_coverage_notes', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>

      <div class="field-group field-group--wide">
        <label class="field-label">Subwoofer requirements</label>
        <input
          :value="modelValue.subwoofer_notes"
          class="field-input"
          placeholder="e.g. Minimum 2× 18″ subs per side. Cardioid sub config preferred."
          @input="update('subwoofer_notes', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-group field-group--wide">
        <label class="field-label">System processing expectations</label>
        <input
          :value="modelValue.processing_notes"
          class="field-input"
          placeholder="e.g. Stereo 31-band EQ on main bus. Access to Lake/Dolby Lake or equivalent."
          @input="update('processing_notes', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-group">
        <label class="field-label">Console preference</label>
        <input
          :value="modelValue.console_preference"
          class="field-input"
          placeholder="e.g. Avid S6L, DiGiCo SD12, Yamaha CL5"
          @input="update('console_preference', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-group">
        <label class="field-label">Show file format</label>
        <input
          :value="modelValue.show_file_format"
          class="field-input"
          placeholder="e.g. Avid Profile .avtp, SD12 .sess"
          :disabled="!modelValue.brings_show_file"
          @input="update('show_file_format', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-group">
        <label class="field-label">Bringing own FOH engineer?</label>
        <label class="toggle-label">
          <input
            type="checkbox"
            :checked="modelValue.brings_own_foh_engineer"
            class="toggle-input"
            @change="update('brings_own_foh_engineer', ($event.target as HTMLInputElement).checked)"
          />
          <span class="toggle-text">{{ modelValue.brings_own_foh_engineer ? 'Yes — travelling with FOH engineer' : 'No — using house engineer' }}</span>
        </label>
        <input
          v-if="modelValue.brings_own_foh_engineer"
          :value="modelValue.foh_engineer_name"
          class="field-input mt-1"
          placeholder="Engineer name"
          @input="update('foh_engineer_name', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="field-group">
        <label class="field-label">Bringing own show file?</label>
        <label class="toggle-label">
          <input
            type="checkbox"
            :checked="modelValue.brings_show_file"
            class="toggle-input"
            @change="update('brings_show_file', ($event.target as HTMLInputElement).checked)"
          />
          <span class="toggle-text">{{ modelValue.brings_show_file ? 'Yes — we provide a show file' : 'No — starting from scratch' }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pafoh-section { display: flex; flex-direction: column; gap: 0.75rem; }
.section-hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.375rem;
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.field-group { display: flex; flex-direction: column; gap: 0.3rem; }
.field-group--wide { grid-column: 1 / -1; }
.field-label { font-size: 0.75rem; font-weight: 600; color: #7c8fa6; }
.field-input {
  display: block; width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem;
  border: 1px solid #1e2040; background: #0e0e26; color: #e2e8f0;
  font-size: 0.875rem; outline: none; font-family: inherit;
  transition: border-color 150ms; resize: vertical;
}
.field-input:focus   { border-color: #5154e5; }
.field-input:disabled { opacity: 0.4; cursor: not-allowed; }
.field-input::placeholder { color: #2a3050; }
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.toggle-input { accent-color: #4338ca; width: 1rem; height: 1rem; cursor: pointer; }
.toggle-text  { font-size: 0.8rem; color: #94a3b8; }
.mt-1 { margin-top: 0.35rem; }
</style>
