<script setup lang="ts">
import { ref, reactive } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import { useAllowedEmails } from '@/composables/useAllowedEmails'
import { useBandMembers } from '@/composables/useBandMembers'
import type { AllowedEmailPayload } from '@/types/allowedEmail'
import type { UserRole } from '@/types/auth'

const { list, create, update, remove } = useAllowedEmails()
const { query: membersQ } = useBandMembers()

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'admin',     label: 'Admin',     desc: 'Full access to all features' },
  { value: 'member',   label: 'Member',    desc: 'Own profile + stage setups' },
  { value: 'publisher',label: 'Publisher', desc: 'Posts and content management' },
]

// ── Add modal ─────────────────────────────────────────────────────────────────

const showAdd   = ref(false)
const adding    = ref(false)

const addForm = reactive<AllowedEmailPayload>({
  email: '',
  role: 'member',
  band_member_id: null,
  notes: '',
})

function openAdd() {
  addForm.email = ''
  addForm.role = 'member'
  addForm.band_member_id = null
  addForm.notes = ''
  showAdd.value = true
}

async function submitAdd() {
  if (!addForm.email.trim()) return
  adding.value = true
  try {
    await create.mutateAsync({ ...addForm, notes: addForm.notes || null })
    showAdd.value = false
    toast.success('Email added to allowed list')
  } catch {
    toast.error('Failed to add email')
  } finally {
    adding.value = false
  }
}

// ── Edit modal ────────────────────────────────────────────────────────────────

const editId   = ref<number | null>(null)
const saving   = ref(false)

const editForm = reactive<AllowedEmailPayload & { email: string }>({
  email: '',
  role: 'member',
  band_member_id: null,
  notes: '',
})

function openEdit(entry: { id: number; email: string; role: UserRole; band_member_id: number | null; notes: string | null }) {
  editId.value = entry.id
  editForm.email = entry.email
  editForm.role = entry.role
  editForm.band_member_id = entry.band_member_id
  editForm.notes = entry.notes ?? ''
}

