<script setup lang="ts">
import { computed } from 'vue'
import type { MonitorSpec } from '@/types/rig'
import { defaultMonitorSpec } from '@/types/rig'

interface Props { modelValue: MonitorSpec[] }
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: MonitorSpec[]] }>()

const monitors = computed(() => props.modelValue ?? [])

function add() {
  const n = monitors.value.length + 1
  emit('update:modelValue', [...monitors.value, defaultMonitorSpec(`Monitor ${n}`)])
}

function remove(id: string) {
  emit('update:modelValue', monitors.value.filter((m) => m.id !== id))
}

function patch(id: string, changes: Partial<MonitorSpec>) {
  emit('update:modelValue', monitors.value.map((m) => (m.id === id ? { ...m, ...changes } : m)))
}
</script>

<template>
  <div class="rig-section">
    <div class="rig-hint">
      One entry per monitor send. A wedge and an IEM are two entries — IEM details
      flow into the rider's RF list automatically.
    </div>

    <div v-if="!monitors.length" class="item-empty">
      No monitor sends yet.
    </div>

    <div v-else class="item-list">
      <div v-for="(mon, idx) in monitors" :key="mon.id" class="item-card">
        <div class="item-header">
          <input
            :value="mon.label"
            class="field-input label-input"
            :placeholder="`Monitor ${idx + 1}`"
            @input="patch(mon.id, { label: ($event.target as HTMLInputElement).value })"
          />
          <button type="button" class="btn-remove" @click="remove(mon.id)">✕ Remove</button>
        </div>

        <div class="form-grid">
          <div class="field-group">
            <label class="field-label">Type</label>
            <div class="type-buttons">
              <button
                type="button"
                class="type-btn"
                :class="{ 'type-btn--on': mon.type === 'wedge' }"
                @click="patch(mon.id, { type: 'wedge' })"
              >🔊 Wedge</button>
              <button
                type="button"
                class="type-btn"
                :class="{ 'type-btn--on': mon.type === 'iem' }"
                @click="patch(mon.id, { type: 'iem' })"
              >🎧 IEM</button>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Configuration</label>
            <div class="type-buttons">
              <button
                type="button"
                class="type-btn"
                :class="{ 'type-btn--on': mon.config === 'mono' }"
                @click="patch(mon.id, { config: 'mono' })"
              >Mono</button>
              <button
                type="button"
                class="type-btn"
                :class="{ 'type-btn--on': mon.config === 'stereo' }"
                @click="patch(mon.id, { config: 'stereo' })"
              >Stereo</button>
            </div>
          </div>

          <div class="field-group field-group--wide">
            <label class="field-label">Mix description — what should be in it?</label>
            <input
              :value="mon.mix_description"
              class="field-input"
              placeholder="e.g. my vocals loud + kick, no guitars, click on left"
              @input="patch(mon.id, { mix_description: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <template v-if="mon.type === 'iem'">
            <div class="field-group">
              <label class="field-label">Wireless pack</label>
              <label class="toggle-label">
                <input
                  type="checkbox"
                  :checked="mon.iem_own_pack"
                  class="toggle-input"
                  @change="patch(mon.id, { iem_own_pack: ($event.target as HTMLInputElement).checked })"
                />
                <span class="toggle-text">
                  {{ mon.iem_own_pack ? 'Own pack' : 'Venue pack needed' }}
                </span>
              </label>
            </div>

            <div class="field-group">
              <label class="field-label">Transmitter model</label>
              <input
                :value="mon.iem_transmitter_model"
                class="field-input"
                placeholder="e.g. Shure PSM300"
                @input="patch(mon.id, { iem_transmitter_model: ($event.target as HTMLInputElement).value })"
              />
            </div>

            <div class="field-group">
              <label class="field-label">Frequency (MHz)</label>
              <input
                :value="mon.iem_frequency"
                class="field-input"
                placeholder="e.g. 606.000"
                @input="patch(mon.id, { iem_frequency: ($event.target as HTMLInputElement).value })"
              />
            </div>
          </template>
        </div>
      </div>
    </div>

    <button type="button" class="btn-add" @click="add">+ Add monitor send</button>
  </div>
</template>

<style scoped src="./rig-form.css" />
<style scoped>
.label-input { max-width: 16rem; font-weight: 600; }
</style>
