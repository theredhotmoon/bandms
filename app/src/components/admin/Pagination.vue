<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  page: number
  totalPages: number
  total: number
  perPage: number
  from: number
  to: number
}>()

const emit = defineEmits<{ 'update:page': [value: number] }>()

function go(p: number) {
  if (p >= 1 && p <= props.totalPages) emit('update:page', p)
}

const pages = computed<(number | '…')[]>(() => {
  const p = props.page
  const t = props.totalPages
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const result: (number | '…')[] = [1]
  if (p > 3) result.push('…')
  for (let i = Math.max(2, p - 1); i <= Math.min(t - 1, p + 1); i++) result.push(i)
  if (p < t - 2) result.push('…')
  result.push(t)
  return result
})
</script>

<template>
  <div class="pg" role="navigation" aria-label="Pagination">
    <span class="pg-info">{{ from }}–{{ to }} of {{ total }}</span>

    <div class="pg-controls">
      <button class="pg-btn" :disabled="page <= 1" aria-label="Previous page" @click="go(page - 1)">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <template v-for="p in pages" :key="p">
        <span v-if="p === '…'" class="pg-ellipsis" aria-hidden="true">…</span>
        <button
          v-else
          class="pg-btn pg-num"
          :class="{ 'pg-num--active': p === page }"
          :aria-current="p === page ? 'page' : undefined"
          @click="go(p as number)"
        >{{ p }}</button>
      </template>

      <button class="pg-btn" :disabled="page >= totalPages" aria-label="Next page" @click="go(page + 1)">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.pg {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-top: 1px solid #1f1f1f;
}

.pg-info {
  font-size: 0.7rem;
  color: #334155;
  font-variant-numeric: tabular-nums;
}

.pg-controls {
  display: flex;
  align-items: center;
  gap: 0.125rem;
}

.pg-btn {
  min-width: 1.75rem;
  height: 1.75rem;
  padding: 0 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.3rem;
  font-size: 0.75rem;
  color: #475569;
  cursor: pointer;
  transition: all 100ms;
}
.pg-btn svg { width: 0.875rem; height: 0.875rem; }
.pg-btn:hover:not(:disabled) { background: #1a1a1a; border-color: #333333; color: #e2e8f0; }
.pg-btn:disabled { opacity: 0.3; cursor: default; }

.pg-num { font-variant-numeric: tabular-nums; }
.pg-num--active { background: #2a2a2a; border-color: #555555; color: #ffffff; }

.pg-ellipsis {
  font-size: 0.75rem;
  color: #334155;
  width: 1.25rem;
  text-align: center;
}
</style>
