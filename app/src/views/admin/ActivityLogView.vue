<script setup lang="ts">
import { computed } from 'vue'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import Pagination from '@/components/admin/Pagination.vue'
import ActivityFiltersBar from '@/components/admin/activity/ActivityFiltersBar.vue'
import ActivityEntryRow from '@/components/admin/activity/ActivityEntryRow.vue'
import { useActivityLog } from '@/composables/useActivityLog'
import { useUiLang } from '@/composables/useUiLang'
import { dateLocale } from '@/locales'
import { humanizeType } from '@/utils/activityFilters'

const { filters, setFilters, clearFilters, hasFilters, list, options } = useActivityLog()
const { uiLang } = useUiLang()

const meta = computed(() => list.data.value?.meta)
const entries = computed(() => list.data.value?.data ?? [])
</script>

<template>
  <AdminLayout>
    <div class="page-wrap">
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ $t('more.activity.title') }}</h1>
          <div class="page-sub">{{ $t('more.activity.lead') }}</div>
        </div>
      </div>

      <ActivityFiltersBar :filters="filters" :options="options.data.value" :has-filters="hasFilters" @change="setFilters" @clear="clearFilters" />

      <div v-if="filters.subject_type && filters.subject_id" class="history-note" data-testid="activity-history-note">
        {{ $t('more.activity.historyOf', { entity: humanizeType(filters.subject_type), id: filters.subject_id }) }}
        <button type="button" class="btn-edit" @click="clearFilters">{{ $t('more.activity.showAll') }}</button>
      </div>

      <div v-if="list.isPending.value" class="empty-state">{{ $t('common.state.loading') }}</div>
      <div v-else-if="list.isError.value" class="empty-state error">{{ $t('more.activity.loadFailed') }}</div>
      <div v-else-if="entries.length === 0" class="empty-state">{{ $t('more.activity.empty') }}</div>

      <div v-else class="table-card">
        <table class="activity-table">
          <thead>
            <tr>
              <th class="th">{{ $t('more.activity.cols.when') }}</th>
              <th class="th">{{ $t('more.activity.cols.who') }}</th>
              <th class="th">{{ $t('more.activity.cols.what') }}</th>
              <th class="th" />
            </tr>
          </thead>
          <tbody>
            <ActivityEntryRow
              v-for="e in entries"
              :key="e.id"
              :entry="e"
              :locale="dateLocale(uiLang)"
              @history="(type, id) => setFilters({ subject_type: type, subject_id: id })"
            />
          </tbody>
        </table>
        <Pagination
          v-if="meta && meta.last_page > 1"
          :page="meta.current_page"
          :total-pages="meta.last_page"
          :total="meta.total"
          :per-page="meta.per_page"
          :from="(meta.current_page - 1) * meta.per_page + 1"
          :to="Math.min(meta.current_page * meta.per_page, meta.total)"
          @update:page="page => setFilters({ page })"
        />
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped>
.page-wrap   { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.page-title  { font-size: var(--fs-lg); font-weight: 700; color: var(--c-e2e8f0); }
.page-sub    { font-size: var(--fs-sm); color: var(--c-475569); margin-top: 0.2rem; }
.activity-table { width: 100%; border-collapse: collapse; }
.history-note { display: flex; align-items: center; gap: 0.75rem; font-size: var(--fs-sm); color: var(--c-94a3b8); }
.error { color: var(--c-f87171); }
</style>
