<script setup lang="ts">
import type { MonitorMix, MonitorType } from '@/types/techRider'
import type { BandMember } from '@/types/bandMember'

interface Props {
  modelValue: MonitorMix[]
  members: BandMember[]
}
const props = defineProps<Props>()
const emit  = defineEmits<{ 'update:modelValue': [value: MonitorMix[]] }>()

function uid() {
  return `mon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function addMix() {
  emit('update:modelValue', [
    ...props.modelValue,
    {
      id: uid(),
      band_member_id: null,
      custom_name: '',
      type: 'wedge',
      mix_description: '',
      iem_own_pack: false,
      transmitter_model: '',
      frequency: '',
    },
  ])
}

function update(id: string, field: keyof MonitorMix, value: unknown) {
  emit('update:modelValue', props.modelValue.map(m => m.id === id ? { ...m, [field]: value } : m))
}

function remove(id: string) {
  emit('update:modelValue', props.modelValue.filter(m => m.id !== id))
}

function memberName(m: MonitorMix): string {
  if (m.band_member_id) {
    const mem = props.members.find(bm => bm.id === m.band_member_id)
    return mem ? `${mem.first_name} ${mem.last_name}` : '—'
  }
  return m.custom_name || '—'
}
</script>

<template>
  <div class="monitors-section">
    <div class="section-hint">
      One row per monitor mix. Link each mix to a band member, or enter a custom name.
      For IEMs, specify whether you bring your own pack and the transmitter details.
    </div>

    <div class="mix-list">
      <div v-if="modelValue.length === 0" class="empty-state">No monitor mixes yet.</div>

      <div v-for="mix in modelValue" :key="mix.id" class="mix-card">
        <div class="mix-header">
          <div class="mix-name">{{ memberName(mix) || 'New mix' }}</div>
          <div class="mix-type-badge" :class="mix.type">{{ mix.type === 'iem' ? 'IEM' : 'Wedge' }}</div>
          <button type="button" class="del-btn" @click="remove(mix.id)">✕</button>
        </div>

        <div class="mix-grid">
          <!-- Member link -->
          <div class="field-group">
            <label class="field-label">Band member</label>
            <select
              :value="mix.band_member_id ?? ''"
              class="field-input"
              @change="update(mix.id, 'band_member_id', ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : null)"
            >
              <option value="">— Custom name —</option>
              <option v-for="bm in members" :key="bm.id" :value="bm.id">
                {{ bm.first_name }} {{ bm.last_name }} ({{ bm.role }})
              </option>
            </select>
          </div>

          <!-- Custom name (only shown when no member linked) -->
          <div v-if="!mix.band_member_id" class="field-group">
            <label class="field-label">Custom name</label>
            <input
              :value="mix.custom_name"
              class="field-input"
              placeholder="e.g. FOH engineer"
              @input="update(mix.id, 'custom_name', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <!-- Type -->
          <div class="field-group">
            <label class="field-label">Type</label>
            <select
              :value="mix.type"
              class="field-input"
              @change="update(mix.id, 'type', ($event.target as HTMLSelectElement).value as MonitorType)"
            >
              <option value="wedge">Wedge monitor</option>
              <option value="iem">IEM</option>
            </select>
          </div>

          <!-- Mix description -->
          <div class="field-group field-group--wide">
            <label class="field-label">Mix description</label>
            <input
              :value="mix.mix_description"
              class="field-input"
              placeholder="e.g. guitar heavy + click, no drums"
              @input="update(mix.id, 'mix_description', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <!-- IEM-specific fields -->
          <template v-if="mix.type === 'iem'">
            <div class="field-group">
              <label class="field-label">Own wireless pack?</label>
              <label class="toggle-label">
                <input
                  type="checkbox"
                  :checked="mix.iem_own_pack"
                  class="toggle-input"
                  @change="update(mix.id, 'iem_own_pack', ($event.target as HTMLInputElement).checked)"
                />
                <span class="toggle-text">{{ mix.iem_own_pack ? 'Yes — we bring our own' : "No — need venue's pack" }}</span>
              </label>
            </div>
            <div class="field-group">
              <label class="field-label">Transmitter model</label>
              <input
                :value="mix.transmitter_model"
                class="field-input"
                placeholder="e.g. Shure PSM300"
                @input="update(mix.id, 'transmitter_model', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="field-group">
              <label class="field-label">Frequency (MHz)</label>
              <input
                :value="mix.frequency"
                class="field-input"
                placeholder="e.g. 606.000 MHz"
                @input="update(mix.id, 'frequency', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </template>
        </div>
      </div>
    </div>

    <button type="button" class="btn-add" @click="addMix">+ Add monitor mix</button>
  </div>
</template>

<style scoped>
.monitors-section { display: flex; flex-direction: column; gap: 0.75rem; }
.section-hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.375rem;
}
.mix-list { display: flex; flex-direction: column; gap: 0.75rem; }
.empty-state { text-align: center; color: #334155; font-size: 0.8rem; padding: 1.5rem 0; }

.mix-card {
  background: #0a0a1e; border: 1px solid #1e2040; border-radius: 0.5rem;
  padding: 0.875rem; display: flex; flex-direction: column; gap: 0.75rem;
}
.mix-header { display: flex; align-items: center; gap: 0.625rem; }
.mix-name { font-size: 0.8125rem; font-weight: 600; color: #e2e8f0; flex: 1; }
.mix-type-badge {
  font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; text-transform: uppercase;
}
.mix-type-badge.wedge { background: #1e2040; color: #818cf8; }
.mix-type-badge.iem   { background: #14284a; color: #38bdf8; }
.del-btn {
  background: none; border: none; cursor: pointer; color: #3d1a1a; font-size: 0.75rem;
  transition: color 120ms; padding: 0.2rem 0.35rem;
}
.del-btn:hover { color: #f87171; }

.mix-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem;
}
.field-group { display: flex; flex-direction: column; gap: 0.25rem; }
.field-group--wide { grid-column: 1 / -1; }
.field-label { font-size: 0.7rem; font-weight: 600; color: #7c8fa6; }
.field-input {
  display: block; width: 100%; padding: 0.45rem 0.65rem; border-radius: 0.4rem;
  border: 1px solid #1e2040; background: #070718; color: #e2e8f0;
  font-size: 0.8rem; outline: none; font-family: inherit;
  transition: border-color 150ms;
}
.field-input:focus { border-color: #5154e5; }
.field-input option { background: #0e0e26; }

.toggle-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
.toggle-input { accent-color: #4338ca; width: 1rem; height: 1rem; cursor: pointer; }
.toggle-text  { font-size: 0.8rem; color: #94a3b8; }

.btn-add {
  align-self: flex-start; padding: 0.35rem 0.875rem; border-radius: 0.375rem;
  font-size: 0.78rem; font-weight: 600; cursor: pointer;
  background: #0e0e26; border: 1px solid #1e2040; color: #818cf8;
  transition: background 100ms, border-color 100ms;
}
.btn-add:hover { background: #12123a; border-color: #312e81; }
</style>
