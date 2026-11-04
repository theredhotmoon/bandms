<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import Pagination from '@/components/admin/Pagination.vue'
import BlockedSitesList from '@/components/admin/assistant/BlockedSitesList.vue'
import FindingRow from '@/components/admin/assistant/FindingRow.vue'
import FindingsFilters from '@/components/admin/assistant/FindingsFilters.vue'
import RunStatusBar from '@/components/admin/assistant/RunStatusBar.vue'
import { useAssistantFindings, useCrawlRuns } from '@/composables/useAssistantFindings'
import { useUiLang } from '@/composables/useUiLang'
import type { FindingStatusChange } from '@/types/assistantCrawler'
import { adminUrl } from '@/config/admin'
import { formatShortDate } from '@/utils/formatDate'
import { reportSaveError } from '@/utils/formErrors'

const { t } = useI18n()
const { uiLang } = useUiLang()
const { query, filter, change, setStatus, link } = useAssistantFindings()
const { query: runs, run } = useCrawlRuns()

async function runNow() {
  try {
    const { queued } = await run.mutateAsync()
    if (queued.length) toast.success(t('more.assistant.runs.queued', { n: queued.length }))
    else toast.info(t('more.assistant.runs.nothingToRun'))
  } catch (e) { reportSaveError(e, t('more.assistant.runs.runFailed')) }
}

// A record created by Save as… whose link then failed, per finding: the row
// offers to link it again rather than create a second one.
const pendingLinks = ref<Record<number, { type: 'venue' | 'band' | 'author'; id: number }>>({})

async function linkSaved(id: number, saved: { type: 'venue' | 'band' | 'author'; id: number }) {
  try {
    await link.mutateAsync({ id, type: saved.type, recordId: saved.id })
    delete pendingLinks.value[id]
    toast.success(t('more.assistant.saveAs.linked'))
  } catch (e) {
    pendingLinks.value[id] = saved
    reportSaveError(e, t('more.assistant.saveAs.linkFailed'))
  }
}

async function updateStatus(id: number, change: FindingStatusChange) {
  try {
    const { data, meta } = await setStatus.mutateAsync({ id, change })
    toast.success(statusToast(change, data.snoozed_until, meta))
  } catch (e) { reportSaveError(e, t('more.assistant.actionFailed')) }
}

function statusToast(
  change: FindingStatusChange,
  until: string | null,
  meta: { blocked: { label: string } | null; also_dismissed: number },
): string {
  if (change.status === 'new') return t('more.assistant.restored')
  if (change.status === 'snoozed') return t('more.assistant.notNow.done', { date: formatShortDate(until, uiLang.value, 'instant') })
  if (!meta.blocked) return t('more.assistant.wrong.done')
  return meta.also_dismissed > 0
    ? t('more.assistant.wrong.blockedMore', { site: meta.blocked.label, n: meta.also_dismissed })
    : t('more.assistant.wrong.blocked', { site: meta.blocked.label })
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
            :busy="setStatus.isPending.value || link.isPending.value"
            :pending-link="pendingLinks[f.id] ?? null"
            @snooze="m => updateStatus(f.id, { status: 'snoozed', snooze_months: m })"
            @wrong="block => updateStatus(f.id, { status: 'dismissed', block_site: block })"
            @restore="updateStatus(f.id, { status: 'new' })"
            @saved="linkSaved(f.id, $event)"
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

      <BlockedSitesList />
    </div>
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped src="../../components/admin/form-styles.css" />
<style scoped>
/* The rows' Save as… / Not now / Wrong menus drop below the row; the card's
   clipping (there for table corners — these rows paint no background) cut
   them off on the last row. */
.table-card { overflow: visible; }
</style>
