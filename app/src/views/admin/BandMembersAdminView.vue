<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import BandMemberForm from '@/components/admin/forms/BandMemberForm.vue'
import MemberSetupsPanel from '@/components/band-member/MemberSetupsPanel.vue'
import MemberDefaultGear from '@/components/band-member/MemberDefaultGear.vue'
import { useBandMembers } from '@/composables/useBandMembers'
import { useInstruments } from '@/composables/useInstruments'
import { ApiValidationError } from '@/api/client'
import type { BandMember, BandMemberPayload } from '@/types/bandMember'

const { query, create, update, remove, uploadPhoto, reorder } = useBandMembers()
const { query: instrumentsQuery } = useInstruments()

// ── Selection ──────────────────────────────────────────────────────────────────
const openId    = ref<number | null>(null)
const detailTab = ref<'profile' | 'setups' | 'gear'>('profile')

const openMember = computed<BandMember | null>(
  () => query.data.value?.find((m: BandMember) => m.id === openId.value) ?? null,
)

watch(openId, () => { detailTab.value = 'profile' })

function selectMember(m: BandMember) {
  openId.value = m.id
}

// ── Drag-and-drop reordering ──────────────────────────────────────────────────
const draggedId   = ref<number | null>(null)
const localOrder  = ref<number[] | null>(null)  // overrides render order while dragging

function orderedGroup(members: BandMember[]): BandMember[] {
  if (!localOrder.value) return members
  return [...members].sort(
    (a, b) => localOrder.value!.indexOf(a.id) - localOrder.value!.indexOf(b.id),
  )
}

function onDragStart(e: DragEvent, m: BandMember) {
  draggedId.value  = m.id
  localOrder.value = (query.data.value ?? []).map((x: BandMember) => x.id)
  e.dataTransfer!.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, m: BandMember) {
  e.preventDefault()
  if (!draggedId.value || !localOrder.value || draggedId.value === m.id) return
  const arr     = [...localOrder.value]
  const fromIdx = arr.indexOf(draggedId.value)
  const toIdx   = arr.indexOf(m.id)
  arr.splice(fromIdx, 1)
  arr.splice(toIdx, 0, draggedId.value)
  localOrder.value = arr
}

async function onDrop() {
  if (!localOrder.value) return
  const ids = [...localOrder.value]
  draggedId.value  = null
  localOrder.value = null
  try {
    await reorder.mutateAsync(ids)
  } catch {
    toast.error('Failed to save new order')
  }
}

function onDragEnd() {
  draggedId.value  = null
  localOrder.value = null
}

const currentMembers = computed(() => {
  const c = query.data.value?.filter((m: BandMember) => m.is_current) ?? []
  return orderedGroup(c)
})
const exMembers = computed(() => {
  const ex = query.data.value?.filter((m: BandMember) => !m.is_current) ?? []
  return orderedGroup(ex)
})

// ── Create (modal) ─────────────────────────────────────────────────────────────
const showCreateModal = ref(false)
const createErrors    = ref<Record<string, string[]>>({})

async function handleCreate(payload: BandMemberPayload) {
  createErrors.value = {}
  const photoFile = payload.photo_file ?? null
  const { photo_file: _, ...rest } = payload
  try {
    const created = await create.mutateAsync(rest)
    if (photoFile) {
      await uploadPhoto.mutateAsync({ id: created.id, file: photoFile })
    }
    toast.success('Member added')
    showCreateModal.value = false
    openId.value = created.id
  } catch (e) {
    if (e instanceof ApiValidationError) createErrors.value = e.errors
    else toast.error('Something went wrong')
  }
}

// ── Update (inline) ────────────────────────────────────────────────────────────
const updateErrors = ref<Record<string, string[]>>({})

