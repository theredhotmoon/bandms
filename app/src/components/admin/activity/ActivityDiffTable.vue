<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityChange } from '@/types/activity'
import { formatDiffValue, humanizeType } from '@/utils/activityFilters'

const props = defineProps<{ change: ActivityChange }>()

// Placeholder for an empty value; a dash, not copy.
const EMPTY = '—' // i18n-ignore: typographic placeholder

const rows = computed(() =>
  Object.entries(props.change.diff).map(([field, [before, after]]) => ({
    field,
    before: formatDiffValue(before, EMPTY),
    after: formatDiffValue(after, EMPTY),
  })))
</script>

<template>
  <div class="ad" data-testid="activity-change">
    <div class="ad-head">
      <span class="ad-event" :class="`ad-event--${change.event}`">{{ $t(`more.activity.events.${change.event}`) }}</span>
      <span class="ad-type">{{ humanizeType(change.subject_type) }}</span>
      <span v-if="change.subject_label" class="ad-label">{{ change.subject_label }}</span>
      <span v-if="change.subject_id" class="ad-id">#{{ change.subject_id }}</span>
    </div>

    <table v-if="rows.length" class="ad-table">
      <thead>
        <tr>
          <th>{{ $t('more.activity.cols.field') }}</th>
          <th v-if="change.event !== 'created'">{{ $t('more.activity.cols.before') }}</th>
          <th v-if="change.event !== 'deleted'">{{ $t('more.activity.cols.after') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.field" :data-field="row.field">
          <td class="ad-field">{{ row.field }}</td>
          <td v-if="change.event !== 'created'" class="ad-before">{{ row.before }}</td>
          <td v-if="change.event !== 'deleted'" class="ad-after">{{ row.after }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.ad { display: flex; flex-direction: column; gap: 0.4rem; }
.ad-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem; font-size: var(--fs-sm); }
.ad-event {
  font-size: var(--fs-2xs); font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
  padding: 0.05rem 0.4rem; border-radius: 999px; border: 1px solid var(--c-334155-line); color: var(--c-94a3b8);
}
.ad-event--created { color: var(--c-4ade80); }
.ad-event--deleted { color: var(--c-f87171); }
.ad-type  { color: var(--c-94a3b8); }
.ad-label { color: var(--c-e2e8f0); font-weight: 600; }
.ad-id    { color: var(--c-64748b); font-size: var(--fs-xs); }

.ad-table { width: 100%; border-collapse: collapse; font-size: var(--fs-xs); table-layout: fixed; }
.ad-table th {
  text-align: left; font-weight: 600; color: var(--c-64748b); padding: 0.3rem 0.5rem;
  border-bottom: 1px solid var(--c-2a2a2a);
}
.ad-table th:first-child { width: 11rem; }
.ad-table td {
  padding: 0.3rem 0.5rem; vertical-align: top; border-bottom: 1px solid var(--c-1f1f1f);
  white-space: pre-wrap; overflow-wrap: anywhere; max-height: 8rem;
}
.ad-field  { color: var(--c-94a3b8); font-family: ui-monospace, monospace; }
.ad-before { color: var(--c-888888); }
.ad-after  { color: var(--c-e2e8f0); }
</style>
