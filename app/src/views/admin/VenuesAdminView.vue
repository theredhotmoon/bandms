<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import VenueForm from '@/components/admin/forms/VenueForm.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useVenues } from '@/composables/useVenues'
import { useTags } from '@/composables/useTags'
import { useTableControls } from '@/composables/useTableControls'
import { ApiValidationError } from '@/api/client'
import type { Venue, VenuePayload } from '@/types/venue'

const { query, create, update, remove } = useVenues()
const { query: tagsQ } = useTags()

const showModal = ref(false)
const editing = ref<Venue | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId = ref<number | null>(null)

const tc = useTableControls<Venue>({
  data: query.data,
  searchFn: (v, q) =>
    v.name.toLowerCase().includes(q) ||
    (v.city ?? '').toLowerCase().includes(q) ||
    (v.street ?? '').toLowerCase().includes(q),
  defaultSort: 'name',
})

function openCreate() { editing.value = null; fieldErrors.value = {}; showModal.value = true }
function openEdit(v: Venue) { editing.value = v; fieldErrors.value = {}; showModal.value = true }
function closeModal() { showModal.value = false }

async function handleSubmit(payload: VenuePayload) {
  fieldErrors.value = {}
  try {
    if (editing.value) {
      await update.mutateAsync({ id: editing.value.id, payload })
      toast.success('Venue updated')
    } else {
      await create.mutateAsync(payload)
      toast.success('Venue created')
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
    toast.success('Venue deleted')
    confirmId.value = null
  } catch { toast.error('Failed to delete') }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Venues</h1>
        <button @click="openCreate" class="btn-add-primary">+ Add venue</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">Loading…</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">Failed to load venues.</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value" />

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!tc.rawTotal.value">No venues yet.</span>
            <span v-else>No venues match your search.</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #222222;">
                <SortHeader label="Name" sort-key="name" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader label="City" sort-key="city" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">Street</th>
                <th class="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="venue in tc.paginated.value" :key="venue.id" class="table-row">
                <td class="td font-medium" style="color:#e2e8f0;">{{ venue.name }}</td>
                <td class="td" style="color:#94a3b8;">{{ venue.city ?? '—' }}</td>
                <td class="td" style="color:#94a3b8;">{{ [venue.street, venue.street_number].filter(Boolean).join(' ') || '—' }}</td>
                <td class="td text-right">
                  <button @click="openEdit(venue)" class="btn-edit">Edit</button>
                  <button @click="confirmId = venue.id" class="btn-delete">Delete</button>
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

    <AdminModal :open="showModal" :title="editing ? 'Edit venue' : 'New venue'" @close="closeModal">
      <VenueForm :initial="editing" :tags="tagsQ.data.value ?? []" :loading="create.isPending.value || update.isPending.value" :errors="fieldErrors" @submit="handleSubmit" @cancel="closeModal" />
    </AdminModal>

    <ConfirmDialog :open="confirmId !== null" :loading="remove.isPending.value" @confirm="confirmDelete" @cancel="confirmId = null" />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
