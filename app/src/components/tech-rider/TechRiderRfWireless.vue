<script setup lang="ts">
import type { RfWirelessUnit } from '@/types/techRider'

interface Props { modelValue: RfWirelessUnit[] }
const props = defineProps<Props>()
const emit  = defineEmits<{ 'update:modelValue': [value: RfWirelessUnit[]] }>()

const RF_TYPES = ['Vocal mic', 'Instrument mic', 'IEM pack', 'Guitar/Bass bodypack', 'Other']

function uid() {
  return `rf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function addUnit() {
  emit('update:modelValue', [
    ...props.modelValue,
    { id: uid(), model: '', type: 'Vocal mic', frequency_band: '', programmed_frequency: '', notes: '' },
  ])
}

function update(id: string, field: keyof RfWirelessUnit, value: unknown) {
  emit('update:modelValue', props.modelValue.map(u => u.id === id ? { ...u, [field]: value } : u))
}

function remove(id: string) {
  emit('update:modelValue', props.modelValue.filter(u => u.id !== id))
}
</script>

<template>
  <div class="rf-section">
    <div class="section-hint">
      List every wireless unit you travel with. This information is essential for RF coordination at the venue to avoid interference.
    </div>

    <div class="table-scroll">
      <table class="rf-table">
        <thead>
          <tr>
            <th class="col-model">Model</th>
            <th class="col-type">Type</th>
            <th class="col-band">Freq. band</th>
            <th class="col-freq">Programmed freq.</th>
            <th class="col-notes">Notes</th>
            <th class="col-del"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="modelValue.length === 0">
            <td colspan="6" class="empty-row">No wireless units yet.</td>
          </tr>
          <tr v-for="unit in modelValue" :key="unit.id" class="data-row">
            <td class="col-model">
              <input
                :value="unit.model"
                class="cell-input"
                placeholder="e.g. Shure ULXD2"
                @input="update(unit.id, 'model', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-type">
              <select
                :value="unit.type"
                class="cell-select"
                @change="update(unit.id, 'type', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="t in RF_TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
            </td>
            <td class="col-band">
              <input
                :value="unit.frequency_band"
                class="cell-input"
                placeholder="e.g. G50 (470–534 MHz)"
                @input="update(unit.id, 'frequency_band', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-freq">
              <input
                :value="unit.programmed_frequency"
                class="cell-input"
                placeholder="e.g. 518.175 MHz"
                @input="update(unit.id, 'programmed_frequency', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-notes">
              <input
                :value="unit.notes"
                class="cell-input"
                placeholder="Optional…"
                @input="update(unit.id, 'notes', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-del">
              <button type="button" class="del-btn" @click="remove(unit.id)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="table-footer">
      <button type="button" class="btn-add" @click="addUnit">+ Add wireless unit</button>
      <span class="unit-count">{{ modelValue.length }} unit{{ modelValue.length === 1 ? '' : 's' }}</span>
    </div>
  </div>
</template>

<style scoped>
.rf-section { display: flex; flex-direction: column; gap: 0.75rem; }
.section-hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #141414; border: 1px solid #2a2a2a; border-radius: 0.375rem;
}
.table-scroll { overflow-x: auto; border-radius: 0.5rem; border: 1px solid #2a2a2a; }
.rf-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.rf-table thead th {
  background: #070718; color: #475569; font-weight: 600; font-size: 0.7rem;
  text-transform: uppercase; letter-spacing: .05em;
  padding: 0.5rem 0.625rem; text-align: left; border-bottom: 1px solid #2a2a2a;
  white-space: nowrap;
}
.data-row { border-bottom: 1px solid #0f0f28; }
.data-row:last-child { border-bottom: none; }
.data-row td { padding: 0.35rem 0.5rem; vertical-align: middle; background: #111111; }
.data-row:hover td { background: #0d0d28; }

.col-model { min-width: 10rem; }
.col-type  { width: 9rem; }
.col-band  { min-width: 11rem; }
.col-freq  { min-width: 9rem; }
.col-notes { min-width: 10rem; }
.col-del   { width: 2.5rem; }

.cell-input {
  width: 100%; background: transparent; border: none; outline: none;
  color: #e2e8f0; font-size: 0.8rem; font-family: inherit;
  border-bottom: 1px solid transparent; padding: 0.1rem 0.25rem;
  transition: border-color 120ms;
}
.cell-input:focus { border-bottom-color: #888888; }
.cell-input::placeholder { color: #1e2a40; }

.cell-select {
  width: 100%; background: #111111; border: none; outline: none;
  color: #e2e8f0; font-size: 0.8rem; font-family: inherit; cursor: pointer;
  border-bottom: 1px solid transparent; padding: 0.1rem 0.1rem; appearance: none;
  transition: border-color 120ms;
}
.cell-select:focus { border-bottom-color: #888888; }
.cell-select option { background: #141414; }

.del-btn {
  background: none; border: none; cursor: pointer; color: #3d1a1a; font-size: 0.75rem;
  transition: color 120ms; padding: 0.2rem 0.4rem;
}
.del-btn:hover { color: #f87171; }

.empty-row { text-align: center; color: #334155; font-size: 0.8rem; padding: 1.5rem; }
.table-footer { display: flex; align-items: center; justify-content: space-between; }
.btn-add {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: #141414; border: 1px solid #2a2a2a; color: #c0c0c0;
  transition: background 100ms, border-color 100ms;
}
.btn-add:hover { background: #12123a; border-color: #444444; }
.unit-count { font-size: 0.7rem; color: #334155; }
</style>
