<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
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
import type { Release, ReleaseSummary, ReleasePayload, ReleasePhoto, ReleaseType } from '@/types/release'
import { reportSaveError } from '@/utils/formErrors'

/** Display order of the filter; the values are the persisted ReleaseType. */
const RELEASE_TYPES: ReleaseType[] = ['LP', 'EP', 'single', 'compilation'] // i18n-ignore: persisted ReleaseType values

const TYPE_BADGE: Record<string, string> = {
  LP:          'var(--c-888888)',
  EP:          'var(--c-0891b2)',
  single:      'var(--c-059669)',
  compilation: 'var(--c-b45309)',
}

/** CSS for the type badge — a colour, not copy. */
const typeBadgeStyle = (type: string) => ({
  background: `color-mix(in srgb, ${TYPE_BADGE[type]} 13%, transparent)`, // i18n-ignore: CSS
  color: TYPE_BADGE[type],
  borderColor: `color-mix(in srgb, ${TYPE_BADGE[type]} 27%, transparent)`, // i18n-ignore: CSS
})

const { query, create, update, remove } = useReleases()
const { token } = useAuth()
const { t } = useI18n()
const queryClient = useQueryClient()

const filterType = ref('')

const filteredData = computed(() => {
  const rows = query.data.value ?? []
  return filterType.value ? rows.filter((r: ReleaseSummary) => r.type === filterType.value) : rows
})

const tc = useTableControls<ReleaseSummary>({
  data: filteredData,
  // Match the label the reader can see as well as the stored value. With
  // only the latter, a Polish admin typing "singiel" got "no matches" while
  // Singiel rows sat visibly in the table.
  searchFn: (r, q) =>
    r.title.toLowerCase().includes(q) ||
    r.type.toLowerCase().includes(q) ||
    t(`media.releases.types.${r.type}`).toLowerCase().includes(q),
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
  isCreating.value ? t('media.releases.modalNew') : (fullRecord.data.value?.title ?? t('media.releases.modalEdit')),
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

    toast.success(isCreating.value ? t('media.releases.created') : t('media.releases.updated'))
    closeModal()
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors)
  }
}

async function confirmDelete() {
  if (confirmId.value == null) return
  try {
    await remove.mutateAsync(confirmId.value)
    toast.success(t('media.releases.deleted'))
    confirmId.value = null
  } catch (e) {
    reportSaveError(e, t('media.releases.deleteFailed'))
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
    toast.success(t('media.releases.orderSaved'))
  } catch (e) {
    reportSaveError(e, t('media.releases.orderFailed'))
  }
}

