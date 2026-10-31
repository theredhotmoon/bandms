<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ActivityAction, ActivityFilterOptions, ActivityFilters } from '@/types/activity'
import { humanizeType } from '@/utils/activityFilters'

const props = defineProps<{
  filters: ActivityFilters
  options: ActivityFilterOptions | undefined
  hasFilters: boolean
}>()

const emit = defineEmits<{
  change: [patch: Partial<ActivityFilters>]
  clear: []
}>()

const ACTIONS: ActivityAction[] = ['created', 'updated', 'deleted', 'other']

// The search box commits on Enter or blur, not per keystroke: each commit is
// a URL change and a request.
const search = ref(props.filters.q ?? '')
watch(() => props.filters.q, q => { search.value = q ?? '' })

function commitSearch(): void {
  const q = search.value.trim() || null
  if (q !== props.filters.q) emit('change', { q })
}

function nullable(value: string): string | null {
  return value === '' ? null : value
}

function nullableId(value: string): number | null {
  return value === '' ? null : Number(value)
}
</script>

<template>
  <form class="af" role="search" :aria-label="$t('more.activity.filters.label')" data-testid="activity-filters" @submit.prevent="commitSearch">
    <label class="af-field">
      <span class="field-label">{{ $t('more.activity.filters.entity') }}</span>
      <select
        class="field-input"
        data-testid="activity-filter-type"
        :value="filters.subject_type ?? ''"
        @change="emit('change', { subject_type: nullable(($event.target as HTMLSelectElement).value), subject_id: null })"
      >
        <option value="">{{ $t('more.activity.filters.anyEntity') }}</option>
        <option v-for="type in options?.subject_types ?? []" :key="type" :value="type">{{ humanizeType(type) }}</option>
      </select>
    </label>

    <label class="af-field">
      <span class="field-label">{{ $t('more.activity.filters.user') }}</span>
      <select
        class="field-input"
        :value="filters.user_id ?? ''"
        @change="emit('change', { user_id: nullableId(($event.target as HTMLSelectElement).value) })"
      >
        <option value="">{{ $t('more.activity.filters.anyUser') }}</option>
        <option v-for="u in options?.users ?? []" :key="u.id" :value="u.id">{{ u.name ?? `#${u.id}` }}</option>
      </select>
    </label>

    <label class="af-field">
      <span class="field-label">{{ $t('more.activity.filters.action') }}</span>
      <select
        class="field-input"
        :value="filters.action ?? ''"
        @change="emit('change', { action: nullable(($event.target as HTMLSelectElement).value) as ActivityAction | null })"
      >
        <option value="">{{ $t('more.activity.filters.anyAction') }}</option>
        <option v-for="a in ACTIONS" :key="a" :value="a">{{ $t(`more.activity.events.${a}`) }}</option>
      </select>
    </label>

    <label class="af-field af-date">
      <span class="field-label">{{ $t('more.activity.filters.from') }}</span>
      <input
        type="date"
        class="field-input"
        :value="filters.from ?? ''"
        @change="emit('change', { from: nullable(($event.target as HTMLInputElement).value) })"
      />
    </label>

    <label class="af-field af-date">
      <span class="field-label">{{ $t('more.activity.filters.to') }}</span>
      <input
        type="date"
        class="field-input"
        :value="filters.to ?? ''"
        @change="emit('change', { to: nullable(($event.target as HTMLInputElement).value) })"
      />
    </label>

    <label class="af-field af-search">
      <span class="field-label">{{ $t('more.activity.filters.search') }}</span>
      <input
        v-model="search"
        type="search"
        class="field-input"
        data-testid="activity-filter-search"
        maxlength="100"
        :placeholder="$t('more.activity.filters.searchPlaceholder')"
        @blur="commitSearch"
      />
    </label>

    <button v-if="hasFilters" type="button" class="btn-ghost af-clear" @click="emit('clear')">
      {{ $t('more.activity.filters.clear') }}
    </button>
  </form>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.af {
  display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem;
}
.af-field  { display: flex; flex-direction: column; min-width: 9rem; }
.af-date   { min-width: 8.5rem; }
.af-search { flex: 1 1 12rem; }
.af-clear  { align-self: flex-end; }
</style>
