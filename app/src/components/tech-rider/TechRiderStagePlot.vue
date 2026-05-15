<script setup lang="ts">
import { ref, computed } from 'vue'
import type { StagePlotItem, StagePlotItemType } from '@/types/techRider'
import type { BandMember } from '@/types/bandMember'
import type { MemberSetupGroup, BandMemberSetup } from '@/types/bandMemberSetup'

interface Props {
  modelValue: StagePlotItem[]
  bandMembers?: BandMember[]
  allSetups?: MemberSetupGroup[]
}
const props = withDefaults(defineProps<Props>(), {
  bandMembers: () => [],
  allSetups: () => [],
})
const emit = defineEmits<{
  'update:modelValue': [value: StagePlotItem[]]
  'member-assigned': [payload: { itemId: string; memberId: number | null; setupId: number | null; setup: BandMemberSetup | null }]
}>()

// ── Palette ───────────────────────────────────────────────────────────────────
const PALETTE: { type: StagePlotItemType; label: string }[] = [
  { type: 'drums',          label: 'Drum Kit'       },
  { type: 'guitar_amp',     label: 'Guitar Amp'     },
  { type: 'bass_amp',       label: 'Bass Amp'       },
  { type: 'keyboard',       label: 'Keyboard'       },
  { type: 'vocalist',       label: 'Vocalist'       },
  { type: 'acoustic_guitar',label: 'Acoustic Guitar'},
  { type: 'violin',         label: 'Violin'         },
  { type: 'brass',          label: 'Brass'          },
  { type: 'monitor_wedge',  label: 'Monitor Wedge'  },
  { type: 'di_box',         label: 'DI Box'         },
  { type: 'rack',           label: 'Rack Unit'      },
  { type: 'custom',         label: 'Custom'         },
]

