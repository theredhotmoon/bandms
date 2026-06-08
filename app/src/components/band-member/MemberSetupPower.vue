<script setup lang="ts">
import type { MemberPowerPrefs } from '@/types/bandMemberSetup'

interface Props { modelValue: MemberPowerPrefs }
const props = defineProps<Props>()
const emit  = defineEmits<{ 'update:modelValue': [value: MemberPowerPrefs] }>()

function update(field: keyof MemberPowerPrefs, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div class="power-section">
    <div class="hint">
      How many 220V outlets do you need at your stage position?
      This feeds into the Power section of the tech rider.
    </div>

    <div class="form-row">
      <div class="field-group outlets-group">
        <label class="field-label">Outlets needed (220V)</label>
        <div class="outlets-input-row">
          <button
            type="button"
            class="outlets-btn"
            :disabled="modelValue.outlets_needed <= 1"
            @click="update('outlets_needed', Math.max(1, modelValue.outlets_needed - 1))"
          >−</button>
          <span class="outlets-count">{{ modelValue.outlets_needed }}</span>
          <button
            type="button"
            class="outlets-btn"
            @click="update('outlets_needed', modelValue.outlets_needed + 1)"
          >+</button>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label">Notes</label>
        <input
          :value="modelValue.notes"
          class="field-input"
          placeholder="e.g. clean/isolated power required, separate circuit from lights"
          @input="update('notes', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.power-section { display: flex; flex-direction: column; gap: 0.75rem; }
.hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #141414; border: 1px solid #2a2a2a; border-radius: 0.375rem;
}
.form-row { display: grid; grid-template-columns: auto 1fr; gap: 1.25rem; align-items: start; }
.field-group { display: flex; flex-direction: column; gap: 0.3rem; }
.field-label { font-size: 0.72rem; font-weight: 600; color: #7c8fa6; }

.outlets-input-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.15rem; }
.outlets-count {
  font-size: 1.5rem; font-weight: 800; color: #d0d0d0;
  min-width: 2.5rem; text-align: center;
}
.outlets-btn {
  width: 2rem; height: 2rem; border-radius: 0.375rem; border: 1px solid #2a2a2a;
  background: #141414; color: #c0c0c0; font-size: 1.2rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 100ms, border-color 100ms;
}
.outlets-btn:hover:not(:disabled) { background: #12123a; border-color: #444444; }
.outlets-btn:disabled { opacity: 0.3; cursor: default; }

.field-input {
  display: block; width: 100%; padding: 0.45rem 0.65rem; border-radius: 0.4rem;
  border: 1px solid #2a2a2a; background: #0d0d0d; color: #e2e8f0;
  font-size: 0.8rem; outline: none; font-family: inherit; transition: border-color 150ms;
}
.field-input:focus { border-color: #5154e5; }
.field-input::placeholder { color: #1e2a40; }
</style>