async function handleUpdate(payload: BandMemberPayload) {
  if (!openMember.value) return
  updateErrors.value = {}
  const photoFile = payload.photo_file ?? null
  const { photo_file: _, ...rest } = payload
  try {
    await update.mutateAsync({ id: openMember.value.id, payload: rest })
    if (photoFile) {
      await uploadPhoto.mutateAsync({ id: openMember.value.id, file: photoFile })
    }
    toast.success('Member updated')
  } catch (e) {
    if (e instanceof ApiValidationError) updateErrors.value = e.errors
    else toast.error('Something went wrong')
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
const confirmDeleteId = ref<number | null>(null)

async function confirmDelete() {
  if (confirmDeleteId.value == null) return
  try {
    await remove.mutateAsync(confirmDeleteId.value)
    if (openId.value === confirmDeleteId.value) openId.value = null
    confirmDeleteId.value = null
    toast.success('Member removed')
  } catch { toast.error('Failed to remove') }
}
</script>

<template>
  <AdminLayout>
    <div class="members-shell">

      <!-- ── Member sidebar ──────────────────────────────────────────────── -->
      <aside class="members-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-title">Band Members</div>
          <button type="button" class="btn-new" title="Add member" @click="showCreateModal = true">+</button>
        </div>

        <div v-if="query.isPending.value" class="sidebar-state">Loading…</div>
        <div v-else-if="query.isError.value" class="sidebar-state sidebar-state--err">Failed to load</div>

        <div v-else class="member-list">
          <!-- Current lineup -->
          <template v-if="currentMembers.length">
            <div class="list-group-label">Current lineup</div>
            <div
              v-for="m in currentMembers"
              :key="m.id"
              class="member-item"
              :class="{ 'member-item--open': openId === m.id, 'member-item--dragging': draggedId === m.id }"
              draggable="true"
              @click="selectMember(m)"
              @dragstart="onDragStart($event, m)"
              @dragover="onDragOver($event, m)"
              @drop.prevent="onDrop"
              @dragend="onDragEnd"
            >
              <div class="item-avatar">
                <img v-if="m.photo" :src="m.photo" :alt="`${m.first_name} ${m.last_name}`" class="avatar-img" />
                <div v-else class="avatar-placeholder">{{ m.first_name[0] }}{{ m.last_name[0] }}</div>
              </div>
              <div class="item-info">
                <div class="item-name">{{ m.first_name }} {{ m.last_name }}</div>
                <div v-if="m.role" class="item-role">{{ m.role }}</div>
                <div v-if="m.instruments?.length" class="item-instrs">{{ m.instruments.map(i => i.name).join(', ') }}</div>
              </div>
            </div>
          </template>

          <!-- Former members -->
          <template v-if="exMembers.length">
            <div class="list-group-label list-group-label--dim">Former</div>
            <div
              v-for="m in exMembers"
              :key="m.id"
              class="member-item member-item--former"
              :class="{ 'member-item--open': openId === m.id, 'member-item--dragging': draggedId === m.id }"
              draggable="true"
              @click="selectMember(m)"
              @dragstart="onDragStart($event, m)"
              @dragover="onDragOver($event, m)"
              @drop.prevent="onDrop"
              @dragend="onDragEnd"
            >
              <div class="item-avatar">
                <img v-if="m.photo" :src="m.photo" :alt="`${m.first_name} ${m.last_name}`" class="avatar-img" />
                <div v-else class="avatar-placeholder avatar-placeholder--dim">{{ m.first_name[0] }}{{ m.last_name[0] }}</div>
              </div>
              <div class="item-info">
                <div class="item-name item-name--dim">{{ m.first_name }} {{ m.last_name }}</div>
                <div v-if="m.role" class="item-role item-role--dim">{{ m.role }}</div>
              </div>
            </div>
          </template>

          <div v-if="!currentMembers.length && !exMembers.length" class="sidebar-state">
            No members yet.<br>Click + to add one.
          </div>
        </div>
      </aside>

      <!-- ── Detail pane ─────────────────────────────────────────────────── -->
      <main class="detail-pane">

        <!-- Nothing selected -->
        <div v-if="!openMember" class="empty-state">
          <div class="empty-icon">🎸</div>
          <div class="empty-title">No member selected</div>
          <p class="empty-hint">Select a member from the sidebar, or add a new one.</p>
          <button type="button" class="btn-primary-lg" @click="showCreateModal = true">Add first member</button>
        </div>

        <!-- Member detail -->
        <template v-else>

          <!-- Topbar -->
          <div class="detail-topbar">
            <div class="topbar-member">
              <div class="topbar-avatar">
                <img v-if="openMember.photo" :src="openMember.photo" :alt="`${openMember.first_name} ${openMember.last_name}`" class="topbar-avatar-img" />
                <div v-else class="topbar-avatar-placeholder">{{ openMember.first_name[0] }}{{ openMember.last_name[0] }}</div>
              </div>
              <div>
                <div class="topbar-name">{{ openMember.first_name }} {{ openMember.last_name }}</div>
                <div v-if="openMember.role" class="topbar-role">{{ openMember.role }}</div>
              </div>
            </div>
            <button
              type="button"
              class="btn-delete"
              title="Remove member"
              @click="confirmDeleteId = openMember.id"
            >Remove</button>
          </div>

          <!-- Tab bar -->
          <div class="detail-tabs">
            <button
              type="button"
              class="detail-tab"
              :class="{ active: detailTab === 'profile' }"
              @click="detailTab = 'profile'"
            >👤 Profile</button>
            <button
              type="button"
              class="detail-tab"
              :class="{ active: detailTab === 'setups' }"
              @click="detailTab = 'setups'"
            >🎚️ Stage Setups</button>
            <button
              type="button"
              class="detail-tab"
              :class="{ active: detailTab === 'gear' }"
              @click="detailTab = 'gear'"
            >🎛️ Default Gear</button>
          </div>

          <!-- Tab: Profile -->
          <div v-if="detailTab === 'profile'" class="tab-content">
            <BandMemberForm
              :key="openMember.id"
              :initial="openMember"
              :loading="update.isPending.value"
              :errors="updateErrors"
              :available-instruments="instrumentsQuery.data.value ?? []"
              @submit="handleUpdate"
              @cancel="openId = null"
            />
          </div>

          <!-- Tab: Stage Setups -->
          <div v-if="detailTab === 'setups'" class="tab-content tab-content--setups">
            <MemberSetupsPanel :key="openMember.id" :member="openMember" />
          </div>

          <!-- Tab: Default Gear -->
          <div v-if="detailTab === 'gear'" class="tab-content">
            <MemberDefaultGear :key="openMember.id" :member="openMember" />
          </div>

        </template>
      </main>

    </div>

    <!-- Create modal -->
    <AdminModal
      :open="showCreateModal"
      title="Add member"
      max-width="54rem"
      @close="showCreateModal = false; createErrors = {}"
    >
      <BandMemberForm
        :loading="create.isPending.value"
        :errors="createErrors"
        :available-instruments="instrumentsQuery.data.value ?? []"
        @submit="handleCreate"
        @cancel="showCreateModal = false; createErrors = {}"
      />
    </AdminModal>

    <!-- Delete confirm -->
    <ConfirmDialog
      :open="confirmDeleteId !== null"
      message="This member will be permanently removed from the band."
      :loading="remove.isPending.value"
      @confirm="confirmDelete"
      @cancel="confirmDeleteId = null"
    />
  </AdminLayout>
</template>

<style scoped>
/* ── Shell ────────────────────────────────────────────────────────── */
.members-shell {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ── Member sidebar ───────────────────────────────────────────────── */
.members-sidebar {
  width: 15rem;
  flex-shrink: 0;
  border-right: 1px solid #1a1a1a;
  background: #0a0a0a;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 0.875rem 0.625rem;
  border-bottom: 1px solid #1a1a1a;
  flex-shrink: 0;
}
.sidebar-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.btn-new {
  width: 1.5rem; height: 1.5rem; border-radius: 0.3rem;
  background: #2a2a2a; border: 1px solid #444444; color: #c0c0c0;
  font-size: 0.9rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.btn-new:hover { background: #333333; }

.sidebar-state {
  padding: 1.25rem 0.875rem;
  font-size: 0.78rem; color: #334155; text-align: center; line-height: 1.6;
}
.sidebar-state--err { color: #f87171; }

.member-list { flex: 1; overflow-y: auto; padding: 0.375rem; }

.list-group-label {
  font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: #d0d0d0;
  padding: 0.5rem 0.5rem 0.2rem;
}
.list-group-label--dim { color: #334155; }

.member-item {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.45rem 0.5rem; border-radius: 0.375rem;
  cursor: pointer; border: 1px solid transparent;
  margin-bottom: 0.15rem; transition: background 100ms, border-color 100ms;
}
.member-item:hover        { background: #181818; border-color: #2a2a2a; }
.member-item--open        { background: #141414; border-color: #444444; }
.member-item--former      { opacity: 0.6; }
.member-item--former.member-item--open { opacity: 0.85; }
.member-item--dragging    { opacity: 0.35; border-color: #888888; cursor: grabbing; }
.member-item[draggable]   { cursor: grab; }

.item-avatar { flex-shrink: 0; }
.avatar-img  { width: 2rem; height: 2rem; border-radius: 9999px; object-fit: cover; }
.avatar-placeholder {
  width: 2rem; height: 2rem; border-radius: 9999px;
  background: #2a2a2a; color: #c0c0c0;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.02em;
}
.avatar-placeholder--dim { background: #222222; color: #475569; }

.item-info  { flex: 1; min-width: 0; }
.item-name  { font-size: 0.78rem; font-weight: 600; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-name--dim { color: #94a3b8; }
.item-role  { font-size: 0.65rem; color: #888888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-role--dim { color: #334155; }
.item-instrs { font-size: 0.62rem; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Detail pane ──────────────────────────────────────────────────── */
.detail-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-state {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 0.625rem;
  text-align: center; padding: 2rem;
}
.empty-icon  { font-size: 2.75rem; }
.empty-title { font-size: 0.95rem; font-weight: 700; color: #e2e8f0; }
.empty-hint  { font-size: 0.82rem; color: #475569; max-width: 22rem; }

.btn-primary-lg {
  margin-top: 0.5rem; padding: 0.5rem 1.25rem; border-radius: 0.5rem;
  background: #e8e8e8; border: none; color: #111111;
  font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 150ms;
}
.btn-primary-lg:hover { background: #ffffff; }

/* Topbar */
.detail-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.625rem 1.25rem; border-bottom: 1px solid #1a1a1a;
  background: #0d0d0d; flex-shrink: 0;
}
.topbar-member { display: flex; align-items: center; gap: 0.75rem; }
.topbar-avatar { flex-shrink: 0; }
.topbar-avatar-img {
  width: 2.5rem; height: 2.5rem; border-radius: 9999px; object-fit: cover;
}
.topbar-avatar-placeholder {
  width: 2.5rem; height: 2.5rem; border-radius: 9999px;
  background: #2a2a2a; color: #c0c0c0;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.72rem; font-weight: 700;
}
.topbar-name { font-size: 0.925rem; font-weight: 700; color: #e2e8f0; }
.topbar-role { font-size: 0.75rem; color: #888888; margin-top: 0.1rem; }

.btn-delete {
  padding: 0.3rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; background: transparent; border: 1px solid #450a0a; color: #f87171;
  transition: background 120ms;
}
.btn-delete:hover { background: #7f1d1d22; }

/* Tab bar */
.detail-tabs {
  display: flex; border-bottom: 1px solid #1a1a1a;
  background: #0d0d0d; flex-shrink: 0;
}
.detail-tab {
  display: flex; align-items: center; gap: 0.3rem;
  padding: 0.5rem 1rem; font-size: 0.78rem; font-weight: 500; color: #475569;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; white-space: nowrap; transition: color 120ms, border-color 120ms;
  margin-bottom: -1px;
}
.detail-tab:hover  { color: #64748b; }
.detail-tab.active { color: #d0d0d0; border-bottom-color: #888888; }

/* Tab content */
.tab-content {
  flex: 1; overflow-y: auto; padding: 1.5rem;
}
.tab-content--setups {
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
