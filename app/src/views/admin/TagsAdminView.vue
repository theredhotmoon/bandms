<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import TagForm from '@/components/admin/forms/TagForm.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useTags } from '@/composables/useTags'
import { useTableControls } from '@/composables/useTableControls'
import { reportSaveError } from '@/utils/formErrors'
import type { Tag, TagPayload } from '@/types/tag'

const { t } = useI18n()

const { query, create, update, remove } = useTags()

const showModal = ref(false)
const editing = ref<Tag | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId = ref<number | null>(null)

const tc = useTableControls<Tag>({
  data: query.data,
  searchFn: (t, q) => t.name.toLowerCase().includes(q) || t.slug_en.toLowerCase().includes(q),
  defaultSort: 'name',
})

function openCreate() { editing.value = null; fieldErrors.value = {}; showModal.value = true }
function openEdit(t: Tag) { editing.value = t; fieldErrors.value = {}; showModal.value = true }
function closeModal() { showModal.value = false }

async function handleSubmit(payload: TagPayload) {
  fieldErrors.value = {}
  try {
    if (editing.value) {
      await update.mutateAsync({ id: editing.value.id, payload })
      toast.success(t('more.tags.updated'))
    } else {
      await create.mutateAsync(payload)
      toast.success(t('more.tags.created'))
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
    toast.success(t('more.tags.deleted'))
    confirmId.value = null
  } catch (e) { reportSaveError(e, t('common.state.deleteFailed')) }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-lg font-semibold" style="color:#e2e8f0;">{{ $t('more.tags.title') }}</h1>
        <button @click="openCreate" class="btn-add-primary">{{ $t('more.tags.add') }}</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">{{ $t('common.state.loading') }}</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">{{ $t('more.tags.loadFailed') }}</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value" />

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!tc.rawTotal.value">{{ $t('more.tags.empty') }}</span>
            <span v-else>{{ $t('more.tags.noMatch') }}</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #222222;">
                <SortHeader :label="$t('more.tags.cols.name')" sort-key="name" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader :label="$t('more.tags.cols.slug')" sort-key="slug_en" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th text-right">{{ $t('more.tags.cols.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tag in tc.paginated.value" :key="tag.id" class="table-row">
                <td class="td font-medium" style="color:#e2e8f0;">{{ tag.name }}</td>
                <td class="td text-xs font-mono" style="color:#64748b;">{{ tag.slug_en }}</td>
                <td class="td text-right">
                  <button @click="openEdit(tag)" class="btn-edit">{{ $t('common.actions.edit') }}</button>
                  <button @click="confirmId = tag.id" class="btn-delete">{{ $t('common.actions.delete') }}</button>
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

    <AdminModal :open="showModal" :title="editing ? $t('more.tags.editTitle') : $t('more.tags.newTitle')" @close="closeModal">
      <TagForm :initial="editing" :loading="create.isPending.value || update.isPending.value" :errors="fieldErrors" @submit="handleSubmit" @cancel="closeModal" />
    </AdminModal>

    <ConfirmDialog :open="confirmId !== null" :loading="remove.isPending.value" @confirm="confirmDelete" @cancel="confirmId = null" />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
