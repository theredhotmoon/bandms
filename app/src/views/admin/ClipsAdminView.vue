<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import ClipForm from '@/components/admin/forms/ClipForm.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useClips } from '@/composables/useClips'
import { useConcerts } from '@/composables/useConcerts'
import { useBandMembers } from '@/composables/useBandMembers'
import { useReleases } from '@/composables/useReleases'
import { useShop } from '@/composables/useShop'
import { useTableControls } from '@/composables/useTableControls'
import { providerLabel } from '@/utils/postBlocks'
import { presetMessageKey } from '@/utils/clipCategories'
import { CLIP_SOURCES, filterBySource, lastSyncedAt as latestSync, officialViewTotal, sourceMessageKey } from '@/utils/clipSources'
import type { ClipSource } from '@/utils/clipSources'
import { reportSaveError } from '@/utils/formErrors'
import type { Clip, ClipPayload } from '@/types/clip'

const { t } = useI18n()

const { query, create, update, remove, syncViews } = useClips()
const { query: concertsQ } = useConcerts()
const { query: membersQ } = useBandMembers()
const { query: releasesQ } = useReleases()
const { query: shopQ }     = useShop()

const showModal = ref(false)
const editing = ref<Clip | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId = ref<number | null>(null)

// Official and fan videos share one list; the filter narrows it.
const filterSource = ref<'' | ClipSource>('')
const filtered = computed(() => filterBySource(query.data.value ?? [], filterSource.value))

const totalViews = computed(() => officialViewTotal(query.data.value ?? []))
const lastSyncedAt = computed(() => {
  const ts = latestSync(query.data.value ?? [])
  return ts ? new Date(ts).toLocaleString() : null
})

async function doSyncViews() {
  try {
    const res = await syncViews.mutateAsync()
    toast.success(t('band.clips.sync.done', res.updated, { named: { n: res.updated, views: res.total_views.toLocaleString() } }))
  } catch (e) { reportSaveError(e, t('band.clips.sync.failed')) }
}

const tc = useTableControls<Clip>({
  data: filtered,
  searchFn: (c, q) => (c.title ?? '').toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.url.toLowerCase().includes(q),
  defaultSort: 'recorded_on',
  defaultDir: 'desc',
})

function openCreate() { editing.value = null; fieldErrors.value = {}; showModal.value = true }
function openEdit(c: Clip) { editing.value = c; fieldErrors.value = {}; showModal.value = true }
function closeModal() { showModal.value = false }

async function handleSubmit(payload: ClipPayload) {
  fieldErrors.value = {}
  try {
    if (editing.value) { await update.mutateAsync({ id: editing.value.id, payload }); toast.success(t('band.clips.updated')) }
    else { await create.mutateAsync(payload); toast.success(t('band.clips.created')) }
    closeModal()
  } catch (e) { reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors) }
}

async function confirmDelete() {
  if (confirmId.value == null) return
  try { await remove.mutateAsync(confirmId.value); toast.success(t('band.clips.deleted')); confirmId.value = null }
  catch (e) { reportSaveError(e, t('common.state.deleteFailed')) }
}