async function deletePhoto(photoId: number) {
  if (!editingId.value) return
  try {
    await removeReleasePhoto(token.value!, editingId.value, photoId)
    localPhotos.value   = localPhotos.value.filter((p) => p.id !== photoId)
    originalOrder.value = localPhotos.value.map((p) => p.id)
    await queryClient.invalidateQueries({ queryKey: ['releases'] })
  } catch (e) {
    reportSaveError(e, t('media.releases.photoDeleteFailed'))
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
    const added = updated.photos?.length ?? 0
    toast.success(t('media.releases.photosAdded', added, { named: { n: added } }))
  } catch (e) {
    reportSaveError(e, t('media.releases.uploadFailed'))
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
        <h1 class="text-lg font-semibold" style="color:var(--c-e2e8f0);">{{ $t('media.releases.title') }}</h1>
        <button @click="openCreate" class="btn-add-primary">{{ $t('media.releases.add') }}</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="py-12 text-center text-sm" style="color:var(--c-475569);">{{ $t('common.state.loading') }}</div>
        <div v-else-if="query.isError.value" class="py-12 text-center text-sm" style="color:var(--c-f87171);">{{ $t('media.releases.loadFailed') }}</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value">
            <template #filters>
              <select v-model="filterType" class="filter-select">
                <option value="">{{ $t('media.releases.allTypes') }}</option>
                <option v-for="rt in RELEASE_TYPES" :key="rt" :value="rt">{{ $t(`media.releases.types.${rt}`) }}</option>
              </select>
            </template>
          </TableToolbar>

          <div v-if="!tc.paginated.value.length" class="py-12 text-center text-sm" style="color:var(--c-475569);">
            <span v-if="!(query.data.value?.length)">{{ $t('media.releases.empty') }}</span>
            <span v-else>{{ $t('media.releases.noMatch') }}</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid var(--c-222222);">
                <th class="th" style="width:3.5rem;">{{ $t('media.releases.columns.cover') }}</th>
                <SortHeader :label="$t('media.releases.columns.title')" sort-key="title" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader :label="$t('media.releases.columns.type')" sort-key="type" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="5rem" @sort="tc.toggleSort" />
                <SortHeader :label="$t('media.releases.columns.released')" sort-key="release_date" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="8rem" @sort="tc.toggleSort" />
                <th class="th text-right">{{ $t('media.releases.columns.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in tc.paginated.value" :key="r.id" class="table-row">
                <td class="td">
                  <img v-if="r.cover_image" :src="r.cover_image" :alt="r.title" class="cover-thumb" />
                  <div v-else class="cover-placeholder">♪</div>
                </td>
                <td class="td font-medium" style="color:var(--c-e2e8f0);">{{ r.title }}</td>
                <td class="td">
                  <span class="type-badge" :style="typeBadgeStyle(r.type)">{{ $t(`media.releases.types.${r.type}`) }}</span>
                </td>
                <td class="td" style="color:var(--c-64748b);">{{ r.release_date ?? '—' }}</td>
                <td class="td text-right">
                  <button @click="openEdit(r)" class="btn-edit">{{ $t('common.actions.edit') }}</button>
                  <button @click="confirmId = r.id" class="btn-delete">{{ $t('common.actions.delete') }}</button>
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
      <div v-if="!isCreating && fullRecord.isPending.value" class="py-8 text-center text-sm" style="color:var(--c-475569);">
        {{ $t('media.releases.loadingOne') }}
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
          <div class="photos-divider">{{ $t('media.releases.photos') }}</div>

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
              <button type="button" class="rp-del" @click.stop="deletePhoto(photo.id)" :title="$t('common.actions.delete')">✕</button>
              <div v-if="photo.caption" class="rp-caption">{{ photo.caption }}</div>
            </div>
          </div>
          <p v-else class="rp-empty">{{ $t('media.releases.photosEmpty') }}</p>

          <div v-if="orderDirty" class="rp-order-row">
            <button type="button" class="rp-btn-save" @click="savePhotoOrder">{{ $t('media.releases.saveOrder') }}</button>
          </div>

          <!-- Add photos -->
          <div class="rp-add">
            <div class="rp-add-title">{{ $t('media.releases.addPhotos') }}</div>
            <ImageDropZone
              ref="dropZoneRef"
              :uploading="photoUploading"
              @change="pendingPhotos = $event"
            />
            <div v-if="photoUploading" class="rp-progress-wrap">
              <div class="rp-progress-bar">
                <div class="rp-progress-fill" :style="`width:${photoProgress?.percent ?? 0}%`" />
              </div>
              <span class="rp-progress-label">{{ $t('media.releases.uploadingPct', { pct: photoProgress?.percent ?? 0 }) }}</span>
            </div>
            <div class="flex justify-end pt-2">
              <button
                type="button"
                :disabled="!pendingPhotos.length || photoUploading"
                class="rp-btn-upload"
                @click="uploadPhotos"
              >
                {{ photoUploading
                  ? $t('media.releases.uploading')
                  : $t('media.releases.uploadPhotos', pendingPhotos.length, { named: { n: pendingPhotos.length } }) }}
              </button>
            </div>
          </div>
        </template>
      </template>
    </AdminModal>

    <ConfirmDialog
      :open="confirmId !== null"
      :message="$t('media.releases.deleteConfirm')"
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
  border: 1px solid var(--c-222222);
}
.cover-placeholder {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.25rem;
  background: var(--c-1a1a1a);
  border: 1px solid var(--c-222222);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-base);
  color: var(--c-334155);
}
.type-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid;
  font-size: var(--fs-2xs);
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* ── Photos section ──────────────────────────────────────────── */
.photos-divider {
  font-size: var(--fs-2xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--c-475569);
  border-top: 1px solid var(--c-252525);
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
  border: 1px solid var(--c-222222);
  border-radius: 6px;
  overflow: hidden;
  cursor: grab;
  background: var(--c-141414);
  transition: opacity 0.15s;
}
.rp-card:active { cursor: grabbing; }
.rp-dragging { opacity: 0.35; }
.rp-thumb { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
.rp-thumb-placeholder {
  width: 100%; aspect-ratio: 4/3; display: flex; align-items: center;
  justify-content: center; color: var(--c-334155); font-size: var(--fs-xl); background: var(--c-1a1a1a);
}
.rp-del {
  position: absolute; top: 3px; right: 3px;
  width: 18px; height: 18px; border-radius: 50%;
  background: color-mix(in srgb, var(--c-141414) 80%, transparent); border: 1px solid var(--c-3a1212);
  color: var(--c-f87171); font-size: var(--fs-2xs); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 100ms;
}
.rp-del:hover { background: var(--c-3f1212); }
.rp-caption {
  font-size: var(--fs-2xs); color: var(--c-475569); padding: 2px 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rp-empty { font-size: var(--fs-sm); color: var(--c-475569); padding: 0.5rem 0; }
.rp-order-row { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
.rp-btn-save {
  padding: 0.3rem 0.875rem; border-radius: 0.375rem; font-size: var(--fs-xs);
  font-weight: 600; cursor: pointer; background: var(--c-2a2a2a);
  border: 1px solid var(--c-444444); color: var(--c-d0d0d0); transition: background 100ms;
}
.rp-btn-save:hover { background: var(--c-333333); }

.rp-add { margin-top: 0.875rem; display: flex; flex-direction: column; gap: 0.5rem; }
.rp-add-title {
  font-size: var(--fs-xs); font-weight: 600; color: var(--c-475569);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.rp-progress-wrap  { display: flex; flex-direction: column; gap: 0.3rem; }
.rp-progress-bar   { height: 4px; background: var(--c-252525); border-radius: 9999px; overflow: hidden; }
.rp-progress-fill  { height: 100%; background: var(--c-888888); border-radius: 9999px; transition: width 0.2s ease; }
.rp-progress-label { font-size: var(--fs-2xs); color: var(--c-94a3b8); text-align: center; }
.rp-btn-upload {
  padding: 0.35rem 1rem; border-radius: 0.375rem; font-size: var(--fs-xs);
  font-weight: 600; cursor: pointer; background: var(--c-333333);
  border: 1px solid var(--c-888888); color: var(--c-ffffff); transition: background 100ms;
}
.rp-btn-upload:hover:not(:disabled) { background: var(--c-888888); }
.rp-btn-upload:disabled { opacity: 0.4; cursor: default; }
</style>
