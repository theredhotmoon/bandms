<script setup lang="ts">
import { computed } from 'vue'
import type { WirelessSpec, WirelessType } from '@/types/rig'
import { defaultWirelessSpec } from '@/types/rig'

interface Props { modelValue: WirelessSpec[] }
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: WirelessSpec[]] }>()

const TYPE_LABELS: Record<WirelessType, string> = {
  instrument: 'Instrument transmitter',
  vocal: 'Vocal / handheld wireless',
  iem: 'IEM pack (wireless monitor)',
  other: 'Other',
}

const units = computed(() => props.modelValue ?? [])

function add() {
  emit('update:modelValue', [...units.value, defaultWirelessSpec()])
}

function remove(id: string) {
  emit('update:modelValue', units.value.filter((u) => u.id !== id))
}

function patch(id: string, changes: Partial<WirelessSpec>) {
  emit('update:modelValue', units.value.map((u) => (u.id === id ? { ...u, ...changes } : u)))
}
</script>

<template>
  <div class="rig-section">
    <div class="rig-hint">
      Wireless systems used at this position — transmitters and IEM packs.
      Frequencies are collected into the rider's RF coordination list.
    </div>

    <div v-if="!units.length" class="item-empty">
      No wireless units.
    </div>

    <div v-else class="item-list">
      <div v-for="(unit, idx) in units" :key="unit.id" class="item-card">
        <div class="item-header">
          <span class="item-title">#{{ idx + 1 }} — {{ TYPE_LABELS[unit.type] }}</span>
          <button type="button" class="btn-remove" @click="remove(unit.id)">✕ Remove</button>
        </div>

        <div class="form-grid">
          <div class="field-group">
            <label class="field-label">Type</label>
            <select
              :value="unit.type"
              class="field-input"
              @change="patch(unit.id, { type: ($event.target as HTMLSelectElement).value as WirelessType })"
            >
              <option v-for="(label, key) in TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label">Brand / model</label>
            <input
              :value="unit.brand_model"
              class="field-input"
              placeholder="e.g. Shure GLXD16"
              @input="patch(unit.id, { brand_model: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group">
            <label class="field-label">Frequency band</label>
            <input
              :value="unit.frequency_band"
              class="field-input"
              placeholder="e.g. 2.4 GHz, 606–630 MHz"
              @input="patch(unit.id, { frequency_band: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group">
            <label class="field-label">Ownership</label>
            <label class="toggle-label">
              <input
                type="checkbox"
                :checked="unit.own_unit"
                class="toggle-input"
                @change="patch(unit.id, { own_unit: ($event.target as HTMLInputElement).checked })"
              />
              <span class="toggle-text">
                {{ unit.own_unit ? 'Own unit' : 'Venue must provide' }}
              </span>
            </label>
          </div>

          <div class="field-group field-group--wide">
            <label class="field-label">Notes</label>
            <input
              :value="unit.notes"
              class="field-input"
              placeholder="Anything the RF coordinator should know…"
              @input="patch(unit.id, { notes: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>
      </div>
    </div>

    <button type="button" class="btn-add" @click="add">+ Add wireless unit</button>
  </div>
</template>

<style scoped src="./rig-form.css" />
