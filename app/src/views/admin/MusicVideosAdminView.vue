<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useMusicVideos } from '@/composables/useMusicVideos'
import { useTableControls } from '@/composables/useTableControls'
import type { MusicVideo, MusicVideoPayload } from '@/types/musicVideo'

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
    toast.success(`Synced ${result.updated} video${result.updated === 1 ? '' : 's'} · ${result.total_views.toLocaleString()} total views`)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to sync YouTube views')
  }
}

async function doFetchPreview(id: number) {
  fetchingPreviewId.value = id
  try {
    await previewFetch.mutateAsync(id)
    toast.success('Preview fetched')
  } catch {
    toast.error('Could not fetch preview for this URL')
  } finally {
    fetchingPreviewId.value = null
  }
}

const showModal = ref(false)
const editing   = ref<MusicVideo | null>(null)

const form = reactive<MusicVideoPayload>({
  title:        '',
  video_url:    '',
  published_at: null,
  sort_order:   0,
})

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

const tc = useTableControls<MusicVideo>({
  data: filteredData,
  searchFn: (v, q) => v.title.toLowerCase().includes(q) || v.video_url.toLowerCase().includes(q),
  defaultSort: 'sort_order',
})

function openCreate() {
  editing.value     = null
  form.title        = ''
  form.video_url    = ''
  form.published_at = null
  form.sort_order   = query.data.value?.length ?? 0
  showModal.value   = true
}

function openEdit(v: MusicVideo) {
  editing.value     = v
  form.title        = v.title
  form.video_url    = v.video_url
  form.published_at = v.published_at
  form.sort_order   = v.sort_order
  showModal.value   = true
}

function closeModal() { showModal.value = false; editing.value = null }

async function submit() {
  const payload: MusicVideoPayload = {
    title:        form.title,
    video_url:    form.video_url,
    published_at: form.published_at || null,
    sort_order:   Number(form.sort_order),
  }
  try {
    if (editing.value) {
      await update.mutateAsync({ id: editing.value.id, payload })
      toast.success('Music video updated')
    } else {
      await create.mutateAsync(payload)
      toast.success('Music video added')
    }
    closeModal()
  } catch {
    toast.error('Failed to save music video')
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
    toast.success('Music video deleted')
  } catch {
    toast.error('Failed to delete music video')
  } finally {
    confirmLoading.value = false
    confirmOpen.value    = false
    confirmId.value      = null
  }
}

