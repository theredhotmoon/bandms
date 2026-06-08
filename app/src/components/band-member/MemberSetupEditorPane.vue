<script setup lang="ts">
import { ref, computed } from 'vue'
import MemberSetupSignalChain from './MemberSetupSignalChain.vue'
import MemberSetupMonitor     from './MemberSetupMonitor.vue'
import MemberSetupBackline    from './MemberSetupBackline.vue'
import MemberSetupPower       from './MemberSetupPower.vue'
import MemberSetupWireless    from './MemberSetupWireless.vue'
import type { BandMember } from '@/types/bandMember'
import type { Instrument } from '@/types/instrument'
import type {
  MemberMonitorPrefs,
  MemberBacklinePrefs,
  MemberPowerPrefs,
  WirelessUnit,
  SignalChainType,
  BandMemberSetupSummary,
} from '@/types/bandMemberSetup'
import type { InputRow } from '@/types/techRider'

export interface SetupEditorModel {
  name: string
  instrument_id: number | null
  signal_chain_type: SignalChainType
  inputs: InputRow[]
  monitor: MemberMonitorPrefs
  backline: MemberBacklinePrefs
  power: MemberPowerPrefs
  wireless: WirelessUnit[]
  foh_notes: string
  shared_monitor_id: number | null
}

interface Props {
  modelValue: SetupEditorModel
  member: BandMember | null
  saving: boolean
  saved: boolean
  fillHeight?: boolean
  showApplyRiderOnly?: boolean
  otherSetups?: BandMemberSetupSummary[]
}
const props = withDefaults(defineProps<Props>(), {
  fillHeight: false,
  showApplyRiderOnly: false,
  otherSetups: () => [],
})
const emit  = defineEmits<{ 'update:modelValue': [SetupEditorModel]; save: []; 'apply-rider-only': [] }>()

type SetupSection = 'inputs' | 'monitor' | 'wireless' | 'backline' | 'power' | 'foh'
const activeSection = ref<SetupSection>('inputs')

const SECTIONS: { key: SetupSection; label: string; icon: string }[] = [
  { key: 'inputs',   label: 'Signal chain / Inputs', icon: '🎙️' },
  { key: 'monitor',  label: 'Monitor',               icon: '🔊' },
  { key: 'wireless', label: 'Wireless',               icon: '📡' },
  { key: 'backline', label: 'Backline',               icon: '🥁' },
  { key: 'power',    label: 'Power',                  icon: '⚡' },
  { key: 'foh',      label: 'FOH notes',              icon: '🎛️' },
]

function patch<K extends keyof SetupEditorModel>(key: K, val: SetupEditorModel[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: val })
}

const selectedInstrument = computed(() =>
  props.member?.instruments?.find(i => i.id === props.modelValue.instrument_id) ?? null,
)
const memberFullName = computed(() =>
  props.member ? `${props.member.first_name} ${props.member.last_name}` : '',
)

const inputsModel = computed({
  get: () => props.modelValue.inputs,
  set: (v: InputRow[]) => patch('inputs', v),
})
const chainTypeModel = computed({
  get: () => props.modelValue.signal_chain_type,
  set: (v: SignalChainType) => patch('signal_chain_type', v),
})
const monitorModel = computed({
  get: () => props.modelValue.monitor,
  set: (v: MemberMonitorPrefs) => patch('monitor', v),
})
const wirelessModel = computed({
  get: () => props.modelValue.wireless,
  set: (v: WirelessUnit[]) => patch('wireless', v),
})
const backlineModel = computed({
  get: () => props.modelValue.backline,
  set: (v: MemberBacklinePrefs) => patch('backline', v),
})
const powerModel = computed({
  get: () => props.modelValue.power,
  set: (v: MemberPowerPrefs) => patch('power', v),
})

const sharedMonitorId = computed({
  get: () => props.modelValue.shared_monitor_id,
  set: (v: number | null) => patch('shared_monitor_id', v),
})

const sharedSetupName = computed(() => {
  if (!props.modelValue.shared_monitor_id) return ''
  const found = props.otherSetups.find(s => s.id === props.modelValue.shared_monitor_id)
  return found ? (found.instrument_name ?? found.name) : ''
})