const ICONS: Record<StagePlotItemType, string> = {
  drums: `<ellipse cx="22" cy="30" rx="14" ry="8" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <rect x="8" y="10" width="10" height="10" rx="5" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <rect x="26" y="8" width="10" height="10" rx="5" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <line x1="13" y1="20" x2="18" y2="30" stroke="#818cf8" stroke-width="1.2"/>
    <line x1="31" y1="18" x2="26" y2="28" stroke="#818cf8" stroke-width="1.2"/>`,
  guitar_amp: `<rect x="6" y="8" width="32" height="28" rx="3" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <circle cx="22" cy="22" r="9" fill="none" stroke="#818cf8" stroke-width="1.5"/>
    <circle cx="22" cy="22" r="4" fill="#4338ca" stroke="#818cf8" stroke-width="1"/>`,
  bass_amp: `<rect x="5" y="8" width="34" height="30" rx="3" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <circle cx="22" cy="23" r="10" fill="none" stroke="#818cf8" stroke-width="1.5"/>
    <rect x="8" y="10" width="28" height="5" rx="1" fill="#4338ca"/>`,
  keyboard: `<rect x="4" y="12" width="36" height="20" rx="3" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <rect x="7" y="16" width="4" height="10" rx="1" fill="#e2e8f0"/>
    <rect x="12" y="16" width="4" height="10" rx="1" fill="#e2e8f0"/>
    <rect x="17" y="16" width="4" height="10" rx="1" fill="#e2e8f0"/>
    <rect x="22" y="16" width="4" height="10" rx="1" fill="#e2e8f0"/>
    <rect x="27" y="16" width="4" height="10" rx="1" fill="#e2e8f0"/>
    <rect x="9" y="16" width="3" height="6" rx="1" fill="#1e1b4b"/>
    <rect x="14" y="16" width="3" height="6" rx="1" fill="#1e1b4b"/>
    <rect x="24" y="16" width="3" height="6" rx="1" fill="#1e1b4b"/>
    <rect x="29" y="16" width="3" height="6" rx="1" fill="#1e1b4b"/>`,
  vocalist: `<circle cx="22" cy="14" r="7" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <line x1="22" y1="21" x2="22" y2="36" stroke="#818cf8" stroke-width="1.5"/>
    <line x1="14" y1="38" x2="30" y2="38" stroke="#818cf8" stroke-width="1.5"/>
    <line x1="22" y1="30" x2="14" y2="36" stroke="#818cf8" stroke-width="1.5"/>
    <line x1="22" y1="30" x2="30" y2="36" stroke="#818cf8" stroke-width="1.5"/>`,
  acoustic_guitar: `<ellipse cx="22" cy="28" rx="10" ry="12" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <line x1="22" y1="6" x2="22" y2="17" stroke="#818cf8" stroke-width="1.5"/>
    <rect x="18" y="6" width="8" height="5" rx="1" fill="#4338ca" stroke="#818cf8" stroke-width="1"/>
    <circle cx="22" cy="26" r="3" fill="none" stroke="#818cf8" stroke-width="1.2"/>`,
  violin: `<ellipse cx="22" cy="26" rx="7" ry="10" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <line x1="22" y1="6" x2="22" y2="16" stroke="#818cf8" stroke-width="1.5"/>
    <line x1="15" y1="26" x2="29" y2="26" stroke="#818cf8" stroke-width="1.2"/>`,
  brass: `<path d="M10 20 Q10 10 22 10 Q34 10 34 20 L34 30 L28 30 L28 22 Q28 16 22 16 Q16 16 16 22 L16 36 L10 36 Z"
    fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <circle cx="10" cy="36" r="4" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>`,
  monitor_wedge: `<polygon points="4,38 40,38 34,20 10,20" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <circle cx="22" cy="30" r="5" fill="none" stroke="#818cf8" stroke-width="1.5"/>`,
  di_box: `<rect x="10" y="12" width="24" height="20" rx="2" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <circle cx="16" cy="22" r="3" fill="#4338ca"/>
    <circle cx="28" cy="22" r="3" fill="#4338ca"/>
    <text x="22" y="10" text-anchor="middle" font-size="7" fill="#818cf8" font-family="sans-serif">DI</text>`,
  rack: `<rect x="6" y="8" width="32" height="30" rx="2" fill="#334155" stroke="#818cf8" stroke-width="1.5"/>
    <rect x="8" y="11" width="28" height="4" rx="1" fill="#1e2040"/>
    <rect x="8" y="17" width="28" height="4" rx="1" fill="#1e2040"/>
    <rect x="8" y="23" width="28" height="4" rx="1" fill="#1e2040"/>
    <circle cx="12" cy="13" r="1.5" fill="#818cf8"/>
    <circle cx="12" cy="19" r="1.5" fill="#818cf8"/>
    <circle cx="12" cy="25" r="1.5" fill="#818cf8"/>`,
  custom: `<rect x="8" y="8" width="28" height="28" rx="4" fill="#334155" stroke="#818cf8" stroke-width="1.5" stroke-dasharray="3 2"/>
    <text x="22" y="26" text-anchor="middle" font-size="14" fill="#818cf8" font-family="sans-serif">?</text>`,
}

// ── Drag state ────────────────────────────────────────────────────────────────
const stageRef           = ref<HTMLElement | null>(null)
const draggingType       = ref<StagePlotItemType | null>(null)
const draggingExistingId = ref<string | null>(null)
const dragOffsetX        = ref(0)
const dragOffsetY        = ref(0)

function onPaletteDragStart(e: DragEvent, type: StagePlotItemType) {
  draggingType.value = type
  draggingExistingId.value = null
  e.dataTransfer?.setData('text/plain', type)
}

function onItemDragStart(e: DragEvent, item: StagePlotItem) {
  draggingExistingId.value = item.id
  draggingType.value = null
  const el = (e.target as HTMLElement).closest('.stage-item') as HTMLElement
  if (el && stageRef.value) {
    const itemRect = el.getBoundingClientRect()
    dragOffsetX.value = e.clientX - itemRect.left - itemRect.width / 2
    dragOffsetY.value = e.clientY - itemRect.top  - itemRect.height / 2
  }
  e.dataTransfer?.setData('text/plain', item.id)
}

function onStageDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onStageDrop(e: DragEvent) {
  e.preventDefault()
  const stage = stageRef.value
  if (!stage) return

  const rect = stage.getBoundingClientRect()
  const x = Math.min(Math.max(((e.clientX - rect.left - dragOffsetX.value) / rect.width)  * 100, 2), 94)
  const y = Math.min(Math.max(((e.clientY - rect.top  - dragOffsetY.value) / rect.height) * 100, 2), 90)

  if (draggingExistingId.value) {
    emit('update:modelValue', props.modelValue.map(item =>
      item.id === draggingExistingId.value ? { ...item, x, y } : item
    ))
  } else if (draggingType.value) {
    const label = PALETTE.find(p => p.type === draggingType.value)?.label ?? 'Item'
    const newItem: StagePlotItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: draggingType.value,
      label,
      x,
      y,
      inputNumber: null,
      band_member_id: null,
      setup_id: null,
    }
    // Add to plot immediately, then prompt for member assignment
    emit('update:modelValue', [...props.modelValue, newItem])
    openAssign(newItem)
  }

  draggingType.value = null
  draggingExistingId.value = null
  dragOffsetX.value = 0
  dragOffsetY.value = 0
}

