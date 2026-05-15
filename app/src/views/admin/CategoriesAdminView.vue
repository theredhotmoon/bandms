<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import CategoryForm from '@/components/admin/forms/CategoryForm.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useCategories } from '@/composables/useCategories'
import { useTableControls } from '@/composables/useTableControls'
import { ApiValidationError } from '@/api/client'
import type { Category, CategoryPayload } from '@/types/category'

const { query, create, update, remove } = useCategories()

const showModal = ref(false)
const editing = ref<Category | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId = ref<number | null>(null)

const tc = useTableControls({
  data: query.data,
  searchFn: (c, q) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q),
  defaultSort: 'name',
})

function openCreate() { editing.value = null; fieldErrors.value = {}; showModal.value = true }
function openEdit(c: Category) { editing.value = c; fieldErrors.value = {}; showModal.value = true }
function closeModal() { showModal.value = false }

async function handleSubmit(payload: CategoryPayload) {
  fieldErrors.value = {}
  try {
    if (editing.value) {
      await update.mutateAsync({ id: editing.value.id, payload })
      toast.success('Category updated')
    } else {
      await create.mutateAsync(payload)
      toast.success('Category created')
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
    toast.success('Category deleted')
    confirmId.value = null
  } catch { toast.error('Failed to delete') }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Categories</h1>
        <button @click="openCreate" class="btn-add-primary">+ Add category</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">Loading…</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">Failed to load categories.</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value" />

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!tc.rawTotal.value">No categories yet.</span>
            <span v-else>No categories match your search.</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #1a1a3a;">
                <SortHeader label="Name" sort-key="name" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader label="Slug" sort-key="slug" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cat in tc.paginated.value" :key="cat.id" class="table-row">
                <td class="td font-medium" style="color:#e2e8f0;">{{ cat.name }}</td>
                <td class="td text-xs font-mono" style="color:#64748b;">{{ cat.slug }}</td>
                <td class="td text-right">
                  <button @click="openEdit(cat)" class="btn-edit">Edit</button>
                  <button @click="confirmId = cat.id" class="btn-delete">Delete</button>
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

    <AdminModal :open="showModal" :title="editing ? 'Edit category' : 'New category'" @close="closeModal">
      <CategoryForm :initial="editing" :loading="create.isPending.value || update.isPending.value" :errors="fieldErrors" @submit="handleSubmit" @cancel="closeModal" />
    </AdminModal>

    <ConfirmDialog :open="confirmId !== null" :loading="remove.isPending.value" @confirm="confirmDelete" @cancel="confirmId = null" />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
