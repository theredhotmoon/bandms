<script setup lang="ts">
import type { ShopCategory } from '@/types/shop'

defineProps<{
  categories: ShopCategory[]
  selected: number | null
}>()

defineEmits<{ 'update:selected': [value: number | null] }>()
</script>

<template>
  <div class="cat-filter">
    <button
      class="cat-chip"
      :class="{ 'cat-chip--on': selected === null }"
      @click="$emit('update:selected', null)"
    >All</button>
    <button
      v-for="cat in categories"
      :key="cat.id"
      class="cat-chip"
      :class="{ 'cat-chip--on': selected === cat.id }"
      @click="$emit('update:selected', cat.id)"
    >{{ cat.name }}</button>
  </div>
</template>

<style scoped>
.cat-filter { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.cat-chip {
  padding: 0.3rem 0.875rem;
  border-radius: 9999px;
  border: 1px solid #d0d0d0;
  background: #fff;
  color: #555;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms, border-color 120ms, color 120ms;
}
.cat-chip:hover { background: #f0f0f0; border-color: #aaa; color: #111; }
.cat-chip--on { background: #111; border-color: #111; color: #fff; }
</style>
