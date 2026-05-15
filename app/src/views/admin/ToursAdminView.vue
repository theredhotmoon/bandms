<script setup lang="ts">
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import TourForm from '@/components/admin/forms/TourForm.vue'
import { useTours } from '@/composables/useTours'
import { useTour } from '@/composables/useTour'
import { ApiValidationError } from '@/api/client'
import type { TourSummary, TourPayload } from '@/types/tour'

const { query, create, update, remove } = useTours()

const showModal   = ref(false)
const isCreating  = ref(false)
const editingId   = ref<number | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId   = ref<number | null>(null)

const fullRecord  = useTour(editingId)

const modalTitle  = computed(() =>
  isCreating.value ? 'New tour' : (fullRecord.data.value?.name ?? 'Edit tour'),
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
      toast.success('Tour created')
    } else {
      await update.mutateAsync({ id: editingId.value!, payload })
      toast.success('Tour updated')
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
    toast.success('Tour deleted')
    confirmId.value = null
  } catch {
    toast.error('Failed to delete')
  }
}

function dateRange(t: TourSummary): string {
  if (!t.start_date && !t.end_date) return '—'
  if (t.start_date && t.end_date) return `${t.start_date} → ${t.end_date}`
  return t.start_date ?? t.end_date ?? '—'
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Tours</h1>
        <button @click="openCreate" class="btn-add-primary">+ Add tour</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="py-12 text-center text-sm" style="color:#475569;">Loading…</div>
        <div v-else-if="query.isError.value" class="py-12 text-center text-sm" style="color:#f87171;">Failed to load tours.</div>
        <div v-else-if="!query.data.value?.length" class="py-12 text-center text-sm" style="color:#475569;">No tours yet. Add the first one above.</div>
        <table v-else class="w-full">
          <thead>
            <tr style="border-bottom:1px solid #1a1a3a;">
              <th class="th" style="width:3rem;">ID</th>
              <th class="th" style="width:3rem;">Poster</th>
              <th class="th">Name</th>
              <th class="th">Dates</th>
              <th class="th">Concerts</th>
              <th class="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in query.data.value" :key="t.id" class="table-row">
              <td class="td" style="color:#475569;">{{ t.id }}</td>
              <td class="td">
                <img v-if="t.poster" :src="t.poster" :alt="t.name" class="poster-thumb" />
                <div v-else class="poster-placeholder">♟</div>
              </td>
              <td class="td font-medium" style="color:#e2e8f0;">{{ t.name }}</td>
              <td class="td" style="color:#64748b; font-size:0.75rem; white-space:nowrap;">{{ dateRange(t) }}</td>
              <td class="td">
                <span class="concerts-pill">{{ t.concerts_count }}</span>
              </td>
              <td class="td text-right">
                <button @click="openEdit(t)" class="btn-edit">Edit</button>
                <button @click="confirmId = t.id" class="btn-delete">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AdminModal :open="showModal" :title="modalTitle" max-width="52rem" @close="closeModal">
      <div v-if="!isCreating && fullRecord.isPending.value" class="py-8 text-center text-sm" style="color:#475569;">
        Loading tour…
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
      message="This tour and all its data will be permanently deleted. Concert assignments will be removed."
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
  object-fit: cover; border: 1px solid #1a1a38;
}
.poster-placeholder {
  width: 2.5rem; height: 2.5rem; border-radius: 0.25rem;
  background: #111128; border: 1px solid #1a1a38;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.875rem; color: #334155;
}
.concerts-pill {
  display: inline-block; min-width: 1.5rem; text-align: center;
  padding: 0.1rem 0.4rem; border-radius: 0.3rem;
  background: #1e293b; border: 1px solid #2d2a6e;
  font-size: 0.7rem; font-weight: 600; color: #64748b;
}
</style>
