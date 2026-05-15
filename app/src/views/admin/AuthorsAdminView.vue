<script setup lang="ts">
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
import { useTableControls } from '@/composables/useTableControls'
import { ApiValidationError } from '@/api/client'
import type { AuthorSummary, AuthorPayload } from '@/types/author'

const { query, create, update, remove } = useAuthors()
const { query: pressReleasesQ } = usePressReleases()
const { query: concertsQ } = useConcerts()
const { query: toursQ } = useTours()

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
    (a.email ?? '').toLowerCase().includes(q) ||
    (a.facebook ?? '').toLowerCase().includes(q) ||
    (a.instagram ?? '').toLowerCase().includes(q),
  defaultSort: 'name',
})

const modalTitle = computed(() => isCreating.value ? 'Add author / contact' : 'Edit author / contact')

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
      toast.success('Author added')
    } else {
      await update.mutateAsync({ id: editingId.value!, payload })
      toast.success('Author updated')
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
    toast.success('Author deleted')
    confirmId.value = null
  } catch { toast.error('Failed to delete') }
}

</script>

<template>
  <AdminLayout>
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-lg font-semibold" style="color:#e2e8f0;">Authors & Contacts</h1>
          <p class="text-xs mt-0.5" style="color:#475569;">Journalists, bloggers, photographers and other people connected to your resources.</p>
        </div>
        <button @click="openCreate" class="btn-add-primary">+ Add author</button>
      </div>

      <div class="table-card">
        <div v-if="query.isPending.value" class="empty-state">Loading…</div>
        <div v-else-if="query.isError.value" class="empty-state" style="color:#f87171;">Failed to load authors.</div>
        <template v-else>
          <TableToolbar v-model:search="tc.search.value" :total="tc.rawTotal.value" :showing="tc.total.value" />

          <div v-if="!tc.paginated.value.length" class="empty-state">
            <span v-if="!tc.rawTotal.value">No authors yet. Add the first contact above.</span>
            <span v-else>No authors match your search.</span>
          </div>
          <table v-else class="w-full">
            <thead>
              <tr style="border-bottom:1px solid #1a1a3a;">
                <SortHeader label="Name" sort-key="name" :current="tc.sortKey.value" :dir="tc.sortDir.value" @sort="tc.toggleSort" />
                <th class="th">Contact channels</th>
                <th class="th">Notes</th>
                <SortHeader label="Added" sort-key="created_at" :current="tc.sortKey.value" :dir="tc.sortDir.value" width="9rem" @sort="tc.toggleSort" />
                <th class="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="author in tc.paginated.value" :key="author.id" class="table-row">
                <td class="td font-medium" style="color:#e2e8f0; max-width:14rem;">{{ author.name }}</td>
                <td class="td">
                  <div class="contact-chips">
                    <a v-if="author.email" :href="`mailto:${author.email}`" class="contact-chip contact-chip--email" :title="author.email">✉ Email</a>
                    <span v-if="author.phone" class="contact-chip contact-chip--phone" :title="author.phone">📞 Phone</span>
                    <span v-if="author.whatsapp" class="contact-chip contact-chip--whatsapp" :title="author.whatsapp">💬 WA</span>
                    <span v-if="author.facebook" class="contact-chip contact-chip--fb" :title="author.facebook">FB</span>
                    <span v-if="author.instagram" class="contact-chip contact-chip--ig" :title="author.instagram">IG</span>
                  </div>
                </td>
                <td class="td notes-cell">{{ author.notes ?? '—' }}</td>
                <td class="td" style="color:#475569; font-size:0.72rem; white-space:nowrap;">
                  {{ new Date(author.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}
                </td>
                <td class="td text-right">
                  <button @click="openEdit(author.id)" class="btn-edit">Edit</button>
                  <button @click="confirmId = author.id" class="btn-delete">Delete</button>
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
      <div v-if="!isCreating && fullRecord.isPending.value" class="py-8 text-center text-sm" style="color:#475569;">Loading…</div>
      <AuthorForm
        v-else
        :initial="isCreating ? null : (fullRecord.data.value ?? null)"
        :loading="create.isPending.value || update.isPending.value"
        :errors="fieldErrors"
        :press-releases="pressReleasesQ.data.value ?? []"
        :concerts="concertsQ.data.value ?? []"
        :tours="toursQ.data.value ?? []"
        @submit="handleSubmit"
        @cancel="closeModal"
      />
    </AdminModal>

    <ConfirmDialog
      :open="confirmId !== null"
      message="This author and all their contact information will be permanently deleted."
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
.contact-chip--fb      { background: #111740; color: #818cf8; border: 1px solid #312e81; }
.contact-chip--ig      { background: #2a0f1e; color: #f472b6; border: 1px solid #831843; }
.contact-chip:hover    { opacity: 0.8; }
</style>
