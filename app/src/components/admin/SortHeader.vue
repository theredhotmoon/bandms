<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  sortKey: string
  current: string
  dir: 'asc' | 'desc'
  right?: boolean
  width?: string
}>()

const emit = defineEmits<{ sort: [key: string] }>()

const isActive = computed(() => props.current === props.sortKey)
</script>

<template>
  <th
    class="th sort-th"
    :class="[{ 'sort-th--active': isActive }, right ? 'text-right' : '']"
    :style="width ? `width:${width}` : undefined"
    :aria-sort="isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'"
    @click="emit('sort', sortKey)"
  >
    <span class="sort-inner" :class="{ 'sort-inner--right': right }">
      {{ label }}
      <svg class="sort-icon" width="8" height="12" viewBox="0 0 8 12" fill="currentColor" aria-hidden="true">
        <path d="M4 1L1 4.5H7L4 1Z" :fill-opacity="isActive && dir === 'asc' ? 1 : 0.22" />
        <path d="M4 11L1 7.5H7L4 11Z" :fill-opacity="isActive && dir === 'desc' ? 1 : 0.22" />
      </svg>
    </span>
  </th>
</template>

<style scoped>
.sort-th {
  cursor: pointer;
  user-select: none;
  transition: color 100ms;
}
.sort-th:hover { color: #64748b; }
.sort-th--active { color: #818cf8; }

.sort-inner {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.sort-inner--right { flex-direction: row-reverse; }

.sort-icon {
  flex-shrink: 0;
  color: #334155;
  transition: color 100ms;
}
.sort-th--active .sort-icon { color: #818cf8; }
</style>
