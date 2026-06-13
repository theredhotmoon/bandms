<script setup lang="ts">
import type { ShopItemVariant } from '@/types/shop'

defineProps<{
  groupName: string
  variants: ShopItemVariant[]
  selected: number | null
}>()

defineEmits<{ 'update:selected': [id: number] }>()

function isSoldOut(v: ShopItemVariant): boolean {
  return v.stock_quantity !== null && v.stock_quantity === 0
}
</script>

<template>
  <div class="vs-group">
    <div class="vs-label">{{ groupName }}</div>
    <div class="vs-buttons">
      <button
        v-for="v in variants"
        :key="v.id"
        type="button"
        class="vs-btn"
        :class="{
          'vs-btn--on':       selected === v.id,
          'vs-btn--soldout':  isSoldOut(v),
        }"
        :disabled="isSoldOut(v)"
        :title="isSoldOut(v) ? 'Sold out' : v.value"
        @click="$emit('update:selected', v.id)"
      >
        <span :class="{ 'vs-strike': isSoldOut(v) }">{{ v.value }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.vs-group { display: flex; flex-direction: column; gap: 0.5rem; }
.vs-label { font-size: 0.8rem; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.06em; }
.vs-buttons { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.vs-btn {
  min-width: 2.5rem;
  padding: 0.35rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #d0d0d0;
  background: #fff;
  color: #333;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms, border-color 120ms, color 120ms;
}
.vs-btn:hover:not(:disabled):not(.vs-btn--on) { background: #f5f5f5; border-color: #aaa; }
.vs-btn--on { background: #111; border-color: #111; color: #fff; }
.vs-btn--soldout { opacity: 0.45; cursor: not-allowed; }
.vs-strike { text-decoration: line-through; }
</style>
