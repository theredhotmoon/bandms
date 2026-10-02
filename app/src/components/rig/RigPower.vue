<script setup lang="ts">
import type { PowerSpec } from '@bandms/rider-core'

interface Props { modelValue: PowerSpec }
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: PowerSpec] }>()

function patch(changes: Partial<PowerSpec>) {
  emit('update:modelValue', { ...props.modelValue, ...changes })
}
</script>

<template>
  <div class="rig-section">
    <div class="rig-hint">{{ $t('rider.rig.power.hint') }}</div>

    <div class="power-row">
      <div class="field-group">
        <label class="field-label">{{ $t('rider.rig.power.outlets') }}</label>
        <div class="outlets-row">
          <button
            type="button"
            class="outlets-btn"
            :disabled="modelValue.outlets_needed <= 0"
            @click="patch({ outlets_needed: Math.max(0, modelValue.outlets_needed - 1) })"
          >−</button>
          <span class="outlets-count">{{ modelValue.outlets_needed }}</span>
          <button
            type="button"
            class="outlets-btn"
            @click="patch({ outlets_needed: modelValue.outlets_needed + 1 })"
          >+</button>
        </div>
      </div>

      <div class="field-group">
        <label class="field-label">{{ $t('rider.rig.power.notes') }}</label>
        <input
          :value="modelValue.notes"
          class="field-input"
          :placeholder="$t('rider.rig.power.notesPlaceholder')"
          @input="patch({ notes: ($event.target as HTMLInputElement).value })"
        />
      </div>
    </div>
  </div>
</template>

<style scoped src="./rig-form.css" />
<style scoped>
.power-row { display: grid; grid-template-columns: auto 1fr; gap: 1.25rem; align-items: start; }
.outlets-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.15rem; }
.outlets-count {
  font-size: 1.5rem; font-weight: 800; color: var(--c-d0d0d0);
  min-width: 2.5rem; text-align: center;
}
.outlets-btn {
  width: 2rem; height: 2rem; border-radius: 0.375rem; border: 1px solid var(--c-2a2a2a);
  background: var(--c-141414); color: var(--c-c0c0c0); font-size: var(--fs-xl); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 100ms, border-color 100ms;
}
.outlets-btn:hover:not(:disabled) { background: var(--c-1a1a1a); border-color: var(--c-444444); }
.outlets-btn:disabled { opacity: 0.3; cursor: default; }
</style>
