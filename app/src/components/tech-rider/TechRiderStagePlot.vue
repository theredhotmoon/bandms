<script setup lang="ts">
import { ref, computed } from 'vue'
import type { BandMember } from '@/types/bandMember'
import type { MemberSetupGroup, BandMemberSetup } from '@/types/bandMemberSetup'
import type { StagePlotMemberItem, GigLineup, GigTempMusician } from '@/types/stagePlot'
import {
  defaultStageMemberItem,
  isMemberItemComplete,
  isMemberItemPartial,
  INSTRUMENT_TYPE_LABELS,
} from '@/types/stagePlot'
import type { StagePlotItemType } from '@/types/techRider'
import StagePlotMemberModal from './StagePlotMemberModal.vue'

interface Props {
  modelValue: StagePlotMemberItem[]
  lineup: GigLineup
  bandMembers: BandMember[]
  allSetups: MemberSetupGroup[]
}
const props = withDefaults(defineProps<Props>(), {
  bandMembers: () => [],
  allSetups:   () => [],
})
const emit = defineEmits<{
  'update:modelValue': [StagePlotMemberItem[]]
}>()

// ── Helpers ───────────────────────────────────────────────────────────────────

function memberName(m: BandMember): string {
  return m.nickname ?? `${m.first_name} ${m.last_name}`
}

function memberInitials(m: BandMember): string {
  return `${m.first_name[0] ?? ''}${m.last_name[0] ?? ''}`.toUpperCase()
}

function tempInitials(t: GigTempMusician): string {
  return (t.name[0] ?? '?').toUpperCase()
}

// Returns member setups for a given member id
function setupsFor(memberId: number | null): BandMemberSetup[] {
  if (!memberId) return []
  return props.allSetups.find(g => g.member_id === memberId)?.setups ?? []
}

// Which band members are available (is_available=true or not listed = default available)
const availableMembers = computed<BandMember[]>(() =>
  props.bandMembers.filter(m => m.is_current && (() => {
    const entry = props.lineup.regular_members.find(r => r.band_member_id === m.id)
    return entry ? entry.is_available : true
  })()),
)

const tempMusicians = computed(() => props.lineup.temp_musicians ?? [])

// Number of times a member appears on stage
function memberPositionCount(memberId: number): number {
  return props.modelValue.filter(i => i.band_member_id === memberId).length
}

function tempPositionCount(tempId: string): number {
  return props.modelValue.filter(i => i.temp_id === tempId).length
}

// ── Profile completeness check ────────────────────────────────────────────────

interface ProfileCheck { ok: boolean; warnings: string[] }

function checkProfile(memberId: number): ProfileCheck {
  const setups = setupsFor(memberId)
  if (!setups.length) return { ok: false, warnings: ['No technical setup configured for this member'] }
  const hasInputs  = setups.some(s => s.inputs?.length > 0)
  const hasMonitor = setups.some(s => s.monitor?.type)
  const warnings: string[] = []
  if (!hasInputs)  warnings.push('No input channels configured in any setup')
  if (!hasMonitor) warnings.push('No monitor preferences configured')
  return { ok: warnings.length === 0, warnings }
}

// Warning dialog state
const warnPending = ref<{ memberId: number | null; tempId?: string; x: number; y: number; warnings: string[] } | null>(null)

// ── Drag & drop ───────────────────────────────────────────────────────────────

const stageRef           = ref<HTMLElement | null>(null)
const draggingMemberId   = ref<number | null>(null)   // dragging from panel
const draggingTempId     = ref<string | null>(null)   // dragging temp from panel
const draggingExistingId = ref<string | null>(null)   // dragging placed item
const dragOffsetX        = ref(0)
const dragOffsetY        = ref(0)

function onPanelMemberDragStart(e: DragEvent, memberId: number) {
  draggingMemberId.value   = memberId
  draggingTempId.value     = null
  draggingExistingId.value = null
  e.dataTransfer?.setData('text/plain', `member:${memberId}`)
}

function onPanelTempDragStart(e: DragEvent, tempId: string) {
  draggingTempId.value     = tempId
  draggingMemberId.value   = null
  draggingExistingId.value = null
  e.dataTransfer?.setData('text/plain', `temp:${tempId}`)
}

function onItemDragStart(e: DragEvent, item: StagePlotMemberItem) {
  draggingExistingId.value = item.id
  draggingMemberId.value   = null
  draggingTempId.value     = null
  const el = (e.target as HTMLElement).closest('.stage-member-card') as HTMLElement | null
  if (el && stageRef.value) {
    const rect = el.getBoundingClientRect()
    dragOffsetX.value = e.clientX - rect.left - rect.width / 2
    dragOffsetY.value = e.clientY - rect.top - rect.height / 2
  }
  e.dataTransfer?.setData('text/plain', `item:${item.id}`)
}

function onStageDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function dropCoords(e: DragEvent): { x: number; y: number } {
  const stage = stageRef.value!
  const rect  = stage.getBoundingClientRect()
  const x = Math.min(Math.max(((e.clientX - rect.left - dragOffsetX.value) / rect.width)  * 100, 5), 93)
  const y = Math.min(Math.max(((e.clientY - rect.top  - dragOffsetY.value) / rect.height) * 100, 5), 88)
  return { x, y }
}

function onStageDrop(e: DragEvent) {
  e.preventDefault()
  if (!stageRef.value) return
  const { x, y } = dropCoords(e)

  if (draggingExistingId.value) {
    // Reposition existing item
    emit('update:modelValue', props.modelValue.map(i =>
      i.id === draggingExistingId.value ? { ...i, x, y } : i,
    ))
  } else if (draggingMemberId.value !== null) {
    const memberId = draggingMemberId.value
    const check    = checkProfile(memberId)
    if (!check.ok) {
      warnPending.value = { memberId, x, y, warnings: check.warnings }
    } else {
      placeOnStage(memberId, undefined, x, y)
    }
  } else if (draggingTempId.value) {
    placeOnStage(null, draggingTempId.value, x, y)
  }

  draggingMemberId.value   = null
  draggingTempId.value     = null
  draggingExistingId.value = null
  dragOffsetX.value = 0
  dragOffsetY.value = 0
}

function placeOnStage(memberId: number | null, tempId: string | undefined, x: number, y: number) {
  const item = defaultStageMemberItem(memberId, tempId, x, y)
  emit('update:modelValue', [...props.modelValue, item])
  openModal(item.id)
}

function confirmPlaceAnyway() {
  if (!warnPending.value) return
  const { memberId, tempId, x, y } = warnPending.value
  placeOnStage(memberId ?? null, tempId, x, y)
  warnPending.value = null
}

// ── Modal ─────────────────────────────────────────────────────────────────────

const modalItemId = ref<string | null>(null)
const modalItem   = computed(() => props.modelValue.find(i => i.id === modalItemId.value) ?? null)

const modalMember = computed<BandMember | null>(() => {
  if (!modalItem.value?.band_member_id) return null
  return props.bandMembers.find(m => m.id === modalItem.value!.band_member_id) ?? null
})

const modalTemp = computed<GigTempMusician | null>(() => {
  if (!modalItem.value?.temp_id) return null
  return tempMusicians.value.find(t => t.id === modalItem.value!.temp_id) ?? null
})

const modalSetups = computed<BandMemberSetup[]>(() =>
  setupsFor(modalItem.value?.band_member_id ?? null),
)

function openModal(itemId: string) {
  modalItemId.value = itemId
}

function onModalUpdate(updated: StagePlotMemberItem) {
  emit('update:modelValue', props.modelValue.map(i => i.id === updated.id ? updated : i))
}

function removeItem(itemId: string) {
  emit('update:modelValue', props.modelValue.filter(i => i.id !== itemId))
  if (modalItemId.value === itemId) modalItemId.value = null
}

// ── Display helpers ───────────────────────────────────────────────────────────

const INSTRUMENT_ICONS: Record<StagePlotItemType, string> = {
  drums:          '🥁',
  guitar_amp:     '🎸',
  bass_amp:       '🎸',
  keyboard:       '🎹',
  vocalist:       '🎤',
  acoustic_guitar:'🎸',
  violin:         '🎻',
  brass:          '🎺',
  monitor_wedge:  '🔊',
  di_box:         '🔌',
  rack:           '📦',
  custom:         '⚙️',
}

function itemDisplayName(item: StagePlotMemberItem): string {
  if (item.temp_id) {
    return tempMusicians.value.find(t => t.id === item.temp_id)?.name ?? 'Guest'
  }
  const m = props.bandMembers.find(b => b.id === item.band_member_id)
  if (!m) return 'Unknown'
  return m.nickname ?? `${m.first_name} ${m.last_name}`
}

function itemAvatar(item: StagePlotMemberItem): string {
  if (item.temp_id) {
    const t = tempMusicians.value.find(t => t.id === item.temp_id)
    return (t?.name[0] ?? '?').toUpperCase()
  }
  const m = props.bandMembers.find(b => b.id === item.band_member_id)
  if (!m) return '?'
  return `${m.first_name[0] ?? ''}${m.last_name[0] ?? ''}`.toUpperCase()
}

function itemPhoto(item: StagePlotMemberItem): string | null {
  if (!item.band_member_id) return null
  return props.bandMembers.find(b => b.id === item.band_member_id)?.photo ?? null
}

function statusClass(item: StagePlotMemberItem): string {
  if (isMemberItemComplete(item)) return 'bg-emerald-500'
  if (isMemberItemPartial(item))  return 'bg-amber-500'
  return 'bg-red-500'
}
</script>

