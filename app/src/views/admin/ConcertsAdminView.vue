<script setup lang="ts">
import { useI18n } from 'vue-i18n'
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
import { venueGate } from '@/utils/venueGate'
import { createRiderForConcert } from '@/api/techRiders'
import { ApiError } from '@/api/client'
import { useRouter } from 'vue-router'
import { adminUrl } from '@/config/admin'
import { reportSaveError } from '@/utils/formErrors'
import type { Concert, ConcertPayload } from '@/types/concert'

const { t } = useI18n()

const { query, create, update, remove } = useConcerts()
const { query: venuesQ } = useVenues()
const { query: bandsQ } = useBands()
const { query: tagsQ } = useTags()
const { token } = useAuth()
const queryClient = useQueryClient()

// Button state and notice both come from one gate so they cannot drift apart.
// See src/utils/venueGate.ts for why a failed fetch must not read as "empty".
const gate = computed(() => venueGate({
  isSuccess: venuesQ.isSuccess.value,
  isError:   venuesQ.isError.value,
  data:      venuesQ.data.value,
}))
const noVenues     = computed(() => gate.value.noVenues)
const venuesFailed = computed(() => gate.value.venuesFailed)

const router = useRouter()

/**
 * Start a tech rider for this gig.
 *
 * Everything inferable is inferred — the name from the venue and date, the
 * lineup from the current members, the concert link — so the user lands in the
 * editor on the one thing that cannot be: the stage plot. A 409 means the gig
 * already has a rider, which is a redirect rather than an error.
 */
const creatingRiderFor = ref<number | null>(null)

async function createRider(concert: Concert) {
  creatingRiderFor.value = concert.id
  try {
    const rider = await createRiderForConcert(token.value!, concert.id)
    toast.success(t('shows.concerts.riderCreated', { name: rider.name }))
    router.push(adminUrl('tech-rider'))
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      toast.info(t('shows.concerts.riderExists'))
      router.push(adminUrl('tech-rider'))
      return
    }
    reportSaveError(e, t('shows.concerts.riderFailed'))
  } finally {
    creatingRiderFor.value = null
  }
}

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
      toast.success(t('shows.concerts.updated'))
    } else {
      concert = await create.mutateAsync(payload)
      toast.success(t('shows.concerts.created'))
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
    reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors)
  }
}

async function confirmDelete() {
  if (confirmId.value == null) return
  try {
    await remove.mutateAsync(confirmId.value)
    toast.success(t('shows.concerts.deleted'))
    confirmId.value = null
  } catch (e) { reportSaveError(e, t('common.state.deleteFailed')) }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">{{ $t('shows.concerts.title') }}</h1>
        <button
          @click="openCreate"
          class="btn-add-primary"
          :disabled="noVenues"
          :title="noVenues ? $t('shows.concerts.addDisabledTitle') : undefined"
        >{{ $t('shows.concerts.add') }}</button>
      </div>

      <div v-if="noVenues" class="venue-notice">
        <span>{{ $t('shows.concerts.needVenue') }}</span>
        <RouterLink :to="adminUrl('venues')" class="venue-notice-link">{{ $t('shows.concerts.goToVenues') }}</RouterLink>
      </div>
      <div v-else-if="venuesFailed" class="venue-notice">
        <span>{{ $t('shows.concerts.venuesLoadFailed') }}</span>
        <button type="button" class="venue-notice-link" @click="venuesQ.refetch()">{{ $t('shows.concerts.retry') }}</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">{{ $t('common.state.loading') }}</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">{{ $t('shows.concerts.loadFailed') }}</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value">
            <template #filters>
              <select v-model="filterWhen" class="filter-select">
                <option value="">{{ $t('shows.concerts.filter.all') }}</option>
                <option value="upcoming">{{ $t('shows.concerts.filter.upcoming') }}</option>
                <option value="past">{{ $t('shows.concerts.filter.past') }}</option>
              </select>
            </template>
          </TableToolbar>

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!(query.data.value?.length)">{{ $t('shows.concerts.empty') }}</span>
            <span v-else>{{ $t('shows.concerts.noMatch') }}</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #222222;">
                <SortHeader :label="$t('common.fields.date')" sort-key="date" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">{{ $t('common.fields.name') }}</th>
                <th class="th">{{ $t('shows.concerts.columns.doorsStart') }}</th>
                <th class="th">{{ $t('shows.venues.singular') }}</th>
                <th class="th text-right">{{ $t('common.table.actions') }}</th>
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
                  <button
                    class="btn-edit"
                    :disabled="creatingRiderFor === concert.id"
                    :title="$t('shows.concerts.riderTitle')"
                    @click="createRider(concert)"
                  >{{ $t('shows.concerts.rider') }}</button>
                  <button @click="ticketsConcert = concert" class="btn-edit">{{ $t('shows.concerts.tickets') }}</button>
                  <button @click="openEdit(concert)" class="btn-edit">{{ $t('common.actions.edit') }}</button>
                  <button @click="confirmId = concert.id" class="btn-delete">{{ $t('common.actions.delete') }}</button>
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

    <AdminModal :open="showModal" :title="editing ? $t('shows.concerts.modalEdit') : $t('shows.concerts.modalNew')" maxWidth="56rem" @close="closeModal">
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

    <AdminModal :open="ticketsConcert !== null" :title="$t('shows.concerts.ticketsModal', { name: ticketsConcert?.name ?? ticketsConcert?.date ?? '' })" maxWidth="52rem" @close="ticketsConcert = null">
      <ConcertTicketsManager v-if="ticketsConcert" :concert-id="ticketsConcert.id" />
    </AdminModal>
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />

<style scoped>
.venue-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid #3f3213;
  border-radius: 0.5rem;
  background: #1c1608;
  color: #fbbf24;
  font-size: 0.8125rem;
}
.venue-notice-link {
  flex-shrink: 0;
  font-weight: 600;
  color: #fcd34d;
  text-decoration: underline;
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
  cursor: pointer;
}
.venue-notice-link:hover { color: #fef3c7; }
</style>
