<script setup lang="ts">
import { computed } from 'vue'
import type { BacklineCategory, BacklineSpec } from '@/types/rig'
import { defaultBacklineSpec } from '@/types/rig'

interface Props { modelValue: BacklineSpec[] }
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: BacklineSpec[]] }>()

const CATEGORIES: { value: BacklineCategory; label: string }[] = [
  { value: 'drum_kit', label: 'Drum kit' },
  { value: 'guitar_amp', label: 'Guitar amp' },
  { value: 'bass_amp', label: 'Bass amp' },
  { value: 'keyboard', label: 'Keyboard / keys' },
  { value: 'other', label: 'Other' },
]

const items = computed(() => props.modelValue ?? [])

function add() {
  emit('update:modelValue', [...items.value, defaultBacklineSpec()])
}

function remove(id: string) {
  emit('update:modelValue', items.value.filter((i) => i.id !== id))
}

function patch(id: string, changes: Partial<BacklineSpec>) {
  emit('update:modelValue', items.value.map((i) => (i.id === id ? { ...i, ...changes } : i)))
}
</script>

<template>
  <div class="rig-section">
    <div class="rig-hint">
      Gear the promoter has to provide. Anything marked "brought by musician" stays
      here for reference but is left off the rider's backline request.
    </div>

    <div v-if="!items.length" class="item-empty">
      No backline requirements.
    </div>

    <div v-else class="item-list">
      <div v-for="item in items" :key="item.id" class="item-card">
        <div class="item-header">
          <input
            :value="item.name"
            class="field-input label-input"
            placeholder="e.g. Drum kit, Bass rig"
            @input="patch(item.id, { name: ($event.target as HTMLInputElement).value })"
          />
          <button type="button" class="btn-remove" @click="remove(item.id)">✕ Remove</button>
        </div>

        <label class="toggle-label">
          <input
            type="checkbox"
            :checked="item.needed"
            class="toggle-input"
            @change="patch(item.id, { needed: ($event.target as HTMLInputElement).checked })"
          />
          <span class="toggle-text" :class="{ 'toggle-text--on': item.needed }">
            {{ item.needed ? 'Promoter must provide' : 'Brought by the musician' }}
          </span>
        </label>

        <div class="form-grid">
          <div class="field-group">
            <label class="field-label">Category</label>
            <select
              :value="item.category"
              class="field-input"
              @change="patch(item.id, { category: ($event.target as HTMLSelectElement).value as BacklineCategory })"
            >
              <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label">Brand preference</label>
            <input
              :value="item.brand_preference"
              class="field-input"
              placeholder="e.g. Pearl, Fender, Marshall…"
              @input="patch(item.id, { brand_preference: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group field-group--wide">
            <label class="field-label">Specs / configuration</label>
            <input
              :value="item.specs"
              class="field-input"
              placeholder="e.g. 5-piece kit, 22″ kick, 100W head + 4×12 cab…"
              @input="patch(item.id, { specs: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group field-group--wide">
            <label class="field-label">Notes</label>
            <input
              :value="item.notes"
              class="field-input"
              placeholder="Any additional requirements…"
              @input="patch(item.id, { notes: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>
      </div>
    </div>

    <button type="button" class="btn-add" @click="add">+ Add backline item</button>
  </div>
</template>

<style scoped src="./rig-form.css" />
<style scoped>
.label-input { max-width: 16rem; font-weight: 600; }
</style>