<template>
  <div class="flex h-full min-h-0">

    <!-- ── Member panel (left) ─────────────────────────────────────────── -->
    <div class="w-52 flex-shrink-0 border-r border-slate-700/60 bg-slate-900/40 flex flex-col">
      <p class="px-3 pt-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        Drag to place
      </p>

      <div class="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">

        <!-- Regular members -->
        <div
          v-for="member in availableMembers"
          :key="member.id"
          draggable="true"
          class="flex items-center gap-2 p-2 rounded-lg border border-slate-700/60 bg-slate-800/40 cursor-grab active:cursor-grabbing hover:border-indigo-600/50 hover:bg-indigo-950/30 transition-all select-none"
          :class="{ 'opacity-50': memberPositionCount(member.id) > 0 }"
          @dragstart="onPanelMemberDragStart($event, member.id)"
        >
          <!-- Avatar -->
          <div
            class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold overflow-hidden"
            :class="checkProfile(member.id).ok ? 'bg-indigo-700 text-white' : 'bg-slate-700 text-slate-400'"
          >
            <img v-if="member.photo" :src="member.photo" :alt="memberName(member)" class="w-full h-full object-cover" />
            <span v-else>{{ memberInitials(member) }}</span>
          </div>

          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium text-white truncate">{{ memberName(member) }}</div>
            <div class="text-[10px] text-slate-400 truncate">{{ member.role ?? 'Musician' }}</div>
          </div>

          <!-- Status indicators -->
          <div class="flex flex-col items-end gap-0.5 flex-shrink-0">
            <!-- Profile check -->
            <div
              class="w-1.5 h-1.5 rounded-full"
              :class="checkProfile(member.id).ok ? 'bg-emerald-500' : 'bg-amber-400'"
              :title="checkProfile(member.id).ok ? 'Profile complete' : checkProfile(member.id).warnings.join(', ')"
            />
            <!-- On stage count -->
            <span v-if="memberPositionCount(member.id) > 0" class="text-[10px] text-indigo-400">
              ×{{ memberPositionCount(member.id) }}
            </span>
          </div>
        </div>

        <!-- Temp musicians -->
        <div
          v-for="temp in tempMusicians"
          :key="temp.id"
          draggable="true"
          class="flex items-center gap-2 p-2 rounded-lg border border-amber-700/40 bg-amber-950/20 cursor-grab active:cursor-grabbing hover:border-amber-600/60 transition-all select-none"
          :class="{ 'opacity-50': tempPositionCount(temp.id) > 0 }"
          @dragstart="onPanelTempDragStart($event, temp.id)"
        >
          <div class="w-8 h-8 rounded-full bg-amber-800/60 text-amber-300 flex-shrink-0 flex items-center justify-center text-[11px] font-bold">
            {{ tempInitials(temp) }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium text-amber-200 truncate">{{ temp.name }}</div>
            <div class="text-[10px] text-amber-400/70">Guest</div>
          </div>
        </div>

        <!-- Empty state -->
        <p v-if="availableMembers.length === 0 && tempMusicians.length === 0" class="text-xs text-slate-500 text-center py-4 px-2">
          Set up the lineup first — click "Edit lineup" above.
        </p>
      </div>

      <!-- Legend -->
      <div class="px-3 py-2 border-t border-slate-700/50 space-y-1">
        <div class="flex items-center gap-1.5 text-[10px] text-slate-500">
          <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>Profile complete
        </div>
        <div class="flex items-center gap-1.5 text-[10px] text-slate-500">
          <div class="w-1.5 h-1.5 rounded-full bg-amber-400"></div>Profile incomplete
        </div>
      </div>
    </div>

    <!-- ── Stage canvas ────────────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col min-w-0 p-3">
      <!-- Stage area -->
      <div
        ref="stageRef"
        class="relative flex-1 rounded-lg overflow-hidden select-none"
        style="background: linear-gradient(180deg, #1a1f3a 0%, #0f1629 100%); border: 1px solid #2d3461; aspect-ratio: 16/9; min-height: 340px; max-height: 100%;"
        @dragover="onStageDragOver"
        @drop="onStageDrop"
      >
        <!-- Stage backdrop label -->
        <div class="absolute inset-x-0 bottom-0 flex items-center justify-center pb-3 pointer-events-none">
          <span class="text-slate-600 text-xs font-medium tracking-[0.3em] uppercase">Audience</span>
        </div>
        <div class="absolute inset-x-0 top-0 flex items-center justify-center pt-2 pointer-events-none">
          <span class="text-slate-700 text-[10px] uppercase tracking-widest">Stage back</span>
        </div>

        <!-- Drop hint when empty -->
        <div
          v-if="modelValue.length === 0"
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div class="text-center">
            <p class="text-slate-600 text-sm">Drag musicians from the panel to place them on stage</p>
          </div>
        </div>

        <!-- Placed member cards -->
        <div
          v-for="item in modelValue"
          :key="item.id"
          class="stage-member-card absolute"
          draggable="true"
          style="transform: translate(-50%, -50%); cursor: grab; z-index: 10;"
          :style="{ left: `${item.x}%`, top: `${item.y}%` }"
          @dragstart="onItemDragStart($event, item)"
        >
          <div
            class="relative w-20 flex flex-col items-center gap-1 px-2 py-2 rounded-xl border shadow-lg"
            :class="
              isMemberItemComplete(item) ? 'border-emerald-600/60 bg-slate-900/95' :
              isMemberItemPartial(item)  ? 'border-amber-600/50 bg-slate-900/95' :
              'border-red-700/50 bg-slate-900/95'
            "
          >
            <!-- Status dot -->
            <div class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-900" :class="statusClass(item)" />

            <!-- Avatar -->
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden flex-shrink-0"
              :class="item.temp_id ? 'bg-amber-800 text-amber-200' : 'bg-indigo-700 text-white'"
            >
              <img v-if="itemPhoto(item)" :src="itemPhoto(item)!" :alt="itemDisplayName(item)" class="w-full h-full object-cover" />
              <span v-else>{{ itemAvatar(item) }}</span>
            </div>

            <!-- Name -->
            <div class="text-[10px] font-medium text-white text-center leading-tight max-w-full truncate w-full text-center">
              {{ itemDisplayName(item) }}
            </div>

            <!-- Instrument icons -->
            <div v-if="item.instruments.length" class="flex gap-0.5 flex-wrap justify-center">
              <span
                v-for="inst in item.instruments.slice(0, 3)"
                :key="inst.id"
                class="text-[11px]"
                :title="INSTRUMENT_TYPE_LABELS[inst.type]"
              >{{ INSTRUMENT_ICONS[inst.type] }}</span>
              <span v-if="item.instruments.length > 3" class="text-[10px] text-slate-500">+{{ item.instruments.length - 3 }}</span>
            </div>

            <!-- Monitor icons -->
            <div v-if="item.monitors.length" class="flex gap-0.5 justify-center">
              <span
                v-for="mon in item.monitors.slice(0, 2)"
                :key="mon.id"
                class="text-[10px]"
                :title="mon.label || (mon.type === 'wedge' ? 'Monitor wedge' : 'IEM')"
              >{{ mon.type === 'wedge' ? '🔊' : '📡' }}</span>
              <span v-if="item.monitors.length > 2" class="text-[10px] text-slate-500">+{{ item.monitors.length - 2 }}</span>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-1 mt-0.5">
              <button
                type="button"
                class="w-5 h-5 rounded flex items-center justify-center bg-slate-700/80 hover:bg-indigo-700 text-slate-300 hover:text-white transition-colors"
                title="Edit configuration"
                @click.stop="openModal(item.id)"
              >
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                type="button"
                class="w-5 h-5 rounded flex items-center justify-center bg-slate-700/80 hover:bg-red-700 text-slate-300 hover:text-white transition-colors"
                title="Remove from stage"
                @click.stop="removeItem(item.id)"
              >
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Incomplete profile warning dialog ──────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="warnPending"
        class="fixed inset-0 z-50 flex items-center justify-center"
        style="background: rgba(0,0,0,0.6)"
      >
        <div class="bg-slate-900 border border-amber-700/50 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-amber-900/60 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-white text-sm">Incomplete profile</h3>
              <p class="text-xs text-slate-400">This musician's tech profile has gaps</p>
            </div>
          </div>

          <ul class="space-y-1 mb-5">
            <li
              v-for="(w, i) in warnPending.warnings"
              :key="i"
              class="flex items-start gap-2 text-sm text-amber-300"
            >
              <span class="mt-0.5 text-amber-500">·</span> {{ w }}
            </li>
          </ul>

          <p class="text-xs text-slate-400 mb-5">You can configure everything after placing. Do you want to continue?</p>

          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 py-2 text-sm font-medium rounded-lg border border-slate-600 text-slate-300 hover:text-white transition-colors"
              @click="warnPending = null"
            >Cancel</button>
            <button
              type="button"
              class="flex-1 py-2 text-sm font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
              @click="confirmPlaceAnyway"
            >Place anyway</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Member config modal ────────────────────────────────────────── -->
    <StagePlotMemberModal
      v-if="modalItem"
      :model-value="modalItem"
      :member="modalMember"
      :temp-musician="modalTemp"
      :member-setups="modalSetups"
      :open="!!modalItemId"
      @update:model-value="onModalUpdate"
      @close="modalItemId = null"
    />
  </div>
</template>
