<script setup lang="ts">
import type { MemberBacklinePrefs } from '@/types/bandMemberSetup'

interface Props { modelValue: MemberBacklinePrefs }
const props = defineProps<Props>()
const emit  = defineEmits<{ 'update:modelValue': [value: MemberBacklinePrefs] }>()

const CATEGORIES = [
  { value: 'drum_kit',   label: 'Drum Kit'       },
  { value: 'guitar_amp', label: 'Guitar Amp'      },
  { value: 'bass_amp',   label: 'Bass Amp'        },
  { value: 'keyboard',   label: 'Keyboard / Keys' },
  { value: 'other',      label: 'Other'           },
]

function update(field: keyof MemberBacklinePrefs, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div class="backline-section">
    <div class="hint">
      Specify if the venue / promoter needs to provide backline for you. Common at festivals with shared backline.
    </div>

    <!-- Needed toggle -->
    <div class="needed-row">
      <label class="toggle-label">
        <input
          type="checkbox"
          :checked="modelValue.needed"
          class="toggle-input"
          @change="update('needed', ($event.target as HTMLInputElement).checked)"
        />
        <span class="toggle-text" :class="{ 'toggle-text--on': modelValue.needed }">
          {{ modelValue.needed ? 'Backline required' : 'No backline needed' }}
        </span>
      </label>
    </div>

    <template v-if="modelValue.needed">
      <div class="form-grid">
        <div class="field-group">
          <label class="field-label">Category</label>
          <select
            :value="modelValue.category"
            class="field-input"
            @change="update('category', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </div>

        <div class="field-group">
          <label class="field-label">Brand preference</label>
          <input
            :value="modelValue.brand_preference"
            class="field-input"
            placeholder="e.g. Pearl, Fender, Marshall…"
            @input="update('brand_preference', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="field-group field-group--wide">
          <label class="field-label">Specs / configuration</label>
          <input
            :value="modelValue.specs"
            class="field-input"
            placeholder="e.g. 5-piece kit, 22″ kick, 100W head + 4×12 cab…"
            @input="update('specs', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="field-group field-group--wide">
          <label class="field-label">Notes</label>
          <input
            :value="modelValue.notes"
            class="field-input"
            placeholder="Any additional requirements…"
            @input="update('notes', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.backline-section { display: flex; flex-direction: column; gap: 0.75rem; }
.hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #141414; border: 1px solid #2a2a2a; border-radius: 0.375rem;
}
.needed-row { display: flex; }
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.toggle-input { accent-color: #888888; width: 1rem; height: 1rem; cursor: pointer; }
.toggle-text { font-size: 0.85rem; color: #475569; }
.toggle-text--on { color: #d0d0d0; font-weight: 600; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.field-group { display: flex; flex-direction: column; gap: 0.3rem; }
.field-group--wide { grid-column: 1 / -1; }
.field-label { font-size: 0.72rem; font-weight: 600; color: #7c8fa6; }
.field-input {
  display: block; width: 100%; padding: 0.45rem 0.65rem; border-radius: 0.4rem;
  border: 1px solid #2a2a2a; background: #0d0d0d; color: #e2e8f0;
  font-size: 0.8rem; outline: none; font-family: inherit; transition: border-color 150ms;
}
.field-input:focus { border-color: #5154e5; }
.field-input::placeholder { color: #1e2a40; }
.field-input option { background: #141414; }
</style>
