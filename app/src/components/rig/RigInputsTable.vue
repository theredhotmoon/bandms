<script setup lang="ts">
import { computed } from 'vue'
import type { InputRow, MicDiChoice } from '@bandms/rider-core'
import { defaultInputRow } from '@bandms/rider-core'
import { unnamedChannels } from '@/utils/rigValidation'

interface Props {
  modelValue: InputRow[]
  /** Optional label for the empty state, e.g. "extra channel". */
  noun?: string
}
const props = withDefaults(defineProps<Props>(), { noun: 'channel' })
const emit = defineEmits<{ 'update:modelValue': [value: InputRow[]] }>()

/**
 * A new row starts nameless — only the user can say what the channel is — and
 * the server requires a name. Marking it here means the gap is visible where it
 * is created, instead of surfacing later as a refused save on another tab.
 */
const unnamedCount = computed(() => unnamedChannels(props.modelValue).length)

function isUnnamed(row: InputRow): boolean {
  return row.instrument.trim() === ''
}

const MIC_DI_OPTIONS: MicDiChoice[] = ['Mic', 'DI', 'Mic+DI']
const STAND_OPTIONS = ['Short boom', 'Tall boom', 'Straight', 'Low tom', 'Desk', 'None', 'Other']

function addRow() {
  emit('update:modelValue', [...props.modelValue, defaultInputRow()])
}

function updateRow(id: string, field: keyof InputRow, value: unknown) {
  emit('update:modelValue', props.modelValue.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
}

function removeRow(id: string) {
  emit('update:modelValue', props.modelValue.filter((r) => r.id !== id))
}

// Order within a rig matters (kick before snare); the rider's overall channel
// numbering is applied later, across every musician.
function moveRow(id: string, dir: -1 | 1) {
  const idx = props.modelValue.findIndex((r) => r.id === id)
  if (idx < 0) return
  if (dir === -1 && idx === 0) return
  if (dir === 1 && idx === props.modelValue.length - 1) return
  const rows = [...props.modelValue]
  ;[rows[idx], rows[idx + dir]] = [rows[idx + dir], rows[idx]]
  emit('update:modelValue', rows)
}
</script>

<template>
  <div class="inputs-section">
    <div class="table-scroll">
      <table class="inputs-table">
        <thead>
          <tr>
            <th class="col-ch">#</th>
            <th class="col-instr">Instrument / source</th>
            <th class="col-micdi">Mic / DI</th>
            <th class="col-model">Model</th>
            <th class="col-stand">Stand</th>
            <th class="col-notes">Notes</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="modelValue.length === 0">
            <td colspan="7" class="empty-row">No {{ noun }}s yet — click "Add row" to start.</td>
          </tr>
          <tr v-for="(row, idx) in modelValue" :key="row.id" class="data-row">
            <td class="col-ch">
              <div class="ch-cell">
                <span class="ch-num">{{ idx + 1 }}</span>
                <div class="move-btns">
                  <button type="button" class="move-btn" title="Move up" @click="moveRow(row.id, -1)">▲</button>
                  <button type="button" class="move-btn" title="Move down" @click="moveRow(row.id, 1)">▼</button>
                </div>
              </div>
            </td>
            <td class="col-instr">
              <input
                :value="row.instrument"
                class="cell-input"
                :class="{ 'cell-input--invalid': isUnnamed(row) }"
                :aria-invalid="isUnnamed(row)"
                placeholder="e.g. Kick drum (in)"
                required
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
      <span class="row-count">{{ modelValue.length }} {{ noun }}{{ modelValue.length === 1 ? '' : 's' }}</span>
      <span v-if="unnamedCount" class="needs-name" role="status">
        {{ unnamedCount }} {{ unnamedCount === 1 ? 'row needs' : 'rows need' }} an instrument name
        before this can be saved
      </span>
    </div>
  </div>
</template>

<style scoped>
.inputs-section { display: flex; flex-direction: column; gap: 0.75rem; }

.cell-input--invalid {
  border-color: #991b1b !important;
  background: #1c0a0a !important;
}
.needs-name { font-size: 0.7rem; color: #f87171; }
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
.btn-add-row:hover { background: #1a1a1a; border-color: #444444; }
.row-count { font-size: 0.7rem; color: #334155; }
</style>
