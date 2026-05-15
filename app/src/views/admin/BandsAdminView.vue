<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import BandForm from '@/components/admin/forms/BandForm.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useBands } from '@/composables/useBands'
import { useTableControls } from '@/composables/useTableControls'
import { ApiValidationError } from '@/api/client'
import type { Band, BandPayload } from '@/types/band'

const { query, create, update, remove } = useBands()
const router = useRouter()

function sendMessage(band: Band) {
  router.push({
    name: 'admin-pitch',
    query: {
      type: 'band',
      band: band.name,
      ...(band.last_gig_at ? { lastGig: band.last_gig_at } : {}),
    },
  })
}

const showModal = ref(false)
const editing = ref<Band | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId = ref<number | null>(null)

const tc = useTableControls({
  data: query.data,
  searchFn: (b, q) => b.name.toLowerCase().includes(q) || (b.website ?? '').toLowerCase().includes(q),
  defaultSort: 'name',
})

function openCreate() { editing.value = null; fieldErrors.value = {}; showModal.value = true }
function openEdit(band: Band) { editing.value = band; fieldErrors.value = {}; showModal.value = true }
function closeModal() { showModal.value = false }

async function handleSubmit(payload: BandPayload) {
  fieldErrors.value = {}
  try {
    if (editing.value) {
      await update.mutateAsync({ id: editing.value.id, payload })
      toast.success('Band updated')
    } else {
      await create.mutateAsync(payload)
      toast.success('Band created')
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
    toast.success('Band deleted')
    confirmId.value = null
  } catch { toast.error('Failed to delete') }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Other Bands</h1>
          <p class="text-xs mt-0.5" style="color:#475569;">Bands you share the stage with — used on concert listings.</p>
        </div>
        <button @click="openCreate" class="btn-add-primary">+ Add band</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">Loading…</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">Failed to load bands.</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value" />

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!tc.rawTotal.value">No bands yet. Add one above.</span>
            <span v-else>No bands match your search.</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #1a1a3a;">
                <SortHeader label="Name" sort-key="name" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">Website</th>
                <SortHeader label="Gigs" sort-key="gigs_count" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="7rem" @sort="tc.toggleSort" />
                <SortHeader label="Last gig" sort-key="last_gig_at" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="9rem" @sort="tc.toggleSort" />
                <th class="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="band in tc.paginated.value" :key="band.id" class="table-row">
                <td class="td font-medium" style="color:#e2e8f0;">{{ band.name }}</td>
                <td class="td">
                  <a v-if="band.website" :href="band.website" target="_blank" rel="noopener"
                     class="text-xs" style="color:#6366f1;">{{ band.website }}</a>
                  <span v-else style="color:#475569;">—</span>
                </td>
                <td class="td">
                  <span v-if="band.gigs_count > 0" class="gig-count">{{ band.gigs_count }}</span>
                  <span v-else style="color:#334155; font-size:0.75rem;">0</span>
                </td>
                <td class="td" style="color:#94a3b8; font-size:0.75rem;">{{ band.last_gig_at ?? '—' }}</td>
                <td class="td text-right">
                  <button @click="sendMessage(band)" class="btn-message">Message</button>
                  <button @click="openEdit(band)" class="btn-edit">Edit</button>
                  <button @click="confirmId = band.id" class="btn-delete">Delete</button>
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

    <AdminModal :open="showModal" :title="editing ? 'Edit band' : 'New band'" @close="closeModal">
      <BandForm :initial="editing" :loading="create.isPending.value || update.isPending.value" :errors="fieldErrors" @submit="handleSubmit" @cancel="closeModal" />
    </AdminModal>

    <ConfirmDialog :open="confirmId !== null" :loading="remove.isPending.value" @confirm="confirmDelete" @cancel="confirmId = null" />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped>
.gig-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 1.5rem; height: 1.5rem; padding: 0 0.375rem;
  border-radius: 9999px; font-size: 0.7rem; font-weight: 700;
  background: #1e1b4b; color: #818cf8;
}
.btn-message {
  padding: 0.2rem 0.6rem; border-radius: 0.3rem; font-size: 0.72rem; font-weight: 600;
  background: #0f2a1e; border: 1px solid #166534; color: #34d399; cursor: pointer;
  margin-right: 0.375rem; transition: background 120ms;
}
.btn-message:hover { background: #14532d; }
</style>
