<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import { createMemberSetup, updateMemberSetup } from '@/api/bandMemberSetups'
import MemberSetupEditorPane from '@/components/band-member/MemberSetupEditorPane.vue'
import type { SetupEditorModel } from '@/components/band-member/MemberSetupEditorPane.vue'
import type { BandMember } from '@/types/bandMember'
import type { BandMemberSetup } from '@/types/bandMemberSetup'
import {
  defaultMonitorPrefs,
  defaultBacklinePrefs,
  defaultPowerPrefs,
  defaultWirelessUnit,
} from '@/types/bandMemberSetup'
import type {
  StagePlotMemberItem,
  PlacedInstrument,
  GigTempMusician,
} from '@/types/stagePlot'
import {
  defaultPlacedInstrument,
  defaultPlacedMonitor,
  INSTRUMENT_PALETTE,
} from '@/types/stagePlot'
import type { StagePlotItemType } from '@/types/techRider'

interface Props {
  modelValue: StagePlotMemberItem
  member: BandMember | null
  tempMusician: GigTempMusician | null
  memberSetups: BandMemberSetup[]
  open: boolean
}
const props = defineProps<Props>()
const emit  = defineEmits<{
  'update:modelValue': [StagePlotMemberItem]
  close: []
}>()

type Tab = 'instruments' | 'monitors' | 'technical'
const activeTab = ref<Tab>('instruments')

// ── Local copy ────────────────────────────────────────────────────────────────
const local = reactive<StagePlotMemberItem>({ ...props.modelValue, instruments: [], monitors: [], wireless: [] })

watch(() => props.modelValue, (v) => {
  Object.assign(local, {
    ...v,
    instruments: v.instruments.map(i => ({ ...i, inputs: [...i.inputs] })),
    monitors:    v.monitors.map(m => ({ ...m })),
    wireless:    v.wireless.map(w => ({ ...w })),
    backline:    { ...v.backline },
    power:       { ...v.power },
  })
}, { immediate: true, deep: false })

// ── Instruments ───────────────────────────────────────────────────────────────
function addInstrument() {
  const inst = defaultPlacedInstrument()
  inst.label = props.member?.role ?? ''
  local.instruments.push(inst)
}

function removeInstrument(id: string) {
  const idx = local.instruments.findIndex(i => i.id === id)
  if (idx !== -1) local.instruments.splice(idx, 1)
}

