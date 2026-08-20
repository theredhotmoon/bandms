<script setup lang="ts">
import type { RiderCompleteness } from '@/utils/riderResolver'

interface Props { completeness: RiderCompleteness }
defineProps<Props>()

defineEmits<{ open: [placementId: string] }>()
</script>

<template>
  <div v-if="completeness.total" class="completeness">
    <div class="bar-row">
      <div class="bar-track">
        <div class="bar-fill" :style="{ width: `${completeness.pct}%` }" />
      </div>
      <span class="bar-label">
        {{ completeness.complete }}/{{ completeness.total }} ready
      </span>
    </div>

    <div v-if="completeness.complete < completeness.total" class="gaps">
      <button
        v-for="status in completeness.statuses.filter(s => !s.complete)"
        :key="status.placementId"
        type="button"
        class="gap-chip"
        @click="$emit('open', status.placementId)"
      >
        <span class="gap-name">{{ status.name }}</span>
        <span class="gap-missing">no {{ status.missing.join(', ') }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.completeness { display: flex; flex-direction: column; gap: 0.4rem; flex-shrink: 0; }

.bar-row { display: flex; align-items: center; gap: 0.625rem; }
.bar-track {
  flex: 1; height: 0.3rem; border-radius: 999px; background: #1a1a1a; overflow: hidden;
}
.bar-fill {
  height: 100%; border-radius: 999px; background: #4ade80;
  transition: width 200ms ease;
}
.bar-label { font-size: 0.7rem; color: #64748b; white-space: nowrap; }

.gaps { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.gap-chip {
  display: flex; align-items: baseline; gap: 0.3rem;
  padding: 0.15rem 0.45rem; border-radius: 0.3rem; cursor: pointer;
  background: #1c1608; border: 1px solid #4d3c10; font-family: inherit;
  transition: background 100ms;
}
.gap-chip:hover { background: #2a2008; }
.gap-name { font-size: 0.68rem; font-weight: 600; color: #fbbf24; }
.gap-missing { font-size: 0.65rem; color: #a16207; }
</style>