const STAGE_ICON: Record<string, string> = {
  drums: '🥁',
  guitar_amp: '🎸',
  bass_amp: '🎸',
  keyboard: '🎹',
  vocalist: '🎤',
  acoustic_guitar: '🎸',
  violin: '🎻',
  brass: '🎺',
  monitor_wedge: '🔊',
  di_box: '🔌',
  rack: '📦',
  custom: '⚙️',
}

function instrumentIcon(inst: Instrument | null): string {
  return inst?.stage_plot_type ? (STAGE_ICON[inst.stage_plot_type] ?? '🎵') : '🎵'
}

defineExpose({ activeSection })
</script>

<template>
  <div class="pane-shell" :class="{ 'pane-shell--fill': fillHeight }">

    <!-- Setup meta -->
    <div class="setup-meta-bar">
      <div class="field-group">
        <label class="field-label">Setup name</label>
        <input
          :value="modelValue.name"
          class="field-input field-input--sm"
          placeholder="e.g. Festival rig"
          @input="patch('name', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div v-if="member" class="field-group">
        <label class="field-label">Instrument (optional)</label>
        <select
          :value="modelValue.instrument_id ?? ''"
          class="field-input field-input--sm"
          @change="patch('instrument_id', Number(($event.target as HTMLSelectElement).value) || null)"
        >
          <option value="">— Any / not specified —</option>
          <option v-for="inst in member.instruments" :key="inst.id" :value="inst.id">{{ inst.name }}</option>
        </select>
      </div>
    </div>

    <!-- Instrument context tag -->
    <div v-if="selectedInstrument" class="setup-instrument-tag">
      <span>{{ instrumentIcon(selectedInstrument) }}</span>
      <span>{{ selectedInstrument.name }}</span>
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
          v-model="inputsModel"
          v-model:chainType="chainTypeModel"
          :instrument="selectedInstrument"
          :memberName="memberFullName"
        />
      </template>
      <template v-if="activeSection === 'monitor'">
        <div class="shared-monitor-row">
          <label class="field-label">Monitor</label>
          <div class="shared-monitor-options">
            <label class="shared-opt" :class="{ 'shared-opt--active': !props.modelValue.shared_monitor_id }">
              <input type="radio" :value="null" v-model="sharedMonitorId" /> Own monitor mix
            </label>
            <label
              v-for="s in otherSetups"
              :key="s.id"
              class="shared-opt"
              :class="{ 'shared-opt--active': props.modelValue.shared_monitor_id === s.id }"
            >
              <input type="radio" :value="s.id" v-model="sharedMonitorId" />
              Share with "{{ s.instrument_name ?? s.name }}"
            </label>
          </div>
        </div>
        <div v-if="sharedMonitorId" class="shared-monitor-note">
          Monitor settings are shared with "{{ sharedSetupName }}". Edit them in that setup.
        </div>
        <MemberSetupMonitor v-else v-model="monitorModel" />
      </template>
      <template v-if="activeSection === 'wireless'">
        <MemberSetupWireless v-model="wirelessModel" />
      </template>
      <template v-if="activeSection === 'backline'">
        <MemberSetupBackline v-model="backlineModel" />
      </template>
      <template v-if="activeSection === 'power'">
        <MemberSetupPower v-model="powerModel" />
      </template>
      <template v-if="activeSection === 'foh'">
        <div class="foh-section">
          <label class="field-label">FOH / PA notes</label>
          <textarea
            :value="modelValue.foh_notes"
            class="foh-textarea"
            rows="6"
            placeholder="Any specific requests for the front-of-house mix — EQ preferences, effects, compression notes, etc."
            @input="patch('foh_notes', ($event.target as HTMLTextAreaElement).value)"
          />
        </div>
      </template>
    </div>

    <!-- Bottom save bar -->
    <div class="bottom-bar">
      <span v-if="showApplyRiderOnly" class="save-hint">Confirm without saving keeps changes for this rider only.</span>
      <button
        v-if="showApplyRiderOnly"
        type="button"
        class="btn-rider-only"
        @click="$emit('apply-rider-only')"
      >Apply to this rider only</button>
      <button
        type="button"
        class="btn-save"
        :class="{ 'btn-save--ok': saved }"
        :disabled="saving"
        @click="$emit('save')"
      >{{ saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save to profile' }}</button>
    </div>

  </div>
</template>

<style scoped>
.pane-shell {
  display: flex;
  flex-direction: column;
}
.pane-shell--fill {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.setup-meta-bar {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;
  padding: 0.75rem 1rem; border-bottom: 1px solid #0f0f28;
  background: #0d0d0d; flex-shrink: 0;
}
.field-group  { display: flex; flex-direction: column; gap: 0.2rem; }
.field-label  { font-size: 0.68rem; font-weight: 600; color: #7c8fa6; }
.field-input {
  display: block; width: 100%; padding: 0.4rem 0.6rem; border-radius: 0.4rem;
  border: 1px solid #2a2a2a; background: #0d0d0d; color: #e2e8f0;
  font-size: 0.8rem; outline: none; font-family: inherit; transition: border-color 150ms;
}
.field-input:focus { border-color: #5154e5; }
.field-input--sm { padding: 0.3rem 0.5rem; font-size: 0.75rem; }
.field-input option { background: #141414; }

.setup-instrument-tag {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.3rem 1rem; background: #0a0a20; border-bottom: 1px solid #0f0f28;
  font-size: 0.72rem; color: #64748b; flex-shrink: 0;
}

.section-tabs {
  display: flex; overflow-x: auto; border-bottom: 1px solid #0f0f28;
  background: #0d0d0d; flex-shrink: 0; scrollbar-width: none;
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
.section-tab.active { color: #d0d0d0; border-bottom-color: #888888; }
.tab-icon { font-size: 0.8rem; }

.section-content {
  padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem;
  overflow-y: auto;
}
.pane-shell--fill .section-content { flex: 1; }

.shared-monitor-row {
  display: flex; flex-direction: column; gap: 0.35rem;
}
.shared-monitor-options {
  display: flex; flex-wrap: wrap; gap: 0.5rem;
}
.shared-opt {
  display: flex; align-items: center; gap: 0.35rem;
  padding: 0.3rem 0.65rem; border-radius: 0.4rem; font-size: 0.75rem;
  border: 1px solid #2a2a2a; color: #64748b; cursor: pointer;
  transition: border-color 150ms, color 150ms, background 150ms;
}
.shared-opt:hover { border-color: #334155; color: #94a3b8; }
.shared-opt--active { border-color: #888888; color: #d0d0d0; background: #0f0f2a; }
.shared-opt input[type="radio"] { accent-color: #888888; }

.shared-monitor-note {
  padding: 0.75rem 1rem; border-radius: 0.5rem;
  border: 1px solid #2a2a2a; background: #0a0a20;
  font-size: 0.8rem; color: #64748b; font-style: italic;
}

.bottom-bar {
  border-top: 1px solid #0f0f28; padding: 0.625rem 1rem;
  display: flex; align-items: center; justify-content: flex-end;
  gap: 0.75rem; background: #0d0d0d; flex-shrink: 0;
}
.save-hint {
  flex: 1; font-size: 0.65rem; color: #2e3a52;
}

.btn-rider-only {
  padding: 0.4rem 1rem; border-radius: 0.45rem; font-size: 0.78rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #334155; color: #64748b;
  transition: background 150ms, border-color 150ms, color 150ms;
}
.btn-rider-only:hover { background: #111111; border-color: #475569; color: #94a3b8; }

.btn-save {
  padding: 0.4rem 1.1rem; border-radius: 0.45rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #e8e8e8; border: none; color: #111111;
  transition: background 150ms; min-width: 7rem;
}
.btn-save:hover:not(:disabled) { background: #333333; }
.btn-save:disabled { opacity: 0.55; cursor: default; }
.btn-save--ok { background: #166534 !important; }

.foh-section  { display: flex; flex-direction: column; gap: 0.35rem; }
.foh-textarea {
  width: 100%; padding: 0.625rem 0.75rem; border-radius: 0.5rem;
  border: 1px solid #2a2a2a; background: #141414; color: #e2e8f0;
  font-size: 0.85rem; font-family: inherit; outline: none; resize: vertical;
  transition: border-color 150ms;
}
.foh-textarea:focus  { border-color: #5154e5; }
.foh-textarea::placeholder { color: #2a3050; }
</style>
