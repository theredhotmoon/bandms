<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ActivityEntry } from '@/types/activity'
import { humanizeType } from '@/utils/activityFilters'
import { formatShortDate } from '@/utils/formatDate'
import ActivityDiffTable from './ActivityDiffTable.vue'

const props = defineProps<{
  entry: ActivityEntry
  /** BCP 47 tag for the timestamp, from the UI language. */
  locale: string
}>()

const emit = defineEmits<{ history: [type: string, id: number] }>()

const open = ref(false)

const time = computed(() =>
  new Date(props.entry.created_at).toLocaleTimeString(props.locale, { hour: '2-digit', minute: '2-digit' }))

const fieldCount = computed(() =>
  props.entry.changes.reduce((n, c) => n + Object.keys(c.diff).length, 0))

const detailsId = computed(() => `activity-details-${props.entry.id}`)
</script>

<template>
  <tr class="table-row" data-testid="activity-entry" :data-action="entry.action">
    <td class="td ae-when">
      <span class="ae-date">{{ formatShortDate(entry.created_at, locale, 'instant') }}</span>
      <span class="ae-time">{{ time }}</span>
    </td>
    <td class="td ae-who">
      <span v-if="entry.user_name">{{ entry.user_name }}</span>
      <span v-else class="ae-system">{{ $t('more.activity.system') }}</span>
    </td>
    <td class="td">
      <div class="ae-what">
        <span class="ae-action" :class="`ae-action--${entry.action}`">{{ $t(`more.activity.events.${entry.action}`) }}</span>
        <span v-if="entry.subject_type" class="ae-type">{{ humanizeType(entry.subject_type) }}</span>
        <span v-if="entry.subject_label" class="ae-label" data-testid="activity-entry-label">{{ entry.subject_label }}</span>
      </div>
      <div v-if="entry.route" class="ae-route">{{ entry.method }} {{ entry.route }}</div>
    </td>
    <td class="td ae-actions">
      <button
        v-if="entry.subject_type && entry.subject_id"
        type="button"
        class="btn-edit"
        data-testid="activity-history"
        @click="emit('history', entry.subject_type, entry.subject_id)"
      >{{ $t('more.activity.history') }}</button>
      <button
        type="button"
        class="btn-edit"
        :aria-expanded="open"
        :aria-controls="detailsId"
        data-testid="activity-details-toggle"
        @click="open = !open"
      >
        {{ open ? $t('more.activity.hideDetails') : $t('more.activity.details') }}
        <span v-if="fieldCount" class="ae-count">({{ $t('more.activity.changes', fieldCount) }})</span>
      </button>
    </td>
  </tr>
  <tr v-if="open" :id="detailsId" class="ae-details-row">
    <td colspan="4" class="td">
      <div class="ae-details">
        <ActivityDiffTable v-for="c in entry.changes" :key="c.id" :change="c" />
        <p v-if="entry.changes.length === 0" class="ae-none">{{ $t('more.activity.nothingItemised') }}</p>
      </div>
    </td>
  </tr>
</template>

<style scoped src="../../../views/admin/admin-table.css" />
<style scoped>
.ae-when   { white-space: nowrap; color: var(--c-94a3b8); }
.ae-date   { display: block; }
.ae-time   { display: block; font-size: var(--fs-xs); color: var(--c-64748b); }
.ae-who    { color: var(--c-e2e8f0); font-weight: 600; white-space: nowrap; }
.ae-system { color: var(--c-64748b); font-weight: 400; font-style: italic; }
.ae-what   { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem; }
.ae-action {
  font-size: var(--fs-2xs); font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
  padding: 0.1rem 0.45rem; border-radius: 999px; border: 1px solid var(--c-334155-line); color: var(--c-94a3b8);
}
.ae-action--created { color: var(--c-4ade80); }
.ae-action--deleted { color: var(--c-f87171); }
.ae-type   { color: var(--c-94a3b8); }
.ae-label  { color: var(--c-e2e8f0); font-weight: 600; }
.ae-route  { font-size: var(--fs-2xs); color: var(--c-64748b); font-family: ui-monospace, monospace; margin-top: 0.15rem; }
.ae-actions { text-align: right; white-space: nowrap; }
.ae-count  { color: var(--c-64748b); font-weight: 400; }
.ae-details { display: flex; flex-direction: column; gap: 1rem; padding: 0.25rem 0 0.5rem; }
.ae-none   { font-size: var(--fs-sm); color: var(--c-64748b); }
</style>
