<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { toast } from 'vue-sonner'
import MemberSetupSignalChain from './MemberSetupSignalChain.vue'
import MemberSetupMonitor     from './MemberSetupMonitor.vue'
import MemberSetupBackline    from './MemberSetupBackline.vue'
import MemberSetupPower       from './MemberSetupPower.vue'
import { useMemberSetups, useMemberSetup } from '@/composables/useBandMemberSetups'
import type { BandMember } from '@/types/bandMember'
import type {
  BandMemberSetupPayload,
  SignalChainType,
} from '@/types/bandMemberSetup'
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

const { list, create, remove } = useMemberSetups(
  computed(() => memberId.value ?? null),
)

// Reset open setup when member changes
watch(memberId, () => { openId.value = null })

// ── Open setup editor ─────────────────────────────────────────────────────────

const { query: setupQ, update: setupMut } = useMemberSetup(memberId, openId)

type SetupSection = 'inputs' | 'monitor' | 'backline' | 'power' | 'foh'
const activeSection = ref<SetupSection>('inputs')

const SECTIONS: { key: SetupSection; label: string; icon: string }[] = [
  { key: 'inputs',  label: 'Signal chain / Inputs', icon: '🎙️' },
  { key: 'monitor', label: 'Monitor',               icon: '🔊' },
  { key: 'backline',label: 'Backline',               icon: '🥁' },
  { key: 'power',   label: 'Power',                 icon: '⚡' },
  { key: 'foh',     label: 'FOH notes',             icon: '🎛️' },
]

// ── Local form state ──────────────────────────────────────────────────────────

const form = reactive<Required<BandMemberSetupPayload>>({
  name:               '',
  instrument_id:      null,
  signal_chain_type:  'other' as SignalChainType,
  inputs:             [],
  monitor:            defaultMonitorPrefs(),
  backline:           defaultBacklinePrefs(),
  power:              defaultPowerPrefs(),
  foh_notes:          '',
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
    form.foh_notes         = s.foh_notes ?? ''
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
      foh_notes:         '',
    })
    openId.value    = setup.id
    showNewRow.value = false
    newName.value   = ''
    activeSection.value = 'inputs'
    toast.success('Setup created')
  } catch {
    toast.error('Failed to create setup')
  } finally {
    creating.value = false
  }
}

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

// ── Resolved instrument for the signal chain component ────────────────────────

const selectedInstrument = computed(() =>
  props.member.instruments.find((i) => i.id === form.instrument_id) ?? null,
)

