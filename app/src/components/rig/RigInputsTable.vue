<script setup lang="ts">
import { computed } from 'vue'
import type { InputRow, MicDiChoice } from '@bandms/rider-core'
import { defaultInputRow } from '@bandms/rider-core'
import { unnamedChannels } from '@/utils/rigValidation'

interface Props {
  modelValue: InputRow[]
  /** Which catalogue noun to use for the empty state and the row counter. */
  noun?: 'channel' | 'extraChannel'
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

const MIC_DI_OPTIONS: { value: MicDiChoice; key: string }[] = [
  { value: 'Mic', key: 'mic' }, // i18n-ignore: persisted value
  { value: 'DI', key: 'di' }, // i18n-ignore: persisted value
  { value: 'Mic+DI', key: 'micDi' }, // i18n-ignore: persisted value
]
const STAND_OPTIONS: { value: string; key: string }[] = [
  { value: 'Short boom', key: 'shortBoom' }, // i18n-ignore: persisted value
  { value: 'Tall boom', key: 'tallBoom' }, // i18n-ignore: persisted value
  { value: 'Straight', key: 'straight' }, // i18n-ignore: persisted value
  { value: 'Low tom', key: 'lowTom' }, // i18n-ignore: persisted value
  { value: 'Desk', key: 'desk' }, // i18n-ignore: persisted value
  { value: 'None', key: 'none' }, // i18n-ignore: persisted value
  { value: 'Other', key: 'other' }, // i18n-ignore: persisted value
]

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
            <th class="col-instr">{{ $t('rider.rig.inputs.instrument') }}</th>
            <th class="col-micdi">{{ $t('rider.rig.inputs.micDi') }}</th>
            <th class="col-model">{{ $t('rider.rig.inputs.model') }}</th>
            <th class="col-stand">{{ $t('rider.rig.inputs.stand') }}</th>
            <th class="col-notes">{{ $t('rider.rig.inputs.notes') }}</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="modelValue.length === 0">
            <td colspan="7" class="empty-row">{{ $t(`rider.rig.inputs.empty.${noun}`) }}</td>
          </tr>
          <tr v-for="(row, idx) in modelValue" :key="row.id" class="data-row">
            <td class="col-ch">
              <div class="ch-cell">
                <span class="ch-num">{{ idx + 1 }}</span>
                <div class="move-btns">
                  <button type="button" class="move-btn" :title="$t('rider.rig.inputs.moveUp')" @click="moveRow(row.id, -1)">▲</button>
                  <button type="button" class="move-btn" :title="$t('rider.rig.inputs.moveDown')" @click="moveRow(row.id, 1)">▼</button>
                </div>
              </div>
            </td>
            <td class="col-instr">
              <input
                :value="row.instrument"
                class="cell-input"
                :class="{ 'cell-input--invalid': isUnnamed(row) }"
                :aria-invalid="isUnnamed(row)"
                :placeholder="$t('rider.rig.inputs.instrumentPlaceholder')"
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
                <option v-for="opt in MIC_DI_OPTIONS" :key="opt.value" :value="opt.value">{{ $t(`rider.rig.inputs.micDiOptions.${opt.key}`) }}</option>
              </select>
            </td>
            <td class="col-model">
              <input
                :value="row.mic_model"
                class="cell-input"
                :placeholder="$t('rider.rig.inputs.modelPlaceholder')"
                @input="updateRow(row.id, 'mic_model', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-stand">
              <select
                :value="row.stand_type"
                class="cell-select"
                @change="updateRow(row.id, 'stand_type', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="opt in STAND_OPTIONS" :key="opt.value" :value="opt.value">{{ $t(`rider.rig.inputs.standOptions.${opt.key}`) }}</option>
              </select>
            </td>
            <td class="col-notes">
              <input
                :value="row.notes"
                class="cell-input"
                :placeholder="$t('rider.rig.inputs.notesPlaceholder')"
                @input="updateRow(row.id, 'notes', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-actions">
              <button type="button" class="del-btn" :title="$t('rider.rig.inputs.removeRow')" @click="removeRow(row.id)">✕</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="table-footer">
      <button type="button" class="btn-add-row" @click="addRow">{{ $t('rider.rig.inputs.addRow') }}</button>
      <span class="row-count">{{ $t(`rider.rig.inputs.count.${noun}`, modelValue.length, { named: { n: modelValue.length } }) }}</span>
      <span v-if="unnamedCount" class="needs-name" role="status">
        {{ $t('rider.rig.inputs.needsName', unnamedCount, { named: { n: unnamedCount } }) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.inputs-section { display: flex; flex-direction: column; gap: 0.75rem; }

.cell-input--invalid {
  border-color: var(--c-991b1b) !important;
  background: var(--c-1c0a0a) !important;
}
.needs-name { font-size: var(--fs-2xs); color: var(--c-f87171); }
.table-scroll { overflow-x: auto; border-radius: 0.5rem; border: 1px solid var(--c-2a2a2a); }
.inputs-table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.inputs-table thead th {
  background: var(--c-070718); color: var(--c-475569); font-weight: 600; font-size: var(--fs-2xs); text-transform: uppercase;
  letter-spacing: .05em; padding: 0.5rem 0.625rem; text-align: left; border-bottom: 1px solid var(--c-2a2a2a);
  white-space: nowrap;
}
.data-row { border-bottom: 1px solid var(--c-0f0f28); }
.data-row:last-child { border-bottom: none; }
.data-row td { padding: 0.35rem 0.5rem; vertical-align: middle; background: var(--c-111111); }
.data-row:hover td { background: var(--c-0d0d28); }

.col-ch      { width: 3.5rem; }
.col-instr   { min-width: 11rem; }
.col-micdi   { width: 7rem; }
.col-model   { min-width: 8rem; }
.col-stand   { width: 9rem; }
.col-notes   { min-width: 11rem; }
.col-actions { width: 2.5rem; }

.ch-cell { display: flex; align-items: center; gap: 0.3rem; }
.ch-num { font-weight: 700; color: var(--c-c0c0c0); min-width: 1.4rem; text-align: center; }
.move-btns { display: flex; flex-direction: column; }
.move-btn {
  background: none; border: none; cursor: pointer; color: var(--c-334155); font-size: var(--fs-2xs); padding: 0;
  line-height: 1; transition: color 100ms;
}
.move-btn:hover { color: var(--c-c0c0c0); }

.cell-input {
  width: 100%; background: transparent; border: none; outline: none;
  color: var(--c-e2e8f0); font-size: var(--fs-sm); font-family: inherit;
  border-bottom: 1px solid transparent; padding: 0.1rem 0.25rem;
  transition: border-color 120ms;
}
.cell-input:focus { border-bottom-color: var(--c-888888-line); }
.cell-input::placeholder { color: var(--c-475569); }

.cell-select {
  width: 100%; background: var(--c-111111); border: none; outline: none;
  color: var(--c-e2e8f0); font-size: var(--fs-sm); font-family: inherit; cursor: pointer;
  border-bottom: 1px solid transparent; padding: 0.1rem 0.1rem; appearance: none;
  transition: border-color 120ms;
}
.cell-select:focus { border-bottom-color: var(--c-888888-line); }
.cell-select option { background: var(--c-141414); }

.del-btn {
  background: none; border: none; cursor: pointer; color: var(--c-475569); font-size: var(--fs-xs);
  transition: color 120ms; padding: 0.2rem 0.4rem;
}
.del-btn:hover { color: var(--c-f87171); }

.empty-row { text-align: center; color: var(--c-334155); font-size: var(--fs-sm); padding: 1.5rem; }

.table-footer { display: flex; align-items: center; justify-content: space-between; }
.btn-add-row {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: var(--fs-xs); font-weight: 600;
  cursor: pointer; background: var(--c-141414); border: 1px solid var(--c-2a2a2a); color: var(--c-c0c0c0);
  transition: background 100ms, border-color 100ms;
}
.btn-add-row:hover { background: var(--c-1a1a1a); border-color: var(--c-444444); }
.row-count { font-size: var(--fs-2xs); color: var(--c-334155); }
</style>
