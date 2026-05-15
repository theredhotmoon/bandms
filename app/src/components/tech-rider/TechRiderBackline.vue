<script setup lang="ts">
import type { BacklineItem, BacklineCategory } from '@/types/techRider'

interface Props { modelValue: BacklineItem[] }
const props = defineProps<Props>()
const emit  = defineEmits<{ 'update:modelValue': [value: BacklineItem[]] }>()

const CATEGORIES: { value: BacklineCategory; label: string }[] = [
  { value: 'drum_kit',   label: 'Drum Kit'      },
  { value: 'guitar_amp', label: 'Guitar Amp'     },
  { value: 'bass_amp',   label: 'Bass Amp'       },
  { value: 'keyboard',   label: 'Keyboard / Keys'},
  { value: 'other',      label: 'Other'          },
]

function uid() {
  return `bl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function addItem(category: BacklineCategory) {
  const label = CATEGORIES.find(c => c.value === category)?.label ?? 'Item'
  emit('update:modelValue', [
    ...props.modelValue,
    { id: uid(), category, name: label, brand_preference: '', specs: '', notes: '' },
  ])
}

function update(id: string, field: keyof BacklineItem, value: unknown) {
  emit('update:modelValue', props.modelValue.map(i => i.id === id ? { ...i, [field]: value } : i))
}

function remove(id: string) {
  emit('update:modelValue', props.modelValue.filter(i => i.id !== id))
}

function categoryLabel(cat: BacklineCategory): string {
  return CATEGORIES.find(c => c.value === cat)?.label ?? cat
}
</script>

<template>
  <div class="backline-section">
    <div class="section-hint">
      List any backline items the venue or promoter must provide. Common at festivals where full backline is supplied.
    </div>

    <div class="item-list">
      <div v-if="modelValue.length === 0" class="empty-state">No backline items yet.</div>

      <div v-for="item in modelValue" :key="item.id" class="item-card">
        <div class="item-header">
          <span class="cat-badge">{{ categoryLabel(item.category) }}</span>
          <button type="button" class="del-btn" @click="remove(item.id)">✕</button>
        </div>
        <div class="item-grid">
          <div class="field-group field-group--wide">
            <label class="field-label">Name / Description</label>
            <input
              :value="item.name"
              class="field-input"
              placeholder="e.g. Standard 5-piece drum kit"
              @input="update(item.id, 'name', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field-group">
            <label class="field-label">Brand preference</label>
            <input
              :value="item.brand_preference"
              class="field-input"
              placeholder="e.g. Pearl, DW, Ludwig…"
              @input="update(item.id, 'brand_preference', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field-group">
            <label class="field-label">Specs</label>
            <input
              :value="item.specs"
              class="field-input"
              placeholder="e.g. 22″ kick, 3 toms, hi-hat, 2 crash, 1 ride"
              @input="update(item.id, 'specs', ($event.target as HTMLInputElement).value)"
            />
          </div>
          <div class="field-group field-group--wide">
            <label class="field-label">Notes</label>
            <input
              :value="item.notes"
              class="field-input"
              placeholder="Additional requirements…"
              @input="update(item.id, 'notes', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="add-buttons">
      <button
        v-for="cat in CATEGORIES"
        :key="cat.value"
        type="button"
        class="btn-add-cat"
        @click="addItem(cat.value)"
      >
        + {{ cat.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.backline-section { display: flex; flex-direction: column; gap: 0.75rem; }
.section-hint {
  font-size: 0.75rem; color: #475569; line-height: 1.5;
  padding: 0.5rem 0.75rem; background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.375rem;
}
.item-list { display: flex; flex-direction: column; gap: 0.75rem; }
.empty-state { text-align: center; color: #334155; font-size: 0.8rem; padding: 1.5rem 0; }

.item-card {
  background: #0a0a1e; border: 1px solid #1e2040; border-radius: 0.5rem;
  padding: 0.875rem; display: flex; flex-direction: column; gap: 0.625rem;
}
.item-header { display: flex; align-items: center; justify-content: space-between; }
.cat-badge {
  font-size: 0.7rem; font-weight: 700; color: #a78bfa;
  background: #1a1440; padding: 0.2rem 0.6rem; border-radius: 999px;
  text-transform: uppercase; letter-spacing: .04em;
}
.del-btn {
  background: none; border: none; cursor: pointer; color: #3d1a1a; font-size: 0.75rem;
  transition: color 120ms; padding: 0.2rem 0.35rem;
}
.del-btn:hover { color: #f87171; }

.item-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; }
.field-group { display: flex; flex-direction: column; gap: 0.25rem; }
.field-group--wide { grid-column: 1 / -1; }
.field-label { font-size: 0.7rem; font-weight: 600; color: #7c8fa6; }
.field-input {
  display: block; width: 100%; padding: 0.45rem 0.65rem; border-radius: 0.4rem;
  border: 1px solid #1e2040; background: #070718; color: #e2e8f0;
  font-size: 0.8rem; outline: none; font-family: inherit; transition: border-color 150ms;
}
.field-input:focus { border-color: #5154e5; }
.field-input::placeholder { color: #1e2a40; }

.add-buttons { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.btn-add-cat {
  padding: 0.3rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; background: #0e0e26; border: 1px solid #1e2040; color: #818cf8;
  transition: background 100ms, border-color 100ms;
}
.btn-add-cat:hover { background: #12123a; border-color: #312e81; }
</style>
