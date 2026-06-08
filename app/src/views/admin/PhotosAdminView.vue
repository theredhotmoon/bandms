<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { toast } from 'vue-sonner'
import { useQueryClient } from '@tanstack/vue-query'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import BatchPhotoUpload from '@/components/admin/forms/BatchPhotoUpload.vue'
import { useAlbums } from '@/composables/useAlbums'
import { useVenues } from '@/composables/useVenues'
import { useConcerts } from '@/composables/useConcerts'
import { useTags } from '@/composables/useTags'
import { useAuth } from '@/composables/useAuth'
import { batchCreateAlbum, removeAlbumPhoto } from '@/api/albums'
import { togglePhotoEpkFeatured } from '@/api/photos'
import type { UploadProgress } from '@/api/albums'
import { ApiValidationError } from '@/api/client'
import type { Album, AlbumPayload, AlbumPhoto } from '@/types/album'

const { query, update, remove, reorderPhotos } = useAlbums()
const { query: venuesQ } = useVenues()
const { query: concertsQ } = useConcerts()
const { query: tagsQ } = useTags()
const { token } = useAuth()
const queryClient = useQueryClient()

// ── Batch upload ──────────────────────────────────────────────
const showBatch = ref(false)
const batchUploading = ref(false)
const batchProgress = ref<UploadProgress | null>(null)

async function handleBatchUpload(
  files: { file: File; caption: string }[],
  meta: {
    title: string
    description: string | null
    venue_id: number | null
    concert_id: number | null
    taken_at: string | null
    published_at: string | null
    tag_ids: number[]
  },
) {
  batchUploading.value = true
  batchProgress.value = null
  try {
    const album = await batchCreateAlbum(token.value!, files, meta, (p) => {
      batchProgress.value = p
    })
    await queryClient.invalidateQueries({ queryKey: ['albums'] })
    toast.success(`Album "${album.title}" created with ${album.photos.length} photo${album.photos.length !== 1 ? 's' : ''}`)
    showBatch.value = false
  } catch {
    toast.error('Upload failed')
  } finally {
    batchUploading.value = false
    batchProgress.value = null
  }
}

// ── Edit album metadata ───────────────────────────────────────
const showEdit = ref(false)
const editAlbum = ref<Album | null>(null)
const editForm = reactive({
  title: '',
  description: '',
  venue_id: '' as string,
  concert_id: '' as string,
  taken_at: '',
  published_at: '',
  tag_ids: [] as number[],
})
const fieldErrors = ref<Record<string, string[]>>({})

function openEdit(album: Album) {
  editAlbum.value = album
  editForm.title        = album.title
  editForm.description  = album.description ?? ''
  editForm.venue_id     = album.venue?.id != null ? String(album.venue.id) : ''
  editForm.concert_id   = album.concert?.id != null ? String(album.concert.id) : ''
  editForm.taken_at     = album.taken_at ? album.taken_at.slice(0, 16) : ''
  editForm.published_at = album.published_at ? album.published_at.slice(0, 16) : ''
  editForm.tag_ids      = album.tags.map((t) => t.id)
  fieldErrors.value     = {}
  showEdit.value        = true
}

function toggleTag(id: number) {
  const idx = editForm.tag_ids.indexOf(id)
  if (idx === -1) editForm.tag_ids.push(id)
  else editForm.tag_ids.splice(idx, 1)
}

async function saveEdit() {
  if (!editAlbum.value) return
  fieldErrors.value = {}
  const payload: AlbumPayload = {
    title:        editForm.title,
    description:  editForm.description || null,
    venue_id:     editForm.venue_id ? parseInt(editForm.venue_id) : null,
    concert_id:   editForm.concert_id ? parseInt(editForm.concert_id) : null,
    taken_at:     editForm.taken_at || null,
    published_at: editForm.published_at || null,
    tag_ids:      editForm.tag_ids,
  }
  try {
    await update.mutateAsync({ id: editAlbum.value.id, payload })
    toast.success('Album updated')
    showEdit.value = false
  } catch (e) {
    if (e instanceof ApiValidationError) fieldErrors.value = e.errors
    else toast.error('Something went wrong')
  }
}