// ── Member assignment modal ───────────────────────────────────────────────────
const assignItem       = ref<StagePlotItem | null>(null)
const assignMemberId   = ref<number | null>(null)
const assignSetupId    = ref<number | null>(null)

function openAssign(item: StagePlotItem) {
  assignItem.value     = item
  assignMemberId.value = item.band_member_id ?? null
  assignSetupId.value  = item.setup_id ?? null
}

const memberSetups = computed<BandMemberSetup[]>(() => {
  if (!assignMemberId.value) return []
  return props.allSetups.find(g => g.member_id === assignMemberId.value)?.setups ?? []
})

function selectMember(memberId: number) {
  assignMemberId.value = memberId
  assignSetupId.value  = null
}

function confirmAssign() {
  if (!assignItem.value) return

  const setup  = memberSetups.value.find(s => s.id === assignSetupId.value) ?? null

  const updated: StagePlotItem = {
    ...assignItem.value,
    band_member_id: assignMemberId.value,
    setup_id:       assignSetupId.value,
  }

  emit('update:modelValue', props.modelValue.map(i =>
    i.id === updated.id ? updated : i
  ))

  if (assignMemberId.value !== null) {
    emit('member-assigned', {
      itemId:   updated.id,
      memberId: assignMemberId.value,
      setupId:  assignSetupId.value,
      setup:    setup,
    })
  }

  assignItem.value = null
}

function skipAssign() {
  assignItem.value = null
}

// ── Helper: member name for a placed item ─────────────────────────────────────
function memberName(item: StagePlotItem): string | null {
  if (!item.band_member_id) return null
  const m = props.bandMembers.find(b => b.id === item.band_member_id)
  return m ? `${m.first_name} ${m.last_name}` : null
}

function memberInitials(item: StagePlotItem): string {
  if (!item.band_member_id) return ''
  const m = props.bandMembers.find(b => b.id === item.band_member_id)
  return m ? `${m.first_name[0] ?? ''}${m.last_name[0] ?? ''}` : ''
}

// ── Detail popup ──────────────────────────────────────────────────────────────
const detailItem  = ref<StagePlotItem | null>(null)
const detailSetup = computed<BandMemberSetup | null>(() => {
  if (!detailItem.value?.band_member_id || !detailItem.value?.setup_id) return null
  return (
    props.allSetups
      .find(g => g.member_id === detailItem.value!.band_member_id)
      ?.setups.find(s => s.id === detailItem.value!.setup_id) ?? null
  )
})

function showDetail(item: StagePlotItem) {
  detailItem.value = item
}

const SIGNAL_CHAIN_LABELS: Record<string, string> = {
  modeler_mono:    'Modeler — Mono DI',
  modeler_stereo:  'Modeler — Stereo DI',
  amp_mic:         'Amp — Mic only',
  amp_mic_di:      'Amp — Mic + DI',
  amp_di:          'Amp — DI only',
  direct_mono:     'Direct — Mono DI',
  direct_stereo:   'Direct — Stereo DI',
  drum_acoustic:   'Drums — Acoustic kit',
  drum_electronic: 'Drums — Electronic',
  drum_hybrid:     'Drums — Hybrid',
  vocal_mic:       'Vocal — Wired mic',
  vocal_wireless:  'Vocal — Wireless',
  acoustic_di:     'Acoustic — DI only',
  acoustic_mic:    'Acoustic — Mic only',
  acoustic_mic_di: 'Acoustic — Mic + DI',
  other:           'Custom / other',
}

// ── Edit item label / channel ─────────────────────────────────────────────────
const editingId   = ref<string | null>(null)
const editLabel   = ref('')
const editChannel = ref<number | null>(null)

