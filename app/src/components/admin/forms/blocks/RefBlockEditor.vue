<script setup lang="ts">
import { computed } from 'vue'
import type { RefEntity } from '@/types/post'

export interface RefEntityLists {
  concert:       { id: number; label: string }[]
  album:         { id: number; label: string }[]
  release:       { id: number; label: string }[]
  music_video:   { id: number; label: string }[]
  press_release: { id: number; label: string }[]
  shop_item:     { id: number; label: string }[]
}

const props = defineProps<{ payload: Record<string, unknown>; entities: RefEntityLists }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

// `tour` is absent on purpose: tours have no public page, so a tour reference
// could only link somewhere that isn't built.
const ENTITY_LABELS: Record<RefEntity, string> = {
  concert: 'Concert', album: 'Photo album', release: 'Release',
  music_video: 'Music video', press_release: 'Press coverage', shop_item: 'Shop item',
}

const entity = computed(() => (props.payload.entity as RefEntity) ?? 'concert')
const items  = computed(() => props.entities[entity.value] ?? [])

function setEntity(value: RefEntity) {
  // Reset the id: an id from the previous list means nothing in the new one.
  emit('update:payload', { ...props.payload, entity: value, id: 0 })
}
</script>

<template>
  <div class="flex gap-2">
    <select :value="entity" @change="setEntity(($event.target as HTMLSelectElement).value as RefEntity)"
            class="field-input" style="width:11rem; flex-shrink:0;">
      <option v-for="(label, key) in ENTITY_LABELS" :key="key" :value="key">{{ label }}</option>
    </select>
    <select :value="payload.id ?? 0"
            @change="emit('update:payload', { ...payload, id: Number(($event.target as HTMLSelectElement).value) })"
            class="field-input flex-1" required>
      <option :value="0" disabled>Choose an item…</option>
      <option v-for="i in items" :key="i.id" :value="i.id">{{ i.label }}</option>
    </select>
  </div>
</template>

<style scoped src="../../form-styles.css" />
