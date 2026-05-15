<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useQueryClient } from '@tanstack/vue-query'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import ReleaseForm from '@/components/admin/forms/ReleaseForm.vue'
import ImageDropZone from '@/components/admin/forms/ImageDropZone.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useReleases } from '@/composables/useReleases'
import { useRelease } from '@/composables/useRelease'
import { useTableControls } from '@/composables/useTableControls'
import { useAuth } from '@/composables/useAuth'
import {
  uploadReleaseCover,
  deleteReleaseCover,
  addReleasePhotos,
  removeReleasePhoto,
  reorderReleasePhotos,
} from '@/api/releases'
import type { UploadProgress } from '@/api/releases'
import { ApiValidationError } from '@/api/client'
import type { Release, ReleaseSummary, ReleasePayload, ReleasePhoto } from '@/types/release'

const TYPE_BADGE: Record<string, string> = {
  LP:          '#4338ca',
  EP:          '#0891b2',
  single:      '#059669',
  compilation: '#b45309',
}

const { query, create, update, remove } = useReleases()
const { token } = useAuth()
const queryClient = useQueryClient()

const filterType = ref('')

const filteredData = computed(() => {
  const rows = query.data.value ?? []
  return filterType.value ? rows.filter((r: ReleaseSummary) => r.type === filterType.value) : rows
})

const tc = useTableControls<ReleaseSummary>({
  data: filteredData,
  searchFn: (r, q) => r.title.toLowerCase().includes(q) || r.type.toLowerCase().includes(q),
  defaultSort: 'release_date',
  defaultDir: 'desc',
})

// ── Modal state ───────────────────────────────────────────────
const showModal    = ref(false)
const isCreating   = ref(false)
const editingId    = ref<number | null>(null)
const fieldErrors  = ref<Record<string, string[]>>({})
const confirmId    = ref<number | null>(null)

const fullRecord   = useRelease(editingId)
const modalTitle   = computed(() =>
  isCreating.value ? 'New release' : (fullRecord.data.value?.title ?? 'Edit release'),
)

function openCreate() {
  isCreating.value  = true
  editingId.value   = null
  fieldErrors.value = {}
  localPhotos.value = []
  originalOrder.value = []
  pendingPhotos.value = []
  showModal.value   = true
}

function openEdit(r: ReleaseSummary) {
  isCreating.value  = false
  editingId.value   = r.id
  fieldErrors.value = {}
  pendingPhotos.value = []
  showModal.value   = true
}

function closeModal() {
  showModal.value     = false
  editingId.value     = null
  localPhotos.value   = []
  originalOrder.value = []
  pendingPhotos.value = []
  photoUploading.value = false
}

// ── Main form submit ──────────────────────────────────────────
async function handleSubmit(payload: ReleasePayload, coverFile: File | null, deleteCover: boolean) {
  fieldErrors.value = {}
  try {
    let result: Release
    if (isCreating.value) {
      result = await create.mutateAsync(payload)
    } else {
      result = await update.mutateAsync({ id: editingId.value!, payload })
    }

    if (coverFile) {
      await uploadReleaseCover(token.value!, result.id, coverFile)
      await queryClient.invalidateQueries({ queryKey: ['releases'] })
    } else if (deleteCover) {
      await deleteReleaseCover(token.value!, result.id)
      await queryClient.invalidateQueries({ queryKey: ['releases'] })
    }

    toast.success(isCreating.value ? 'Release created' : 'Release updated')
    closeModal()
  } catch (e) {
    if (e instanceof ApiValidationError) fieldErrors.value = e.errors
    else toast.error('Something went wrong')
  }
}

async function confirmDelete() {
  if (confirmId.value == null) return
  try {
    await remove.mutateAsync(confirmId.value)
    toast.success('Release deleted')
    confirmId.value = null
  } catch {
    toast.error('Failed to delete')
  }
}

// ── Photos management ─────────────────────────────────────────
const localPhotos    = ref<ReleasePhoto[]>([])
const originalOrder  = ref<number[]>([])
const draggedIdx     = ref<number | null>(null)
const orderDirty     = computed(() =>
  localPhotos.value.map((p) => p.id).join(',') !== originalOrder.value.join(','),
)
const pendingPhotos  = ref<{ file: File; caption: string }[]>([])
const photoUploading = ref(false)
const photoProgress  = ref<UploadProgress | null>(null)
const dropZoneRef    = ref<{ clear: () => void } | null>(null)

watch(
  () => fullRecord.data.value?.photos,
  (photos) => {
    if (photos) {
      localPhotos.value  = [...photos]
      originalOrder.value = photos.map((p: ReleasePhoto) => p.id)
    }
  },
  { immediate: true },
)

function onPhotoDragStart(idx: number) { draggedIdx.value = idx }

