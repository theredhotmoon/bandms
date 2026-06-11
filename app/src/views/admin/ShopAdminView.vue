<script setup lang="ts">
import { ref, computed, watch, type Ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import ShopItemForm from '@/components/admin/forms/ShopItemForm.vue'
import { useShop } from '@/composables/useShop'
import { useShopItem } from '@/composables/useShopItem'
import { useTableControls } from '@/composables/useTableControls'
import { useTags } from '@/composables/useTags'
import { useReleases } from '@/composables/useReleases'
import { useConcerts } from '@/composables/useConcerts'
import { usePosts } from '@/composables/usePosts'
import { useMusicVideos } from '@/composables/useMusicVideos'
import { useAuth } from '@/composables/useAuth'
import { ApiValidationError } from '@/api/client'
import { uploadShopPhoto, deleteShopPhoto, reorderShopPhotos } from '@/api/shop'
import type { ShopItemPayload, ShopItemPhoto, ShopItemSummary } from '@/types/shop'
import { SHOP_ITEM_TYPE_LABELS } from '@/types/shop'
import type { PostFilters } from '@/api/posts'

const { token } = useAuth()
const qc = useQueryClient()

const { query, currenciesQuery, create, update, remove, saveCurrencies } = useShop()
const tagsQ     = useTags()
const releasesQ = useReleases()
const concertsQ = useConcerts()
const postsQ    = usePosts(ref<PostFilters>({}))
const videosQ   = useMusicVideos()

const currencies = computed(() => currenciesQuery.data.value ?? [])
const tags       = computed(() => tagsQ.query.data.value ?? [])
const releases   = computed(() => releasesQ.query.data.value ?? [])
const concerts   = computed(() => concertsQ.query.data.value ?? [])
const posts      = computed(() => postsQ.query.data.value?.data ?? [])
const videos     = computed(() => videosQ.query.data.value ?? [])

// ── Table ──────────────────────────────────────────────────────
const tc = useTableControls<ShopItemSummary>({
  data: computed(() => query.data.value ?? []),
  searchFn: (item, q) =>
    item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q),
  defaultSort: 'sort_order',
  defaultDir: 'asc',
})

// ── Modal state ────────────────────────────────────────────────
const showModal   = ref(false)
const isCreating  = ref(false)
const editingId   = ref<number | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId   = ref<number | null>(null)

const fullItem  = useShopItem(editingId)
const modalTitle = computed(() =>
  isCreating.value ? 'New shop item' : (fullItem.data.value?.name ?? 'Edit item'),
)

function openCreate() {
  isCreating.value  = true
  editingId.value   = null
  fieldErrors.value = {}
  localPhotos.value = []
  showModal.value   = true
}

function openEdit(item: ShopItemSummary) {
  isCreating.value  = false
  editingId.value   = item.id
  fieldErrors.value = {}
  showModal.value   = true
}

function closeModal() {
  showModal.value  = false
  editingId.value  = null
  localPhotos.value = []
}

// ── Form submit ────────────────────────────────────────────────
async function handleSubmit(payload: ShopItemPayload) {
  fieldErrors.value = {}
  try {
    if (isCreating.value) {
      await create.mutateAsync(payload)
      toast.success('Item created')
    } else {
      await update.mutateAsync({ id: editingId.value!, payload })
      toast.success('Item updated')
    }
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
    toast.success('Item deleted')
    confirmId.value = null
  } catch {
    toast.error('Failed to delete')
  }
}

// ── Photos ─────────────────────────────────────────────────────
const localPhotos   = ref<ShopItemPhoto[]>([])
const originalOrder = ref<number[]>([])
const draggedIdx    = ref<number | null>(null)
const orderDirty    = computed(
  () => localPhotos.value.map((p) => p.id).join(',') !== originalOrder.value.join(','),
)
const photoInput    = ref<HTMLInputElement | null>(null)
const photoUploading = ref(false)

watch(
  () => fullItem.data.value?.photos,
  (photos) => {
    if (photos) {
      localPhotos.value   = [...photos]
      originalOrder.value = photos.map((p: ShopItemPhoto) => p.id)
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
    await reorderShopPhotos(token.value!, editingId.value, localPhotos.value.map((p) => p.id))
    originalOrder.value = localPhotos.value.map((p) => p.id)
    toast.success('Order saved')
  } catch {
    toast.error('Failed to save order')
  }
}

async function onPhotoFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files || !editingId.value) return
  photoUploading.value = true
  try {
    for (const file of Array.from(files)) {
      const photo = await uploadShopPhoto(token.value!, editingId.value, file)
      localPhotos.value.push(photo)
      originalOrder.value = localPhotos.value.map((p) => p.id)
    }
    await qc.invalidateQueries({ queryKey: ['shop-item', editingId] })
    toast.success('Photo(s) uploaded')
  } catch {
    toast.error('Upload failed')
  } finally {
    photoUploading.value = false
    if (photoInput.value) photoInput.value.value = ''
  }
}

