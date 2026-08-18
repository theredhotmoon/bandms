<script setup lang="ts">
/**
 * Editing one musician's position on the rider.
 *
 * The placement points at a saved rig and stores only what this gig changes.
 * Both destinations are offered explicitly — "this gig only" is the default
 * (writing an override), and promoting the changes into the member's library
 * is a deliberate button. The previous editor guessed, and silently rewrote
 * people's saved rigs.
 */
import { computed, ref } from 'vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import RigEditor from '@/components/rig/RigEditor.vue'
import InstrumentIcon from '@/components/ui/InstrumentIcon.vue'
import InstrumentIconPicker from '@/components/ui/InstrumentIconPicker.vue'
import type { BandMember } from '@/types/bandMember'
import type { BandMemberSetup, SetupLookup } from '@/types/bandMemberSetup'
import type { Instrument } from '@/types/instrument'
import type { StagePlotItemType } from '@/types/instrumentType'
import type { RigField } from '@/types/rig'
import type { GigTempMusician, PlacedInstrument, StagePlacement } from '@/types/stagePlot'
import { defaultPlacedInstrument, INSTRUMENT_TYPE_LABELS } from '@/types/stagePlot'
import { guessInstrumentType } from '@/utils/instrumentIcons'
import { overriddenFields, resolveRig } from '@/utils/riderResolver'

interface Props {
  open: boolean
  placement: StagePlacement | null
  member: BandMember | null
  tempMusician: GigTempMusician | null
  /** The member's own saved rigs, for the picker. */
  memberSetups: BandMemberSetup[]
  /** All setups, for resolving whichever one is referenced. */
  setups: SetupLookup
  promoting?: boolean
}
const props = withDefaults(defineProps<Props>(), { promoting: false })

const emit = defineEmits<{
  'update:placement': [value: StagePlacement]
  /** Push the current overrides into the linked saved rig. */
  promote: [placement: StagePlacement]
  close: []
}>()

const displayName = computed(() => {
  if (props.tempMusician) return `${props.tempMusician.name} (guest)`
  if (props.member) return props.member.nickname ?? `${props.member.first_name} ${props.member.last_name}`
  return 'Musician'
})

const linkedSetup = computed<BandMemberSetup | null>(() => {
  const id = props.placement?.setup_id
  return id != null ? props.setups[id] ?? null : null
})

const rig = computed(() =>
  props.placement ? resolveRig(props.placement, props.setups) : null,
)

const overridden = computed<RigField[]>(() =>
  props.placement ? overriddenFields(props.placement) : [],
)

const selectedInstrument = computed<Instrument | null>(() => {
  const id = linkedSetup.value?.instrument_id
  if (id == null || !props.member) return null
  return props.member.instruments?.find((i) => i.id === id) ?? null
})

function patch(changes: Partial<StagePlacement>) {
  if (!props.placement) return
  emit('update:placement', { ...props.placement, ...changes })
}

// ── Rig edits land in the override patch ──────────────────────────────────────

function onChange(field: RigField, value: unknown) {
  if (!props.placement) return
  patch({ overrides: { ...props.placement.overrides, [field]: value } })
}

function onReset(fields: RigField[]) {
  if (!props.placement) return
  const next = { ...props.placement.overrides }
  for (const field of fields) delete next[field]
  patch({ overrides: next })
}

function clearAllOverrides() {
  patch({ overrides: {} })
}

// ── Which saved rig is being played ───────────────────────────────────────────

function selectSetup(event: Event) {
  const el = event.target as HTMLSelectElement
  const id = el.value === '' ? null : Number(el.value)
  if (!props.placement) return
  if (overridden.value.length && !confirm("Switching rigs discards this gig's changes. Continue?")) {
    // Cancelling changes nothing reactive, so Vue never re-renders the select
    // and it would keep showing the rig that was *not* chosen.
    el.value = String(props.placement.setup_id ?? '')
    return
  }
  patch({ setup_id: id, overrides: {} })
}

// Success/failure is reported by the caller, which owns the request.
function promote() {
  if (!props.placement || !linkedSetup.value) return
  emit('promote', props.placement)
}

// ── Instruments ───────────────────────────────────────────────────────────────

const pickerFor = ref<string | null>(null)

