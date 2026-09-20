<script setup lang="ts">
import { ref } from 'vue'
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
import { useReleases } from '@/composables/useReleases'
import { useShop } from '@/composables/useShop'
import { useTableControls } from '@/composables/useTableControls'
import { providerLabel } from '@/utils/postBlocks'
import { presetLabel } from '@/utils/clipCategories'
import { reportSaveError } from '@/utils/formErrors'
import type { Clip, ClipPayload } from '@/types/clip'

const { query, create, update, remove } = useClips()
const { query: concertsQ } = useConcerts()
const { query: releasesQ } = useReleases()
const { query: shopQ }     = useShop()

const showModal = ref(false)
const editing = ref<Clip | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId = ref<number | null>(null)

const tc = useTableControls<Clip>({
  data: query.data,
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
    if (editing.value) { await update.mutateAsync({ id: editing.value.id, payload }); toast.success('Clip updated') }
    else { await create.mutateAsync(payload); toast.success('Clip created') }
    closeModal()
  } catch (e) { reportSaveError(e, 'Something went wrong', fieldErrors) }
}

async function confirmDelete() {
  if (confirmId.value == null) return
  try { await remove.mutateAsync(confirmId.value); toast.success('Clip deleted'); confirmId.value = null }
  catch (e) { reportSaveError(e, 'Failed to delete') }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Clips</h1>
        <button @click="openCreate" class="btn-add-primary">+ Add clip</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">Loading…</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">Failed to load clips.</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value" />

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!tc.rawTotal.value">No clips yet.</span>
            <span v-else>No clips match your search.</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #222222;">
                <SortHeader label="Title" sort-key="title" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader label="Category" sort-key="category" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">Provider</th>
                <th class="th">Attached to</th>
                <SortHeader label="Recorded" sort-key="recorded_on" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="clip in tc.paginated.value" :key="clip.id" class="table-row">
                <td class="td font-medium" style="color:#e2e8f0;">{{ clip.title ?? clip.url }}</td>
                <td class="td" style="color:#94a3b8;">{{ presetLabel(clip.category) }}</td>
                <td class="td" style="color:#94a3b8;">{{ providerLabel(clip.provider) }}</td>
                <td class="td" style="color:#94a3b8;">{{ clip.owners.length }}</td>
                <td class="td text-xs font-mono" style="color:#64748b;">{{ clip.recorded_on ?? '—' }}</td>
                <td class="td text-right">
                  <button @click="openEdit(clip)" class="btn-edit">Edit</button>
                  <button @click="confirmId = clip.id" class="btn-delete">Delete</button>
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

    <AdminModal :open="showModal" :title="editing ? 'Edit clip' : 'New clip'" max-width="48rem" @close="closeModal">
      <ClipForm
        :initial="editing"
        :concerts="concertsQ.data.value ?? []"
        :releases="releasesQ.data.value ?? []"
        :shop-items="shopQ.data.value ?? []"
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