function startEdit(item: StagePlotItem) {
  editingId.value  = item.id
  editLabel.value  = item.label
  editChannel.value = item.inputNumber ?? null
}

function commitEdit() {
  if (!editingId.value) return
  emit('update:modelValue', props.modelValue.map(item =>
    item.id === editingId.value
      ? { ...item, label: editLabel.value, inputNumber: editChannel.value }
      : item
  ))
  editingId.value = null
}

function removeItem(id: string) {
  emit('update:modelValue', props.modelValue.filter(i => i.id !== id))
}
</script>

<template>
  <div class="stage-editor">
    <!-- Palette -->
    <div class="palette">
      <div class="palette-title">Drag to stage →</div>
      <div
        v-for="p in PALETTE"
        :key="p.type"
        class="palette-item"
        draggable="true"
        @dragstart="onPaletteDragStart($event, p.type)"
      >
        <svg viewBox="0 0 44 44" class="palette-icon" v-html="ICONS[p.type]" />
        <span class="palette-label">{{ p.label }}</span>
      </div>
    </div>

    <!-- Stage floor plan -->
    <div class="stage-wrapper">
      <div class="audience-label">← AUDIENCE →</div>
      <div
        ref="stageRef"
        class="stage-floor"
        @dragover="onStageDragOver"
        @drop="onStageDrop"
      >
        <div class="stage-back-wall">BACK OF STAGE</div>

        <div
          v-for="item in modelValue"
          :key="item.id"
          class="stage-item"
          :class="{ 'stage-item--assigned': !!item.band_member_id }"
          :style="{ left: item.x + '%', top: item.y + '%' }"
          draggable="true"
          @dragstart="onItemDragStart($event, item)"
        >
          <svg viewBox="0 0 44 44" class="stage-item-icon" v-html="ICONS[item.type]" />

          <!-- Member avatar dot -->
          <div v-if="item.band_member_id" class="member-dot" :title="memberName(item) ?? ''">
            {{ memberInitials(item) }}
          </div>

          <div v-if="item.inputNumber" class="channel-badge">{{ item.inputNumber }}</div>

          <div class="stage-item-label">{{ item.label }}</div>
          <div v-if="item.band_member_id" class="stage-item-member">{{ memberName(item) }}</div>

          <!-- Actions (shown on hover) -->
          <div class="item-actions">
            <button type="button" class="item-btn item-btn--info" title="View rig details"
              @click.stop="showDetail(item)">👁</button>
            <button type="button" class="item-btn item-btn--assign" title="Assign band member"
              @click.stop="openAssign(item)">👤</button>
            <button type="button" class="item-btn" title="Edit label / channel"
              @click.stop="startEdit(item)">✎</button>
            <button type="button" class="item-btn item-btn--del" title="Remove"
              @click.stop="removeItem(item.id)">✕</button>
          </div>
        </div>
      </div>
      <div class="stage-hint">Drag items from the palette. Drop a new item to assign a band member and load their rig templates.</div>
    </div>
  </div>

  <!-- ── Member assignment modal ─────────────────────────────────────────── -->
  <div v-if="assignItem" class="overlay" @click.self="skipAssign">
    <div class="assign-card">
      <div class="assign-header">
        <div class="assign-title">Assign band member</div>
        <div class="assign-sub">{{ assignItem.label }} — select who plays this position</div>
      </div>

      <!-- Member grid -->
      <div class="member-grid">
        <button
          type="button"
          class="member-card"
          :class="{ 'member-card--active': assignMemberId === null }"
          @click="assignMemberId = null; assignSetupId = null"
        >
          <div class="member-avatar" style="color:#475569;background:#0f0f28;">—</div>
          <div class="member-card-name">No assignment</div>
        </button>
        <button
          v-for="m in bandMembers"
          :key="m.id"
          type="button"
          class="member-card"
          :class="{ 'member-card--active': assignMemberId === m.id }"
          @click="selectMember(m.id)"
        >
          <div class="member-avatar">{{ (m.first_name[0] ?? '') }}{{ (m.last_name[0] ?? '') }}</div>
          <div class="member-card-name">{{ m.first_name }} {{ m.last_name }}</div>
          <div class="member-card-role">{{ m.role || '—' }}</div>
        </button>
      </div>

      <!-- Setup selection (shown when a member is selected) -->
      <template v-if="assignMemberId !== null">
        <div class="assign-section-label">
          Rig template
          <span v-if="memberSetups.length === 0" style="color:#334155;font-weight:400;">— no setups saved for this member</span>
        </div>
        <div v-if="memberSetups.length > 0" class="setup-grid">
          <button
            type="button"
            class="setup-card"
            :class="{ 'setup-card--active': assignSetupId === null }"
            @click="assignSetupId = null"
          >
            <div class="setup-card-name">No template</div>
            <div class="setup-card-desc">Just assign the member, skip import</div>
          </button>
          <button
            v-for="s in memberSetups"
            :key="s.id"
            type="button"
            class="setup-card"
            :class="{ 'setup-card--active': assignSetupId === s.id }"
            @click="assignSetupId = s.id"
          >
            <div class="setup-card-name">{{ s.name }}</div>
            <div class="setup-card-desc">
              {{ SIGNAL_CHAIN_LABELS[s.signal_chain_type] ?? s.signal_chain_type }}
              · {{ s.inputs?.length ?? 0 }} ch
            </div>
          </button>
        </div>
        <p v-if="assignSetupId" class="assign-import-hint">
          ✓ Inputs, monitor, backline and power from this template will be added to the rider.
        </p>
      </template>

      <div class="assign-actions">
        <button type="button" class="btn-ghost" @click="skipAssign">Skip</button>
        <button type="button" class="btn-primary" @click="confirmAssign">
          {{ assignMemberId ? (assignSetupId ? 'Assign + Import' : 'Assign') : 'Confirm' }}
        </button>
      </div>
    </div>
  </div>

  <!-- ── Detail popup ────────────────────────────────────────────────────── -->
  <div v-if="detailItem" class="overlay" @click.self="detailItem = null">
    <div class="detail-card">
      <div class="detail-header">
        <div>
          <div class="detail-title">{{ detailItem.label }}</div>
          <div class="detail-member">
            <span v-if="memberName(detailItem)" class="detail-member-name">{{ memberName(detailItem) }}</span>
            <span v-else style="color:#334155;">No member assigned</span>
          </div>
        </div>
        <button type="button" class="detail-close" @click="detailItem = null">✕</button>
      </div>

      <!-- No setup -->
      <div v-if="!detailSetup && detailItem.band_member_id" class="detail-empty">
        No rig template linked. Use the 👤 button to assign a setup.
      </div>
      <div v-else-if="!detailItem.band_member_id" class="detail-empty">
        No band member assigned to this position.
      </div>

      <!-- Setup detail sections -->
      <template v-if="detailSetup">
        <div class="detail-setup-name">{{ detailSetup.name }}</div>
        <div class="detail-chain">{{ SIGNAL_CHAIN_LABELS[detailSetup.signal_chain_type] ?? detailSetup.signal_chain_type }}</div>

        <!-- Inputs -->
        <div v-if="detailSetup.inputs?.length" class="detail-section">
          <div class="detail-section-label">Inputs ({{ detailSetup.inputs.length }} ch)</div>
          <table class="detail-table">
            <thead><tr>
              <th>Ch</th><th>Instrument</th><th>Mic/DI</th><th>Model</th>
            </tr></thead>
            <tbody>
              <tr v-for="row in detailSetup.inputs" :key="row.id">
                <td>{{ row.channel }}</td>
                <td>{{ row.instrument }}</td>
                <td>{{ row.mic_di }}</td>
                <td style="color:#64748b;">{{ row.mic_model || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Monitor -->
        <div class="detail-section">
          <div class="detail-section-label">Monitor</div>
          <div class="detail-kv-grid">
            <span class="detail-k">Type</span>
            <span class="detail-v">{{ detailSetup.monitor.type === 'iem' ? 'IEM' : 'Wedge' }} · {{ detailSetup.monitor.config }}</span>
            <span class="detail-k">Mix</span>
            <span class="detail-v">{{ detailSetup.monitor.mix_description || '—' }}</span>
            <template v-if="detailSetup.monitor.type === 'iem'">
              <span class="detail-k">Own pack</span>
              <span class="detail-v">{{ detailSetup.monitor.iem_own_pack ? 'Yes' : 'No' }}</span>
              <span v-if="detailSetup.monitor.iem_transmitter_model" class="detail-k">Transmitter</span>
              <span v-if="detailSetup.monitor.iem_transmitter_model" class="detail-v">{{ detailSetup.monitor.iem_transmitter_model }}</span>
              <span v-if="detailSetup.monitor.iem_frequency" class="detail-k">Frequency</span>
              <span v-if="detailSetup.monitor.iem_frequency" class="detail-v">{{ detailSetup.monitor.iem_frequency }}</span>
            </template>
          </div>
        </div>

        <!-- Backline -->
        <div v-if="detailSetup.backline?.needed" class="detail-section">
          <div class="detail-section-label">Backline needed</div>
          <div class="detail-kv-grid">
            <span class="detail-k">Category</span><span class="detail-v">{{ detailSetup.backline.category }}</span>
            <span v-if="detailSetup.backline.brand_preference" class="detail-k">Brand</span>
            <span v-if="detailSetup.backline.brand_preference" class="detail-v">{{ detailSetup.backline.brand_preference }}</span>
            <span v-if="detailSetup.backline.specs" class="detail-k">Specs</span>
            <span v-if="detailSetup.backline.specs" class="detail-v">{{ detailSetup.backline.specs }}</span>
            <span v-if="detailSetup.backline.notes" class="detail-k">Notes</span>
            <span v-if="detailSetup.backline.notes" class="detail-v">{{ detailSetup.backline.notes }}</span>
          </div>
        </div>

        <!-- Power -->
        <div class="detail-section">
          <div class="detail-section-label">Power</div>
          <div class="detail-kv-grid">
            <span class="detail-k">Outlets</span>
            <span class="detail-v">{{ detailSetup.power.outlets_needed }}</span>
            <span v-if="detailSetup.power.notes" class="detail-k">Notes</span>
            <span v-if="detailSetup.power.notes" class="detail-v">{{ detailSetup.power.notes }}</span>
          </div>
        </div>

        <!-- FOH notes -->
        <div v-if="detailSetup.foh_notes" class="detail-section">
          <div class="detail-section-label">FOH notes</div>
          <div class="detail-foh-notes">{{ detailSetup.foh_notes }}</div>
        </div>
      </template>
    </div>
  </div>

  <!-- ── Edit label / channel overlay ───────────────────────────────────── -->
  <div v-if="editingId" class="overlay" @click.self="commitEdit">
    <div class="edit-card">
      <div class="edit-title">Edit item</div>
      <label class="field-label">Label</label>
      <input v-model="editLabel" class="field-input" @keydown.enter="commitEdit" @keydown.escape="editingId = null" />
      <label class="field-label mt-3">Input channel # <span style="color:#475569">(optional)</span></label>
      <input v-model.number="editChannel" type="number" min="1" class="field-input" placeholder="e.g. 1" />
      <div class="edit-actions">
        <button type="button" class="btn-ghost" @click="editingId = null">Cancel</button>
        <button type="button" class="btn-primary" @click="commitEdit">Done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-editor { display: flex; gap: 1rem; align-items: flex-start; min-height: 28rem; }

/* ── Palette ─────────────────────────────────────────── */
.palette {
  display: flex; flex-direction: column; gap: 0.35rem;
  min-width: 9rem; max-width: 9rem;
  background: #070718; border: 1px solid #1a1a3a; border-radius: 0.5rem; padding: 0.625rem;
}
.palette-title { font-size: 0.65rem; color: #475569; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 0.25rem; }
.palette-item {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.3rem 0.4rem; border-radius: 0.375rem; cursor: grab;
  background: #0e0e26; border: 1px solid #1e2040;
  transition: border-color 120ms, background 120ms; user-select: none;
}
.palette-item:hover { border-color: #4338ca; background: #12123a; }
.palette-item:active { cursor: grabbing; }
.palette-icon { width: 1.75rem; height: 1.75rem; flex-shrink: 0; }
.palette-label { font-size: 0.7rem; color: #94a3b8; line-height: 1.2; }

/* ── Stage ───────────────────────────────────────────── */
.stage-wrapper { flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
.audience-label {
  text-align: center; font-size: 0.65rem; color: #334155;
  letter-spacing: .1em; text-transform: uppercase;
  border-top: 2px dashed #1e2040; padding-top: 0.25rem;
}
.stage-floor {
  position: relative; width: 100%; aspect-ratio: 16/9;
  background: #0a0a1e; border: 2px solid #1e2040; border-radius: 0.5rem;
  overflow: hidden; box-shadow: inset 0 0 40px rgba(0,0,0,0.6);
}
.stage-back-wall {
  position: absolute; top: 0.5rem; left: 50%; transform: translateX(-50%);
  font-size: 0.6rem; color: #1e2040; letter-spacing: .12em; text-transform: uppercase;
}
.stage-hint { font-size: 0.68rem; color: #334155; text-align: center; }

/* ── Placed items ────────────────────────────────────── */
.stage-item {
  position: absolute; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
  cursor: grab; user-select: none; z-index: 10;
}
.stage-item:active { cursor: grabbing; }
.stage-item--assigned .stage-item-icon { filter: drop-shadow(0 0 4px #6366f180); }
.stage-item-icon { width: 2.5rem; height: 2.5rem; flex-shrink: 0; }
.stage-item-label {
  font-size: 0.6rem; color: #94a3b8; text-align: center; max-width: 5.5rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  background: rgba(7,7,24,0.8); padding: 0 0.25rem; border-radius: 2px;
}
.stage-item-member {
  font-size: 0.6rem; color: #818cf8; font-weight: 600; text-align: center; max-width: 5.5rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  background: rgba(7,7,24,0.8); padding: 0 0.25rem; border-radius: 2px;
}
.channel-badge {
  position: absolute; top: -0.4rem; right: -0.4rem;
  background: #4338ca; color: #e0e7ff; font-size: 0.6rem; font-weight: 700;
  min-width: 1.1rem; height: 1.1rem; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #312e81;
}
.member-dot {
  position: absolute; top: -0.4rem; left: -0.4rem;
  background: #1e1b4b; color: #a5b4fc; font-size: 0.5rem; font-weight: 700;
  width: 1.1rem; height: 1.1rem; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #4338ca; text-transform: uppercase;
}
.item-actions {
  display: none; position: absolute; top: -0.5rem; right: -3.5rem;
  flex-direction: column; gap: 0.15rem;
}
.stage-item:hover .item-actions { display: flex; }
.item-btn {
  padding: 0.1rem 0.25rem; font-size: 0.65rem; cursor: pointer;
  background: #0e0e26; border: 1px solid #2a2860; color: #818cf8; border-radius: 3px;
  transition: background 100ms; white-space: nowrap;
}
.item-btn:hover        { background: #1e1b4b; }
.item-btn--del         { color: #f87171; border-color: #7f1d1d; }
.item-btn--del:hover   { background: #450a0a; }
.item-btn--assign      { color: #4ade80; border-color: #14532d; }
.item-btn--assign:hover{ background: #052e16; }
.item-btn--info        { color: #fb923c; border-color: #7c2d12; }
.item-btn--info:hover  { background: #431407; }

/* ── Shared overlay ──────────────────────────────────── */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200;
  display: flex; align-items: center; justify-content: center; padding: 1rem;
}

/* ── Assignment modal ────────────────────────────────── */
.assign-card {
  background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.875rem;
  width: min(48rem, 100%); max-height: 85vh; overflow-y: auto;
  display: flex; flex-direction: column; gap: 1rem; padding: 1.5rem;
}
.assign-header  { display: flex; flex-direction: column; gap: 0.2rem; }
.assign-title   { font-size: 1rem; font-weight: 700; color: #e2e8f0; }
.assign-sub     { font-size: 0.8rem; color: #475569; }
.assign-section-label {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: #a5b4fc; margin-top: 0.25rem;
}
.assign-import-hint {
  font-size: 0.75rem; color: #4ade80; background: #052e1630; border: 1px solid #14532d40;
  border-radius: 0.375rem; padding: 0.4rem 0.625rem;
}
.assign-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.25rem; }

.member-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr)); gap: 0.5rem;
}
.member-card {
  display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
  padding: 0.625rem 0.5rem; border-radius: 0.5rem; cursor: pointer;
  border: 1px solid #1e2040; background: #0a0a1e;
  transition: border-color 100ms, background 100ms;
}
.member-card:hover       { border-color: #312e81; background: #12123a; }
.member-card--active     { border-color: #6366f1 !important; background: #16164a !important; }
.member-avatar {
  width: 2rem; height: 2rem; border-radius: 50%;
  background: #1e1b4b; color: #818cf8;
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  display: flex; align-items: center; justify-content: center;
}
.member-card--active .member-avatar { background: #312e81; color: #a5b4fc; }
.member-card-name { font-size: 0.72rem; font-weight: 600; color: #e2e8f0; text-align: center; line-height: 1.2; }
.member-card-role { font-size: 0.65rem; color: #475569; text-align: center; }

.setup-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0.5rem;
}
.setup-card {
  display: flex; flex-direction: column; gap: 0.2rem; padding: 0.625rem 0.75rem;
  border-radius: 0.5rem; cursor: pointer; text-align: left;
  border: 1px solid #1e2040; background: #0a0a1e;
  transition: border-color 100ms, background 100ms;
}
.setup-card:hover    { border-color: #312e81; background: #12123a; }
.setup-card--active  { border-color: #6366f1 !important; background: #16164a !important; }
.setup-card-name     { font-size: 0.8rem; font-weight: 600; color: #e2e8f0; }
.setup-card-desc     { font-size: 0.68rem; color: #475569; line-height: 1.4; }
.setup-card--active .setup-card-name { color: #a5b4fc; }

/* ── Detail popup ────────────────────────────────────── */
.detail-card {
  background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.875rem;
  width: min(42rem, 100%); max-height: 85vh; overflow-y: auto;
  display: flex; flex-direction: column; gap: 0.875rem; padding: 1.5rem;
}
.detail-header       { display: flex; justify-content: space-between; align-items: flex-start; }
.detail-title        { font-size: 1rem; font-weight: 700; color: #e2e8f0; }
.detail-member       { font-size: 0.8rem; margin-top: 0.15rem; }
.detail-member-name  { color: #818cf8; font-weight: 600; }
.detail-close {
  background: none; border: 1px solid #1e2040; color: #64748b;
  border-radius: 0.375rem; cursor: pointer; padding: 0.25rem 0.5rem; font-size: 0.8rem;
}
.detail-close:hover { background: #1a1a3a; color: #94a3b8; }
.detail-setup-name   { font-size: 0.875rem; font-weight: 600; color: #a5b4fc; }
.detail-chain        { font-size: 0.75rem; color: #475569; }
.detail-empty        { font-size: 0.8rem; color: #334155; padding: 1rem 0; }

.detail-section      { display: flex; flex-direction: column; gap: 0.5rem; }
.detail-section-label {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: #4f5f80; border-bottom: 1px solid #1a1a3a; padding-bottom: 0.25rem;
}
.detail-table {
  width: 100%; border-collapse: collapse; font-size: 0.75rem;
}
.detail-table th {
  text-align: left; font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
  color: #334155; padding: 0.2rem 0.4rem; border-bottom: 1px solid #1a1a3a;
}
.detail-table td {
  padding: 0.25rem 0.4rem; color: #94a3b8; border-bottom: 1px solid #0f0f28;
}
.detail-table tr:last-child td { border-bottom: none; }
.detail-kv-grid {
  display: grid; grid-template-columns: 6rem 1fr; gap: 0.2rem 0.5rem;
  font-size: 0.78rem;
}
.detail-k { color: #475569; font-weight: 600; }
.detail-v { color: #94a3b8; }
.detail-foh-notes { font-size: 0.78rem; color: #94a3b8; line-height: 1.6; }

/* ── Edit overlay ────────────────────────────────────── */
.edit-card {
  background: #0e0e26; border: 1px solid #1e2040; border-radius: 0.75rem;
  padding: 1.25rem; width: 22rem; display: flex; flex-direction: column; gap: 0.5rem;
}
.edit-title   { font-size: 0.875rem; font-weight: 600; color: #e2e8f0; margin-bottom: 0.25rem; }
.edit-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem; }

/* Buttons */
.btn-ghost {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #1e2040; color: #64748b;
}
.btn-ghost:hover { background: #0a0a1e; }
.btn-primary {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
}
.btn-primary:hover { background: #4f46e5; }
.field-label { display: block; font-size: 0.75rem; font-weight: 600; color: #7c8fa6; margin-bottom: 0.3rem; }
.field-input {
  display: block; width: 100%; padding: 0.5rem 0.75rem; border-radius: 0.5rem;
  border: 1px solid #1e2040; background: #0a0a1e; color: #e2e8f0;
  font-size: 0.875rem; outline: none; font-family: inherit;
}
.field-input:focus { border-color: #5154e5; }
.mt-3 { margin-top: 0.75rem; }
</style>