function addInstrument() {
  if (!props.placement) return
  patch({ instruments: [...props.placement.instruments, defaultPlacedInstrument()] })
}

function addProfileInstrument(inst: Instrument) {
  if (!props.placement) return
  const placed = defaultPlacedInstrument()
  placed.label = inst.name
  placed.type = inst.stage_plot_type ?? guessInstrumentType(inst.name) ?? 'custom'
  patch({ instruments: [...props.placement.instruments, placed] })
}

function patchInstrument(id: string, changes: Partial<PlacedInstrument>) {
  if (!props.placement) return
  patch({
    instruments: props.placement.instruments.map((i) => (i.id === id ? { ...i, ...changes } : i)),
  })
}

function removeInstrument(id: string) {
  if (!props.placement) return
  patch({ instruments: props.placement.instruments.filter((i) => i.id !== id) })
}

// The picker can emit null when a selection is cleared; a slot always needs a
// type, so fall back to the generic icon rather than leaving it unset.
function pickType(id: string, type: StagePlotItemType | null) {
  patchInstrument(id, { type: type ?? 'custom' })
  pickerFor.value = null
}
</script>

<template>
  <AdminModal
    :open="open"
    :title="`${displayName} — stage position`"
    max-width="52rem"
    @close="emit('close')"
  >
    <div v-if="placement && rig" class="placement-modal">

      <!-- Which saved rig -->
      <div class="rig-picker">
        <label class="field-label">Playing through</label>
        <select
          :value="placement.setup_id ?? ''"
          class="field-input"
          @change="selectSetup($event)"
        >
          <option value="">— No saved rig (this gig only) —</option>
          <option v-for="s in memberSetups" :key="s.id" :value="s.id">
            {{ s.name }}{{ s.is_default ? ' (default)' : '' }}
          </option>
        </select>
        <p class="picker-hint">
          <template v-if="linkedSetup">
            Channels, monitors and power come from “{{ linkedSetup.name }}”. Edits below apply
            to this gig only until you save them back.
          </template>
          <template v-else-if="memberSetups.length">
            Nothing linked — everything entered here lives on this rider alone.
          </template>
          <template v-else>
            This musician has no saved rigs yet. Anything entered here stays on this rider.
          </template>
        </p>
      </div>

      <!-- Instruments -->
      <div class="instruments-block">
        <div class="block-header">
          <span class="block-title">Instruments on stage</span>
          <div class="block-actions">
            <button
              v-for="inst in (member?.instruments ?? [])"
              :key="inst.id"
              type="button"
              class="quick-add"
              @click="addProfileInstrument(inst)"
            >+ {{ inst.name }}</button>
            <button type="button" class="quick-add quick-add--blank" @click="addInstrument">+ Blank</button>
          </div>
        </div>

        <div v-if="!placement.instruments.length" class="block-empty">
          No instrument slots — the stage card falls back to this member's profile instrument.
        </div>

        <div v-else class="instrument-rows">
          <div v-for="inst in placement.instruments" :key="inst.id" class="instrument-row">
            <button
              type="button"
              class="icon-btn"
              :title="INSTRUMENT_TYPE_LABELS[inst.type]"
              @click="pickerFor = pickerFor === inst.id ? null : inst.id"
            >
              <InstrumentIcon :type="inst.type" :size="20" />
            </button>
            <input
              :value="inst.label"
              class="field-input"
              :placeholder="INSTRUMENT_TYPE_LABELS[inst.type]"
              @input="patchInstrument(inst.id, { label: ($event.target as HTMLInputElement).value })"
            />
            <button type="button" class="btn-remove" @click="removeInstrument(inst.id)">✕</button>

            <div v-if="pickerFor === inst.id" class="picker-pop">
              <InstrumentIconPicker
                :model-value="inst.type"
                @update:model-value="pickType(inst.id, $event)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Rig -->
      <RigEditor
        :model-value="rig"
        mode="placement"
        :overridden="overridden"
        :base-name="linkedSetup?.name ?? null"
        :instrument="selectedInstrument"
        :member-name="displayName"
        @change="onChange"
        @reset="onReset"
      />

      <!-- Footer -->
      <div class="modal-footer">
        <div class="footer-status">
          <template v-if="overridden.length">
            <span class="status-dot" />
            {{ overridden.length }} section{{ overridden.length === 1 ? '' : 's' }} changed for this gig
          </template>
          <template v-else-if="linkedSetup">
            Matches “{{ linkedSetup.name }}” exactly
          </template>
        </div>

        <div class="footer-actions">
          <button
            v-if="overridden.length"
            type="button"
            class="btn-ghost"
            @click="clearAllOverrides"
          >Revert all</button>
          <button
            v-if="overridden.length && linkedSetup"
            type="button"
            class="btn-promote"
            :disabled="promoting"
            @click="promote"
          >
            {{ promoting ? 'Saving…' : `Save to ${displayName}'s rig` }}
          </button>
          <button type="button" class="btn-done" @click="emit('close')">Done</button>
        </div>
      </div>
    </div>
  </AdminModal>
