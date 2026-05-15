<script setup lang="ts">
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import PressReleaseForm from '@/components/admin/forms/PressReleaseForm.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { usePressReleases } from '@/composables/usePressReleases'
import { usePressRelease } from '@/composables/usePressRelease'
import { useTableControls } from '@/composables/useTableControls'
import { useConcerts } from '@/composables/useConcerts'
import { useAlbums } from '@/composables/useAlbums'
import { useTours } from '@/composables/useTours'
import { useTags } from '@/composables/useTags'
import { useReleases } from '@/composables/useReleases'
import { usePosts } from '@/composables/usePosts'
import { ApiValidationError } from '@/api/client'
import type { PressReleaseSummary, PressReleasePayload } from '@/types/press-release'

const { query, create, update, remove } = usePressReleases()

const tc = useTableControls<PressReleaseSummary>({
  data: query.data,
  searchFn: (pr, q) =>
    pr.url.toLowerCase().includes(q) ||
    (pr.og_title ?? '').toLowerCase().includes(q) ||
    (pr.og_site_name ?? '').toLowerCase().includes(q) ||
    (pr.tags ?? []).some((t: { name: string }) => t.name.toLowerCase().includes(q)),
  defaultSort: 'published_at',
  defaultDir: 'desc',
})

const { query: concertsQ }  = useConcerts()
const { query: albumsQ }    = useAlbums()
const { query: toursQ }     = useTours()
const { query: tagsQ }      = useTags()
const { query: releasesQ }  = useReleases()
const { query: postsQ }     = usePosts()

const showModal   = ref(false)
const isCreating  = ref(false)
const editingId   = ref<number | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId   = ref<number | null>(null)

const fullRecord  = usePressRelease(editingId)

const modalTitle  = computed(() =>
  isCreating.value ? 'Add press release' : 'Edit press release',
)

function openCreate() {
  isCreating.value  = true
  editingId.value   = null
  fieldErrors.value = {}
  showModal.value   = true
}

function openEdit(pr: PressReleaseSummary) {
  isCreating.value  = false
  editingId.value   = pr.id
  fieldErrors.value = {}
  showModal.value   = true
}

function closeModal() {
  showModal.value = false
  editingId.value = null
}

async function handleSubmit(payload: PressReleasePayload) {
  fieldErrors.value = {}
  try {
    if (isCreating.value) {
      await create.mutateAsync(payload)
      toast.success('Press release added')
    } else {
      await update.mutateAsync({ id: editingId.value!, payload })
      toast.success('Press release updated')
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
    toast.success('Deleted')
    confirmId.value = null
  } catch {
    toast.error('Failed to delete')
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Press Releases</h1>
        <button @click="openCreate" class="btn-add-primary">+ Add press release</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="py-12 text-center text-sm" style="color:#475569;">Loading…</div>
        <div v-else-if="query.isError.value" class="py-12 text-center text-sm" style="color:#f87171;">Failed to load press releases.</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value" />

          <div v-if="!tc.paginated.value.length" class="py-12 text-center text-sm" style="color:#475569;">
            <span v-if="!(query.data.value?.length)">No press releases yet. Add the first one above.</span>
            <span v-else>No press releases match your search.</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #1a1a3a;">
                <th class="th" style="width:3.5rem;">Image</th>
                <SortHeader label="Article" sort-key="og_title" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">Tags</th>
                <SortHeader label="Published" sort-key="published_at" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pr in tc.paginated.value" :key="pr.id" class="table-row">
                <td class="td">
                  <img
                    v-if="pr.og_image"
                    :src="pr.og_image"
                    :alt="pr.og_title ?? ''"
                    class="og-thumb"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                  />
                  <div v-else class="og-thumb-placeholder">📰</div>
                </td>
                <td class="td" style="max-width:28rem;">
                  <div class="pr-title">{{ pr.og_title ?? pr.url }}</div>
                  <div class="pr-site">{{ pr.og_site_name ?? hostname(pr.url) }}</div>
                </td>
                <td class="td">
                  <div class="tag-chips">
                    <span v-for="t in pr.tags" :key="t.id" class="tag-chip">{{ t.name }}</span>
                  </div>
                </td>
                <td class="td" style="white-space:nowrap;">
                  <span v-if="pr.featured" class="epk-badge" title="Featured on EPK">EPK</span>
                  <span style="color:#64748b;">{{ formatDate(pr.published_at) }}</span>
                </td>
                <td class="td text-right">
                  <button @click="openEdit(pr)" class="btn-edit">Edit</button>
                  <button @click="confirmId = pr.id" class="btn-delete">Delete</button>
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

    <AdminModal :open="showModal" :title="modalTitle" max-width="52rem" @close="closeModal">
      <div v-if="!isCreating && fullRecord.isPending.value" class="py-8 text-center text-sm" style="color:#475569;">
        Loading…
      </div>
      <PressReleaseForm
        v-else
        :initial="isCreating ? null : (fullRecord.data.value ?? null)"
        :loading="create.isPending.value || update.isPending.value"
        :errors="fieldErrors"
        :concerts="concertsQ.data.value ?? []"
        :posts="postsQ.data.value ?? []"
        :albums="albumsQ.data.value ?? []"
        :releases="releasesQ.data.value ?? []"
        :tours="toursQ.data.value ?? []"
        :tags="tagsQ.data.value ?? []"
        @submit="handleSubmit"
        @cancel="closeModal"
      />
    </AdminModal>

    <ConfirmDialog
      :open="confirmId !== null"
      message="This press release will be permanently deleted."
      :loading="remove.isPending.value"
      @confirm="confirmDelete"
      @cancel="confirmId = null"
    />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped>
.og-thumb {
  width: 3rem; height: 2.25rem; border-radius: 0.25rem;
  object-fit: cover; border: 1px solid #1a1a38;
}
.og-thumb-placeholder {
  width: 3rem; height: 2.25rem; border-radius: 0.25rem;
  background: #111128; border: 1px solid #1a1a38;
  display: flex; align-items: center; justify-content: center; font-size: 0.9rem;
}
.pr-title {
  font-size: 0.8125rem; font-weight: 500; color: #e2e8f0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 26rem;
}
.pr-site  { font-size: 0.72rem; color: #475569; margin-top: 1px; }
.tag-chips { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.epk-badge {
  display: inline-block; padding: 0.1rem 0.4rem; border-radius: 0.2rem; margin-right: 0.375rem;
  background: #1e1b4b; color: #818cf8; font-size: 0.62rem; font-weight: 700;
  letter-spacing: 0.06em; vertical-align: middle;
}
.tag-chip {
  display: inline-block; padding: 0.1rem 0.45rem; border-radius: 0.25rem;
  background: #1e1b4b; color: #818cf8; font-size: 0.65rem; font-weight: 500;
}
</style>