// ── Manage photos within album ────────────────────────────────
const viewAlbum = ref<Album | null>(null)
const showPhotos = ref(false)
const deletingPhotoId = ref<number | null>(null)
const localPhotos = ref<AlbumPhoto[]>([])
const originalOrder = ref<number[]>([])
const draggedIdx = ref<number | null>(null)
const orderDirty = computed(() =>
  localPhotos.value.map((p) => p.id).join(',') !== originalOrder.value.join(','),
)

function openPhotos(album: Album) {
  viewAlbum.value = album
  localPhotos.value = [...album.photos]
  originalOrder.value = album.photos.map((p) => p.id)
  showPhotos.value = true
}

function onDragStart(idx: number) {
  draggedIdx.value = idx
}

function onDragOver(idx: number) {
  if (draggedIdx.value === null || draggedIdx.value === idx) return
  const items = [...localPhotos.value]
  const [moved] = items.splice(draggedIdx.value, 1)
  items.splice(idx, 0, moved)
  localPhotos.value = items
  draggedIdx.value = idx
}

function onDragEnd() {
  draggedIdx.value = null
}

async function saveOrder() {
  if (!viewAlbum.value) return
  try {
    await reorderPhotos.mutateAsync({
      albumId: viewAlbum.value.id,
      order: localPhotos.value.map((p) => p.id),
    })
    originalOrder.value = localPhotos.value.map((p) => p.id)
    toast.success('Order saved')
  } catch {
    toast.error('Failed to save order')
  }
}

async function toggleEpk(photo: AlbumPhoto) {
  try {
    await togglePhotoEpkFeatured(token.value!, photo.id, !photo.epk_featured)
    await queryClient.invalidateQueries({ queryKey: ['albums'] })
    const refreshed = query.data.value?.find((a: Album) => a.id === viewAlbum.value?.id) ?? viewAlbum.value
    viewAlbum.value = refreshed ?? null
    localPhotos.value = refreshed?.photos ? [...refreshed.photos] : localPhotos.value
    toast.success(photo.epk_featured ? 'Removed from EPK' : 'Added to EPK')
  } catch {
    toast.error('Failed to update EPK status')
  }
}

async function deletePhoto(albumId: number, photoId: number) {
  deletingPhotoId.value = photoId
  try {
    await removeAlbumPhoto(token.value!, albumId, photoId)
    await queryClient.invalidateQueries({ queryKey: ['albums'] })
    const refreshed = query.data.value?.find((a: Album) => a.id === albumId) ?? viewAlbum.value
    viewAlbum.value = refreshed
    localPhotos.value = refreshed?.photos ? [...refreshed.photos] : localPhotos.value.filter((p) => p.id !== photoId)
    originalOrder.value = localPhotos.value.map((p) => p.id)
    toast.success('Photo removed')
  } catch {
    toast.error('Failed to remove photo')
  } finally {
    deletingPhotoId.value = null
  }
}

// ── Delete album ──────────────────────────────────────────────
const confirmId = ref<number | null>(null)