</template>

<style scoped>
.placement-modal { display: flex; flex-direction: column; gap: 1rem; max-height: 76vh; }

.field-label { font-size: 0.7rem; font-weight: 600; color: #7c8fa6; }
.field-input {
  padding: 0.4rem 0.6rem; border-radius: 0.35rem; border: 1px solid #2a2a2a;
  background: #0d0d0d; color: #e2e8f0; font-size: 0.8rem; outline: none;
  font-family: inherit; width: 100%;
}
.field-input:focus { border-color: #5154e5; }
.field-input option { background: #141414; }

.rig-picker { display: flex; flex-direction: column; gap: 0.3rem; }
.picker-hint { font-size: 0.7rem; color: #475569; line-height: 1.5; }

.instruments-block { display: flex; flex-direction: column; gap: 0.5rem; }
.block-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
.block-title { font-size: 0.75rem; font-weight: 700; color: #94a3b8; }
.block-actions { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.quick-add {
  padding: 0.2rem 0.5rem; border-radius: 0.3rem; font-size: 0.68rem; font-weight: 600;
  cursor: pointer; background: #141414; border: 1px solid #2a2a2a; color: #94a3b8;
}
.quick-add:hover { background: #1a1a1a; border-color: #444444; }
.quick-add--blank { color: #64748b; }
.block-empty {
  padding: 0.6rem 0.75rem; font-size: 0.72rem; color: #475569; line-height: 1.5;
  border: 1px dashed #2a2a2a; border-radius: 0.375rem;
}

.instrument-rows { display: flex; flex-direction: column; gap: 0.35rem; }
.instrument-row { display: flex; align-items: center; gap: 0.4rem; position: relative; }
.icon-btn {
  width: 2rem; height: 2rem; flex-shrink: 0; border-radius: 0.35rem;
  background: #141414; border: 1px solid #2a2a2a; color: #c0c0c0; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.icon-btn:hover { border-color: #555555; }
.btn-remove {
  background: none; border: none; cursor: pointer; color: #3d1a1a;
  font-size: 0.75rem; padding: 0.25rem 0.4rem; flex-shrink: 0;
}
.btn-remove:hover { color: #f87171; }
.picker-pop {
  position: absolute; top: 2.3rem; left: 0; z-index: 20;
  background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 0.5rem;
  padding: 0.5rem; box-shadow: 0 8px 24px rgba(0,0,0,.6);
}

.modal-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  flex-wrap: wrap; padding-top: 0.75rem; border-top: 1px solid #1a1a1a; flex-shrink: 0;
}
.footer-status { display: flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; color: #64748b; }
.status-dot { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: #fbbf24; }
.footer-actions { display: flex; gap: 0.5rem; }

.btn-ghost {
  padding: 0.4rem 0.8rem; border-radius: 0.35rem; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; background: transparent; border: 1px solid #2a2a2a; color: #64748b;
}
.btn-ghost:hover { color: #94a3b8; border-color: #444444; }
.btn-promote {
  padding: 0.4rem 0.8rem; border-radius: 0.35rem; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; background: #1c1608; border: 1px solid #4d3c10; color: #fbbf24;
}
.btn-promote:hover:not(:disabled) { background: #2a2008; }
.btn-promote:disabled { opacity: 0.5; cursor: default; }
.btn-done {
  padding: 0.4rem 1rem; border-radius: 0.35rem; font-size: 0.75rem; font-weight: 600;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111;
}
</style>