async function submitEdit() {
  if (!editId.value) return
  saving.value = true
  try {
    await update.mutateAsync({
      id: editId.value,
      payload: { role: editForm.role, band_member_id: editForm.band_member_id, notes: editForm.notes || null },
    })
    editId.value = null
    toast.success('Entry updated')
  } catch {
    toast.error('Failed to update')
  } finally {
    saving.value = false
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

const deleteId = ref<number | null>(null)

async function confirmDelete() {
  if (!deleteId.value) return
  try {
    await remove.mutateAsync(deleteId.value)
    deleteId.value = null
    toast.success('Email removed')
  } catch {
    toast.error('Failed to remove')
  }
}
</script>

<template>
  <AdminLayout>
    <div class="page-shell">
      <div class="page-header">
        <div>
          <div class="page-title">Allowed Emails</div>
          <div class="page-subtitle">Only emails on this list can register and log in. When empty, anyone can register.</div>
        </div>
        <button type="button" class="btn-primary" @click="openAdd">+ Add email</button>
      </div>

      <div v-if="list.isPending.value" class="state-msg">Loading…</div>
      <div v-else-if="list.isError.value" class="state-msg state-msg--error">Failed to load</div>
      <template v-else>
        <div v-if="(list.data.value ?? []).length === 0" class="empty-state">
          <div class="empty-icon">📧</div>
          <div class="empty-title">No restrictions yet</div>
          <p class="empty-desc">The allowed list is empty — registration is open to anyone. Add emails to start restricting access.</p>
          <button type="button" class="btn-primary" @click="openAdd">Add first entry</button>
        </div>

        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Linked member</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in list.data.value" :key="entry.id">
              <td class="td-email">{{ entry.email }}</td>
              <td>
                <span class="role-badge" :class="`role-badge--${entry.role}`">{{ entry.role }}</span>
              </td>
              <td class="td-member">
                <template v-if="entry.band_member_id">
                  {{ (membersQ.data.value ?? []).find(m => m.id === entry.band_member_id)?.first_name }}
                  {{ (membersQ.data.value ?? []).find(m => m.id === entry.band_member_id)?.last_name }}
                </template>
                <span v-else class="td-none">—</span>
              </td>
              <td class="td-notes">{{ entry.notes || '—' }}</td>
              <td class="td-actions">
                <button type="button" class="tbl-btn" @click="openEdit(entry)">Edit</button>
                <button type="button" class="tbl-btn tbl-btn--del" @click="deleteId = entry.id">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>

    <!-- Add modal -->
    <AdminModal :open="showAdd" title="Add allowed email" max-width="30rem" @close="showAdd = false">
      <form @submit.prevent="submitAdd" class="modal-form">
        <div>
          <label class="field-label">Email address</label>
          <input v-model="addForm.email" type="email" class="field-input" placeholder="john@yourband.com" autofocus />
        </div>
        <div>
          <label class="field-label">Role</label>
          <div class="role-options">
            <label
              v-for="r in ROLES"
              :key="r.value"
              class="role-option"
              :class="{ 'role-option--active': addForm.role === r.value }"
            >
              <input type="radio" v-model="addForm.role" :value="r.value" class="sr-only" />
              <span class="role-option-name">{{ r.label }}</span>
              <span class="role-option-desc">{{ r.desc }}</span>
            </label>
          </div>
        </div>
        <div v-if="addForm.role === 'member'">
          <label class="field-label">Link to band member (optional)</label>
          <select v-model="addForm.band_member_id" class="field-input">
            <option :value="null">— No link —</option>
            <option v-for="m in (membersQ.data.value ?? [])" :key="m.id" :value="m.id">
              {{ m.first_name }} {{ m.last_name }} ({{ m.role }})
            </option>
          </select>
          <p class="field-hint">When linked, the user can edit that member's profile and stage setups after registering.</p>
        </div>
        <div>
          <label class="field-label">Notes (optional)</label>
          <input v-model="addForm.notes" class="field-input" placeholder="e.g. Lead guitarist, added 2026" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="showAdd = false">Cancel</button>
          <button type="submit" :disabled="!addForm.email.trim() || adding" class="btn-primary">
            {{ adding ? 'Adding…' : 'Add' }}
          </button>
        </div>
      </form>
    </AdminModal>

    <!-- Edit modal -->
    <AdminModal :open="editId !== null" title="Edit entry" max-width="30rem" @close="editId = null">
      <form @submit.prevent="submitEdit" class="modal-form">
        <div>
          <label class="field-label">Email</label>
          <div class="field-static">{{ editForm.email }}</div>
        </div>
        <div>
          <label class="field-label">Role</label>
          <div class="role-options">
            <label
              v-for="r in ROLES"
              :key="r.value"
              class="role-option"
              :class="{ 'role-option--active': editForm.role === r.value }"
            >
              <input type="radio" v-model="editForm.role" :value="r.value" class="sr-only" />
              <span class="role-option-name">{{ r.label }}</span>
              <span class="role-option-desc">{{ r.desc }}</span>
            </label>
          </div>
        </div>
        <div v-if="editForm.role === 'member'">
          <label class="field-label">Link to band member (optional)</label>
          <select v-model="editForm.band_member_id" class="field-input">
            <option :value="null">— No link —</option>
            <option v-for="m in (membersQ.data.value ?? [])" :key="m.id" :value="m.id">
              {{ m.first_name }} {{ m.last_name }} ({{ m.role }})
            </option>
          </select>
        </div>
        <div>
          <label class="field-label">Notes (optional)</label>
          <input v-model="editForm.notes" class="field-input" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="editId = null">Cancel</button>
          <button type="submit" :disabled="saving" class="btn-primary">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </AdminModal>

    <!-- Confirm delete -->
    <AdminModal :open="deleteId !== null" title="Remove email?" max-width="24rem" @close="deleteId = null">
      <div class="confirm-delete">
        <p>This will remove the email from the allowed list. Existing user accounts are not affected.</p>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="deleteId = null">Cancel</button>
          <button type="button" class="btn-danger" @click="confirmDelete">Remove</button>
        </div>
      </div>
    </AdminModal>
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped src="../../components/admin/form-styles.css" />
<style scoped>
.page-shell {
  padding: 1.5rem;
  max-width: 56rem;
}
.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 1rem; margin-bottom: 1.5rem;
}
.page-title    { font-size: 1.125rem; font-weight: 700; color: #e2e8f0; }
.page-subtitle { font-size: 0.8rem; color: #475569; margin-top: 0.25rem; max-width: 40rem; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.75rem; padding: 4rem 2rem; text-align: center;
}
.empty-icon  { font-size: 2.5rem; }
.empty-title { font-size: 1rem; font-weight: 700; color: #e2e8f0; }
.empty-desc  { font-size: 0.8rem; color: #475569; max-width: 28rem; line-height: 1.6; }

.td-email  { font-weight: 500; color: #e2e8f0; }
.td-member { color: #94a3b8; font-size: 0.8125rem; }
.td-notes  { color: #475569; font-size: 0.8rem; max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-none   { color: #1e293b; }

.role-badge {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; padding: 0.15rem 0.5rem; border-radius: 999px;
}
.role-badge--admin     { background: #1e1b4b; color: #818cf8; }
.role-badge--member    { background: #052e16; color: #4ade80; }
.role-badge--publisher { background: #431407; color: #fb923c; }

.role-options { display: flex; flex-direction: column; gap: 0.375rem; }
.role-option {
  display: flex; flex-direction: column; gap: 0.1rem;
  padding: 0.5rem 0.75rem; border-radius: 0.375rem; cursor: pointer;
  border: 1px solid #1e2040; background: #0a0a1e;
  transition: border-color 120ms, background 120ms;
}
.role-option--active { border-color: #4338ca; background: #0e0e26; }
.role-option-name { font-size: 0.8rem; font-weight: 600; color: #e2e8f0; }
.role-option-desc { font-size: 0.7rem; color: #475569; }

.field-static {
  font-size: 0.8125rem; color: #94a3b8;
  padding: 0.4rem 0; border-bottom: 1px solid #1e2040;
}

.modal-form, .confirm-delete { display: flex; flex-direction: column; gap: 1rem; }
.modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
.confirm-delete p { font-size: 0.875rem; color: #94a3b8; line-height: 1.6; }

.state-msg { padding: 2rem; text-align: center; color: #475569; font-size: 0.875rem; }
.state-msg--error { color: #f87171; }
</style>
