<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import TourForm from '@/components/admin/forms/TourForm.vue'
import { useTours } from '@/composables/useTours'
import { useTour } from '@/composables/useTour'
import { reportSaveError } from '@/utils/formErrors'
import type { TourSummary, TourPayload } from '@/types/tour'

const { t } = useI18n()

const { query, create, update, remove } = useTours()

const showModal   = ref(false)
const isCreating  = ref(false)
const editingId   = ref<number | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId   = ref<number | null>(null)

const fullRecord  = useTour(editingId)

const modalTitle  = computed(() =>
  isCreating.value ? t('shows.tours.modalNew') : (fullRecord.data.value?.name ?? t('shows.tours.modalEdit')),
)

function openCreate() {
  isCreating.value  = true
  editingId.value   = null
  fieldErrors.value = {}
  showModal.value   = true
}

function openEdit(t: TourSummary) {
  isCreating.value  = false
  editingId.value   = t.id
  fieldErrors.value = {}
  showModal.value   = true
}

function closeModal() {
  showModal.value = false
  editingId.value = null
}

async function handleSubmit(payload: TourPayload) {
  fieldErrors.value = {}
  try {
    if (isCreating.value) {
      await create.mutateAsync(payload)
      toast.success(t('shows.tours.created'))
    } else {
      await update.mutateAsync({ id: editingId.value!, payload })
      toast.success(t('shows.tours.updated'))
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
    toast.success(t('shows.tours.deleted'))
    confirmId.value = null
  } catch (e) {
    reportSaveError(e, t('common.state.deleteFailed'))
  }
}

function dateRange(tour: TourSummary): string {
  if (!tour.start_date && !tour.end_date) return '—'
  if (tour.start_date && tour.end_date) return `${tour.start_date} → ${tour.end_date}` /* i18n-ignore: pure interpolation, no copy */
  return tour.start_date ?? tour.end_date ?? '—'
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">{{ $t('shows.tours.title') }}</h1>
        <button @click="openCreate" class="btn-add-primary">{{ $t('shows.tours.add') }}</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="py-12 text-center text-sm" style="color:#475569;">{{ $t('common.state.loading') }}</div>
        <div v-else-if="query.isError.value" class="py-12 text-center text-sm" style="color:#f87171;">{{ $t('shows.tours.loadFailed') }}</div>
        <div v-else-if="!query.data.value?.length" class="py-12 text-center text-sm" style="color:#475569;">{{ $t('shows.tours.empty') }}</div>
        <table v-else class="w-full">
          <thead>
            <tr style="border-bottom:1px solid #222222;">
              <th class="th" style="width:3rem;">{{ $t('shows.tours.columns.id') }}</th>
              <th class="th" style="width:3rem;">{{ $t('shows.tours.columns.poster') }}</th>
              <th class="th">{{ $t('common.fields.name') }}</th>
              <th class="th">{{ $t('shows.tours.columns.dates') }}</th>
              <th class="th">{{ $t('shows.tours.columns.concerts') }}</th>
              <th class="th text-right">{{ $t('common.table.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tour in query.data.value" :key="tour.id" class="table-row">
              <td class="td" style="color:#475569;">{{ tour.id }}</td>
              <td class="td">
                <img v-if="tour.poster" :src="tour.poster" :alt="tour.name" class="poster-thumb" />
                <div v-else class="poster-placeholder">♟</div>
              </td>
              <td class="td font-medium" style="color:#e2e8f0;">{{ tour.name }}</td>
              <td class="td" style="color:#64748b; font-size:0.75rem; white-space:nowrap;">{{ dateRange(tour) }}</td>
              <td class="td">
                <span class="concerts-pill">{{ tour.concerts_count }}</span>
              </td>
              <td class="td text-right">
                <button @click="openEdit(tour)" class="btn-edit">{{ $t('common.actions.edit') }}</button>
                <button @click="confirmId = tour.id" class="btn-delete">{{ $t('common.actions.delete') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AdminModal :open="showModal" :title="modalTitle" max-width="52rem" @close="closeModal">
      <div v-if="!isCreating && fullRecord.isPending.value" class="py-8 text-center text-sm" style="color:#475569;">
        {{ $t('shows.tours.loadingOne') }}
      </div>
      <TourForm
        v-else
        :initial="isCreating ? null : (fullRecord.data.value ?? null)"
        :loading="create.isPending.value || update.isPending.value"
        :errors="fieldErrors"
        @submit="handleSubmit"
        @cancel="closeModal"
      />
    </AdminModal>

    <ConfirmDialog
      :open="confirmId !== null"
      :message="$t('shows.tours.deleteMessage')"
      :loading="remove.isPending.value"
      @confirm="confirmDelete"
      @cancel="confirmId = null"
    />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped>
.poster-thumb {
  width: 2.5rem; height: 2.5rem; border-radius: 0.25rem;
  object-fit: cover; border: 1px solid #222222;
}
.poster-placeholder {
  width: 2.5rem; height: 2.5rem; border-radius: 0.25rem;
  background: #1a1a1a; border: 1px solid #222222;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.875rem; color: #334155;
}
.concerts-pill {
  display: inline-block; min-width: 1.5rem; text-align: center;
  padding: 0.1rem 0.4rem; border-radius: 0.3rem;
  background: #222222; border: 1px solid #333333;
  font-size: 0.7rem; font-weight: 600; color: #64748b;
}
</style>