function linkSetup(inst: PlacedInstrument, setup: BandMemberSetup) {
  inst.setup_id          = setup.id
  inst.signal_chain_type = setup.signal_chain_type
  inst.inputs            = setup.inputs?.map(r => ({ ...r })) ?? []
  // If no monitors yet, seed one from the setup
  if (local.monitors.length === 0 && setup.monitor?.type) {
    local.monitors.push({
      id:               `mon-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type:             setup.monitor.type,
      label:            'Stage Monitor',
      mix_description:  setup.monitor.mix_description ?? '',
      iem_own_pack:     setup.monitor.iem_own_pack ?? false,
      transmitter_model:setup.monitor.iem_transmitter_model ?? '',
      frequency:        setup.monitor.iem_frequency ?? '',
    })
  }
}

function unlinkSetup(inst: PlacedInstrument) {
  inst.setup_id = null
}

// ── Inline setup editor (per instrument) ──────────────────────────────────────
const { token }   = useAuth()
const queryClient = useQueryClient()

const editingInstId = ref<string | null>(null)
const setupSaving   = ref(false)
const editModel     = reactive<SetupEditorModel>({
  name: '', instrument_id: null, signal_chain_type: 'other',
  inputs: [], monitor: defaultMonitorPrefs(), backline: defaultBacklinePrefs(),
  power: defaultPowerPrefs(), wireless: [], foh_notes: '',
})

function openSetupEditor(inst: PlacedInstrument) {
  editingInstId.value = inst.id
  const setup = props.memberSetups.find(s => s.id === inst.setup_id)
  if (setup) {
    Object.assign(editModel, {
      name:              setup.name,
      instrument_id:     setup.instrument_id,
      signal_chain_type: setup.signal_chain_type,
      inputs:            [...(setup.inputs ?? [])],
      monitor:           { ...defaultMonitorPrefs(), ...(setup.monitor ?? {}) },
      backline:          { ...defaultBacklinePrefs(), ...(setup.backline ?? {}) },
      power:             { ...defaultPowerPrefs(), ...(setup.power ?? {}) },
      wireless:          [...(setup.wireless ?? [])],
      foh_notes:         setup.foh_notes ?? '',
    })
  } else {
    Object.assign(editModel, {
      name: inst.label || 'Custom setup',
      instrument_id: null,
      signal_chain_type: inst.signal_chain_type,
      inputs: [...inst.inputs],
      monitor: defaultMonitorPrefs(),
      backline: defaultBacklinePrefs(),
      power: defaultPowerPrefs(),
      wireless: [],
      foh_notes: '',
    })
  }
}

function applySetupToInstrument() {
  const inst = local.instruments.find(i => i.id === editingInstId.value)
  if (!inst) return
  inst.signal_chain_type = editModel.signal_chain_type
  inst.inputs            = [...editModel.inputs]
  editingInstId.value    = null
}

async function saveSetupToProfile() {
  if (!props.member || !editingInstId.value) return
  const inst = local.instruments.find(i => i.id === editingInstId.value)
  if (!inst) return
  setupSaving.value = true
  try {
    if (inst.setup_id) {
      await updateMemberSetup(token.value!, props.member.id, inst.setup_id, { ...editModel })
    } else {
      const created = await createMemberSetup(token.value!, props.member.id, { ...editModel })
      inst.setup_id = created.id
    }
    inst.signal_chain_type = editModel.signal_chain_type
    inst.inputs            = [...editModel.inputs]
    await queryClient.invalidateQueries({ queryKey: ['all-member-setups'] })
    toast.success('Setup saved to profile')
    editingInstId.value = null
  } catch {
    toast.error('Failed to save setup')
  } finally {
    setupSaving.value = false
  }
}

// ── Monitors ──────────────────────────────────────────────────────────────────
function addMonitor() {
  local.monitors.push(defaultPlacedMonitor())
}

function removeMonitor(id: string) {
  const idx = local.monitors.findIndex(m => m.id === id)
  if (idx !== -1) local.monitors.splice(idx, 1)
}

// ── Wireless ──────────────────────────────────────────────────────────────────
function addWireless() {
  local.wireless.push(defaultWirelessUnit())
}

function removeWireless(idx: number) {
  local.wireless.splice(idx, 1)
}

// ── Save ──────────────────────────────────────────────────────────────────────
function save() {
  emit('update:modelValue', {
    ...local,
    instruments: local.instruments.map(i => ({ ...i, inputs: [...i.inputs] })),
    monitors:    local.monitors.map(m => ({ ...m })),
    wireless:    local.wireless.map(w => ({ ...w })),
    backline:    { ...local.backline },
    power:       { ...local.power },
  })
  emit('close')
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const memberName = computed(() => {
  if (props.tempMusician) return props.tempMusician.name
  if (!props.member) return 'Unknown'
  return props.member.nickname ?? `${props.member.first_name} ${props.member.last_name}`
})

const memberRole = computed(() => {
  if (props.tempMusician) return props.tempMusician.role || 'Replacement'
  return props.member?.role ?? 'Musician'
})

const memberInitials = computed(() => {
  if (props.tempMusician) return (props.tempMusician.name[0] ?? '?').toUpperCase()
  if (!props.member) return '?'
  return `${props.member.first_name[0] ?? ''}${props.member.last_name[0] ?? ''}`.toUpperCase()
})

const INSTRUMENT_TYPES = INSTRUMENT_PALETTE.filter(
  p => !['monitor_wedge'].includes(p.type)
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background: rgba(0,0,0,0.7)"
      @mousedown.self="save"
    >
      <div class="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        <!-- Header -->
        <div class="flex items-center gap-3 px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <!-- Avatar -->
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0"
            :class="tempMusician ? 'bg-amber-800 text-amber-200' : 'bg-indigo-700 text-white'"
          >
            <img v-if="member?.photo" :src="member.photo" :alt="memberName" class="w-full h-full object-cover" />
            <span v-else>{{ memberInitials }}</span>
          </div>

          <div class="flex-1">
            <div class="font-semibold text-white text-sm">{{ memberName }}</div>
            <div class="text-xs text-slate-400">{{ memberRole }}
              <span v-if="tempMusician" class="ml-2 px-1.5 py-0.5 rounded bg-amber-800/50 text-amber-300 text-[10px] font-medium">GUEST</span>
            </div>
          </div>

          <button type="button" class="text-slate-400 hover:text-white transition-colors p-1" @click="save">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-slate-700 flex-shrink-0">
          <button
            v-for="tab in ([{ key: 'instruments', label: '🎸 Instruments' }, { key: 'monitors', label: '🔊 Monitors' }, { key: 'technical', label: '⚙️ Technical' }] as const)"
            :key="tab.key"
            type="button"
            class="px-5 py-3 text-sm font-medium border-b-2 transition-colors"
            :class="activeTab === tab.key
              ? 'border-indigo-500 text-indigo-300'
              : 'border-transparent text-slate-400 hover:text-white'"
            @click="activeTab = tab.key"
          >{{ tab.label }}</button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          <!-- ── INSTRUMENTS TAB ────────────────────────────────────────── -->
          <template v-if="activeTab === 'instruments'">
            <p class="text-xs text-slate-400">Add all instruments this musician plays tonight. Link each to a saved setup for inputs.</p>

            <!-- Inline setup editor -->
            <div v-if="editingInstId" class="rounded-lg border border-indigo-600/40 bg-indigo-950/30 p-4">
              <div class="flex items-center justify-between mb-3">
                <p class="text-sm font-medium text-indigo-300">Edit setup</p>
                <div class="flex gap-2">
                  <button
                    v-if="member"
                    type="button"
                    :disabled="setupSaving"
                    class="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
                    @click="saveSetupToProfile"
                  >
                    {{ setupSaving ? 'Saving…' : 'Save to profile' }}
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-600 text-slate-300 hover:text-white transition-colors"
                    @click="applySetupToInstrument"
                  >Apply & close</button>
                </div>
              </div>
              <MemberSetupEditorPane
                v-model="editModel"
                :member="member"
                :saving="setupSaving"
                :saved="false"
                :fill-height="false"
                :show-apply-rider-only="false"
              />
            </div>

            <!-- Instrument list -->
            <div
              v-for="inst in local.instruments"
              :key="inst.id"
              class="rounded-lg border border-slate-700 bg-slate-800/30 overflow-hidden"
            >
              <div class="flex items-center gap-3 px-4 py-3">
                <!-- Type selector -->
                <select
                  :value="inst.type"
                  class="text-xs bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500 flex-shrink-0"
                  @change="inst.type = ($event.target as HTMLSelectElement).value as StagePlotItemType"
                >
                  <option v-for="opt in INSTRUMENT_TYPES" :key="opt.type" :value="opt.type">{{ opt.label }}</option>
                </select>

                <!-- Label input -->
                <input
                  v-model="inst.label"
                  type="text"
                  placeholder="Label (e.g. Guitar, Acoustic)"
                  class="flex-1 text-sm bg-transparent border-b border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 py-0.5"
                />

                <!-- Setup badge -->
                <span
                  class="text-xs px-2 py-1 rounded-full flex-shrink-0"
                  :class="inst.setup_id ? 'bg-green-900/40 text-green-400' : 'bg-slate-700 text-slate-400'"
                >
                  {{ inst.setup_id ? `${inst.inputs.length} ch.` : 'No inputs' }}
                </span>

                <!-- Edit setup -->
                <button
                  type="button"
                  class="text-slate-400 hover:text-indigo-400 transition-colors p-1"
                  :title="inst.setup_id ? 'Edit setup' : 'Configure inputs'"
                  @click="openSetupEditor(inst)"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                <!-- Remove -->
                <button
                  type="button"
                  class="text-slate-500 hover:text-red-400 transition-colors p-1"
                  @click="removeInstrument(inst.id)"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <!-- Setup dropdown -->
              <div v-if="memberSetups.length" class="px-4 pb-3 border-t border-slate-700/50 pt-2 bg-slate-900/20">
                <label class="text-xs text-slate-500 block mb-1.5">Link to saved setup</label>
                <div class="flex gap-2 flex-wrap">
                  <button
                    v-for="setup in memberSetups"
                    :key="setup.id"
                    type="button"
                    class="text-xs px-2.5 py-1 rounded-md border transition-colors"
                    :class="inst.setup_id === setup.id
                      ? 'border-indigo-500 bg-indigo-900/40 text-indigo-300'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'"
                    @click="inst.setup_id === setup.id ? unlinkSetup(inst) : linkSetup(inst, setup)"
                  >
                    {{ setup.name }} ({{ setup.inputs?.length ?? 0 }} ch.)
                  </button>
                </div>
              </div>
              <div v-else-if="member" class="px-4 pb-3 border-t border-slate-700/50 pt-2 bg-slate-900/20">
                <p class="text-xs text-slate-500">No saved setups. Click the edit button above to configure inputs.</p>
              </div>
            </div>

            <!-- Empty state -->
            <div v-if="!local.instruments.length" class="text-center py-6 text-slate-500 text-sm">
              No instruments added yet
            </div>

            <!-- Add instrument button -->
            <button
              type="button"
              class="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              @click="addInstrument"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add instrument
            </button>
          </template>

          <!-- ── MONITORS TAB ────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'monitors'">
            <p class="text-xs text-slate-400">Add all monitor mixes needed by this musician. Multiple wedges or IEM units are supported.</p>

            <div
              v-for="mon in local.monitors"
              :key="mon.id"
              class="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3"
            >
              <div class="flex items-center gap-3">
                <!-- Type toggle -->
                <div class="flex rounded-md border border-slate-600 overflow-hidden flex-shrink-0">
                  <button
                    v-for="t in [{ v: 'wedge', icon: '🔊' }, { v: 'iem', icon: '📡' }] as const"
                    :key="t.v"
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium transition-colors"
                    :class="mon.type === t.v ? 'bg-indigo-700 text-white' : 'text-slate-400 hover:text-white'"
                    @click="mon.type = t.v"
                  >{{ t.icon }} {{ t.v.toUpperCase() }}</button>
                </div>

                <!-- Label -->
                <input
                  v-model="mon.label"
                  type="text"
                  placeholder="Label (e.g. Stage Left Wedge)"
                  class="flex-1 text-sm bg-transparent border-b border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 py-0.5"
                />

                <button type="button" class="text-slate-500 hover:text-red-400 transition-colors p-1" @click="removeMonitor(mon.id)">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <input
                v-model="mon.mix_description"
                type="text"
                placeholder="Mix description (e.g. guitar heavy, click track, full mix)"
                class="w-full text-sm px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />

              <!-- IEM fields -->
              <div v-if="mon.type === 'iem'" class="grid grid-cols-2 gap-2">
                <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input v-model="mon.iem_own_pack" type="checkbox" class="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500" />
                  Own transmitter pack
                </label>
                <input
                  v-model="mon.transmitter_model"
                  type="text"
                  placeholder="Transmitter model"
                  class="text-sm px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  v-model="mon.frequency"
                  type="text"
                  placeholder="Frequency (e.g. 606.800 MHz)"
                  class="col-span-2 text-sm px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div v-if="!local.monitors.length" class="text-center py-6 text-slate-500 text-sm">
              No monitors configured
            </div>

            <button type="button" class="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors" @click="addMonitor">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add monitor
            </button>
          </template>

          <!-- ── TECHNICAL TAB ──────────────────────────────────────────── -->
          <template v-else>
            <!-- Backline -->
            <div class="space-y-2">
              <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input v-model="local.backline.needed" type="checkbox" class="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500" />
                Backline required
              </label>
              <div v-if="local.backline.needed" class="grid grid-cols-2 gap-2 pl-6">
                <input v-model="local.backline.category" type="text" placeholder="Category (drum kit, guitar amp…)" class="text-sm px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
                <input v-model="local.backline.brand_preference" type="text" placeholder="Brand preference" class="text-sm px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
                <input v-model="local.backline.specs" type="text" placeholder="Specs" class="text-sm px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 col-span-2" />
                <input v-model="local.backline.notes" type="text" placeholder="Notes" class="text-sm px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 col-span-2" />
              </div>
            </div>

            <hr class="border-slate-700/60" />

            <!-- Power -->
            <div class="space-y-2">
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Power</p>
              <div class="flex items-center gap-3">
                <input
                  v-model.number="local.power.outlets_needed"
                  type="number" min="0" max="20"
                  class="w-20 text-sm px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-md text-white focus:outline-none focus:border-indigo-500"
                />
                <span class="text-sm text-slate-400">outlets needed</span>
              </div>
              <input v-model="local.power.notes" type="text" placeholder="Power notes" class="w-full text-sm px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
            </div>

            <hr class="border-slate-700/60" />

            <!-- Wireless -->
            <div class="space-y-2">
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Wireless units</p>
              <div
                v-for="(unit, idx) in local.wireless"
                :key="idx"
                class="grid grid-cols-2 gap-2 p-3 rounded-lg border border-slate-700 bg-slate-800/20 relative"
              >
                <button type="button" class="absolute top-2 right-2 text-slate-500 hover:text-red-400 transition-colors" @click="removeWireless(idx)">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <select v-model="unit.type" class="text-xs bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500">
                  <option value="instrument">Instrument</option>
                  <option value="vocal">Vocal</option>
                  <option value="iem">IEM</option>
                  <option value="other">Other</option>
                </select>
                <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input v-model="unit.own_unit" type="checkbox" class="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500" />
                  Own unit
                </label>
                <input v-model="unit.brand_model" type="text" placeholder="Brand / model" class="col-span-2 text-sm px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
                <input v-model="unit.frequency_band" type="text" placeholder="Frequency band" class="text-sm px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
                <input v-model="unit.notes" type="text" placeholder="Notes" class="text-sm px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" />
              </div>
              <button type="button" class="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors" @click="addWireless">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                Add wireless unit
              </button>
            </div>

            <hr class="border-slate-700/60" />

            <!-- FOH notes -->
            <div class="space-y-2">
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">FOH notes</p>
              <textarea
                v-model="local.foh_notes"
                rows="3"
                placeholder="Special mixing notes, routing preferences, cue requests…"
                class="w-full text-sm px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-slate-700 flex-shrink-0">
          <span class="text-xs text-slate-500">
            {{ local.instruments.length }} instrument{{ local.instruments.length !== 1 ? 's' : '' }}
            · {{ local.monitors.length }} monitor{{ local.monitors.length !== 1 ? 's' : '' }}
          </span>
          <div class="flex gap-2">
            <button type="button" class="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg border border-slate-700 transition-colors" @click="emit('close')">
              Cancel
            </button>
            <button type="button" class="px-5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors" @click="save">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
