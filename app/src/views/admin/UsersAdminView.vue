<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUiLang } from '@/composables/useUiLang'
import { formatShortDate } from '@/utils/formatDate'
import { dateLocale } from '@/locales'
import { ref, reactive, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import { reportSaveError } from '@/utils/formErrors'
import { useUsers } from '@/composables/useUsers'
import { useBandMembers } from '@/composables/useBandMembers'
import { useAuth } from '@/composables/useAuth'
import type { ManagedUser, UserPayload } from '@/types/user'
import type { UserRole } from '@/types/auth'

const { t } = useI18n()
const { uiLang } = useUiLang()

/** Inline style, not copy — see the note in ShopAdminView. */
function roleBadgeStyle(role: UserRole) {
  const c = ROLE_COLORS[role]
  return { color: c, background: c + '18', borderColor: c + '30' }
}

const { list, create, update, remove } = useUsers()
const { query: membersQ } = useBandMembers()
const { user: currentUser } = useAuth()

const bandMembers = computed(() => membersQ.data.value ?? [])

// The words live in the catalogue, keyed by the stored value; the order here
// is the order the radio cards appear in.
const ROLES: UserRole[] = ['admin', 'member', 'publisher']

// ── Add modal ─────────────────────────────────────────────────────────────────

const showAdd = ref(false)
const adding  = ref(false)
const addForm = reactive<UserPayload & { password: string; password_confirmation: string }>({
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  password_confirmation: '',
  role: 'member',
  band_member_id: null,
})

function openAdd() {
  Object.assign(addForm, {
    first_name: '', last_name: '', email: '',
    password: '', password_confirmation: '',
    role: 'member', band_member_id: null,
  })
  showAdd.value = true
}

watch(() => addForm.band_member_id, (memberId) => {
  const member = memberId ? bandMembers.value.find(m => m.id === memberId) : null
  if (member) {
    addForm.first_name = member.first_name
    addForm.last_name  = member.last_name
    addForm.email      = member.login_email ?? ''
  } else {
    addForm.first_name = ''
    addForm.last_name  = ''
    addForm.email      = ''
  }
})

async function submitAdd() {
  if (!addForm.first_name.trim() || !addForm.email.trim() || !addForm.password) return
  adding.value = true
  try {
    await create.mutateAsync({ ...addForm })
    showAdd.value = false
    toast.success(t('more.users.created'))
  } catch (e) {
    reportSaveError(e, t('more.users.createFailed'))
  } finally {
    adding.value = false
  }
}

// ── Edit modal ────────────────────────────────────────────────────────────────

const showEdit    = ref(false)
const editingId   = ref<number | null>(null)
const saving      = ref(false)
const editForm    = reactive<Partial<UserPayload> & { password: string; password_confirmation: string }>({
  first_name: '', last_name: '', email: '',
  password: '', password_confirmation: '',
  role: 'member', band_member_id: null,
})

function openEdit(userId: number) {
  const u = (list.data.value ?? []).find((x: ManagedUser) => x.id === userId)
  if (!u) return
  Object.assign(editForm, {
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    password: '',
    password_confirmation: '',
    role: u.role,
    band_member_id: u.band_member_id,
  })
  editingId.value = userId
  showEdit.value = true
}

watch(() => editForm.band_member_id, (memberId) => {
  const member = memberId ? bandMembers.value.find(m => m.id === memberId) : null
  if (member) {
    editForm.first_name = member.first_name
    editForm.last_name  = member.last_name
    editForm.email      = member.login_email ?? ''
  }
})

async function submitEdit() {
  if (editingId.value === null) return
  saving.value = true
  const payload: Partial<UserPayload> = {
    first_name: editForm.first_name,
    last_name: editForm.last_name,
    email: editForm.email,
    role: editForm.role,
    band_member_id: editForm.band_member_id,
  }
  if (editForm.password) {
    payload.password = editForm.password
    payload.password_confirmation = editForm.password_confirmation
  }
  try {
    await update.mutateAsync({ id: editingId.value, payload })
    showEdit.value = false
    toast.success(t('more.users.updated'))
  } catch (e) {
    reportSaveError(e, t('more.users.updateFailed'))
  } finally {
    saving.value = false
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

const confirmDeleteId = ref<number | null>(null)

async function confirmDelete() {
  if (!confirmDeleteId.value) return
  try {
    await remove.mutateAsync(confirmDeleteId.value)
    confirmDeleteId.value = null
    toast.success(t('more.users.deleted'))
  } catch (e) {
    reportSaveError(e, t('more.users.deleteFailed'))
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<UserRole, string> = {
  admin:     '#c0c0c0',
  member:    '#4ade80',
  publisher: '#fb923c',
}
</script>

<template>
  <AdminLayout>
    <div class="page-wrap">
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ $t('more.users.title') }}</h1>
          <div class="page-sub">{{ $t('more.users.lead') }}</div>
        </div>
        <button type="button" class="btn-add-primary" @click="openAdd">{{ $t('more.users.add') }}</button>
      </div>

      <div v-if="list.isPending.value" class="empty-state">{{ $t('common.state.loading') }}</div>
      <div v-else-if="list.isError.value" class="empty-state" style="color:#f87171;">{{ $t('more.users.loadFailed') }}</div>

      <div v-else class="table-card">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th class="th">{{ $t('more.users.cols.name') }}</th>
              <th class="th">{{ $t('more.users.cols.email') }}</th>
              <th class="th">{{ $t('more.users.cols.role') }}</th>
              <th class="th">{{ $t('more.users.cols.bandMember') }}</th>
              <th class="th">{{ $t('more.users.cols.created') }}</th>
              <th class="th" style="text-align:right;">{{ $t('more.users.cols.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in (list.data.value ?? [])" :key="u.id" class="table-row">
              <td class="td" style="color:#e2e8f0; font-weight:600;">
                {{ u.first_name }} {{ u.last_name }}
                <span v-if="u.id === currentUser?.id" style="font-size:0.65rem;color:#888888;margin-left:0.4rem;">{{ $t('more.users.you') }}</span>
              </td>
              <td class="td" style="color:#94a3b8;">{{ u.email }}</td>
              <td class="td">
                <span class="role-badge" :style="roleBadgeStyle(u.role as UserRole)">
                  {{ $t(`more.users.roles.${u.role}`) }}
                </span>
              </td>
              <td class="td" style="color:#64748b;">
                <span v-if="u.band_member">{{ u.band_member.first_name }} {{ u.band_member.last_name }}</span>
                <span v-else>—</span>
              </td>
              <td class="td" style="color:#475569;">{{ formatShortDate(u.created_at, dateLocale(uiLang), 'instant') }}</td>
              <td class="td" style="text-align:right;">
                <button type="button" class="btn-edit" @click="openEdit(u.id)">{{ $t('common.actions.edit') }}</button>
                <button
                  type="button"
                  class="btn-delete"
                  :disabled="u.id === currentUser?.id"
                  :title="u.id === currentUser?.id ? $t('more.users.cannotDeleteSelf') : $t('common.actions.delete')"
                  @click="confirmDeleteId = u.id"
                >{{ $t('common.actions.delete') }}</button>
              </td>
            </tr>
            <tr v-if="(list.data.value ?? []).length === 0">
              <td colspan="6" class="empty-state">{{ $t('more.users.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add modal -->
    <AdminModal :open="showAdd" :title="$t('more.users.addTitle')" max-width="30rem" @close="showAdd = false">
      <form class="modal-form" @submit.prevent="submitAdd">
        <div>
          <label class="field-label">{{ $t('more.users.form.bandMember') }} <span style="color:#475569;font-weight:400;">{{ $t('more.users.form.bandMemberHint') }}</span></label>
          <select v-model="addForm.band_member_id" class="field-input">
            <option :value="null">{{ $t('more.users.form.enterManually') }}</option>
            <option v-for="m in bandMembers" :key="m.id" :value="m.id">
              {{ m.first_name }} {{ m.last_name }}
            </option>
          </select>
        </div>
        <div class="field-row">
          <div>
            <label class="field-label">{{ $t('more.users.form.firstName') }}</label>
            <input v-model="addForm.first_name" class="field-input" required :disabled="!!addForm.band_member_id" />
          </div>
          <div>
            <label class="field-label">{{ $t('more.users.form.lastName') }}</label>
            <input v-model="addForm.last_name" class="field-input" required :disabled="!!addForm.band_member_id" />
          </div>
        </div>
        <div>
          <label class="field-label">{{ $t('more.users.form.email') }}</label>
          <input v-model="addForm.email" type="email" class="field-input" required autocomplete="off" :disabled="!!addForm.band_member_id" />
        </div>
        <div>
          <label class="field-label">{{ $t('more.users.form.role') }}</label>
          <div class="role-grid">
            <label v-for="r in ROLES" :key="r" class="role-card" :class="{ 'role-card--active': addForm.role === r }">
              <input v-model="addForm.role" type="radio" :value="r" style="display:none;" />
              <span class="role-card-name">{{ $t(`more.users.roles.${r}`) }}</span>
              <span class="role-card-desc">{{ $t(`more.users.roleDesc.${r}`) }}</span>
            </label>
          </div>
        </div>
        <div class="field-row">
          <div>
            <label class="field-label">{{ $t('more.users.form.password') }}</label>
            <input v-model="addForm.password" type="password" class="field-input" required autocomplete="new-password" />
          </div>
          <div>
            <label class="field-label">{{ $t('more.users.form.confirmPassword') }}</label>
            <input v-model="addForm.password_confirmation" type="password" class="field-input" required autocomplete="new-password" />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="showAdd = false">{{ $t('common.actions.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="adding">{{ adding ? $t('more.users.form.creating') : $t('more.users.form.createUser') }}</button>
        </div>
      </form>
    </AdminModal>

    <!-- Edit modal -->
    <AdminModal :open="showEdit" :title="$t('more.users.editTitle')" max-width="30rem" @close="showEdit = false">
      <form class="modal-form" @submit.prevent="submitEdit">
        <div>
          <label class="field-label">{{ $t('more.users.form.bandMember') }} <span style="color:#475569;font-weight:400;">{{ $t('more.users.form.bandMemberHint') }}</span></label>
          <select v-model="editForm.band_member_id" class="field-input">
            <option :value="null">{{ $t('more.users.form.none') }}</option>
            <option v-for="m in bandMembers" :key="m.id" :value="m.id">
              {{ m.first_name }} {{ m.last_name }}
            </option>
          </select>
        </div>
        <div class="field-row">
          <div>
            <label class="field-label">{{ $t('more.users.form.firstName') }}</label>
            <input v-model="editForm.first_name" class="field-input" required :disabled="!!editForm.band_member_id" />
          </div>
          <div>
            <label class="field-label">{{ $t('more.users.form.lastName') }}</label>
            <input v-model="editForm.last_name" class="field-input" required :disabled="!!editForm.band_member_id" />
          </div>
        </div>
        <div>
          <label class="field-label">{{ $t('more.users.form.email') }}</label>
          <input v-model="editForm.email" type="email" class="field-input" required :disabled="!!editForm.band_member_id" />
        </div>
        <div>
          <label class="field-label">{{ $t('more.users.form.role') }}</label>
          <div class="role-grid">
            <label v-for="r in ROLES" :key="r" class="role-card" :class="{ 'role-card--active': editForm.role === r }">
              <input v-model="editForm.role" type="radio" :value="r" style="display:none;" />
              <span class="role-card-name">{{ $t(`more.users.roles.${r}`) }}</span>
              <span class="role-card-desc">{{ $t(`more.users.roleDesc.${r}`) }}</span>
            </label>
          </div>
        </div>
        <div class="field-row">
          <div>
            <label class="field-label">{{ $t('more.users.form.newPassword') }} <span style="color:#475569;font-weight:400;">{{ $t('more.users.form.newPasswordHint') }}</span></label>
            <input v-model="editForm.password" type="password" class="field-input" autocomplete="new-password" />
          </div>
          <div>
            <label class="field-label">{{ $t('more.users.form.confirmNewPassword') }}</label>
            <input v-model="editForm.password_confirmation" type="password" class="field-input" autocomplete="new-password" />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="showEdit = false">{{ $t('common.actions.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? $t('common.actions.saving') : $t('more.users.form.saveChanges') }}</button>
        </div>
      </form>
    </AdminModal>

    <!-- Confirm delete -->
    <AdminModal :open="confirmDeleteId !== null" :title="$t('more.users.deleteTitle')" max-width="24rem" @close="confirmDeleteId = null">
      <div class="modal-form">
        <p style="font-size:0.875rem;color:#94a3b8;line-height:1.6;">
          {{ $t('more.users.deleteMessage') }}
        </p>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="confirmDeleteId = null">{{ $t('common.actions.cancel') }}</button>
          <button type="button" class="btn-danger" @click="confirmDelete">{{ $t('common.actions.delete') }}</button>
        </div>
      </div>
    </AdminModal>
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped src="../../components/admin/form-styles.css" />
<style scoped>
.page-wrap   { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.page-title  { font-size: 1.125rem; font-weight: 700; color: #e2e8f0; }
.page-sub    { font-size: 0.8rem; color: #475569; margin-top: 0.2rem; }

.role-badge {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid;
}

.modal-form  { display: flex; flex-direction: column; gap: 1rem; }
.modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
.field-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

.role-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
.role-card {
  display: flex; flex-direction: column; gap: 0.2rem; padding: 0.625rem 0.75rem;
  border-radius: 0.5rem; border: 1px solid #2a2a2a; background: #141414; cursor: pointer;
  transition: border-color 120ms, background 120ms;
}
.role-card:hover        { border-color: #444444; background: #12123a; }
.role-card--active      { border-color: #888888 !important; background: #1f1f1f !important; }
.role-card-name         { font-size: 0.8rem; font-weight: 700; color: #e2e8f0; }
.role-card-desc         { font-size: 0.65rem; color: #475569; line-height: 1.4; }
.role-card--active .role-card-name { color: #d0d0d0; }

.btn-danger {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #7f1d1d; border: 1px solid #991b1b; color: #fca5a5;
}
.btn-danger:hover { background: #450a0a; }
</style>
