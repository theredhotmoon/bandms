<script setup lang="ts">
import { computed } from 'vue'
import type { BacklineCategory, BacklineSpec } from '@bandms/rider-core'
import { defaultBacklineSpec } from '@bandms/rider-core'

interface Props { modelValue: BacklineSpec[] }
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: BacklineSpec[]] }>()

const CATEGORIES: BacklineCategory[] = ['drum_kit', 'guitar_amp', 'bass_amp', 'keyboard', 'other']

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
    <div class="rig-hint">{{ $t('rider.rig.backline.hint') }}</div>

    <div v-if="!items.length" class="item-empty">
      {{ $t('rider.rig.backline.empty') }}
    </div>

    <div v-else class="item-list">
      <div v-for="item in items" :key="item.id" class="item-card">
        <div class="item-header">
          <input
            :value="item.name"
            class="field-input label-input"
            :placeholder="$t('rider.rig.backline.namePlaceholder')"
            @input="patch(item.id, { name: ($event.target as HTMLInputElement).value })"
          />
          <button type="button" class="btn-remove" @click="remove(item.id)">{{ $t('rider.rig.backline.remove') }}</button>
        </div>

        <label class="toggle-label">
          <input
            type="checkbox"
            :checked="item.needed"
            class="toggle-input"
            @change="patch(item.id, { needed: ($event.target as HTMLInputElement).checked })"
          />
          <span class="toggle-text" :class="{ 'toggle-text--on': item.needed }">
            {{ item.needed ? $t('rider.rig.backline.promoterProvides') : $t('rider.rig.backline.broughtByMusician') }}
          </span>
        </label>

        <div class="form-grid">
          <div class="field-group">
            <label class="field-label">{{ $t('rider.rig.backline.category') }}</label>
            <select
              :value="item.category"
              class="field-input"
              @change="patch(item.id, { category: ($event.target as HTMLSelectElement).value as BacklineCategory })"
            >
              <option v-for="c in CATEGORIES" :key="c" :value="c">{{ $t(`rider.rig.backline.categories.${c}`) }}</option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label">{{ $t('rider.rig.backline.brand') }}</label>
            <input
              :value="item.brand_preference"
              class="field-input"
              :placeholder="$t('rider.rig.backline.brandPlaceholder')"
              @input="patch(item.id, { brand_preference: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group field-group--wide">
            <label class="field-label">{{ $t('rider.rig.backline.specs') }}</label>
            <input
              :value="item.specs"
              class="field-input"
              :placeholder="$t('rider.rig.backline.specsPlaceholder')"
              @input="patch(item.id, { specs: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="field-group field-group--wide">
            <label class="field-label">{{ $t('rider.rig.backline.notes') }}</label>
            <input
              :value="item.notes"
              class="field-input"
              :placeholder="$t('rider.rig.backline.notesPlaceholder')"
              @input="patch(item.id, { notes: ($event.target as HTMLInputElement).value })"
            />
          </div>
        </div>
      </div>
    </div>

    <button type="button" class="btn-add" @click="add">{{ $t('rider.rig.backline.add') }}</button>
  </div>
</template>

<style scoped src="./rig-form.css" />
<style scoped>
.label-input { max-width: 16rem; font-weight: 600; }
</style>
