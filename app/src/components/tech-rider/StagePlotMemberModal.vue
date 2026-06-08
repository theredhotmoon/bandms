<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { toast } from 'vue-sonner'
import { useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import { createMemberSetup, updateMemberSetup } from '@/api/bandMemberSetups'
import MemberSetupSignalChain from '@/components/band-member/MemberSetupSignalChain.vue'
import MemberSetupMonitor     from '@/components/band-member/MemberSetupMonitor.vue'
import MemberSetupWireless    from '@/components/band-member/MemberSetupWireless.vue'
import MemberSetupBackline    from '@/components/band-member/MemberSetupBackline.vue'
import MemberSetupPower       from '@/components/band-member/MemberSetupPower.vue'
import type { BandMember } from '@/types/bandMember'
import type { BandMemberSetup, MemberMonitorPrefs } from '@/types/bandMemberSetup'
import type { StagePlotMemberItem, PlacedInstrument, GigTempMusician } from '@/types/stagePlot'
import {
  defaultPlacedInstrument,
  defaultPlacedMonitor,
  monitorToPrefs,
  prefsToMonitor,
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

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'instruments' | 'inputs' | 'monitor' | 'wireless' | 'backline' | 'power' | 'foh'
const activeTab = ref<Tab>('instruments')

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'instruments', label: 'Instruments',          icon: '🎸' },
  { key: 'inputs',      label: 'Signal chain / Inputs',icon: '🎙️' },
  { key: 'monitor',     label: 'Monitor',              icon: '🔊' },
  { key: 'wireless',    label: 'Wireless',             icon: '📡' },
  { key: 'backline',    label: 'Backline',             icon: '🥁' },
  { key: 'power',       label: 'Power',                icon: '⚡' },
  { key: 'foh',         label: 'FOH notes',            icon: '🎛️' },
]

// ── Local state ───────────────────────────────────────────────────────────────

const local = reactive<StagePlotMemberItem>({
  ...props.modelValue,
  instruments: [],
  monitors:    [],
  wireless:    [],
})

watch(() => props.modelValue, (v) => {
  Object.assign(local, {
    ...v,
    instruments: v.instruments.map(i => ({ ...i })),
    monitors:    v.monitors.map(m => ({ ...m })),
    wireless:    v.wireless.map(w => ({ ...w })),
    backline:    { ...v.backline },
    power:       { ...v.power },
  })
}, { immediate: true, deep: false })

// ── Instruments tab ───────────────────────────────────────────────────────────

function addInstrument() {
  const inst = defaultPlacedInstrument()
  inst.label = ''
  local.instruments.push(inst)
}

function removeInstrument(id: string) {
  const idx = local.instruments.findIndex(i => i.id === id)
  if (idx !== -1) local.instruments.splice(idx, 1)
}

// When user links a setup, import its inputs + chain type
function linkSetup(inst: PlacedInstrument, setup: BandMemberSetup) {
  inst.setup_id = setup.id
  // Import inputs and chain type into the member-level fields
  local.signal_chain_type = setup.signal_chain_type
  local.inputs = (setup.inputs ?? []).map(r => ({ ...r }))
  // Seed first monitor from setup if none yet
  if (local.monitors.length === 0 && setup.monitor?.type) {
    local.monitors.push(prefsToMonitor(
      { ...setup.monitor } as MemberMonitorPrefs,
      `mon-${Date.now()}`,
      'Stage Monitor',
    ))
  }
  toast.success(`Imported ${setup.inputs?.length ?? 0} channels from "${setup.name}"`)
}

function unlinkSetup(inst: PlacedInstrument) {
  inst.setup_id = null
}

// Save to profile
const { token }   = useAuth()
const queryClient = useQueryClient()
const setupSaving = ref(false)

async function saveToProfile() {
  if (!props.member) return
  setupSaving.value = true
  try {
    const payload = {
      name:              `Stage rig — ${local.instruments.map(i => i.label || i.type).join(' + ')}`,
      signal_chain_type: local.signal_chain_type,
      inputs:            local.inputs,
      monitor:           local.monitors[0] ? monitorToPrefs(local.monitors[0]) : undefined,
      backline:          local.backline,
      power:             local.power,
      wireless:          local.wireless,
      foh_notes:         local.foh_notes,
    }
    const linkedId = local.instruments.find(i => i.setup_id)?.setup_id
    if (linkedId) {
      await updateMemberSetup(token.value!, props.member.id, linkedId, payload)
    } else {
      const created = await createMemberSetup(token.value!, props.member.id, payload)
      // Link first instrument to the new setup
      if (local.instruments[0]) local.instruments[0].setup_id = created.id
    }
    await queryClient.invalidateQueries({ queryKey: ['all-member-setups'] })
    toast.success('Setup saved to profile')
  } catch {
    toast.error('Failed to save setup')
  } finally {
    setupSaving.value = false
  }
}

// ── Monitor tab ───────────────────────────────────────────────────────────────

function addMonitor() {
  local.monitors.push(defaultPlacedMonitor())
}

function removeMonitor(id: string) {
  const idx = local.monitors.findIndex(m => m.id === id)
  if (idx !== -1) local.monitors.splice(idx, 1)
}