// A custom category prints as the band typed it; only presets are translated.
function categoryLabel(value: string): string {
  const key = presetMessageKey(value)
  return key ? t(key) : value
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color:var(--c-e2e8f0);">{{ $t('band.clips.title') }}</h1>
          <p class="text-xs mt-0.5" style="color:var(--c-64748b);">{{ $t('band.clips.subtitle') }}</p>
        </div>
        <div class="header-right">
          <div v-if="totalViews > 0" class="views-stat" data-testid="clips-total-views">
            <span class="views-stat-num">{{ totalViews.toLocaleString() }}</span>
            <span class="views-stat-label">{{ $t('band.clips.sync.totalViews') }}</span>
            <span v-if="lastSyncedAt" class="views-stat-ts">{{ $t('band.clips.sync.syncedAt', { at: lastSyncedAt }) }}</span>
          </div>
          <button class="btn-sync" :disabled="syncViews.isPending.value" data-testid="clips-sync-views" @click="doSyncViews">
            {{ syncViews.isPending.value ? $t('band.clips.sync.syncing') : $t('band.clips.sync.button') }}
          </button>
          <button @click="openCreate" class="btn-add-primary">{{ $t('band.clips.add') }}</button>
        </div>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">{{ $t('common.state.loading') }}</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:var(--c-f87171);">{{ $t('band.clips.loadFailed') }}</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value">
            <template #filters>
              <select v-model="filterSource" class="filter-select" data-testid="clips-source-filter" :aria-label="$t('band.clips.columns.source')">
                <option value="">{{ $t('band.clips.source.all') }}</option>
                <option v-for="s in CLIP_SOURCES" :key="s" :value="s">{{ $t(sourceMessageKey(s)) }}</option>
              </select>
            </template>
          </TableToolbar>

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!tc.rawTotal.value">{{ $t('band.clips.empty') }}</span>
            <span v-else>{{ $t('band.clips.noMatch') }}</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid var(--c-222222);">
                <th class="th" style="width:5rem;">{{ $t('band.clips.columns.preview') }}</th>
                <SortHeader :label="$t('common.fields.title')" sort-key="title" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader :label="$t('band.clips.columns.source')" sort-key="source" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader :label="$t('band.clips.columns.category')" sort-key="category" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">{{ $t('band.clips.columns.provider') }}</th>
                <th class="th">{{ $t('band.clips.columns.attachedTo') }}</th>
                <SortHeader :label="$t('band.clips.columns.recorded')" sort-key="recorded_on" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader :label="$t('band.clips.columns.views')" sort-key="view_count" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="6rem" @sort="tc.toggleSort" />
                <th class="th text-right">{{ $t('common.table.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="clip in tc.paginated.value" :key="clip.id" class="table-row">
                <td class="td">
                  <img v-if="clip.thumbnail_url" :src="clip.thumbnail_url" class="video-thumb" alt="" />
                  <div v-else class="video-thumb-empty" aria-hidden="true">▶</div>
                </td>
                <td class="td font-medium" style="color:var(--c-e2e8f0);">
                  {{ clip.title ?? clip.url }}
                  <div v-if="clip.channel_name || clip.duration" class="clip-sub">
                    <span v-if="clip.channel_name">{{ clip.channel_name }}</span>
                    <span v-if="clip.duration">· {{ clip.duration }}</span>
                  </div>
                </td>
                <td class="td">
                  <span class="source-badge" :class="`source-badge--${clip.source}`" data-testid="clip-source-badge">{{ $t(sourceMessageKey(clip.source)) }}</span>
                </td>
                <td class="td" style="color:var(--c-94a3b8);">{{ categoryLabel(clip.category) }}</td>
                <td class="td" style="color:var(--c-94a3b8);">{{ providerLabel(clip.provider, $t('common.link')) }}</td>
                <td class="td" style="color:var(--c-94a3b8);" data-testid="clip-attached-count">{{ clip.owners.length }}</td>
                <td class="td text-xs tabular-nums" style="color:var(--c-64748b);">{{ clip.recorded_on ?? '—' }}</td>
                <td class="td tabular-nums" style="font-size:var(--fs-sm);">
                  <span v-if="clip.view_count !== null" style="color:var(--c-38bdf8); font-weight:600;">{{ clip.view_count.toLocaleString() }}</span>
                  <span v-else style="color:var(--c-64748b);">—</span>
                </td>
                <td class="td text-right">
                  <button @click="openEdit(clip)" class="btn-edit">{{ $t('common.actions.edit') }}</button>
                  <button @click="confirmId = clip.id" class="btn-delete">{{ $t('common.actions.delete') }}</button>
                </td>
              </tr>
            </tbody>
          </table>

          <Pagination
            v-if="tc.totalPages.value > 1"
            :page="tc.page.value"
            :total-pages="tc.totalPages.value"
            :total="tc.total.value"
            :per-page="tc.perPage"
            :from="tc.from.value"
            :to="tc.to.value"
            @update:page="tc.page.value = $event"
          />
        </template>
      </div>
    </div>

    <AdminModal :open="showModal" :title="editing ? t('band.clips.modalEdit') : t('band.clips.modalNew')" max-width="48rem" @close="closeModal">
      <ClipForm
        :initial="editing"
        :concerts="concertsQ.data.value ?? []"
        :releases="releasesQ.data.value ?? []"
        :shop-items="shopQ.data.value ?? []"
        :members="membersQ.data.value ?? []"
        :loading="create.isPending.value || update.isPending.value"
        :errors="fieldErrors"
        @submit="handleSubmit"
        @cancel="closeModal"
      />
    </AdminModal>

    <ConfirmDialog :open="confirmId !== null" :loading="remove.isPending.value" @confirm="confirmDelete" @cancel="confirmId = null" />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped>
.header-right { display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap; justify-content: flex-end; }
.views-stat {
  display: flex; align-items: baseline; gap: 0.3rem;
  background: var(--c-111111); border: 1px solid var(--c-222222); border-radius: 0.5rem; padding: 0.3rem 0.75rem;
}
.views-stat-num { font-size: var(--fs-md); font-weight: 700; color: var(--c-38bdf8); }
.views-stat-label, .views-stat-ts { font-size: var(--fs-2xs); color: var(--c-64748b); }
.btn-sync {
  padding: 0.375rem 0.75rem; border-radius: 0.4rem; font-size: var(--fs-xs); font-weight: 500; cursor: pointer;
  background: var(--c-111111); color: var(--c-38bdf8); border: 1px solid var(--c-222222);
}
.btn-sync:hover:not(:disabled) { background: var(--c-0f2540); }
.btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }
.video-thumb { width: 4.5rem; aspect-ratio: 16/9; object-fit: cover; border-radius: 0.25rem; display: block; background: var(--c-1a1a1a); }
.video-thumb-empty {
  width: 4.5rem; aspect-ratio: 16/9; border-radius: 0.25rem; display: flex; align-items: center; justify-content: center;
  background: var(--c-1a1a1a); border: 1px solid var(--c-222222); color: var(--c-64748b); font-size: var(--fs-md);
}
.clip-sub { font-size: var(--fs-2xs); color: var(--c-64748b); font-weight: 400; display: flex; gap: 0.5rem; margin-top: 1px; }
.source-badge {
  display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: var(--fs-2xs); font-weight: 600;
  border: 1px solid var(--c-222222); color: var(--c-94a3b8);
}
.source-badge--fan { color: var(--c-fbbf24); border-color: var(--c-92400e); }
</style>