const memberFullName = computed(() =>
  `${props.member.first_name} ${props.member.last_name}`,
)
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
          @click="openId = s.id; activeSection = 'inputs'"
        >
          <div class="setup-item-info">
            <span class="setup-name">{{ s.name }}</span>
            <span class="setup-meta">{{ s.input_count }} ch</span>
          </div>
          <button
            type="button"
            class="del-btn"
            title="Delete"
            @click.stop="confirmDeleteId = s.id"
          >✕</button>
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

        <!-- Setup meta -->
        <div class="setup-meta-bar">
          <div class="field-group">
            <label class="field-label">Setup name</label>
            <input v-model="form.name" class="field-input field-input--sm" placeholder="e.g. Festival rig" />
          </div>
          <div class="field-group">
            <label class="field-label">Instrument (optional)</label>
            <select v-model="form.instrument_id" class="field-input field-input--sm">
              <option :value="null">— Any / not specified —</option>
              <option v-for="inst in member.instruments" :key="inst.id" :value="inst.id">
                {{ inst.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Section tabs -->
        <div class="section-tabs">
          <button
            v-for="s in SECTIONS"
            :key="s.key"
            type="button"
            class="section-tab"
            :class="{ active: activeSection === s.key }"
            @click="activeSection = s.key"
          >
            <span class="tab-icon">{{ s.icon }}</span>{{ s.label }}
          </button>
        </div>

        <!-- Section content -->
        <div class="section-content">

          <template v-if="activeSection === 'inputs'">
            <MemberSetupSignalChain
              v-model="form.inputs"
              v-model:chain-type="form.signal_chain_type"
              :instrument="selectedInstrument"
              :member-name="memberFullName"
            />
          </template>

          <template v-if="activeSection === 'monitor'">
            <MemberSetupMonitor v-model="form.monitor" />
          </template>

          <template v-if="activeSection === 'backline'">
            <MemberSetupBackline v-model="form.backline" />
          </template>

          <template v-if="activeSection === 'power'">
            <MemberSetupPower v-model="form.power" />
          </template>

          <template v-if="activeSection === 'foh'">
            <div class="foh-section">
              <label class="field-label">FOH / PA notes</label>
              <textarea
                v-model="form.foh_notes"
                class="foh-textarea"
                rows="6"
                placeholder="Any specific requests for the front-of-house mix — EQ preferences, effects, compression notes, etc."
              />
            </div>
          </template>

        </div><!-- /section-content -->

        <!-- Bottom save bar -->
        <div class="bottom-bar">
          <button
            type="button"
            class="btn-save"
            :class="{ 'btn-save--ok': saved }"
            :disabled="saving"
            @click="saveSetup"
          >{{ saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save setup' }}</button>
        </div>

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
  background: #1e1b4b; border: 1px solid #312e81; color: #818cf8;
  font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.btn-new:hover { background: #252370; }

.new-setup-row {
  display: flex; gap: 0.3rem; padding: 0.4rem 0.5rem;
  border-bottom: 1px solid #0f0f28;
}
.new-setup-input {
  flex: 1; background: #0a0a1e; border: 1px solid #1e2040; border-radius: 0.3rem;
  color: #e2e8f0; font-size: 0.75rem; padding: 0.3rem 0.5rem; outline: none;
  font-family: inherit;
}
.new-setup-input:focus { border-color: #4338ca; }
.btn-create {
  padding: 0.25rem 0.5rem; border-radius: 0.3rem; font-size: 0.72rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
  transition: background 100ms;
}
.btn-create:hover:not(:disabled) { background: #4f46e5; }
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
.setup-item:hover  { background: #0d0d28; border-color: #1e2040; }
.setup-item--open  { background: #0e0e26; border-color: #312e81; }
.setup-item-info   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.setup-name        { font-size: 0.78rem; font-weight: 600; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.setup-meta        { font-size: 0.62rem; color: #334155; }

.del-btn {
  background: none; border: none; cursor: pointer; color: #1e2040; font-size: 0.65rem;
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
  background: #070718; flex-shrink: 0;
}
.topbar-name { font-size: 0.875rem; font-weight: 700; color: #e2e8f0; }

.setup-meta-bar {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;
  padding: 0.75rem 1rem; border-bottom: 1px solid #0f0f28;
  background: #070718; flex-shrink: 0;
}
.field-group  { display: flex; flex-direction: column; gap: 0.2rem; }
.field-label  { font-size: 0.68rem; font-weight: 600; color: #7c8fa6; }
.field-input {
  display: block; width: 100%; padding: 0.4rem 0.6rem; border-radius: 0.4rem;
  border: 1px solid #1e2040; background: #070718; color: #e2e8f0;
  font-size: 0.8rem; outline: none; font-family: inherit; transition: border-color 150ms;
}
.field-input:focus { border-color: #5154e5; }
.field-input--sm { padding: 0.3rem 0.5rem; font-size: 0.75rem; }
.field-input option { background: #0e0e26; }

.section-tabs {
  display: flex; overflow-x: auto; border-bottom: 1px solid #0f0f28;
  background: #070718; flex-shrink: 0; scrollbar-width: none;
}
.section-tabs::-webkit-scrollbar { display: none; }
.section-tab {
  display: flex; align-items: center; gap: 0.3rem;
  padding: 0.45rem 0.75rem; font-size: 0.72rem; font-weight: 500; color: #475569;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; white-space: nowrap; transition: color 120ms, border-color 120ms;
  margin-bottom: -1px;
}
.section-tab:hover  { color: #64748b; }
.section-tab.active { color: #a5b4fc; border-bottom-color: #6366f1; }
.tab-icon { font-size: 0.8rem; }

.section-content {
  flex: 1; overflow-y: auto; padding: 1rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}

.bottom-bar {
  border-top: 1px solid #0f0f28; padding: 0.625rem 1rem;
  display: flex; justify-content: flex-end; background: #070718; flex-shrink: 0;
}

.btn-save {
  padding: 0.4rem 1.1rem; border-radius: 0.45rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
  transition: background 150ms; min-width: 7rem;
}
.btn-save:hover:not(:disabled) { background: #4f46e5; }
.btn-save:disabled { opacity: 0.55; cursor: default; }
.btn-save--ok { background: #166534 !important; }

/* FOH textarea */
.foh-section  { display: flex; flex-direction: column; gap: 0.35rem; }
.foh-textarea {
  width: 100%; padding: 0.625rem 0.75rem; border-radius: 0.5rem;
  border: 1px solid #1e2040; background: #0e0e26; color: #e2e8f0;
  font-size: 0.85rem; font-family: inherit; outline: none; resize: vertical;
  transition: border-color 150ms;
}
.foh-textarea:focus  { border-color: #5154e5; }
.foh-textarea::placeholder { color: #2a3050; }

/* Confirm delete overlay */
.confirm-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.55); z-index: 50;
  display: flex; align-items: center; justify-content: center;
}
.confirm-card {
  background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.75rem;
  padding: 1.25rem; width: 22rem; display: flex; flex-direction: column; gap: 0.75rem;
}
.confirm-title  { font-size: 0.9rem; font-weight: 700; color: #e2e8f0; }
.confirm-text   { font-size: 0.8rem; color: #94a3b8; line-height: 1.5; }
.confirm-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
.btn-ghost {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #1e2040; color: #64748b;
}
.btn-ghost:hover { background: #0a0a1e; }
.btn-danger {
  padding: 0.35rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; background: #7f1d1d; border: 1px solid #991b1b; color: #fca5a5;
}
.btn-danger:hover { background: #450a0a; }
</style>
