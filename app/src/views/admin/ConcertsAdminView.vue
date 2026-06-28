<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import ConcertForm from '@/components/admin/forms/ConcertForm.vue'
import ConcertTicketsManager from '@/components/admin/ConcertTicketsManager.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useConcerts } from '@/composables/useConcerts'
import { useVenues } from '@/composables/useVenues'
import { useBands } from '@/composables/useBands'
import { useTags } from '@/composables/useTags'
import { useAuth } from '@/composables/useAuth'
import { useTableControls } from '@/composables/useTableControls'
import { uploadConcertPoster, deleteConcertPoster } from '@/api/concerts'
import { ApiValidationError } from '@/api/client'
import type { Concert, ConcertPayload } from '@/types/concert'

const { query, create, update, remove } = useConcerts()
const { query: venuesQ } = useVenues()
const { query: bandsQ } = useBands()
const { query: tagsQ } = useTags()
const { token } = useAuth()
const queryClient = useQueryClient()

const showModal = ref(false)
const editing = ref<Concert | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId = ref<number | null>(null)
const ticketsConcert = ref<Concert | null>(null)
const filterWhen = ref<'' | 'upcoming' | 'past'>('')

const today = new Date().toISOString().slice(0, 10)

const filteredData = computed(() => {
  const rows = query.data.value ?? []
  if (filterWhen.value === 'upcoming') return rows.filter((c: Concert) => c.date >= today)
  if (filterWhen.value === 'past') return rows.filter((c: Concert) => c.date < today)
  return rows
})

const tc = useTableControls<Concert>({
  data: filteredData,
  searchFn: (c, q) =>
    c.date.includes(q) ||
    (c.name ?? '').toLowerCase().includes(q) ||
    (c.venue?.name ?? '').toLowerCase().includes(q) ||
    (c.bands ?? []).some(b => b.name.toLowerCase().includes(q)),
  defaultSort: 'date',
  defaultDir: 'desc',
})

function openCreate() { editing.value = null; fieldErrors.value = {}; showModal.value = true }
function openEdit(c: Concert) { editing.value = c; fieldErrors.value = {}; showModal.value = true }
function closeModal() { showModal.value = false }

async function handleSubmit(payload: ConcertPayload, posterFile: File | null, deletePoster: boolean) {
  fieldErrors.value = {}
  try {
    let concert: Concert
    if (editing.value) {
      concert = await update.mutateAsync({ id: editing.value.id, payload })
      toast.success('Concert updated')
    } else {
      concert = await create.mutateAsync(payload)
      toast.success('Concert created')
    }
    if (posterFile) {
      await uploadConcertPoster(token.value!, concert.id, posterFile)
      await queryClient.invalidateQueries({ queryKey: ['concerts'] })
    } else if (deletePoster) {
      await deleteConcertPoster(token.value!, concert.id)
      await queryClient.invalidateQueries({ queryKey: ['concerts'] })
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
    toast.success('Concert deleted')
    confirmId.value = null
  } catch { toast.error('Failed to delete') }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Concerts</h1>
        <button @click="openCreate" class="btn-add-primary">+ Add concert</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">Loading…</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">Failed to load concerts.</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value">
            <template #filters>
              <select v-model="filterWhen" class="filter-select">
                <option value="">All dates</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
            </template>
          </TableToolbar>

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!(query.data.value?.length)">No concerts yet.</span>
            <span v-else>No concerts match your search.</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #222222;">
                <SortHeader label="Date" sort-key="date" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">Name</th>
                <th class="th">Doors / Start</th>
                <th class="th">Venue</th>
                <th class="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="concert in tc.paginated.value" :key="concert.id" class="table-row">
                <td class="td font-medium" style="color:#e2e8f0;">{{ concert.date }}</td>
                <td class="td" style="color:#d0d0d0;">{{ concert.name ?? '—' }}</td>
                <td class="td text-xs" style="color:#94a3b8; font-variant-numeric:tabular-nums;">
                  <span v-if="concert.doors_open">🚪 {{ concert.doors_open }}</span>
                  <span v-if="concert.doors_open && concert.start_time"> · </span>
                  <span v-if="concert.start_time">🎸 {{ concert.start_time }}</span>
                  <span v-if="!concert.doors_open && !concert.start_time">—</span>
                </td>
                <td class="td" style="color:#94a3b8;">{{ concert.venue?.name ?? '—' }}</td>
                <td class="td text-right">
                  <button @click="ticketsConcert = concert" class="btn-edit">Tickets</button>
                  <button @click="openEdit(concert)" class="btn-edit">Edit</button>
                  <button @click="confirmId = concert.id" class="btn-delete">Delete</button>
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

    <AdminModal :open="showModal" :title="editing ? 'Edit concert' : 'New concert'" maxWidth="56rem" @close="closeModal">
      <ConcertForm
        :initial="editing"
        :venues="venuesQ.data.value ?? []"
        :bands="bandsQ.data.value ?? []"
        :tags="tagsQ.data.value ?? []"
        :loading="create.isPending.value || update.isPending.value"
        :errors="fieldErrors"
        @submit="handleSubmit"
        @cancel="closeModal"
      />
    </AdminModal>

    <ConfirmDialog :open="confirmId !== null" :loading="remove.isPending.value" @confirm="confirmDelete" @cancel="confirmId = null" />

    <AdminModal :open="ticketsConcert !== null" :title="`Tickets — ${ticketsConcert?.name ?? ticketsConcert?.date ?? ''}`" maxWidth="52rem" @close="ticketsConcert = null">
      <ConcertTicketsManager v-if="ticketsConcert" :concert-id="ticketsConcert.id" />
    </AdminModal>
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