function videoHost(url: string): string {
  if (url.includes('youtu')) return 'YouTube'
  if (url.includes('vimeo')) return 'Vimeo'
  return 'Video'
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Music Videos</h1>
          <p class="text-xs mt-0.5" style="color:#334155;">YouTube and Vimeo links shown on your EPK.</p>
        </div>
        <div class="header-right">
          <!-- Total views stat -->
          <div v-if="totalViews > 0" class="views-stat">
            <span class="views-stat-num">{{ totalViews.toLocaleString() }}</span>
            <span class="views-stat-label">total views</span>
            <span v-if="lastSyncedAt" class="views-stat-ts">· synced {{ lastSyncedAt }}</span>
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
            {{ syncViews.isPending.value ? 'Syncing…' : 'Sync YouTube views' }}
          </button>
          <button @click="openCreate" class="btn-add-primary">+ Add video</button>
        </div>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">Loading…</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">Failed to load music videos.</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value">
            <template #filters>
              <select v-model="filterStatus" class="filter-select">
                <option value="">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </template>
          </TableToolbar>

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!(query.data.value?.length)">No music videos yet. Add YouTube or Vimeo URLs to showcase your work.</span>
            <span v-else>No videos match your search.</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #222222;">
                <th class="th" style="width:5rem;">Preview</th>
                <SortHeader label="Title" sort-key="title" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">URL / Channel</th>
                <SortHeader label="Published" sort-key="published_at" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader label="Views" sort-key="view_count" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="6rem" @sort="tc.toggleSort" />
                <SortHeader label="Order" sort-key="sort_order" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="4rem" @sort="tc.toggleSort" />
                <th class="th text-right" style="width:12rem;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in tc.paginated.value" :key="v.id" class="table-row">
                <td class="td">
                  <img v-if="v.og_image" :src="v.og_image" class="video-thumb" alt="" />
                  <div v-else class="video-thumb-empty">▶</div>
                </td>
                <td class="td font-medium" style="color:#e2e8f0;">
                  {{ v.title }}
                  <div v-if="v.channel_name" style="font-size:0.7rem;color:#475569;font-weight:400;">{{ v.channel_name }}</div>
                </td>
                <td class="td">
                  <a :href="v.video_url" target="_blank" rel="noopener noreferrer" class="url-link">
                    {{ videoHost(v.video_url) }} ↗
                  </a>
                </td>
                <td class="td" style="color:#475569; font-size:0.75rem;">{{ v.published_at ?? '—' }}</td>
                <td class="td views-cell">
                  <span v-if="v.view_count !== null" class="views-num">{{ v.view_count.toLocaleString() }}</span>
                  <span v-else class="views-none">—</span>
                </td>
                <td class="td" style="color:#475569;">{{ v.sort_order }}</td>
                <td class="td text-right">
                  <button
                    @click="doFetchPreview(v.id)"
                    :disabled="fetchingPreviewId === v.id"
                    class="btn-preview"
                  >{{ fetchingPreviewId === v.id ? '…' : 'Preview' }}</button>
                  <button @click="openEdit(v)" class="btn-edit">Edit</button>
                  <button @click="requestDelete(v.id)" class="btn-delete">Delete</button>
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
      :title="editing ? 'Edit video' : 'Add video'"
      max-width="32rem"
      @close="closeModal"
    >
      <form @submit.prevent="submit" class="flex flex-col gap-4">
        <div>
          <label class="field-label">Title <span class="field-req">*</span></label>
          <input v-model="form.title" required class="field-input" placeholder="Video title" />
        </div>
        <div>
          <label class="field-label">YouTube / Vimeo URL <span class="field-req">*</span></label>
          <input v-model="form.video_url" required type="url" class="field-input" placeholder="https://youtu.be/…" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">Published date</label>
            <input v-model="form.published_at" type="date" class="field-input" />
          </div>
          <div>
            <label class="field-label">Sort order</label>
            <input v-model="form.sort_order" type="number" min="0" class="field-input" />
          </div>
        </div>
        <div class="flex gap-2 justify-end pt-1">
          <button type="button" class="btn-ghost" @click="closeModal">Cancel</button>
          <button type="submit" :disabled="create.isPending.value || update.isPending.value" class="btn-primary">
            {{ (create.isPending.value || update.isPending.value) ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </AdminModal>

    <ConfirmDialog
      :open="confirmOpen"
      message="This music video will be permanently deleted."
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
  font-size: 0.75rem;
  font-weight: 500;
  color: #c0c0c0;
  text-decoration: none;
  transition: color 120ms;
}
.url-link:hover { color: #d0d0d0; }
.field-req { color: #f87171; }

.video-thumb {
  width: 4.5rem;
  aspect-ratio: 16/9;
  object-fit: cover;
  border-radius: 0.25rem;
  display: block;
  background: #1a1a1a;
}
.video-thumb-empty {
  width: 4.5rem;
  aspect-ratio: 16/9;
  border-radius: 0.25rem;
  background: #1a1a1a;
  border: 1px solid #222222;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: #334155;
}

.btn-preview {
  padding: 0.25rem 0.5rem;
  border-radius: 0.3rem;
  font-size: 0.72rem;
  font-weight: 500;
  background: #0f2a1e;
  color: #34d399;
  border: 1px solid #065f46;
  cursor: pointer;
  margin-right: 0.25rem;
  transition: background 120ms;
}
.btn-preview:hover:not(:disabled) { background: #134e35; }
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
  background: #111111;
  border: 1px solid #222222;
  border-radius: 0.5rem;
  padding: 0.3rem 0.75rem;
}
.views-stat-num {
  font-size: 1rem;
  font-weight: 700;
  color: #38bdf8;
  letter-spacing: -0.02em;
}
.views-stat-label {
  font-size: 0.7rem;
  color: #475569;
  font-weight: 500;
}
.views-stat-ts {
  font-size: 0.65rem;
  color: #334155;
}

.btn-sync {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.4rem;
  font-size: 0.78rem;
  font-weight: 500;
  background: #111111;
  color: #38bdf8;
  border: 1px solid #222222;
  cursor: pointer;
  transition: background 120ms;
}
.btn-sync:hover:not(:disabled) { background: #0f2540; }
.btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }

.views-cell { font-size: 0.8rem; }
.views-num  { color: #38bdf8; font-weight: 600; font-variant-numeric: tabular-nums; }
.views-none { color: #334155; }
</style>
