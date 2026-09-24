<script setup lang="ts">
import { computed } from 'vue'
import type { WirelessSpec, WirelessType } from '@bandms/rider-core'
import { defaultWirelessSpec } from '@bandms/rider-core'

interface Props { modelValue: WirelessSpec[] }
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: WirelessSpec[]] }>()

const TYPES: WirelessType[] = ['instrument', 'vocal', 'iem', 'other']

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
    <div class="rig-hint">{{ $t('rider.rig.wireless.hint') }}</div>

    <div v-if="!units.length" class="item-empty">
      {{ $t('rider.rig.wireless.empty') }}
    </div>

    <div v-else class="item-list">
      <div v-for="(unit, idx) in units" :key="unit.id" class="item-card">
        <div class="item-header">
          <span class="item-title">#{{ idx + 1 }} — {{ $t(`rider.rig.wireless.types.${unit.type}`) }}</span>
          <button type="button" class="btn-remove" @click="remove(unit.id)">{{ $t('rider.rig.wireless.remove') }}</button>
        </div>

        <div class="form-grid">
          <div class="field-group">
            <label class="field-label">{{ $t('rider.rig.wireless.type') }}</label>
            <select
              :value="unit.type"
              class="field-input"
              @change="patch(unit.id, { type: ($event.target as HTMLSelectElement).value as WirelessType })"
            >
              <option v-for="key in TYPES" :key="key" :value="key">{{ $t(`rider.rig.wireless.types.${key}`) }}</option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label">{{ $t('rider.rig.wireless.brand') }}</label>
            <input
              :value="unit.brand_model"
              class="field-input"
              :placeholder="$t('rider.rig.wireless.brandPlaceholder')"
              @input="patch(unit.id, { brand_model: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group">
            <label class="field-label">{{ $t('rider.rig.wireless.band') }}</label>
            <input
              :value="unit.frequency_band"
              class="field-input"
              :placeholder="$t('rider.rig.wireless.bandPlaceholder')"
              @input="patch(unit.id, { frequency_band: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group">
            <label class="field-label">{{ $t('rider.rig.wireless.ownership') }}</label>
            <label class="toggle-label">
              <input
                type="checkbox"
                :checked="unit.own_unit"
                class="toggle-input"
                @change="patch(unit.id, { own_unit: ($event.target as HTMLInputElement).checked })"
              />
              <span class="toggle-text">
                {{ unit.own_unit ? $t('rider.rig.wireless.ownUnit') : $t('rider.rig.wireless.venueProvides') }}
              </span>
            </label>
          </div>

          <div class="field-group field-group--wide">
            <label class="field-label">{{ $t('rider.rig.wireless.notes') }}</label>
            <input
              :value="unit.notes"
              class="field-input"
              :placeholder="$t('rider.rig.wireless.notesPlaceholder')"
              @input="patch(unit.id, { notes: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>
      </div>
    </div>

    <button type="button" class="btn-add" @click="add">{{ $t('rider.rig.wireless.add') }}</button>
  </div>
</template>

<style scoped src="./rig-form.css" />