async function confirmDelete() {
  if (confirmId.value == null) return
  try {
    await remove.mutateAsync(confirmId.value)
    toast.success('Album deleted')
    confirmId.value = null
  } catch { toast.error('Failed to delete') }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Photo Albums</h1>
        <button @click="showBatch = true" class="btn-add-primary">+ New Album</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="py-12 text-center text-sm" style="color:#475569;">Loading…</div>
        <div v-else-if="query.isError.value" class="py-12 text-center text-sm" style="color:#f87171;">Failed to load albums.</div>
        <div v-else-if="!query.data.value?.length" class="py-12 text-center text-sm" style="color:#475569;">No albums yet.</div>
        <table v-else class="w-full">
          <thead>
            <tr style="border-bottom:1px solid #222222;">
              <th class="th" style="width:60px;"></th>
              <th class="th">Album</th>
              <th class="th">Concert / Venue</th>
              <th class="th">Tags</th>
              <th class="th">Photos</th>
              <th class="th">Published</th>
              <th class="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="album in query.data.value" :key="album.id" class="table-row">
              <td class="td">
                <div class="cover-cell">
                  <img v-if="album.cover_url" :src="album.cover_url" class="cover-thumb" :alt="album.title" />
                  <div v-else class="cover-empty">📷</div>
                </div>
              </td>
              <td class="td" style="max-width:14rem;">
                <div class="font-medium truncate" style="color:#e2e8f0;">{{ album.title }}</div>
                <div v-if="album.taken_at" class="text-xs" style="color:#475569;">{{ album.taken_at.slice(0,10) }}</div>
              </td>
              <td class="td text-sm" style="color:#94a3b8;">
                <span v-if="album.concert">{{ album.concert.date }}</span>
                <span v-else-if="album.venue">{{ album.venue.name }}</span>
                <span v-else>—</span>
              </td>
              <td class="td">
                <span v-if="album.tags?.length" class="flex flex-wrap gap-1">
                  <span v-for="t in album.tags" :key="t.id" class="pill">{{ t.name }}</span>
                </span>
                <span v-else style="color:#475569;">—</span>
              </td>
              <td class="td text-sm" style="color:#94a3b8;">
                <button class="photo-count-btn" @click="openPhotos(album)">
                  {{ album.photo_count }} photo{{ album.photo_count !== 1 ? 's' : '' }}
                </button>
              </td>
              <td class="td text-xs" :style="album.published_at ? 'color:#34d399;' : 'color:#475569;'">
                {{ album.published_at ? album.published_at.slice(0,10) : 'Draft' }}
              </td>
              <td class="td text-right">
                <button @click="openEdit(album)" class="btn-edit">Edit</button>
                <button @click="confirmId = album.id" class="btn-delete">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Batch upload / new album modal -->
    <AdminModal :open="showBatch" title="New Photo Album" max-width="64rem" @close="showBatch = false">
      <BatchPhotoUpload
        :venues="venuesQ.data.value ?? []"
        :concerts="concertsQ.data.value ?? []"
        :tags="tagsQ.data.value ?? []"
        :uploading="batchUploading"
        :progress="batchProgress"
        @upload="handleBatchUpload"
        @cancel="showBatch = false"
      />
    </AdminModal>

    <!-- Edit album metadata modal -->
    <AdminModal :open="showEdit" title="Edit album" max-width="42rem" @close="showEdit = false">
      <form @submit.prevent="saveEdit" class="flex flex-col gap-4">
        <div>
          <label class="field-label">Title <span style="color:#f87171;">*</span></label>
          <input v-model="editForm.title" required class="field-input" />
          <p v-if="fieldErrors.title" class="field-error">{{ fieldErrors.title[0] }}</p>
        </div>
        <div>
          <label class="field-label">Description</label>
          <textarea v-model="editForm.description" class="field-input" rows="2" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">Concert</label>
            <select v-model="editForm.concert_id" class="field-input">
              <option value="">— none —</option>
              <option v-for="c in concertsQ.data.value" :key="c.id" :value="String(c.id)">
                {{ c.date }} — {{ c.venue?.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="field-label">Venue</label>
            <select v-model="editForm.venue_id" class="field-input">
              <option value="">— none —</option>
              <option v-for="v in venuesQ.data.value" :key="v.id" :value="String(v.id)">{{ v.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">Taken at</label>
            <input v-model="editForm.taken_at" type="datetime-local" class="field-input" />
          </div>
          <div>
            <label class="field-label">Publish at</label>
            <input v-model="editForm.published_at" type="datetime-local" class="field-input" />
          </div>
        </div>
        <div v-if="tagsQ.data.value?.length">
          <label class="field-label">Tags</label>
          <div class="checkbox-list">
            <label v-for="t in tagsQ.data.value" :key="t.id" class="checkbox-item">
              <input type="checkbox" :checked="editForm.tag_ids.includes(t.id)" @change="toggleTag(t.id)" />
              <span>{{ t.name }}</span>
            </label>
          </div>
        </div>
        <div class="flex gap-2 justify-end pt-1">
          <button type="button" @click="showEdit = false" class="btn-ghost">Cancel</button>
          <button type="submit" :disabled="update.isPending.value" class="btn-primary">
            {{ update.isPending.value ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </AdminModal>

    <!-- Photo grid modal -->
    <AdminModal :open="showPhotos" :title="viewAlbum?.title ?? 'Photos'" max-width="64rem" @close="showPhotos = false">
      <div v-if="viewAlbum">
        <div class="photos-grid">
          <div
            v-for="(photo, idx) in localPhotos"
            :key="photo.id"
            class="photo-item"
            :class="{ 'photo-dragging': draggedIdx === idx }"
            draggable="true"
            @dragstart="onDragStart(idx)"
            @dragover.prevent="onDragOver(idx)"
            @dragend="onDragEnd"
          >
            <div class="drag-handle">⠿</div>
            <img v-if="photo.image_url" :src="photo.image_url" class="photo-img" :alt="photo.caption ?? ''" />
            <div v-else class="photo-placeholder">—</div>
            <div class="photo-footer">
              <span class="photo-caption">{{ photo.caption || '—' }}</span>
              <button
                class="photo-epk"
                :class="{ 'photo-epk--on': photo.epk_featured }"
                :title="photo.epk_featured ? 'Remove from EPK' : 'Add to EPK'"
                @click.stop="toggleEpk(photo)"
              >★</button>
              <button
                class="photo-remove"
                :disabled="deletingPhotoId === photo.id"
                @click="deletePhoto(viewAlbum!.id, photo.id)"
              >✕</button>
            </div>
          </div>
          <div v-if="!localPhotos.length" class="py-8 text-center text-sm" style="color:#475569;">No photos in this album.</div>
        </div>
        <div v-if="orderDirty" class="reorder-bar">
          <span class="reorder-hint">Drag photos to reorder</span>
          <button @click="saveOrder" :disabled="reorderPhotos.isPending.value" class="btn-primary">
            {{ reorderPhotos.isPending.value ? 'Saving…' : 'Save order' }}
          </button>
        </div>
        <div v-else-if="localPhotos.length" class="reorder-hint-idle">Drag photos to reorder</div>
      </div>
    </AdminModal>

    <ConfirmDialog :open="confirmId !== null" :loading="remove.isPending.value" @confirm="confirmDelete" @cancel="confirmId = null" />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped src="../../components/admin/form-styles.css" />
<style scoped>
.pill { font-size:0.7rem; padding:0.1rem 0.4rem; border-radius:9999px; background:#0f2a1e; color:#34d399; white-space:nowrap; }

.cover-cell { width:52px; height:40px; }
.cover-thumb { width:52px; height:40px; object-fit:cover; border-radius:5px; border:1px solid #333333; }
.cover-empty { width:52px; height:40px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; color:#333333; }

.photo-count-btn {
  color: #c0c0c0; background: transparent; border: none;
  cursor: pointer; font-size: 0.8rem; padding: 0;
  text-decoration: underline; text-underline-offset: 2px;
}
.photo-count-btn:hover { color: #d0d0d0; }

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.65rem;
  max-height: 62vh;
  overflow-y: auto;
  padding: 2px;
}
.photo-item {
  background:#0e0c2a; border:1px solid #333333; border-radius:8px;
  overflow:hidden; cursor:grab; position:relative;
  transition: opacity 0.15s, box-shadow 0.15s;
}
.photo-item:active { cursor: grabbing; }
.photo-dragging { opacity: 0.4; box-shadow: 0 0 0 2px #c0c0c0; }
.drag-handle {
  position:absolute; top:4px; left:6px; font-size:0.85rem;
  color:#475569; pointer-events:none; line-height:1;
}
.photo-img { width:100%; aspect-ratio:4/3; object-fit:cover; display:block; }
.photo-placeholder { width:100%; aspect-ratio:4/3; background:#1a1740; display:flex; align-items:center; justify-content:center; color:#475569; }
.photo-footer { display:flex; align-items:center; justify-content:space-between; padding:0.3rem 0.5rem; gap:0.4rem; }
.photo-caption { font-size:0.7rem; color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
.photo-epk {
  background:transparent; border:none; color:#334155;
  cursor:pointer; font-size:0.8rem; padding:2px 4px;
  border-radius:3px; transition:color 0.1s, background 0.1s;
  flex-shrink:0; line-height:1;
}
.photo-epk:hover { color:#fbbf24; }
.photo-epk--on { color:#fbbf24; }
.photo-remove {
  background:transparent; border:none; color:#475569;
  cursor:pointer; font-size:0.75rem; padding:2px 4px;
  border-radius:3px; transition:color 0.1s, background 0.1s;
  flex-shrink:0;
}
.photo-remove:hover:not(:disabled) { color:#f87171; background:#3d1515; }
.photo-remove:disabled { opacity:0.4; cursor:default; }
.reorder-bar {
  display:flex; align-items:center; justify-content:space-between;
  margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid #333333;
}
.reorder-hint { font-size:0.75rem; color:#475569; }
.reorder-hint-idle { margin-top:0.6rem; font-size:0.72rem; color:#333333; text-align:center; }
</style>
