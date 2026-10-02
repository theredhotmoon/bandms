<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { RiderCompleteness } from '@bandms/rider-core'
import { gapWords as toWords } from '@/utils/riderGaps'

interface Props { completeness: RiderCompleteness }
defineProps<Props>()

defineEmits<{ open: [placementId: string] }>()

const { t } = useI18n()

const gapWords = (missing: string[]) => toWords(missing, t)
</script>

<template>
  <div v-if="completeness.total" class="completeness">
    <div class="bar-row">
      <div class="bar-track">
        <div class="bar-fill" :style="{ width: `${completeness.pct}%` }" />
      </div>
      <span class="bar-label">
        {{ $t('rider.completeness.ready', { done: completeness.complete, total: completeness.total }) }}
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
        <span class="gap-missing">{{ $t('rider.completeness.missing', { items: gapWords(status.missing) }) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.completeness { display: flex; flex-direction: column; gap: 0.4rem; flex-shrink: 0; }

.bar-row { display: flex; align-items: center; gap: 0.625rem; }
.bar-track {
  flex: 1; height: 0.3rem; border-radius: 999px; background: var(--c-1a1a1a); overflow: hidden;
}
.bar-fill {
  height: 100%; border-radius: 999px; background: var(--c-4ade80);
  transition: width 200ms ease;
}
.bar-label { font-size: var(--fs-2xs); color: var(--c-64748b); white-space: nowrap; }

.gaps { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.gap-chip {
  display: flex; align-items: baseline; gap: 0.3rem;
  padding: 0.15rem 0.45rem; border-radius: 0.3rem; cursor: pointer;
  background: var(--c-1c1608); border: 1px solid var(--c-4d3c10); font-family: inherit;
  transition: background 100ms;
}
.gap-chip:hover { background: var(--c-2a2008); }
.gap-name { font-size: var(--fs-2xs); font-weight: 600; color: var(--c-fbbf24); }
.gap-missing { font-size: var(--fs-2xs); color: var(--c-a16207); }
</style>
