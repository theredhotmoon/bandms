<script setup lang="ts">
import type { InputRow, MicDiChoice } from '@/types/techRider'

interface Props { modelValue: InputRow[] }
const props = defineProps<Props>()
const emit  = defineEmits<{ 'update:modelValue': [value: InputRow[]] }>()

const MIC_DI_OPTIONS: MicDiChoice[] = ['Mic', 'DI', 'Mic+DI']
const STAND_OPTIONS = ['Short boom', 'Tall boom', 'Straight', 'Low tom', 'Desk', 'None', 'Other']

function uid() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function addRow() {
  const next = props.modelValue.length + 1
  emit('update:modelValue', [
    ...props.modelValue,
    { id: uid(), channel: next, instrument: '', mic_di: 'Mic', mic_model: '', stand_type: 'Tall boom', notes: '' },
  ])
}

function updateRow(id: string, field: keyof InputRow, value: unknown) {
  emit('update:modelValue', props.modelValue.map(r => r.id === id ? { ...r, [field]: value } : r))
}

function removeRow(id: string) {
  const filtered = props.modelValue.filter(r => r.id !== id)
  // Re-number channels
  emit('update:modelValue', filtered.map((r, i) => ({ ...r, channel: i + 1 })))
}

function moveRow(id: string, dir: -1 | 1) {
  const idx = props.modelValue.findIndex(r => r.id === id)
  if (idx < 0) return
  if (dir === -1 && idx === 0) return
  if (dir === 1  && idx === props.modelValue.length - 1) return
  const rows = [...props.modelValue]
  ;[rows[idx], rows[idx + dir]] = [rows[idx + dir], rows[idx]]
  emit('update:modelValue', rows.map((r, i) => ({ ...r, channel: i + 1 })))
}
</script>

<template>
  <div class="inputs-section">
    <div class="section-hint">
      One row per microphone or DI channel. Channel numbers must match your stage plot labels.
    </div>

    <div class="table-scroll">
      <table class="inputs-table">
        <thead>
          <tr>
            <th class="col-ch">#</th>
            <th class="col-instr">Instrument / Source</th>
            <th class="col-micdi">Mic / DI</th>
            <th class="col-model">Model</th>
            <th class="col-stand">Stand</th>
            <th class="col-notes">Notes</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="modelValue.length === 0">
            <td colspan="7" class="empty-row">No inputs yet — click "Add row" to start.</td>
          </tr>
          <tr v-for="row in modelValue" :key="row.id" class="data-row">
            <td class="col-ch">
              <div class="ch-cell">
                <span class="ch-num">{{ row.channel }}</span>
                <div class="move-btns">
                  <button type="button" class="move-btn" title="Move up"   @click="moveRow(row.id, -1)">▲</button>
                  <button type="button" class="move-btn" title="Move down" @click="moveRow(row.id,  1)">▼</button>
                </div>
              </div>
            </td>
            <td class="col-instr">
              <input
                :value="row.instrument"
                class="cell-input"
                placeholder="e.g. Kick drum (in)"
                @input="updateRow(row.id, 'instrument', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-micdi">
              <select
                :value="row.mic_di"
                class="cell-select"
                @change="updateRow(row.id, 'mic_di', ($event.target as HTMLSelectElement).value as MicDiChoice)"
              >
                <option v-for="opt in MIC_DI_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </td>
            <td class="col-model">
              <input
                :value="row.mic_model"
                class="cell-input"
                placeholder="e.g. SM57"
                @input="updateRow(row.id, 'mic_model', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-stand">
              <select
                :value="row.stand_type"
                class="cell-select"
                @change="updateRow(row.id, 'stand_type', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="opt in STAND_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </td>
            <td class="col-notes">
              <input
                :value="row.notes"
                class="cell-input"
                placeholder="Optional notes…"
                @input="updateRow(row.id, 'notes', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-actions">
              <button type="button" class="del-btn" title="Remove row" @click="removeRow(row.id)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="table-footer">
      <button type="button" class="btn-add-row" @click="addRow">+ Add row</button>
      <span class="row-count">{{ modelValue.length }} channel{{ modelValue.length === 1 ? '' : 's' }}</span>
    </div>
  </div>
</template>

<style scoped>
.inputs-section { display: flex; flex-direction: column; gap: 0.75rem; }
.section-hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #141414; border: 1px solid #2a2a2a; border-radius: 0.375rem;
}
.table-scroll { overflow-x: auto; border-radius: 0.5rem; border: 1px solid #2a2a2a; }
.inputs-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.inputs-table thead th {
  background: #070718; color: #475569; font-weight: 600; font-size: 0.7rem; text-transform: uppercase;
  letter-spacing: .05em; padding: 0.5rem 0.625rem; text-align: left; border-bottom: 1px solid #2a2a2a;
  white-space: nowrap;
}
.data-row { border-bottom: 1px solid #0f0f28; }
.data-row:last-child { border-bottom: none; }
.data-row td { padding: 0.35rem 0.5rem; vertical-align: middle; background: #111111; }
.data-row:hover td { background: #0d0d28; }

.col-ch      { width: 3.5rem; }
.col-instr   { min-width: 11rem; }
.col-micdi   { width: 7rem; }
.col-model   { min-width: 8rem; }
.col-stand   { width: 9rem; }
.col-notes   { min-width: 11rem; }
.col-actions { width: 2.5rem; }

.ch-cell { display: flex; align-items: center; gap: 0.3rem; }
.ch-num { font-weight: 700; color: #c0c0c0; min-width: 1.4rem; text-align: center; }
.move-btns { display: flex; flex-direction: column; }
.move-btn {
  background: none; border: none; cursor: pointer; color: #334155; font-size: 0.55rem; padding: 0;
  line-height: 1; transition: color 100ms;
}
.move-btn:hover { color: #c0c0c0; }

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
.btn-add-row {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: #141414; border: 1px solid #2a2a2a; color: #c0c0c0;
  transition: background 100ms, border-color 100ms;
}
.btn-add-row:hover { background: #12123a; border-color: #444444; }
.row-count { font-size: 0.7rem; color: #334155; }
</style>