function updateMonitorPrefs(id: string, prefs: MemberMonitorPrefs) {
  const idx = local.monitors.findIndex(m => m.id === id)
  if (idx === -1) return
  const label = local.monitors[idx].label
  local.monitors[idx] = prefsToMonitor(prefs, id, label)
}

// ── Save ──────────────────────────────────────────────────────────────────────

function save() {
  emit('update:modelValue', {
    ...local,
    instruments: local.instruments.map(i => ({ ...i })),
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

const memberInitials = computed(() => {
  if (props.tempMusician) return (props.tempMusician.name[0] ?? '?').toUpperCase()
  if (!props.member) return '?'
  return `${props.member.first_name[0] ?? ''}${props.member.last_name[0] ?? ''}`.toUpperCase()
})

// The instrument from the member's profile that best matches the first setup link
const memberInstrument = computed(() => {
  if (!props.member) return null
  const linkedSetup = props.memberSetups.find(s =>
    local.instruments.some(i => i.setup_id === s.id),
  )
  if (linkedSetup?.instrument_id) {
    return props.member.instruments?.find(i => i.id === linkedSetup.instrument_id) ?? null
  }
  return props.member.instruments?.[0] ?? null
})

const memberFullName = computed(() =>
  props.member ? `${props.member.first_name} ${props.member.last_name}` : '',
)

const INSTRUMENT_TYPES = INSTRUMENT_PALETTE.filter(p => p.type !== 'monitor_wedge')
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
        <div class="flex items-center gap-3 px-5 py-3.5 border-b border-slate-700 flex-shrink-0">
          <div
            class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0"
            :class="tempMusician ? 'bg-amber-800 text-amber-200' : 'bg-zinc-600 text-white'"
          >
            <img v-if="member?.photo" :src="member.photo" :alt="memberName" class="w-full h-full object-cover" />
            <span v-else>{{ memberInitials }}</span>
          </div>
          <div class="flex-1">
            <div class="font-semibold text-white text-sm">{{ memberName }}</div>
            <div class="text-xs text-slate-400">
              {{ tempMusician?.role || member?.role || 'Musician' }}
              <span v-if="tempMusician" class="ml-2 px-1.5 py-0.5 rounded bg-amber-800/50 text-amber-300 text-[10px] font-medium">GUEST</span>
            </div>
          </div>

          <!-- Save to profile -->
          <button
            v-if="member"
            type="button"
            :disabled="setupSaving"
            class="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-600 text-slate-300 hover:text-white hover:border-zinc-400 transition-colors disabled:opacity-50"
            @click="saveToProfile"
          >{{ setupSaving ? 'Saving…' : 'Save to profile' }}</button>

          <button type="button" class="text-slate-400 hover:text-white transition-colors p-1" @click="save">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Tabs (same as MemberSetupEditorPane) -->
        <div class="flex overflow-x-auto border-b border-slate-700 flex-shrink-0 scrollbar-none">
          <button
            v-for="tab in TABS"
            :key="tab.key"
            type="button"
            class="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap"
            :class="activeTab === tab.key
              ? 'border-zinc-400 text-zinc-200'
              : 'border-transparent text-slate-400 hover:text-white'"
            style="margin-bottom: -1px"
            @click="activeTab = tab.key"
          >
            <span>{{ tab.icon }}</span>{{ tab.label }}
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto">

          <!-- ── Instruments tab ─────────────────────────────────────────── -->
          <template v-if="activeTab === 'instruments'">
            <div class="p-5 space-y-4">
              <p class="text-xs text-slate-400">Select all instruments this musician plays at this stage position. Use the setup links to auto-import inputs.</p>

              <!-- Member's profile instruments as quick-add -->
              <div v-if="member?.instruments?.length" class="flex flex-wrap gap-1.5">
                <span class="text-xs text-slate-500 self-center mr-1">From profile:</span>
                <button
                  v-for="profInst in member.instruments"
                  :key="profInst.id"
                  type="button"
                  class="px-2.5 py-1 text-xs rounded-full border border-slate-700 text-slate-400 hover:border-zinc-400 hover:text-zinc-200 transition-colors"
                  @click="() => { const i = defaultPlacedInstrument(); i.label = profInst.name; local.instruments.push(i) }"
                >+ {{ profInst.name }}</button>
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
                    class="text-xs bg-slate-800 border border-slate-600 rounded-md px-2 py-1.5 text-slate-300 focus:outline-none focus:border-zinc-400 flex-shrink-0"
                    @change="inst.type = ($event.target as HTMLSelectElement).value as StagePlotItemType"
                  >
                    <option v-for="opt in INSTRUMENT_TYPES" :key="opt.type" :value="opt.type">{{ opt.label }}</option>
                  </select>

                  <!-- Label input -->
                  <input
                    v-model="inst.label"
                    type="text"
                    placeholder="Label (e.g. Guitar, Acoustic)"
                    class="flex-1 text-sm bg-transparent border-b border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-zinc-400 py-0.5"
                  />

                  <!-- Setup status -->
                  <span
                    class="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    :class="inst.setup_id ? 'bg-green-900/40 text-green-400' : 'bg-slate-700/60 text-slate-500'"
                  >{{ inst.setup_id ? 'Setup linked' : 'No setup' }}</span>

                  <!-- Remove -->
                  <button type="button" class="text-slate-500 hover:text-red-400 transition-colors p-1 flex-shrink-0" @click="removeInstrument(inst.id)">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <!-- Setup links -->
                <div v-if="memberSetups.length" class="px-4 pb-3 pt-2 border-t border-slate-700/40 bg-slate-900/20">
                  <span class="text-[10px] text-slate-500 mr-2">Link setup (imports inputs):</span>
                  <div class="flex flex-wrap gap-1.5 mt-1.5">
                    <button
                      v-for="setup in memberSetups"
                      :key="setup.id"
                      type="button"
                      class="text-xs px-2.5 py-1 rounded-md border transition-colors"
                      :class="inst.setup_id === setup.id
                        ? 'border-zinc-400 bg-zinc-800/40 text-zinc-200'
                        : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-white'"
                      @click="inst.setup_id === setup.id ? unlinkSetup(inst) : linkSetup(inst, setup)"
                    >
                      {{ setup.name }} ({{ setup.inputs?.length ?? 0 }} ch.)
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="!local.instruments.length" class="text-center py-4 text-slate-500 text-sm">
                No instruments added yet
              </div>

              <button type="button" class="flex items-center gap-1.5 text-sm text-zinc-300 hover:text-zinc-100 transition-colors" @click="addInstrument">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                Add instrument
              </button>
            </div>
          </template>

          <!-- ── Signal chain / Inputs tab ───────────────────────────────── -->
          <template v-else-if="activeTab === 'inputs'">
            <div class="p-4">
              <MemberSetupSignalChain
                v-model="local.inputs"
                v-model:chainType="local.signal_chain_type"
                :instrument="memberInstrument"
                :member-name="memberFullName"
              />
            </div>
          </template>

          <!-- ── Monitor tab ─────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'monitor'">
            <div class="p-5 space-y-4">
              <p v-if="!local.monitors.length" class="text-xs text-slate-400">
                Add monitor mixes needed by this musician. Multiple wedges or IEM units are supported.
              </p>

              <div
                v-for="mon in local.monitors"
                :key="mon.id"
                class="rounded-lg border border-slate-700 bg-slate-800/20 overflow-hidden"
              >
                <!-- Monitor label + remove -->
                <div class="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/50">
                  <input
                    v-model="mon.label"
                    type="text"
                    placeholder="Label (e.g. Stage left wedge, IEM)"
                    class="flex-1 text-sm bg-transparent border-b border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-zinc-400 py-0.5"
                  />
                  <button type="button" class="text-slate-500 hover:text-red-400 transition-colors p-1" @click="removeMonitor(mon.id)">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <!-- Existing MemberSetupMonitor component -->
                <div class="p-3">
                  <MemberSetupMonitor
                    :model-value="monitorToPrefs(mon)"
                    @update:model-value="updateMonitorPrefs(mon.id, $event)"
                  />
                </div>
              </div>

              <button type="button" class="flex items-center gap-1.5 text-sm text-zinc-300 hover:text-zinc-100 transition-colors" @click="addMonitor">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                Add monitor / IEM
              </button>
            </div>
          </template>

          <!-- ── Wireless tab ────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'wireless'">
            <div class="p-4">
              <MemberSetupWireless v-model="local.wireless" />
            </div>
          </template>

          <!-- ── Backline tab ────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'backline'">
            <div class="p-4">
              <MemberSetupBackline v-model="local.backline" />
            </div>
          </template>

          <!-- ── Power tab ──────────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'power'">
            <div class="p-4">
              <MemberSetupPower v-model="local.power" />
            </div>
          </template>

          <!-- ── FOH notes tab ──────────────────────────────────────────── -->
          <template v-else-if="activeTab === 'foh'">
            <div class="p-5">
              <label class="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">FOH / PA notes</label>
              <textarea
                v-model="local.foh_notes"
                rows="6"
                placeholder="Any specific requests for the front-of-house mix — EQ preferences, effects, compression notes, cue requests…"
                class="w-full px-3 py-2.5 text-sm bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-zinc-400 resize-none"
              />
            </div>
          </template>

        </div><!-- /body -->

        <!-- Footer -->
        <div class="flex items-center justify-between px-5 py-3.5 border-t border-slate-700 flex-shrink-0">
          <span class="text-xs text-slate-500">
            {{ local.instruments.length }} instrument{{ local.instruments.length !== 1 ? 's' : '' }}
            · {{ local.inputs.length }} ch.
            · {{ local.monitors.length }} monitor{{ local.monitors.length !== 1 ? 's' : '' }}
          </span>
          <div class="flex gap-2">
            <button type="button" class="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg border border-slate-700 transition-colors" @click="emit('close')">
              Cancel
            </button>
            <button type="button" class="px-5 py-2 text-sm font-semibold rounded-lg bg-zinc-200 hover:bg-white text-zinc-900 transition-colors" @click="save">
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>
