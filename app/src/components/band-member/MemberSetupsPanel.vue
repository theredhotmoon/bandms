<script setup lang="ts">
/**
 * A member's library of saved rigs. Riders reference these rather than copying
 * them, so editing one here changes every rider that has not overridden it.
 */
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import RigEditor from '@/components/rig/RigEditor.vue'
import InstrumentIcon from '@/components/ui/InstrumentIcon.vue'
import { useMemberSetups, useMemberSetup } from '@/composables/useBandMemberSetups'
import type { BandMember } from '@/types/bandMember'
import type { Instrument } from '@/types/instrument'
import type { RigField, RigSpec } from '@/types/rig'
import { defaultRigSpec } from '@/types/rig'
import { guessInstrumentType } from '@/utils/instrumentIcons'

interface Props { member: BandMember }
const props = defineProps<Props>()

const memberId = computed(() => props.member.id)
const openId = ref<number | null>(null)

const { list, create, remove, setDefault } = useMemberSetups(memberId)
const { query: setupQ, update: setupMut } = useMemberSetup(memberId, openId)

watch(memberId, () => { openId.value = null })

// ── Draft ─────────────────────────────────────────────────────────────────────

const name = ref('')
const instrumentId = ref<number | null>(null)
const rig = ref<RigSpec>(defaultRigSpec())
const dirty = ref(false)
/** Which setup the draft was loaded from, so a refetch is not mistaken for a switch. */
const loadedId = ref<number | null>(null)

watch(
  () => setupQ.data.value,
  (setup) => {
    if (!setup) return
    // Same guard as the rider editor: a background refetch (staleTime 0 +
    // refetchOnWindowFocus) must not overwrite unsaved edits to the rig the
    // user is already in. Opening a different setup still loads.
    if (dirty.value && setup.id === loadedId.value) return
    name.value = setup.name
    instrumentId.value = setup.instrument_id
    rig.value = {
      signal_chain_type: setup.signal_chain_type,
      inputs: setup.inputs ?? [],
      monitors: setup.monitors ?? [],
      backline: setup.backline ?? [],
      power: setup.power ?? defaultRigSpec().power,
      wireless: setup.wireless ?? [],
      foh_notes: setup.foh_notes ?? '',
    }
    loadedId.value = setup.id
    dirty.value = false
  },
  { immediate: true },
)

function onRigChange(field: RigField, value: unknown) {
  rig.value = { ...rig.value, [field]: value } as RigSpec
  dirty.value = true
}

const selectedInstrument = computed<Instrument | null>(
  () => props.member.instruments?.find((i) => i.id === instrumentId.value) ?? null,
)
const memberFullName = computed(() => `${props.member.first_name} ${props.member.last_name}`)

// ── Save ──────────────────────────────────────────────────────────────────────

const saving = ref(false)
const saved = ref(false)

async function save() {
  if (openId.value === null) return
  saving.value = true
  try {
    await setupMut.mutateAsync({
      name: name.value,
      instrument_id: instrumentId.value,
      ...rig.value,
    })
    dirty.value = false
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
    toast.success('Setup saved')
  } catch {
    toast.error('Failed to save setup')
  } finally {
    saving.value = false
  }
}

// ── Create / delete ───────────────────────────────────────────────────────────

const newName = ref('')
const showNewRow = ref(false)
const creating = ref(false)

async function createSetup() {
  if (!newName.value.trim()) return
  creating.value = true
  try {
    const setup = await create.mutateAsync({ name: newName.value.trim(), ...defaultRigSpec() })
    openId.value = setup.id
    newName.value = ''
    showNewRow.value = false
    toast.success('Setup created')
  } catch {
    toast.error('Failed to create setup')
  } finally {
    creating.value = false
  }
}

async function removeSetup(id: number) {
  try {
    await remove.mutateAsync(id)
    if (openId.value === id) openId.value = null
    toast.success('Setup deleted')
  } catch {
    toast.error('Failed to delete setup')
  }
}

