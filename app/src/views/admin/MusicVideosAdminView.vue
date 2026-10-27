<script setup lang="ts">
import { useBandMembers } from '@/composables/useBandMembers'
import { computed, ref } from 'vue'
import MusicVideoForm from '@/components/admin/forms/MusicVideoForm.vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useMusicVideos } from '@/composables/useMusicVideos'
import { useTableControls } from '@/composables/useTableControls'
import type { MusicVideo, MusicVideoPayload } from '@/types/musicVideo'
import { reportSaveError } from '@/utils/formErrors'

const { query, create, update, remove, previewFetch, syncViews } = useMusicVideos()
const fetchingPreviewId = ref<number | null>(null)

const totalViews = computed(() => {
  const videos = query.data.value ?? []
  return videos.reduce((sum: number, v: MusicVideo) => sum + (v.view_count ?? 0), 0)
})

const lastSyncedAt = computed(() => {
  const videos = query.data.value ?? []
  const ts = videos
    .map((v: MusicVideo) => v.views_synced_at)
    .filter(Boolean)
    .sort()
    .at(-1)
  if (!ts) return null
  return new Date(ts).toLocaleString()
})

async function doSyncViews() {
  try {
    const result = await syncViews.mutateAsync()
    toast.success(t('media.videos.syncResult', result.updated, { named: { n: result.updated, views: result.total_views.toLocaleString() } }))
  } catch (e) {
    reportSaveError(e, t('media.videos.syncFailed'))
  }
}

async function doFetchPreview(id: number) {
  fetchingPreviewId.value = id
  try {
    await previewFetch.mutateAsync(id)
    toast.success(t('media.videos.previewFetched'))
  } catch (e) {
    reportSaveError(e, t('media.videos.previewFailed'))
  } finally {
    fetchingPreviewId.value = null
  }
}

const { query: membersQ } = useBandMembers()

const showModal = ref(false)
const editing   = ref<MusicVideo | null>(null)

const confirmOpen    = ref(false)
const confirmId      = ref<number | null>(null)
const confirmLoading = ref(false)
const filterStatus   = ref<'' | 'published' | 'draft'>('')

const filteredData = computed(() => {
  const rows = query.data.value ?? []
  if (filterStatus.value === 'published') return rows.filter((v: MusicVideo) => !!v.published_at)
  if (filterStatus.value === 'draft') return rows.filter((v: MusicVideo) => !v.published_at)
  return rows
})

const { t } = useI18n()
const tc = useTableControls<MusicVideo>({
  data: filteredData,
  searchFn: (v, q) => v.title.toLowerCase().includes(q) || v.video_url.toLowerCase().includes(q),
  defaultSort: 'sort_order',
})

function openCreate() { editing.value = null; showModal.value = true }
function openEdit(v: MusicVideo) { editing.value = v; showModal.value = true }
// Only the flag: `editing` stays for the 150 ms leave fade, or the form
// would blank and retitle mid-fade. openCreate/openEdit set it anew.
function closeModal() { showModal.value = false }

async function submit(payload: MusicVideoPayload) {
  try {
    if (editing.value) {
      await update.mutateAsync({ id: editing.value.id, payload })
      toast.success(t('media.videos.updated'))
    } else {
      await create.mutateAsync(payload)
      toast.success(t('media.videos.added'))
    }
    closeModal()
  } catch (e) {
    reportSaveError(e, t('media.videos.saveFailed'))
  }
}

function requestDelete(id: number) {
  confirmId.value   = id
  confirmOpen.value = true
}

async function confirmDelete() {
  if (confirmId.value == null) return
  confirmLoading.value = true
  try {
    await remove.mutateAsync(confirmId.value)
    toast.success(t('media.videos.deleted'))
  } catch (e) {
    reportSaveError(e, t('media.videos.deleteFailed'))
  } finally {
    confirmLoading.value = false
    confirmOpen.value    = false
    confirmId.value      = null
  }
}

