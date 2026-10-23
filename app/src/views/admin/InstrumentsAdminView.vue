<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useInstruments } from '@/composables/useInstruments'
import { useTableControls } from '@/composables/useTableControls'
import InstrumentIcon from '@bandms/rider-core/components/InstrumentIcon.vue'
import InstrumentForm from '@/components/admin/forms/InstrumentForm.vue'
import type { Instrument, InstrumentPayload } from '@bandms/rider-core'
import { reportSaveError } from '@/utils/formErrors'

const { t } = useI18n()

const { query, create, update, remove } = useInstruments()

const showModal = ref(false)
const editing   = ref<Instrument | null>(null)
const fieldErrors    = ref<Record<string, string[]>>({})
const confirmOpen    = ref(false)
const confirmId      = ref<number | null>(null)
const confirmLoading = ref(false)
const filterCategory = ref('')

const filteredData = computed(() => {
  const rows = query.data.value ?? []
  return filterCategory.value ? rows.filter((i: Instrument) => i.category === filterCategory.value) : rows
})

const allCategories = computed(() =>
  [...new Set((query.data.value ?? []).map((i: Instrument) => i.category).filter(Boolean) as string[])].sort()
)

const tc = useTableControls<Instrument>({
  data: filteredData,
  searchFn: (i, q) => i.name.toLowerCase().includes(q) || (i.category ?? '').toLowerCase().includes(q),
  defaultSort: 'name',
})

function openCreate() { editing.value = null; fieldErrors.value = {}; showModal.value = true }
function openEdit(i: Instrument) { editing.value = i; fieldErrors.value = {}; showModal.value = true }
function closeModal() { showModal.value = false; editing.value = null }

async function submit(payload: InstrumentPayload) {
  fieldErrors.value = {}
  try {
    if (editing.value) {
      await update.mutateAsync({ id: editing.value.id, payload })
      toast.success(t('more.instruments.updated'))
    } else {
      await create.mutateAsync(payload)
      toast.success(t('more.instruments.added'))
    }
    closeModal()
  } catch (e) {
    reportSaveError(e, t('more.instruments.saveFailed'), fieldErrors)
  }
}

function requestDelete(id: number) { confirmId.value = id; confirmOpen.value = true }

async function confirmDelete() {
  if (confirmId.value == null) return
  confirmLoading.value = true
  try {
    await remove.mutateAsync(confirmId.value)
    toast.success(t('more.instruments.deleted'))
  } catch (e) { reportSaveError(e, t('more.instruments.deleteFailed')) }
  finally { confirmLoading.value = false; confirmOpen.value = false; confirmId.value = null }
}
</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color:var(--c-e2e8f0);">{{ $t('more.instruments.title') }}</h1>
          <p class="text-xs mt-0.5" style="color:var(--c-334155);">{{ $t('more.instruments.lead') }}</p>
        </div>
        <button @click="openCreate" class="btn-add-primary">{{ $t('more.instruments.add') }}</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">{{ $t('common.state.loading') }}</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:var(--c-f87171);">{{ $t('more.instruments.loadFailed') }}</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value">
            <template #filters>
              <select v-if="allCategories.length" v-model="filterCategory" class="filter-select">
                <option value="">{{ $t('more.instruments.allCategories') }}</option>
                <option v-for="cat in allCategories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </template>
          </TableToolbar>

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!(query.data.value?.length)">{{ $t('more.instruments.empty') }}</span>
            <span v-else>{{ $t('more.instruments.noMatch') }}</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid var(--c-222222);">
                <SortHeader :label="$t('more.instruments.cols.name')" sort-key="name" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <SortHeader :label="$t('more.instruments.cols.category')" sort-key="category" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">{{ $t('more.instruments.cols.stageIcon') }}</th>
                <th class="th text-right" style="width:8rem;">{{ $t('more.instruments.cols.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in tc.paginated.value" :key="i.id" class="table-row">
                <td class="td" style="color:var(--c-e2e8f0); font-weight:500;">{{ i.name }}</td>
                <td class="td">
                  <span v-if="i.category" class="category-badge">{{ i.category }}</span>
                  <span v-else style="color:var(--c-334155); font-size:var(--fs-xs);">—</span>
                </td>
                <td class="td stage-icon-cell">
                  <InstrumentIcon v-if="i.stage_plot_type" :type="i.stage_plot_type" :size="22" />
                  <span v-else style="color:var(--c-334155); font-size:var(--fs-xs);">—</span>
                </td>
                <td class="td text-right">
                  <button @click="openEdit(i)" class="btn-edit">{{ $t('common.actions.edit') }}</button>
                  <button @click="requestDelete(i.id)" class="btn-delete">{{ $t('common.actions.delete') }}</button>
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

    <AdminModal :open="showModal" :title="editing ? $t('more.instruments.editTitle') : $t('more.instruments.addTitle')" max-width="28rem" @close="closeModal">
      <InstrumentForm
        :initial="editing"
        :loading="create.isPending.value || update.isPending.value"
        :errors="fieldErrors"
        @submit="submit"
        @cancel="closeModal"
      />
    </AdminModal>

    <ConfirmDialog
      :open="confirmOpen"
      :message="$t('more.instruments.deleteMessage')"
      :loading="confirmLoading"
      @confirm="confirmDelete"
      @cancel="confirmOpen = false"
    />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped>
.category-badge {
  display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px;
  font-size: var(--fs-2xs); font-weight: 600;
  background: var(--c-2a2a2a); color: var(--c-c0c0c0);
}
.stage-icon-cell { color: var(--c-cbd5e1); }
</style>
