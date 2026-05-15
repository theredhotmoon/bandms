<script setup lang="ts">
import type { PowerRequirements, PowerPosition } from '@/types/techRider'

interface Props { modelValue: PowerRequirements }
const props = defineProps<Props>()
const emit  = defineEmits<{ 'update:modelValue': [value: PowerRequirements] }>()

function uid() {
  return `pwr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function updateField(field: keyof PowerRequirements, value: unknown) {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

function addPosition() {
  emit('update:modelValue', {
    ...props.modelValue,
    positions: [
      ...props.modelValue.positions,
      { id: uid(), location: '', outlets_needed: 4, notes: '' },
    ],
  })
}

function updatePosition(id: string, field: keyof PowerPosition, value: unknown) {
  emit('update:modelValue', {
    ...props.modelValue,
    positions: props.modelValue.positions.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ),
  })
}

function removePosition(id: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    positions: props.modelValue.positions.filter(p => p.id !== id),
  })
}
</script>

<template>
  <div class="power-section">
    <div class="section-hint">
      List power requirements per stage position. Note if clean/isolated power is needed to avoid hum from lighting dimmers.
    </div>

    <div class="form-row">
      <div class="field-group">
        <label class="field-label">Total wattage (approx.)</label>
        <input
          :value="modelValue.total_wattage ?? ''"
          type="number"
          min="0"
          class="field-input"
          placeholder="e.g. 3500"
          @input="updateField('total_wattage', ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null)"
        />
      </div>
      <div class="field-group">
        <label class="field-label">Clean / isolated power required?</label>
        <label class="toggle-label">
          <input
            type="checkbox"
            :checked="modelValue.needs_clean_power"
            class="toggle-input"
            @change="updateField('needs_clean_power', ($event.target as HTMLInputElement).checked)"
          />
          <span class="toggle-text">{{ modelValue.needs_clean_power ? 'Yes — isolated circuits needed' : 'No — standard outlets OK' }}</span>
        </label>
        <p v-if="modelValue.needs_clean_power" class="field-hint">Required to avoid hum from lighting dimmers.</p>
      </div>
    </div>

    <div class="field-group">
      <label class="field-label">General power notes</label>
      <textarea
        :value="modelValue.general_notes"
        class="field-input"
        rows="2"
        placeholder="e.g. All stage power should be on dedicated circuits, away from dimmer packs."
        @input="updateField('general_notes', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <div class="positions-section">
      <div class="positions-header">
        <span class="positions-title">Stage positions</span>
        <button type="button" class="btn-add" @click="addPosition">+ Add position</button>
      </div>

      <div v-if="modelValue.positions.length === 0" class="empty-state">No stage positions defined.</div>

      <div v-for="pos in modelValue.positions" :key="pos.id" class="pos-row">
        <div class="field-group">
          <label class="field-label">Location</label>
          <input
            :value="pos.location"
            class="field-input"
            placeholder="e.g. Drum riser, Stage left, Stage right"
            @input="updatePosition(pos.id, 'location', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field-group outlets-group">
          <label class="field-label">Outlets needed</label>
          <input
            :value="pos.outlets_needed"
            type="number"
            min="1"
            class="field-input"
            @input="updatePosition(pos.id, 'outlets_needed', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="field-group">
          <label class="field-label">Notes</label>
          <input
            :value="pos.notes"
            class="field-input"
            placeholder="Optional notes…"
            @input="updatePosition(pos.id, 'notes', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <button type="button" class="del-btn" title="Remove" @click="removePosition(pos.id)">✕</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.power-section { display: flex; flex-direction: column; gap: 0.75rem; }
.section-hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.375rem;
}
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.field-group { display: flex; flex-direction: column; gap: 0.3rem; }
.field-label { font-size: 0.75rem; font-weight: 600; color: #7c8fa6; }
.field-hint  { font-size: 0.7rem; color: #334155; margin-top: 0.15rem; }
.field-input {
  display: block; width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem;
  border: 1px solid #1e2040; background: #0e0e26; color: #e2e8f0;
  font-size: 0.875rem; outline: none; font-family: inherit;
  transition: border-color 150ms; resize: vertical;
}
.field-input:focus { border-color: #5154e5; }
.field-input::placeholder { color: #2a3050; }
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.toggle-input { accent-color: #4338ca; width: 1rem; height: 1rem; cursor: pointer; }
.toggle-text  { font-size: 0.8rem; color: #94a3b8; }

.positions-section { display: flex; flex-direction: column; gap: 0.5rem; }
.positions-header { display: flex; align-items: center; justify-content: space-between; }
.positions-title  { font-size: 0.75rem; font-weight: 600; color: #7c8fa6; }
.empty-state { text-align: center; color: #334155; font-size: 0.8rem; padding: 1rem 0; }

.pos-row {
  display: grid; grid-template-columns: 1fr 6rem 1fr auto; gap: 0.5rem;
  align-items: end; background: #0a0a1e; border: 1px solid #1e2040;
  border-radius: 0.4rem; padding: 0.625rem;
}
.outlets-group { min-width: 0; }
.del-btn {
  background: none; border: none; cursor: pointer; color: #3d1a1a; font-size: 0.75rem;
  transition: color 120ms; padding: 0.4rem 0.35rem; align-self: center;
}
.del-btn:hover { color: #f87171; }

.btn-add {
  padding: 0.3rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; background: #0e0e26; border: 1px solid #1e2040; color: #818cf8;
  transition: background 100ms, border-color 100ms;
}
.btn-add:hover { background: #12123a; border-color: #312e81; }
</style>
