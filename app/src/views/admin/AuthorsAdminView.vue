<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import AuthorForm from '@/components/admin/forms/AuthorForm.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useAuthors, useAuthor } from '@/composables/useAuthors'
import { usePressReleases } from '@/composables/usePressReleases'
import { useConcerts } from '@/composables/useConcerts'
import { useTours } from '@/composables/useTours'
import { useBands } from '@/composables/useBands'
import { useTableControls } from '@/composables/useTableControls'
import { reportSaveError } from '@/utils/formErrors'
import type { AuthorSummary, AuthorPayload } from '@/types/author'

const { t } = useI18n()

const { query, create, update, remove } = useAuthors()
const { query: pressReleasesQ } = usePressReleases()
const { query: concertsQ } = useConcerts()
const { query: toursQ } = useTours()
const { query: bandsQ } = useBands()

const showModal   = ref(false)
const isCreating  = ref(false)
const editingId   = ref<number | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId   = ref<number | null>(null)

const fullRecord = useAuthor(computed(() => editingId.value))

const tc = useTableControls<AuthorSummary>({
  data: query.data,
  searchFn: (a, q) =>
    a.name.toLowerCase().includes(q) ||
    (a.email ?? '').toLowerCase().includes(q),
  defaultSort: 'name',
})

const modalTitle = computed(() => isCreating.value ? t('content.authors.modalNew') : t('content.authors.modalEdit'))

function openCreate() {
  isCreating.value  = true
  editingId.value   = null
  fieldErrors.value = {}
  showModal.value   = true
}

function openEdit(id: number) {
  isCreating.value  = false
  editingId.value   = id
  fieldErrors.value = {}
  showModal.value   = true
}

function closeModal() {
  showModal.value = false
  editingId.value = null
}

async function handleSubmit(payload: AuthorPayload) {
  fieldErrors.value = {}
  try {
    if (isCreating.value) {
      await create.mutateAsync(payload)
      toast.success(t('content.authors.created'))
    } else {
      await update.mutateAsync({ id: editingId.value!, payload })
      toast.success(t('content.authors.updated'))
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
    toast.success(t('content.authors.deleted'))
    confirmId.value = null
  } catch (e) { reportSaveError(e, t('common.state.deleteFailed')) }
}

</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color:#e2e8f0;">{{ $t('content.authors.title') }}</h1>
          <p class="text-xs mt-0.5" style="color:#475569;">{{ $t('content.authors.subtitle') }}</p>
        </div>
        <button @click="openCreate" class="btn-add-primary">{{ $t('content.authors.add') }}</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">{{ $t('common.state.loading') }}</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">{{ $t('content.authors.loadFailed') }}</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value" />

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!tc.rawTotal.value">{{ $t('content.authors.empty') }}</span>
            <span v-else>{{ $t('content.authors.noMatch') }}</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #222222;">
                <SortHeader :label="$t('common.fields.name')" sort-key="name" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">{{ $t('content.authors.columns.channels') }}</th>
                <th class="th">{{ $t('content.authors.columns.notes') }}</th>
                <SortHeader :label="$t('content.authors.columns.added')" sort-key="created_at" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="9rem" @sort="tc.toggleSort" />
                <th class="th text-right">{{ $t('common.table.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="author in tc.paginated.value" :key="author.id" class="table-row">
                <td class="td font-medium" style="color:#e2e8f0; max-width:14rem;">{{ author.name }}</td>
                <td class="td">
                  <div class="contact-chips">
                    <a v-if="author.email" :href="`mailto:${author.email}`" class="contact-chip contact-chip--email" :title="author.email">{{ $t('content.authors.chip.email') }}</a>
                    <span v-if="author.phone" class="contact-chip contact-chip--phone" :title="author.phone">{{ $t('content.authors.chip.phone') }}</span>
                    <span v-if="author.whatsapp" class="contact-chip contact-chip--whatsapp" :title="author.whatsapp">{{ $t('content.authors.chip.whatsapp') }}</span>
                  </div>
                </td>
                <td class="td notes-cell">{{ author.notes ?? '—' }}</td>
                <td class="td" style="color:#475569; font-size:0.72rem; white-space:nowrap;">
                  {{ new Date(author.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                </td>
                <td class="td text-right">
                  <button @click="openEdit(author.id)" class="btn-edit">{{ $t('common.actions.edit') }}</button>
                  <button @click="confirmId = author.id" class="btn-delete">{{ $t('common.actions.delete') }}</button>
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

    <AdminModal :open="showModal" :title="modalTitle" max-width="40rem" @close="closeModal">
      <div v-if="!isCreating && fullRecord.isPending.value" class="py-8 text-center text-sm" style="color:#475569;">{{ $t('common.state.loading') }}</div>
      <!--
        Without this branch a failed fetch renders an empty form that is still
        an *update*: saving it would wipe the contact's details and every
        relation, including the bands just assigned to them.
      -->
      <div v-else-if="!isCreating && !fullRecord.data.value" class="py-8 text-center text-sm" style="color:#f87171;">
        {{ $t('content.authors.loadOneFailed') }}
      </div>
      <AuthorForm
        v-else
        :initial="isCreating ? null : (fullRecord.data.value ?? null)"
        :loading="create.isPending.value || update.isPending.value"
        :errors="fieldErrors"
        :press-releases="pressReleasesQ.data.value ?? []"
        :concerts="concertsQ.data.value ?? []"
        :tours="toursQ.data.value ?? []"
        :bands="bandsQ.data.value ?? []"
        @submit="handleSubmit"
        @cancel="closeModal"
      />
    </AdminModal>

    <ConfirmDialog
      :open="confirmId !== null"
      :message="$t('content.authors.deleteMessage')"
      :loading="remove.isPending.value"
      @confirm="confirmDelete"
      @cancel="confirmId = null"
    />
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped>
.notes-cell {
  font-size: 0.72rem; color: #475569;
  max-width: 14rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.contact-chips { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.contact-chip {
  display: inline-block; padding: 0.1rem 0.45rem; border-radius: 0.25rem;
  font-size: 0.65rem; font-weight: 600; text-decoration: none;
  transition: opacity 100ms;
}
.contact-chip--email   { background: #0c1e2e; color: #60a5fa; border: 1px solid #1e3a5f; }
.contact-chip--phone   { background: #0f2a1e; color: #34d399; border: 1px solid #166534; }
.contact-chip--whatsapp{ background: #0f2a1e; color: #4ade80; border: 1px solid #166534; }
.contact-chip--fb      { background: #111740; color: #c0c0c0; border: 1px solid #444444; }
.contact-chip--ig      { background: #2a0f1e; color: #f472b6; border: 1px solid #831843; }
.contact-chip:hover    { opacity: 0.8; }
</style>