function onPhotoDragOver(idx: number) {
  if (draggedIdx.value === null || draggedIdx.value === idx) return
  const items = [...localPhotos.value]
  const [moved] = items.splice(draggedIdx.value, 1)
  items.splice(idx, 0, moved)
  localPhotos.value = items
  draggedIdx.value  = idx
}

function onPhotoDragEnd() { draggedIdx.value = null }

async function savePhotoOrder() {
  if (!editingId.value) return
  try {
    await reorderReleasePhotos(token.value!, editingId.value, localPhotos.value.map((p) => p.id))
    originalOrder.value = localPhotos.value.map((p) => p.id)
    toast.success('Order saved')
  } catch {
    toast.error('Failed to save order')
  }
}

async function deletePhoto(photoId: number) {
  if (!editingId.value) return
  try {
    await removeReleasePhoto(token.value!, editingId.value, photoId)
    localPhotos.value   = localPhotos.value.filter((p) => p.id !== photoId)
    originalOrder.value = localPhotos.value.map((p) => p.id)
    await queryClient.invalidateQueries({ queryKey: ['releases'] })
  } catch {
    toast.error('Failed to delete photo')
  }
}

async function uploadPhotos() {
  if (!editingId.value || !pendingPhotos.value.length) return
  photoUploading.value = true
  photoProgress.value  = null
  try {
    const updated = await addReleasePhotos(
      token.value!, editingId.value, pendingPhotos.value,
      (p) => { photoProgress.value = p },
    )
    localPhotos.value   = updated.photos ?? []
    originalOrder.value = localPhotos.value.map((p) => p.id)
    pendingPhotos.value = []
    dropZoneRef.value?.clear()
    await queryClient.invalidateQueries({ queryKey: ['releases'] })
    toast.success(`${updated.photos?.length ?? 0} photos added`)
  } catch {
    toast.error('Upload failed')
  } finally {
    photoUploading.value = false
    photoProgress.value  = null
  }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Releases</h1>
        <button @click="openCreate" class="btn-add-primary">+ Add release</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="py-12 text-center text-sm" style="color:#475569;">Loading…</div>
        <div v-else-if="query.isError.value" class="py-12 text-center text-sm" style="color:#f87171;">Failed to load releases.</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value">
            <template #filters>
              <select v-model="filterType" class="filter-select">
                <option value="">All types</option>
                <option value="LP">LP</option>
                <option value="EP">EP</option>
                <option value="single">Single</option>
                <option value="compilation">Compilation</option>
              </select>
            </template>
          </TableToolbar>

          <div v-if="!tc.paginated.value.length" class="py-12 text-center text-sm" style="color:#475569;">
            <span v-if="!(query.data.value?.length)">No releases yet. Add the first one above.</span>
            <span v-else>No releases match your search.</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #1a1a3a;">
                <th class="th" style="width:3.5rem;">Cover</th>
                <SortHeader label="Title" sort-key="title" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader label="Type" sort-key="type" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="5rem" @sort="tc.toggleSort" />
                <SortHeader label="Released" sort-key="release_date" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="8rem" @sort="tc.toggleSort" />
                <th class="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in tc.paginated.value" :key="r.id" class="table-row">
                <td class="td">
                  <img v-if="r.cover_image" :src="r.cover_image" :alt="r.title" class="cover-thumb" />
                  <div v-else class="cover-placeholder">♪</div>
                </td>
                <td class="td font-medium" style="color:#e2e8f0;">{{ r.title }}</td>
                <td class="td">
                  <span class="type-badge" :style="`background:${TYPE_BADGE[r.type]}22; color:${TYPE_BADGE[r.type]}; border-color:${TYPE_BADGE[r.type]}44;`">{{ r.type }}</span>
                </td>
                <td class="td" style="color:#64748b;">{{ r.release_date ?? '—' }}</td>
                <td class="td text-right">
                  <button @click="openEdit(r)" class="btn-edit">Edit</button>
                  <button @click="confirmId = r.id" class="btn-delete">Delete</button>
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

    <AdminModal :open="showModal" :title="modalTitle" max-width="56rem" @close="closeModal">
      <div v-if="!isCreating && fullRecord.isPending.value" class="py-8 text-center text-sm" style="color:#475569;">
        Loading release…
      </div>
      <template v-else>
        <ReleaseForm
          :initial="isCreating ? null : (fullRecord.data.value ?? null)"
          :loading="create.isPending.value || update.isPending.value"
          :errors="fieldErrors"
          @submit="handleSubmit"
          @cancel="closeModal"
        />

        <!-- Photos section — edit only -->
        <template v-if="!isCreating && fullRecord.data.value">
          <div class="photos-divider">Release Photos</div>

          <div v-if="localPhotos.length" class="rp-grid">
            <div
              v-for="(photo, i) in localPhotos"
              :key="photo.id"
              class="rp-card"
              :class="{ 'rp-dragging': draggedIdx === i }"
              draggable="true"
              @dragstart="onPhotoDragStart(i)"
              @dragover.prevent="onPhotoDragOver(i)"
              @dragend="onPhotoDragEnd"
            >
              <img
                v-if="photo.image_url"
                :src="photo.image_url"
                :alt="photo.caption ?? ''"
                class="rp-thumb"
              />
              <div v-else class="rp-thumb-placeholder">♪</div>
              <button type="button" class="rp-del" @click.stop="deletePhoto(photo.id)" title="Delete">✕</button>
              <div v-if="photo.caption" class="rp-caption">{{ photo.caption }}</div>
            </div>
          </div>
          <p v-else class="rp-empty">No additional photos yet.</p>

          <div v-if="orderDirty" class="rp-order-row">
            <button type="button" class="rp-btn-save" @click="savePhotoOrder">Save order</button>
          </div>

          <!-- Add photos -->
          <div class="rp-add">
            <div class="rp-add-title">Add photos</div>
            <ImageDropZone
              ref="dropZoneRef"
              :uploading="photoUploading"
              @change="pendingPhotos = $event"
            />
            <div v-if="photoUploading" class="rp-progress-wrap">
              <div class="rp-progress-bar">
                <div class="rp-progress-fill" :style="`width:${photoProgress?.percent ?? 0}%`" />
              </div>
              <span class="rp-progress-label">Uploading… {{ photoProgress?.percent ?? 0 }}%</span>
            </div>
            <div class="flex justify-end pt-2">
              <button
                type="button"
                :disabled="!pendingPhotos.length || photoUploading"
                class="rp-btn-upload"
                @click="uploadPhotos"
              >
                {{ photoUploading
                  ? 'Uploading…'
                  : `Upload ${pendingPhotos.length} photo${pendingPhotos.length !== 1 ? 's' : ''}` }}
              </button>
            </div>
          </div>
        </template>
      </template>
    </AdminModal>

    <ConfirmDialog
      :open="confirmId !== null"
      message="This release and all its tracks will be permanently deleted."
      :loading="remove.isPending.value"
      @confirm="confirmDelete"
      @cancel="confirmId = null"
    />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped>
.cover-thumb {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.25rem;
  object-fit: cover;
  border: 1px solid #1a1a38;
}
.cover-placeholder {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.25rem;
  background: #111128;
  border: 1px solid #1a1a38;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: #334155;
}
.type-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* ── Photos section ──────────────────────────────────────────── */
.photos-divider {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #475569;
  border-top: 1px solid #1e1a4a;
  margin-top: 1.5rem;
  padding-top: 0.875rem;
  margin-bottom: 0.75rem;
}
.rp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 0.5rem;
}
.rp-card {
  position: relative;
  border: 1px solid #1a1a38;
  border-radius: 6px;
  overflow: hidden;
  cursor: grab;
  background: #0d0d22;
  transition: opacity 0.15s;
}
.rp-card:active { cursor: grabbing; }
.rp-dragging { opacity: 0.35; }
.rp-thumb { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
.rp-thumb-placeholder {
  width: 100%; aspect-ratio: 4/3; display: flex; align-items: center;
  justify-content: center; color: #334155; font-size: 1.25rem; background: #111128;
}
.rp-del {
  position: absolute; top: 3px; right: 3px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #0d0d22cc; border: 1px solid #3a1212;
  color: #f87171; font-size: 0.55rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 100ms;
}
.rp-del:hover { background: #3f1212; }
.rp-caption {
  font-size: 0.62rem; color: #475569; padding: 2px 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rp-empty { font-size: 0.8125rem; color: #475569; padding: 0.5rem 0; }
.rp-order-row { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
.rp-btn-save {
  padding: 0.3rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem;
  font-weight: 600; cursor: pointer; background: #1e1b4b;
  border: 1px solid #312e81; color: #a5b4fc; transition: background 100ms;
}
.rp-btn-save:hover { background: #2d2a6e; }

.rp-add { margin-top: 0.875rem; display: flex; flex-direction: column; gap: 0.5rem; }
.rp-add-title {
  font-size: 0.72rem; font-weight: 600; color: #475569;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.rp-progress-wrap  { display: flex; flex-direction: column; gap: 0.3rem; }
.rp-progress-bar   { height: 4px; background: #1e1a4a; border-radius: 9999px; overflow: hidden; }
.rp-progress-fill  { height: 100%; background: #6366f1; border-radius: 9999px; transition: width 0.2s ease; }
.rp-progress-label { font-size: 0.7rem; color: #94a3b8; text-align: center; }
.rp-btn-upload {
  padding: 0.35rem 1rem; border-radius: 0.375rem; font-size: 0.78rem;
  font-weight: 600; cursor: pointer; background: #4f46e5;
  border: 1px solid #4338ca; color: #fff; transition: background 100ms;
}
.rp-btn-upload:hover:not(:disabled) { background: #4338ca; }
.rp-btn-upload:disabled { opacity: 0.4; cursor: default; }
</style>