async function makeDefault(id: number) {
  try {
    await setDefault.mutateAsync(id)
    toast.success('Default setup updated')
  } catch {
    toast.error('Failed to update default')
  }
}

function openSetup(id: number) {
  if (dirty.value && !confirm('Discard unsaved changes to this setup?')) return
  openId.value = id
}

function instrumentIconType(inst: Instrument | null) {
  if (!inst) return null
  return inst.stage_plot_type ?? guessInstrumentType(inst.name)
}
</script>

<template>
  <div class="setups-shell">

    <!-- Setup list -->
    <aside class="setups-list">
      <div class="list-header">
        <span class="list-title">Saved rigs</span>
        <button type="button" class="btn-new" title="New setup" @click="showNewRow = true">+</button>
      </div>

      <div v-if="showNewRow" class="new-row">
        <input
          v-model="newName"
          class="new-input"
          placeholder="e.g. Festival rig"
          @keyup.enter="createSetup"
          @keyup.esc="showNewRow = false"
        />
        <button type="button" class="btn-mini" :disabled="!newName.trim() || creating" @click="createSetup">
          {{ creating ? '…' : 'Add' }}
        </button>
      </div>

      <div v-if="list.isPending.value" class="list-state">Loading…</div>
      <div v-else-if="!(list.data.value ?? []).length" class="list-state">
        No saved rigs yet.
      </div>

      <button
        v-for="s in (list.data.value ?? [])"
        :key="s.id"
        type="button"
        class="setup-item"
        :class="{ 'setup-item--open': openId === s.id }"
        @click="openSetup(s.id)"
      >
        <div class="setup-item-main">
          <span class="setup-name">{{ s.name }}</span>
          <span class="setup-meta">
            {{ s.input_count }} ch · {{ s.monitor_count }} mon
            <span v-if="s.instrument_name"> · {{ s.instrument_name }}</span>
          </span>
        </div>
        <span v-if="s.is_default" class="badge-default">Default</span>
        <span v-else class="item-actions">
          <span class="mini-action" title="Make default" @click.stop="makeDefault(s.id)">★</span>
          <span class="mini-action mini-action--del" title="Delete" @click.stop="removeSetup(s.id)">✕</span>
        </span>
      </button>
    </aside>

    <!-- Editor -->
    <section class="setup-editor">
      <div v-if="openId === null" class="editor-empty">
        Select a saved rig, or create one.
      </div>
      <div v-else-if="setupQ.isPending.value" class="editor-empty">Loading…</div>

      <template v-else>
        <div class="editor-meta">
          <div class="field-group">
            <label class="field-label">Setup name</label>
            <input
              v-model="name"
              class="meta-input"
              placeholder="e.g. Festival rig"
              @input="dirty = true"
            />
          </div>
          <div class="field-group">
            <label class="field-label">Instrument (optional)</label>
            <select
              :value="instrumentId ?? ''"
              class="meta-input"
              @change="instrumentId = Number(($event.target as HTMLSelectElement).value) || null; dirty = true"
            >
              <option value="">— Any / not specified —</option>
              <option v-for="inst in member.instruments" :key="inst.id" :value="inst.id">
                {{ inst.name }}
              </option>
            </select>
          </div>
          <div v-if="selectedInstrument" class="instrument-tag">
            <InstrumentIcon :type="instrumentIconType(selectedInstrument)" :size="16" />
            <span>{{ selectedInstrument.name }}</span>
          </div>
        </div>

        <RigEditor
          :model-value="rig"
          mode="library"
          :instrument="selectedInstrument"
          :member-name="memberFullName"
          @change="onRigChange"
        />

        <div class="editor-footer">
          <span v-if="dirty" class="dirty-hint">Unsaved changes</span>
          <button
            type="button"
            class="btn-save"
            :class="{ 'btn-save--ok': saved }"
            :disabled="saving"
            @click="save"
          >
            {{ saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save setup' }}
          </button>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.setups-shell { display: flex; gap: 1rem; flex: 1; min-height: 0; }

/* List */
.setups-list {
  width: 15rem; flex-shrink: 0; display: flex; flex-direction: column; gap: 0.25rem;
  border-right: 1px solid #1a1a1a; padding-right: 0.75rem; overflow-y: auto;
}
.list-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 0.375rem; }
.list-title { font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .05em; }
.btn-new {
  width: 1.5rem; height: 1.5rem; border-radius: 0.3rem; background: #1a1a1a;
  border: 1px solid #2a2a2a; color: #c0c0c0; cursor: pointer; font-size: 0.9rem;
  display: flex; align-items: center; justify-content: center;
}
.btn-new:hover { background: #222222; }

.new-row { display: flex; gap: 0.25rem; margin-bottom: 0.25rem; }
.new-input {
  flex: 1; min-width: 0; padding: 0.3rem 0.5rem; border-radius: 0.3rem;
  border: 1px solid #2a2a2a; background: #0d0d0d; color: #e2e8f0; font-size: 0.75rem;
  outline: none; font-family: inherit;
}
.new-input:focus { border-color: #5154e5; }
.btn-mini {
  padding: 0.3rem 0.5rem; border-radius: 0.3rem; font-size: 0.7rem; font-weight: 600;
  background: #e8e8e8; border: none; color: #111111; cursor: pointer;
}
.btn-mini:disabled { opacity: 0.4; cursor: default; }

.list-state { padding: 1rem 0.25rem; font-size: 0.75rem; color: #334155; }

.setup-item {
  display: flex; align-items: center; gap: 0.4rem; width: 100%; text-align: left;
  padding: 0.45rem 0.55rem; border-radius: 0.375rem; cursor: pointer;
  background: transparent; border: 1px solid transparent; color: inherit;
  transition: background 100ms, border-color 100ms;
}
.setup-item:hover { background: #141414; border-color: #222222; }
.setup-item--open { background: #141414; border-color: #444444; }
.setup-item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.setup-name { font-size: 0.78rem; font-weight: 600; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.setup-meta { font-size: 0.65rem; color: #475569; }
.badge-default {
  font-size: 0.58rem; font-weight: 700; color: #4ade80; background: #052e16;
  padding: 0.1rem 0.35rem; border-radius: 999px; text-transform: uppercase; flex-shrink: 0;
}
.item-actions { display: flex; gap: 0.15rem; flex-shrink: 0; }
.mini-action { color: #334155; font-size: 0.7rem; padding: 0.1rem 0.25rem; border-radius: 3px; }
.mini-action:hover { color: #c0c0c0; background: #222222; }
.mini-action--del:hover { color: #f87171; background: #2a1010; }

/* Editor */
.setup-editor { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.editor-empty { padding: 2rem; color: #334155; font-size: 0.85rem; text-align: center; }

.editor-meta { display: flex; gap: 0.75rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 0.75rem; }
.field-group { display: flex; flex-direction: column; gap: 0.25rem; }
.field-label { font-size: 0.68rem; font-weight: 600; color: #7c8fa6; }
.meta-input {
  padding: 0.35rem 0.55rem; border-radius: 0.35rem; border: 1px solid #2a2a2a;
  background: #0d0d0d; color: #e2e8f0; font-size: 0.78rem; outline: none;
  font-family: inherit; min-width: 12rem;
}
.meta-input:focus { border-color: #5154e5; }
.meta-input option { background: #141414; }
.instrument-tag {
  display: flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; color: #94a3b8;
  padding: 0.3rem 0.55rem; background: #141414; border: 1px solid #2a2a2a; border-radius: 0.35rem;
}

.editor-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem;
  padding-top: 0.75rem; border-top: 1px solid #1a1a1a; flex-shrink: 0;
}
.dirty-hint { font-size: 0.7rem; color: #fbbf24; }
.btn-save {
  padding: 0.4rem 1.1rem; border-radius: 0.4rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111; min-width: 7rem;
}
.btn-save:disabled { opacity: 0.55; cursor: default; }
.btn-save--ok { background: #166534 !important; color: #dcfce7; }
</style>
