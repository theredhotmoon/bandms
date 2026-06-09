<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { toast } from 'vue-sonner'
import MemberSetupEditorPane from './MemberSetupEditorPane.vue'
import type { SetupEditorModel } from './MemberSetupEditorPane.vue'
import { useMemberSetups, useMemberSetup } from '@/composables/useBandMemberSetups'
import type { BandMember } from '@/types/bandMember'
import {
  defaultMonitorPrefs,
  defaultBacklinePrefs,
  defaultPowerPrefs,
} from '@/types/bandMemberSetup'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props { member: BandMember }
const props = defineProps<Props>()

// ── Setup list ────────────────────────────────────────────────────────────────

const memberId = computed(() => props.member.id)
const openId   = ref<number | null>(null)

const { list, create, remove, setDefault } = useMemberSetups(
  computed(() => memberId.value ?? null),
)

// Reset open setup when member changes
watch(memberId, () => { openId.value = null })

// ── Open setup editor ─────────────────────────────────────────────────────────

const { query: setupQ, update: setupMut } = useMemberSetup(memberId, openId)

// ── Local form state ──────────────────────────────────────────────────────────

const form = reactive<SetupEditorModel>({
  name:               '',
  instrument_id:      null,
  signal_chain_type:  'other',
  inputs:             [],
  monitor:            defaultMonitorPrefs(),
  backline:           defaultBacklinePrefs(),
  power:              defaultPowerPrefs(),
  wireless:           [],
  foh_notes:          '',
  shared_monitor_id:  null as number | null,
})

watch(
  () => setupQ.data.value,
  (s) => {
    if (!s) return
    form.name              = s.name
    form.instrument_id     = s.instrument_id
    form.signal_chain_type = s.signal_chain_type
    form.inputs            = s.inputs ?? []
    form.monitor           = { ...defaultMonitorPrefs(), ...s.monitor }
    form.backline          = { ...defaultBacklinePrefs(), ...s.backline }
    form.power             = { ...defaultPowerPrefs(), ...s.power }
    form.wireless          = s.wireless ?? []
    form.foh_notes         = s.foh_notes ?? ''
    form.shared_monitor_id = s.shared_monitor_id ?? null
  },
  { immediate: true },
)

// ── Save ──────────────────────────────────────────────────────────────────────

const saving = ref(false)
const saved  = ref(false)

async function saveSetup() {
  if (openId.value === null) return
  saving.value = true
  try {
    await setupMut.mutateAsync({ ...form })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
    toast.success('Setup saved')
  } catch {
    toast.error('Failed to save setup')
  } finally {
    saving.value = false
  }
}

// ── New setup ─────────────────────────────────────────────────────────────────

const newName    = ref('')
const creating   = ref(false)
const showNewRow = ref(false)

async function createSetup() {
  if (!newName.value.trim()) return
  creating.value = true
  try {
    const setup = await create.mutateAsync({
      name:              newName.value.trim(),
      signal_chain_type: 'other',
      inputs:            [],
      monitor:           defaultMonitorPrefs(),
      backline:          defaultBacklinePrefs(),
      power:             defaultPowerPrefs(),
      wireless:          [],
      foh_notes:         '',
      shared_monitor_id: null,
    })
    openId.value    = setup.id
    showNewRow.value = false
    newName.value   = ''
    toast.success('Setup created')
  } catch {
    toast.error('Failed to create setup')
  } finally {
    creating.value = false
  }
}

// ── Other setups (for MemberSetupEditorPane) ──────────────────────────────

const otherSetups = computed(() =>
  (list.data.value ?? []).filter(s => s.id !== openId.value)
)

// ── Delete ────────────────────────────────────────────────────────────────────

const confirmDeleteId = ref<number | null>(null)

async function confirmDelete() {
  if (!confirmDeleteId.value) return
  try {
    await remove.mutateAsync(confirmDeleteId.value)
    if (openId.value === confirmDeleteId.value) openId.value = null
    confirmDeleteId.value = null
    toast.success('Setup deleted')
  } catch {
    toast.error('Failed to delete')
  }
}

</script>