async function deletePhoto(photoId: number) {
  if (!editingId.value) return
  try {
    await deleteShopPhoto(token.value!, editingId.value, photoId)
    localPhotos.value   = localPhotos.value.filter((p) => p.id !== photoId)
    originalOrder.value = localPhotos.value.map((p) => p.id)
    await qc.invalidateQueries({ queryKey: ['shop-item', editingId] })
  } catch {
    toast.error('Failed to delete photo')
  }
}

// ── Currency settings modal ────────────────────────────────────
const showCurrencyModal  = ref(false)
const currencyInput      = ref('')
const currencyList       = ref<string[]>([])

function openCurrencyModal() {
  currencyList.value  = [...(currenciesQuery.data.value ?? [])]
  currencyInput.value = ''
  showCurrencyModal.value = true
}

function addCurrency() {
  const c = currencyInput.value.trim().toUpperCase()
  if (!c || c.length !== 3 || currencyList.value.includes(c)) return
  currencyList.value.push(c)
  currencyInput.value = ''
}

function removeCurrency(c: string) {
  currencyList.value = currencyList.value.filter((x) => x !== c)
}

async function saveCurrencySettings() {
  try {
    await saveCurrencies.mutateAsync(currencyList.value)
    toast.success('Currencies saved')
    showCurrencyModal.value = false
  } catch {
    toast.error('Failed to save currencies')
  }
}

