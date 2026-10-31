<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import Pagination from '@/components/admin/Pagination.vue'
import FindingRow from '@/components/admin/assistant/FindingRow.vue'
import FindingsFilters from '@/components/admin/assistant/FindingsFilters.vue'
import RunStatusBar from '@/components/admin/assistant/RunStatusBar.vue'
import { useAssistantFindings, useCrawlRuns } from '@/composables/useAssistantFindings'
import { adminUrl } from '@/config/admin'
import { reportSaveError } from '@/utils/formErrors'

const { t } = useI18n()
const { query, filter, change, setStatus } = useAssistantFindings()
const { query: runs, run } = useCrawlRuns()

async function runNow() {
  try {
    const { queued } = await run.mutateAsync()
    if (queued.length) toast.success(t('more.assistant.runs.queued', { n: queued.length }))
    else toast.info(t('more.assistant.runs.nothingToRun'))
  } catch (e) { reportSaveError(e, t('more.assistant.runs.runFailed')) }
}

async function updateStatus(id: number, status: 'new' | 'dismissed') {
  try {
    await setStatus.mutateAsync({ id, status })
    toast.success(status === 'dismissed' ? t('more.assistant.dismissed') : t('more.assistant.restored'))
  } catch (e) { reportSaveError(e, t('more.assistant.actionFailed')) }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-2">
        <h1 class="text-lg font-semibold" style="color:var(--c-e2e8f0);">{{ $t('more.assistant.title') }}</h1>
        <RouterLink :to="adminUrl('assistant/settings')" class="btn-ghost">{{ $t('more.assistant.settingsLink') }}</RouterLink>
      </div>
      <p class="mb-4 text-sm" style="color:var(--c-94a3b8);">{{ $t('more.assistant.lead') }}</p>

      <RunStatusBar :runs="runs.data.value ?? []" :running="run.isPending.value" @run="runNow" />

      <FindingsFilters
        :filter="filter"
        :countries="query.data.value?.meta.countries ?? {}"
        :kinds="query.data.value?.meta.kinds ?? {}"
        @change="change"
      />

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">{{ $t('common.state.loading') }}</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:var(--c-f87171);">{{ $t('more.assistant.loadFailed') }}</div>
        <div v-else-if="!query.data.value?.data.length" class="empty-state" data-testid="findings-empty">
          {{ filter.kind || filter.country || filter.q || filter.status !== 'new' ? $t('more.assistant.noMatch') : $t('more.assistant.empty') }}
        </div>
        <template v-else>
          <FindingRow
            v-for="f in query.data.value.data"
            :key="f.id"
            :finding="f"
            :busy="setStatus.isPending.value"
            @dismiss="updateStatus(f.id, 'dismissed')"
            @restore="updateStatus(f.id, 'new')"
          />
          <Pagination
            v-if="query.data.value.meta.last_page > 1"
            :page="filter.page"
            :total-pages="query.data.value.meta.last_page"
            :total="query.data.value.meta.total"
            :per-page="50"
            :from="(filter.page - 1) * 50 + 1"
            :to="Math.min(filter.page * 50, query.data.value.meta.total)"
            @update:page="p => change({ page: p })"
          />
        </template>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped src="../../components/admin/form-styles.css" />