<template>
  <div class="setups-shell">

    <!-- ── Setup sidebar ─────────────────────────────────────────────────── -->
    <aside class="setups-sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">Stage setups</span>
        <button type="button" class="btn-new" title="New setup" @click="showNewRow = !showNewRow">+</button>
      </div>

      <!-- New setup inline row -->
      <div v-if="showNewRow" class="new-setup-row">
        <input
          v-model="newName"
          class="new-setup-input"
          placeholder="Setup name…"
          autofocus
          @keydown.enter="createSetup"
          @keydown.escape="showNewRow = false; newName = ''"
        />
        <button type="button" class="btn-create" :disabled="!newName.trim() || creating" @click="createSetup">
          {{ creating ? '…' : 'Create' }}
        </button>
      </div>

      <div v-if="list.isPending.value" class="sidebar-state">Loading…</div>
      <div v-else-if="list.isError.value" class="sidebar-state sidebar-state--err">Failed to load</div>
      <div v-else-if="!list.data.value?.length" class="sidebar-state">
        No setups yet. Click + to create one.
      </div>
      <div v-else class="setup-list">
        <div
          v-for="s in list.data.value"
          :key="s.id"
          class="setup-item"
          :class="{ 'setup-item--open': openId === s.id }"
          @click="openId = s.id"
        >
          <div class="setup-item-info">
            <div class="setup-name-row">
              <span class="setup-name">{{ s.name }}</span>
              <span v-if="s.is_default" class="default-star" title="Default setup">★</span>
            </div>
            <span v-if="s.instrument_name" class="setup-instrument">{{ s.instrument_name }}</span>
            <span class="setup-meta">{{ s.input_count }} ch</span>
          </div>
          <div class="item-actions">
            <button
              v-if="!s.is_default"
              type="button"
              class="default-btn"
              title="Set as default"
              @click.stop="setDefault.mutate(s.id)"
            >★</button>
            <button
              type="button"
              class="del-btn"
              title="Delete"
              @click.stop="confirmDeleteId = s.id"
            >✕</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- ── Editor pane ─────────────────────────────────────────────────────── -->
    <div class="editor-pane">

      <!-- Nothing selected -->
      <div v-if="openId === null" class="empty-state">
        <div class="empty-icon">🎚️</div>
        <div class="empty-title">No setup selected</div>
        <p class="empty-hint">Pick a setup from the list, or create a new one.</p>
      </div>

      <!-- Loading -->
      <div v-else-if="setupQ.isPending.value" class="loading-state">Loading…</div>

      <!-- Editor -->
      <template v-else-if="setupQ.data.value">

        <!-- Top bar -->
        <div class="editor-topbar">
          <div class="topbar-name">{{ form.name }}</div>
          <button
            type="button"
            class="btn-save"
            :class="{ 'btn-save--ok': saved }"
            :disabled="saving"
            @click="saveSetup"
          >{{ saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save setup' }}</button>
        </div>

        <MemberSetupEditorPane
          :model-value="{ ...form }"
          :member="member"
          :saving="saving"
          :saved="saved"
          :fill-height="true"
          :other-setups="otherSetups"
          @update:model-value="Object.assign(form, $event)"
          @save="saveSetup"
        />

      </template>
    </div><!-- /editor-pane -->

    <!-- Confirm delete -->
    <div v-if="confirmDeleteId !== null" class="confirm-overlay" @click.self="confirmDeleteId = null">
      <div class="confirm-card">
        <div class="confirm-title">Delete setup?</div>
        <p class="confirm-text">This will permanently delete this setup. Cannot be undone.</p>
        <div class="confirm-actions">
          <button type="button" class="btn-ghost" @click="confirmDeleteId = null">Cancel</button>
          <button type="button" class="btn-danger" @click="confirmDelete">Delete</button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* ── Shell ───────────────────────────────────────────────────────── */
.setups-shell {
  display: flex; height: 100%; overflow: hidden; position: relative;
}

/* ── Setup sidebar ───────────────────────────────────────────────── */
.setups-sidebar {
  width: 14rem; flex-shrink: 0;
  border-right: 1px solid #0f0f28; background: #060614;
  display: flex; flex-direction: column; overflow: hidden;
}
.sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 0.875rem 0.5rem;
  border-bottom: 1px solid #0f0f28;
}
.sidebar-title { font-size: 0.7rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .06em; }
.btn-new {
  width: 1.5rem; height: 1.5rem; border-radius: 0.3rem;
  background: #2a2a2a; border: 1px solid #444444; color: #c0c0c0;
  font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.btn-new:hover { background: #333333; }

.new-setup-row {
  display: flex; gap: 0.3rem; padding: 0.4rem 0.5rem;
  border-bottom: 1px solid #0f0f28;
}
.new-setup-input {
  flex: 1; background: #111111; border: 1px solid #2a2a2a; border-radius: 0.3rem;
  color: #e2e8f0; font-size: 0.75rem; padding: 0.3rem 0.5rem; outline: none;
  font-family: inherit;
}
.new-setup-input:focus { border-color: #888888; }
.btn-create {
  padding: 0.25rem 0.5rem; border-radius: 0.3rem; font-size: 0.72rem; font-weight: 600;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111;
  transition: background 100ms;
}
.btn-create:hover:not(:disabled) { background: #333333; }
.btn-create:disabled { opacity: 0.4; cursor: default; }

.sidebar-state {
  padding: 1rem 0.875rem; font-size: 0.78rem; color: #334155; text-align: center; line-height: 1.6;
}
.sidebar-state--err { color: #f87171; }

.setup-list { flex: 1; overflow-y: auto; padding: 0.4rem; }
.setup-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.45rem 0.6rem; border-radius: 0.35rem; cursor: pointer;
  border: 1px solid transparent; margin-bottom: 0.2rem;
  transition: background 100ms, border-color 100ms;
}
.setup-item:hover  { background: #0d0d28; border-color: #2a2a2a; }
.setup-item--open  { background: #141414; border-color: #444444; }
.setup-item-info   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.setup-name        { font-size: 0.78rem; font-weight: 600; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.setup-instrument  { font-size: 0.62rem; color: #888888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.setup-meta        { font-size: 0.62rem; color: #334155; }

.setup-name-row { display: flex; align-items: center; gap: 0.25rem; }
.default-star { color: #f59e0b; font-size: 0.65rem; flex-shrink: 0; }

.item-actions { display: flex; align-items: center; gap: 0.1rem; flex-shrink: 0; }

.default-btn {
  background: none; border: none; cursor: pointer; color: #334155; font-size: 0.65rem;
  padding: 0.15rem 0.3rem; transition: color 100ms;
}
.default-btn:hover { color: #f59e0b; }

.del-btn {
  background: none; border: none; cursor: pointer; color: #2a2a2a; font-size: 0.65rem;
  padding: 0.15rem 0.3rem; transition: color 100ms;
}
.del-btn:hover { color: #f87171; }

/* ── Editor pane ─────────────────────────────────────────────────── */
.editor-pane {
  flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;
}

.empty-state, .loading-state {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 0.5rem;
  text-align: center; padding: 2rem;
}
.empty-icon  { font-size: 2.5rem; }
.empty-title { font-size: 0.9rem; font-weight: 700; color: #e2e8f0; }
.empty-hint  { font-size: 0.8rem; color: #475569; max-width: 22rem; }
.loading-state { color: #475569; font-size: 0.85rem; }

.editor-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.625rem 1rem; border-bottom: 1px solid #0f0f28;
  background: #0d0d0d; flex-shrink: 0;
}
.topbar-name { font-size: 0.875rem; font-weight: 700; color: #e2e8f0; }

.btn-save {
  padding: 0.4rem 1.1rem; border-radius: 0.45rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111;
  transition: background 150ms; min-width: 7rem;
}
.btn-save:hover:not(:disabled) { background: #333333; }
.btn-save:disabled { opacity: 0.55; cursor: default; }
.btn-save--ok { background: #166534 !important; }

/* Confirm delete overlay */
.confirm-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.55); z-index: 50;
  display: flex; align-items: center; justify-content: center;
}
.confirm-card {
  background: #141414; border: 1px solid #2a2a2a; border-radius: 0.75rem;
  padding: 1.25rem; width: 22rem; display: flex; flex-direction: column; gap: 0.75rem;
}
.confirm-title  { font-size: 0.9rem; font-weight: 700; color: #e2e8f0; }
.confirm-text   { font-size: 0.8rem; color: #94a3b8; line-height: 1.5; }
.confirm-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
.btn-ghost {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #2a2a2a; color: #64748b;
}
.btn-ghost:hover { background: #111111; }
.btn-danger {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: #7f1d1d; border: 1px solid #991b1b; color: #fca5a5;
}
.btn-danger:hover { background: #450a0a; }
</style>