function videoHost(url: string): 'youtube' | 'vimeo' | 'other' {
  if (url.includes('youtu')) return 'youtube'
  if (url.includes('vimeo')) return 'vimeo'
  return 'other'
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color:var(--c-e2e8f0);">{{ $t('media.videos.title') }}</h1>
          <p class="text-xs mt-0.5" style="color:var(--c-334155);">{{ $t('media.videos.subtitle') }}</p>
        </div>
        <div class="header-right">
          <!-- Total views stat -->
          <div v-if="totalViews > 0" class="views-stat">
            <span class="views-stat-num">{{ totalViews.toLocaleString() }}</span>
            <span class="views-stat-label">{{ $t('media.videos.totalViewsLabel') }}</span>
            <span v-if="lastSyncedAt" class="views-stat-ts">{{ $t('media.videos.syncedAt', { at: lastSyncedAt }) }}</span>
          </div>
          <button
            class="btn-sync"
            :disabled="syncViews.isPending.value"
            @click="doSyncViews"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0020.49 15"/>
            </svg>
            {{ syncViews.isPending.value ? $t('media.videos.syncing') : $t('media.videos.syncViews') }}
          </button>
          <button @click="openCreate" class="btn-add-primary">{{ $t('media.videos.add') }}</button>
        </div>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">{{ $t('common.state.loading') }}</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:var(--c-f87171);">{{ $t('media.videos.loadFailed') }}</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value">
            <template #filters>
              <select v-model="filterStatus" class="filter-select">
                <option value="">{{ $t('media.videos.allStatuses') }}</option>
                <option value="published">{{ $t('media.videos.published') }}</option>
                <option value="draft">{{ $t('media.videos.draft') }}</option>
              </select>
            </template>
          </TableToolbar>

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!(query.data.value?.length)">{{ $t('media.videos.empty') }}</span>
            <span v-else>{{ $t('media.videos.noMatch') }}</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid var(--c-222222);">
                <th class="th" style="width:5rem;">{{ $t('media.videos.columns.preview') }}</th>
                <SortHeader :label="$t('media.videos.columns.title')" sort-key="title" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">{{ $t('media.videos.columns.url') }}</th>
                <SortHeader :label="$t('media.videos.columns.published')" sort-key="published_at" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader :label="$t('media.videos.columns.views')" sort-key="view_count" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="6rem" @sort="tc.toggleSort" />
                <SortHeader :label="$t('media.videos.columns.order')" sort-key="sort_order" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="4rem" @sort="tc.toggleSort" />
                <th class="th text-right" style="width:12rem;">{{ $t('media.videos.columns.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in tc.paginated.value" :key="v.id" class="table-row">
                <td class="td">
                  <img v-if="v.og_image" :src="v.og_image" class="video-thumb" alt="" />
                  <div v-else class="video-thumb-empty">▶</div>
                </td>
                <td class="td font-medium" style="color:var(--c-e2e8f0);">
                  {{ v.title }}
                  <div style="font-size:var(--fs-2xs);color:var(--c-475569);font-weight:400;display:flex;gap:0.5rem;margin-top:1px;">
                    <span v-if="v.channel_name">{{ v.channel_name }}</span>
                    <span v-if="v.duration">· {{ v.duration }}</span>
                  </div>
                </td>
                <td class="td">
                  <a :href="v.video_url" target="_blank" rel="noopener noreferrer" class="url-link">
                    {{ $t(`media.videos.hosts.${videoHost(v.video_url)}`) }} ↗
                  </a>
                </td>
                <td class="td" style="color:var(--c-475569); font-size:var(--fs-xs);">{{ v.published_at ?? '—' }}</td>
                <td class="td views-cell">
                  <span v-if="v.view_count !== null" class="views-num">{{ v.view_count.toLocaleString() }}</span>
                  <span v-else class="views-none">—</span>
                </td>
                <td class="td" style="color:var(--c-475569);">{{ v.sort_order }}</td>
                <td class="td text-right">
                  <button
                    @click="doFetchPreview(v.id)"
                    :disabled="fetchingPreviewId === v.id"
                    class="btn-preview"
                  >{{ fetchingPreviewId === v.id ? '…' : $t('media.videos.preview') }}</button>
                  <button @click="openEdit(v)" class="btn-edit">{{ $t('common.actions.edit') }}</button>
                  <button @click="requestDelete(v.id)" class="btn-delete">{{ $t('common.actions.delete') }}</button>
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

    <AdminModal
      :open="showModal"
      :title="editing ? $t('media.videos.modalEdit') : $t('media.videos.modalNew')"
      max-width="32rem"
      @close="closeModal"
    >
      <MusicVideoForm
        :initial="editing"
        :members="membersQ.data.value ?? []"
        :next-sort-order="query.data.value?.length ?? 0"
        :loading="create.isPending.value || update.isPending.value"
        @submit="submit"
        @cancel="closeModal"
      />
    </AdminModal>

    <ConfirmDialog
      :open="confirmOpen"
      :message="$t('media.videos.deleteConfirm')"
      :loading="confirmLoading"
      @confirm="confirmDelete"
      @cancel="confirmOpen = false"
    />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped src="../../components/admin/form-styles.css" />
<style scoped>
.url-link {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--c-c0c0c0);
  text-decoration: none;
  transition: color 120ms;
}
.url-link:hover { color: var(--c-d0d0d0); }
.video-thumb {
  width: 4.5rem;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: 0.25rem;
  display: block;
  background: var(--c-1a1a1a);
}
.video-thumb-empty {
  width: 4.5rem;
  aspect-ratio: 16/9;
  border-radius: 0.25rem;
  background: var(--c-1a1a1a);
  border: 1px solid var(--c-222222);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-md);
  color: var(--c-334155);
}

.btn-preview {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: var(--fs-xs);
  font-weight: 500;
  background: var(--c-0f2a1e);
  color: var(--c-34d399);
  border: 1px solid var(--c-065f46);
  cursor: pointer;
  margin-right: 0.25rem;
  transition: background 120ms;
}
.btn-preview:hover:not(:disabled) { background: var(--c-134e35); }
.btn-preview:disabled { opacity: 0.5; cursor: not-allowed; }

.header-right {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.views-stat {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  background: var(--c-111111);
  border: 1px solid var(--c-222222);
  border-radius: 0.5rem;
  padding: 0.3rem 0.75rem;
}
.views-stat-num {
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--c-38bdf8);
  letter-spacing: -0.02em;
}
.views-stat-label {
  font-size: var(--fs-2xs);
  color: var(--c-475569);
  font-weight: 500;
}
.views-stat-ts {
  font-size: var(--fs-2xs);
  color: var(--c-334155);
}

.btn-sync {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.4rem;
  font-size: var(--fs-xs);
  font-weight: 500;
  background: var(--c-111111);
  color: var(--c-38bdf8);
  border: 1px solid var(--c-222222);
  cursor: pointer;
  transition: background 120ms;
}
.btn-sync:hover:not(:disabled) { background: var(--c-0f2540); }
.btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }

.views-cell { font-size: var(--fs-sm); }
.views-num  { color: var(--c-38bdf8); font-weight: 600; font-variant-numeric: tabular-nums; }
.views-none { color: var(--c-334155); }

</style>
