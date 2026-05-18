<script setup lang="ts">
import { computed } from 'vue'
import type { WirelessUnit } from '@/types/bandMemberSetup'
import { defaultWirelessUnit } from '@/types/bandMemberSetup'

const props = defineProps<{ modelValue: WirelessUnit[] }>()
const emit  = defineEmits<{ 'update:modelValue': [WirelessUnit[]] }>()

const units = computed(() => props.modelValue ?? [])

function addUnit() {
  emit('update:modelValue', [...units.value, defaultWirelessUnit()])
}

function removeUnit(index: number) {
  emit('update:modelValue', units.value.filter((_, i) => i !== index))
}

function updateUnit(index: number, patch: Partial<WirelessUnit>) {
  emit('update:modelValue', units.value.map((u, i) => i === index ? { ...u, ...patch } : u))
}

const TYPE_LABELS: Record<string, string> = {
  instrument: 'Instrument transmitter',
  vocal:      'Vocal / handheld wireless',
  iem:        'IEM pack (wireless monitor)',
  other:      'Other',
}
</script>

<template>
  <div class="wireless-section">
    <div class="section-intro">
      List any wireless systems this member uses on stage — transmitters, IEM packs, etc.
    </div>

    <div v-if="!units.length" class="no-units">
      No wireless units added. Click "+ Add unit" to start.
    </div>

    <div v-else class="units-list">
      <div v-for="(unit, idx) in units" :key="idx" class="unit-card">
        <div class="unit-header">
          <span class="unit-num">#{{ idx + 1 }}</span>
          <button type="button" class="btn-remove-unit" @click="removeUnit(idx)">✕ Remove</button>
        </div>

        <div class="unit-grid">
          <div class="field-group col-span-2">
            <label class="field-label">Type</label>
            <select :value="unit.type" class="field-input" @change="updateUnit(idx, { type: ($event.target as HTMLSelectElement).value as WirelessUnit['type'] })">
              <option v-for="(label, key) in TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label">Brand / Model</label>
            <input
              :value="unit.brand_model"
              class="field-input"
              placeholder="e.g. Shure ULXD2"
              @input="updateUnit(idx, { brand_model: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group">
            <label class="field-label">Frequency / Band</label>
            <input
              :value="unit.frequency_band"
              class="field-input"
              placeholder="e.g. H50 (534–598 MHz)"
              @input="updateUnit(idx, { frequency_band: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group col-span-2">
            <div class="own-unit-row">
              <span class="field-label mb-0">Own unit</span>
              <label class="toggle-label">
                <button
                  type="button"
                  class="toggle"
                  :class="{ 'toggle--on': unit.own_unit }"
                  @click="updateUnit(idx, { own_unit: !unit.own_unit })"
                  :aria-pressed="unit.own_unit"
                >
                  <span class="toggle-thumb" />
                </button>
                <span class="toggle-text" :style="unit.own_unit ? 'color:#818cf8;' : 'color:#94a3b8;'">
                  {{ unit.own_unit ? 'Member brings their own' : 'Needs to be provided by venue' }}
                </span>
              </label>
            </div>
          </div>

          <div class="field-group col-span-2">
            <label class="field-label">Notes <span class="field-opt">(optional)</span></label>
            <input
              :value="unit.notes"
              class="field-input"
              placeholder="Any special requirements, frequency coordination notes…"
              @input="updateUnit(idx, { notes: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>
      </div>
    </div>

    <button type="button" class="btn-add-unit" @click="addUnit">+ Add unit</button>
  </div>
</template>

<style scoped>
.wireless-section {
  display: flex; flex-direction: column; gap: 0.875rem;
}
.section-intro {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
}
.no-units {
  font-size: 0.8rem; color: #334155; text-align: center; padding: 1.5rem 0;
}
.units-list { display: flex; flex-direction: column; gap: 0.75rem; }
.unit-card {
  background: #0a0a1e; border: 1px solid #1e2040; border-radius: 0.5rem;
  padding: 0.875rem 1rem; display: flex; flex-direction: column; gap: 0.75rem;
}
.unit-header {
  display: flex; align-items: center; justify-content: space-between;
}
.unit-num {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: #a5b4fc;
}
.btn-remove-unit {
  font-size: 0.68rem; font-weight: 500; color: #f87171;
  background: transparent; border: 1px solid #7f1d1d; border-radius: 0.25rem;
  cursor: pointer; padding: 0.15rem 0.5rem; transition: background 100ms;
}
.btn-remove-unit:hover { background: #450a0a; }

.unit-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem;
}
.col-span-2 { grid-column: span 2; }
.field-group { display: flex; flex-direction: column; gap: 0.2rem; }
.field-label { font-size: 0.68rem; font-weight: 600; color: #7c8fa6; }
.field-opt   { color: #334155; font-weight: 400; }
.mb-0 { margin-bottom: 0; }
.field-input {
  display: block; width: 100%; padding: 0.4rem 0.6rem; border-radius: 0.4rem;
  border: 1px solid #1e2040; background: #070718; color: #e2e8f0;
  font-size: 0.8rem; outline: none; font-family: inherit; transition: border-color 150ms;
}
.field-input:focus { border-color: #5154e5; }
.field-input option { background: #0e0e26; }
select.field-input {
  appearance: none; -webkit-appearance: none; padding-right: 2rem; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234a5568' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.6rem center;
}

.own-unit-row { display: flex; align-items: center; gap: 0.875rem; }
.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.toggle {
  position: relative; width: 2.5rem; height: 1.375rem; border-radius: 9999px;
  border: none; cursor: pointer; background: #1e293b; transition: background 200ms;
}
.toggle--on { background: #1e1b4b; }
.toggle-thumb {
  position: absolute; top: 0.1875rem; left: 0.1875rem;
  width: 1rem; height: 1rem; border-radius: 9999px;
  background: #475569; transition: transform 200ms, background 200ms;
}
.toggle--on .toggle-thumb { transform: translateX(1.125rem); background: #818cf8; }
.toggle-text { font-size: 0.75rem; }

.btn-add-unit {
  align-self: flex-start;
  font-size: 0.75rem; font-weight: 600; color: #818cf8;
  background: transparent; border: 1px dashed #312e81; border-radius: 0.375rem;
  cursor: pointer; padding: 0.375rem 0.875rem; transition: background 100ms, border-color 100ms;
}
.btn-add-unit:hover { background: #12103a; border-color: #4338ca; }
</style>