// ── Type badge colours ─────────────────────────────────────────
const TYPE_COLOURS: Record<string, string> = {
  record:    '#64748b',
  apparel:   '#0891b2',
  accessory: '#059669',
  ticket:    '#b45309',
  bundle:    '#7c3aed',
  other:     '#888888',
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Shop</h1>
        <div class="flex gap-2">
          <button @click="openCurrencyModal" class="btn-currencies">Currencies</button>
          <button @click="openCreate" class="btn-add-primary">+ Add item</button>
        </div>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="py-12 text-center text-sm" style="color:#475569;">Loading…</div>
        <div v-else-if="query.isError.value" class="py-12 text-center text-sm" style="color:#f87171;">Failed to load shop items.</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value" />

          <div v-if="!tc.paginated.value.length" class="py-12 text-center text-sm" style="color:#475569;">
            <span v-if="!(query.data.value?.length)">No items yet. Add the first one above.</span>
            <span v-else>No items match your search.</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #222222;">
                <th class="th" style="width:3rem;">Photo</th>
                <SortHeader label="Name" sort-key="name" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader label="Type" sort-key="type" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="6rem" @sort="tc.toggleSort" />
                <th class="th" style="width:10rem;">Price</th>
                <th class="th" style="width:6rem;">Status</th>
                <SortHeader label="Stock" sort-key="stock_quantity" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="5rem" @sort="tc.toggleSort" />
                <th class="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in tc.paginated.value" :key="item.id" class="table-row">
                <td class="td">
                  <img v-if="item.cover_photo" :src="item.cover_photo" :alt="item.name" class="cover-thumb" />
                  <div v-else class="cover-placeholder">🛍</div>
                </td>
                <td class="td font-medium" style="color:#e2e8f0;">{{ item.name }}</td>
                <td class="td">
                  <span class="type-badge"
                    :style="`background:${TYPE_COLOURS[item.type] ?? '#888'}22; color:${TYPE_COLOURS[item.type] ?? '#888'}; border-color:${TYPE_COLOURS[item.type] ?? '#888'}44;`">
                    {{ SHOP_ITEM_TYPE_LABELS[item.type] }}
                  </span>
                </td>
                <td class="td" style="color:#64748b;">
                  <span v-for="p in item.prices" :key="p.currency" class="price-chip">
                    {{ p.currency }} {{ Number(p.amount).toFixed(2) }}
                  </span>
                  <span v-if="!item.prices.length" style="color:#334155;">—</span>
                </td>
                <td class="td">
                  <span v-if="item.is_presale" class="status-badge status-presale">Pre-sale</span>
                  <span v-else-if="item.is_available" class="status-badge status-available">Available</span>
                  <span v-else class="status-badge status-unavailable">Hidden</span>
                </td>
                <td class="td" style="color:#64748b;">
                  {{ item.stock_quantity !== null ? item.stock_quantity : '∞' }}
                </td>
                <td class="td text-right">
                  <button @click="openEdit(item)" class="btn-edit">Edit</button>
                  <button @click="confirmId = item.id" class="btn-delete">Delete</button>
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

    <!-- ── Item modal ──────────────────────────────────────────── -->
    <AdminModal :open="showModal" :title="modalTitle" max-width="52rem" @close="closeModal">
      <div v-if="!isCreating && fullItem.isPending.value" class="py-8 text-center text-sm" style="color:#475569;">
        Loading item…
      </div>
      <template v-else>
        <ShopItemForm
          :initial="isCreating ? null : (fullItem.data.value ?? null)"
          :currencies="currencies"
          :tags="tags"
          :releases="releases"
          :concerts="concerts"
          :posts="posts"
          :videos="videos"
          :loading="create.isPending.value || update.isPending.value"
          :errors="fieldErrors"
          @submit="handleSubmit"
          @cancel="closeModal"
        />

        <!-- Photos — edit only -->
        <template v-if="!isCreating && fullItem.data.value">
          <div class="photos-divider">Photos</div>

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
              <img :src="photo.url" :alt="photo.alt_text ?? ''" class="rp-thumb" />
              <button type="button" class="rp-del" @click.stop="deletePhoto(photo.id)" title="Delete">✕</button>
            </div>
          </div>
          <p v-else class="rp-empty">No photos yet.</p>

          <div v-if="orderDirty" class="rp-order-row">
            <button type="button" class="rp-btn-save" @click="savePhotoOrder">Save order</button>
          </div>

          <div class="rp-add">
            <div class="rp-add-title">Add photos</div>
            <div class="rp-upload-row">
              <input ref="photoInput" type="file" accept="image/*" multiple class="hidden" @change="onPhotoFileChange" />
              <button
                type="button"
                :disabled="photoUploading"
                class="rp-btn-upload"
                @click="photoInput?.click()"
              >
                {{ photoUploading ? 'Uploading…' : 'Choose photos' }}
              </button>
            </div>
          </div>
        </template>
      </template>
    </AdminModal>

    <!-- ── Currency settings modal ─────────────────────────────── -->
    <AdminModal :open="showCurrencyModal" title="Shop currencies" max-width="24rem" @close="showCurrencyModal = false">
      <div class="currency-modal">
        <p class="currency-hint">Set the currencies available for pricing. Items will show a price field for each enabled currency.</p>

        <div class="currency-chips">
          <span v-for="c in currencyList" :key="c" class="currency-chip">
            {{ c }}
            <button type="button" @click="removeCurrency(c)" class="currency-chip-rm">✕</button>
          </span>
          <span v-if="!currencyList.length" class="currency-empty">No currencies added yet.</span>
        </div>

        <div class="currency-add-row">
          <input
            v-model="currencyInput"
            type="text"
            maxlength="3"
            class="field-input currency-input"
            placeholder="USD"
            @keydown.enter.prevent="addCurrency"
          />
          <button type="button" @click="addCurrency" class="btn-add-currency">Add</button>
        </div>

        <div class="currency-actions">
          <button type="button" @click="showCurrencyModal = false" class="btn-cancel-sm">Cancel</button>
          <button type="button" :disabled="saveCurrencies.isPending.value" @click="saveCurrencySettings" class="btn-save-sm">
            {{ saveCurrencies.isPending.value ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </AdminModal>

    <ConfirmDialog
      :open="confirmId !== null"
      message="This item and all its photos will be permanently deleted."
      :loading="remove.isPending.value"
      @confirm="confirmDelete"
      @cancel="confirmId = null"
    />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped>
.btn-currencies {
  padding: 0.375rem 0.875rem;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-weight: 500;
  background: transparent;
  border: 1px solid #333333;
  color: #64748b;
  cursor: pointer;
  transition: background 100ms, color 100ms;
}
.btn-currencies:hover { background: #1a1a1a; color: #94a3b8; }

.cover-thumb {
  width: 2.25rem; height: 2.25rem; border-radius: 0.25rem;
  object-fit: cover; border: 1px solid #222222;
}
.cover-placeholder {
  width: 2.25rem; height: 2.25rem; border-radius: 0.25rem;
  background: #1a1a1a; border: 1px solid #222222;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.875rem;
}

.type-badge {
  display: inline-block; padding: 0.15rem 0.5rem;
  border-radius: 0.25rem; border: 1px solid;
  font-size: 0.68rem; font-weight: 600; letter-spacing: 0.04em;
}

.price-chip {
  display: inline-block; font-size: 0.72rem; color: #64748b;
  margin-right: 0.25rem; white-space: nowrap;
}

.status-badge {
  display: inline-block; padding: 0.15rem 0.5rem;
  border-radius: 0.25rem; border: 1px solid; font-size: 0.68rem; font-weight: 600;
}
.status-available   { background: #05966922; color: #059669; border-color: #05966944; }
.status-presale     { background: #b4530922; color: #b45309; border-color: #b4530944; }
.status-unavailable { background: #33333322; color: #555555; border-color: #33333344; }

/* Photos section */
.photos-divider {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: #475569; border-top: 1px solid #252525; margin-top: 1.5rem;
  padding-top: 0.875rem; margin-bottom: 0.75rem;
}
.rp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.5rem; }
.rp-card {
  position: relative; border: 1px solid #222222; border-radius: 6px; overflow: hidden;
  cursor: grab; background: #141414; transition: opacity 0.15s;
}
.rp-card:active { cursor: grabbing; }
.rp-dragging { opacity: 0.35; }
.rp-thumb { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
.rp-del {
  position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; border-radius: 50%;
  background: #141414cc; border: 1px solid #3a1212; color: #f87171;
  font-size: 0.55rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.rp-del:hover { background: #3f1212; }
.rp-empty { font-size: 0.8125rem; color: #475569; padding: 0.5rem 0; }
.rp-order-row { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
.rp-btn-save {
  padding: 0.3rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: #2a2a2a; border: 1px solid #444444; color: #d0d0d0;
}
.rp-btn-save:hover { background: #333333; }
.rp-add { margin-top: 0.875rem; display: flex; flex-direction: column; gap: 0.375rem; }
.rp-add-title { font-size: 0.72rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
.rp-upload-row { display: flex; gap: 0.5rem; }
.rp-btn-upload {
  padding: 0.35rem 1rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: #333333; border: 1px solid #888888; color: #fff;
}
.rp-btn-upload:hover:not(:disabled) { background: #888888; }
.rp-btn-upload:disabled { opacity: 0.4; cursor: default; }
.hidden { display: none; }

/* Currency modal */
.currency-modal { display: flex; flex-direction: column; gap: 1rem; }
.currency-hint { font-size: 0.8rem; color: #64748b; }
.currency-chips { display: flex; flex-wrap: wrap; gap: 0.375rem; min-height: 2rem; }
.currency-chip {
  display: flex; align-items: center; gap: 0.3rem;
  padding: 0.25rem 0.5rem; border-radius: 0.25rem;
  background: #1e1e1e; border: 1px solid #333333;
  font-size: 0.75rem; font-weight: 600; color: #94a3b8; letter-spacing: 0.05em;
}
.currency-chip-rm {
  color: #475569; background: none; border: none; cursor: pointer; font-size: 0.6rem; padding: 0;
}
.currency-chip-rm:hover { color: #f87171; }
.currency-empty { font-size: 0.78rem; color: #334155; }
.currency-add-row { display: flex; gap: 0.5rem; }
.field-input {
  background: #141414; border: 1px solid #2a2a2a; border-radius: 0.375rem;
  color: #e2e8f0; font-size: 0.8125rem; padding: 0.4375rem 0.625rem;
  outline: none; transition: border-color 120ms;
}
.field-input:focus { border-color: #555555; }
.currency-input { width: 5rem; text-transform: uppercase; letter-spacing: 0.05em; }
.btn-add-currency {
  padding: 0.4rem 0.75rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  background: #2a2a2a; border: 1px solid #444444; color: #d0d0d0; cursor: pointer;
}
.btn-add-currency:hover { background: #333333; }
.currency-actions { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #1e1e1e; }
.btn-cancel-sm {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 500;
  background: transparent; border: 1px solid #2a2a2a; color: #64748b; cursor: pointer;
}
.btn-save-sm {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  background: #333333; border: 1px solid #555555; color: #fff; cursor: pointer;
}
.btn-save-sm:hover:not(:disabled) { background: #444444; }
.btn-save-sm:disabled { opacity: 0.4; cursor: default; }
</style>
