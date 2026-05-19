<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import TechRiderStagePlot from '@/components/tech-rider/TechRiderStagePlot.vue'
import TechRiderInputsTable from '@/components/tech-rider/TechRiderInputsTable.vue'
import TechRiderMonitors from '@/components/tech-rider/TechRiderMonitors.vue'
import TechRiderBackline from '@/components/tech-rider/TechRiderBackline.vue'
import TechRiderPaFoh from '@/components/tech-rider/TechRiderPaFoh.vue'
import TechRiderPower from '@/components/tech-rider/TechRiderPower.vue'
import TechRiderRfWireless from '@/components/tech-rider/TechRiderRfWireless.vue'
import TechRiderInputsDashboard from '@/components/tech-rider/TechRiderInputsDashboard.vue'
import TechRiderImportPanel from '@/components/tech-rider/TechRiderImportPanel.vue'
import { useTechRiders, useTechRider } from '@/composables/useTechRiders'
import { useBandProfile } from '@/composables/useBandProfile'
import { useBandMembers } from '@/composables/useBandMembers'
import { useAllMemberSetups } from '@/composables/useBandMemberSetups'
import type {
  TechRiderPayload,
  PaFohRequirements,
  PowerRequirements,
  InputRow,
  MonitorMix,
  BacklineItem,
  PowerPosition,
} from '@/types/techRider'
import { defaultPaFoh, defaultPower } from '@/types/techRider'
import type { BandMemberSetup } from '@/types/bandMemberSetup'
import {
  suggestInputs,
  suggestMonitors,
  suggestBackline,
  suggestPowerPositions,
} from '@/utils/stagePlotSuggestions'

// ── Template list ─────────────────────────────────────────────────────────────
const { list, create, remove: removeRider, activate } = useTechRiders()
const { query: profileQ } = useBandProfile()
const { query: membersQ } = useBandMembers()
const allSetupsQ = useAllMemberSetups()

const bandMembers = computed(() => membersQ.data.value ?? [])
const allSetups   = computed(() => allSetupsQ.data.value ?? [])

// ── Currently open rider ──────────────────────────────────────────────────────
// openId is a Ref — passed directly so useTechRider can be called ONCE at setup root
const openId = ref<number | null>(null)
const { query: riderQ, update: riderMut } = useTechRider(openId)

// ── Local form state (synced from query) ──────────────────────────────────────
type Section = 'cover' | 'stage' | 'inputs' | 'monitors' | 'backline' | 'pafoh' | 'power' | 'rf'

const activeSection = ref<Section>('stage')

const form = reactive<Required<TechRiderPayload>>({
  name:            '',
  is_active:       false,
  stage_plot_data: [],
  inputs:          [],
  monitors:        [],
  backline:        [],
  pa_foh:          defaultPaFoh(),
  power:           defaultPower(),
  rf_wireless:     [],
})

watch(
  () => riderQ.data.value,
  (rider) => {
    if (!rider) return
    form.name            = rider.name
    form.is_active       = rider.is_active
    form.stage_plot_data = rider.stage_plot_data ?? []
    form.inputs          = rider.inputs          ?? []
    form.monitors        = rider.monitors        ?? []
    form.backline        = rider.backline        ?? []
    form.pa_foh          = { ...defaultPaFoh(), ...(rider.pa_foh ?? {}) } as PaFohRequirements
    form.power           = { ...defaultPower(), ...(rider.power ?? {}), positions: (rider.power as PowerRequirements)?.positions ?? [] }
    form.rf_wireless     = rider.rf_wireless     ?? []
  },
  { immediate: true },
)

// ── Save ──────────────────────────────────────────────────────────────────────
const saving = ref(false)
const saved  = ref(false)

async function saveRider() {
  if (openId.value === null) return
  saving.value = true
  try {
    await riderMut.mutateAsync({ ...form })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
    toast.success('Rider saved')
  } catch {
    toast.error('Failed to save rider')
  } finally {
    saving.value = false
  }
}

// ── New template modal ────────────────────────────────────────────────────────
const showNewModal  = ref(false)
const newName       = ref('')
const creating      = ref(false)

async function createTemplate() {
  if (!newName.value.trim()) return
  creating.value = true
  try {
    const rider = await create.mutateAsync({ name: newName.value.trim(), is_active: false })
    showNewModal.value = false
    newName.value      = ''
    openId.value       = rider.id
    activeSection.value = 'cover'
    toast.success('Rider template created')
  } catch {
    toast.error('Failed to create rider')
  } finally {
    creating.value = false
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
const confirmDeleteId = ref<number | null>(null)

async function confirmDelete() {
  if (!confirmDeleteId.value) return
  try {
    await removeRider.mutateAsync(confirmDeleteId.value)
    if (openId.value === confirmDeleteId.value) openId.value = null
    confirmDeleteId.value = null
    toast.success('Rider deleted')
  } catch {
    toast.error('Failed to delete')
  }
}

// ── Activate ──────────────────────────────────────────────────────────────────
async function setActive(id: number) {
  try {
    await activate.mutateAsync(id)
    toast.success('Active rider updated')
  } catch {
    toast.error('Failed to set active rider')
  }
}

// ── Print ──────────────────────────────────────────────────────────────────────
function printRider() {
  window.print()
}

// ── Build from stage plot ─────────────────────────────────────────────────────

type BuildSection = 'inputs' | 'monitors' | 'backline' | 'power'

type PendingBuild =
  | { section: 'inputs';   generated: InputRow[] }
  | { section: 'monitors'; generated: MonitorMix[] }
  | { section: 'backline'; generated: BacklineItem[] }
  | { section: 'power';    generated: PowerPosition[] }

const pendingBuild = ref<PendingBuild | null>(null)

/** Computed preview counts so the banner can show what will be generated. */
const buildCounts = computed(() => {
  const items = form.stage_plot_data
  return {
    inputs:   suggestInputs(items).length,
    monitors: suggestMonitors(items).length,
    backline: suggestBackline(items).length,
    power:    suggestPowerPositions(items).length,
  }
})

function currentSectionLength(section: BuildSection): number {
  if (section === 'power') return form.power.positions.length
  return (form[section] as unknown[]).length
}

function requestBuild(section: BuildSection) {
  const items = form.stage_plot_data
  let pending: PendingBuild

  if (section === 'inputs') {
    pending = { section, generated: suggestInputs(items) }
  } else if (section === 'monitors') {
    pending = { section, generated: suggestMonitors(items) }
  } else if (section === 'backline') {
    pending = { section, generated: suggestBackline(items) }
  } else {
    pending = { section: 'power', generated: suggestPowerPositions(items) }
  }

  if (currentSectionLength(section) === 0) {
    applyBuild(pending, 'replace')
  } else {
    pendingBuild.value = pending
  }
}

function applyBuild(build: PendingBuild, mode: 'replace' | 'append') {
  if (build.section === 'inputs') {
    if (mode === 'replace') {
      form.inputs = build.generated
    } else {
      const offset = form.inputs.length
      form.inputs = [
        ...form.inputs,
        ...build.generated.map((r, i) => ({ ...r, channel: offset + i + 1 })),
      ]
    }
  } else if (build.section === 'monitors') {
    if (mode === 'replace') form.monitors = build.generated
    else form.monitors = [...form.monitors, ...build.generated]
  } else if (build.section === 'backline') {
    if (mode === 'replace') form.backline = build.generated
    else form.backline = [...form.backline, ...build.generated]
  } else {
    if (mode === 'replace') {
      form.power = { ...form.power, positions: build.generated }
    } else {
      form.power = {
        ...form.power,
        positions: [...form.power.positions, ...build.generated],
      }
    }
  }
  pendingBuild.value = null
}

function cancelBuild() {
  pendingBuild.value = null
}

// ── Import from members ───────────────────────────────────────────────────────

const showImportPanel = ref(false)

function handleMemberImport(rows: InputRow[]) {
  if (!rows.length) return
  const offset = form.inputs.length
  const renumbered = rows.map((r, i) => ({ ...r, channel: offset + i + 1 }))
  form.inputs = [...form.inputs, ...renumbered]
  toast.success(`Imported ${rows.length} channel${rows.length === 1 ? '' : 's'}`)
}

// ── Stage plot member assignment → auto-import setup ─────────────────────────

function handleMemberAssigned(payload: {
  itemId: string
  memberId: number | null
  setupId: number | null
  setup: BandMemberSetup | null
}) {
  const { setup, memberId, itemId } = payload
  const itemLabel = form.stage_plot_data.find(i => i.id === itemId)?.label ?? 'Stage position'
  if (!setup) return

  const parts: string[] = []

  // Inputs — renumber channels after existing rows
  if (setup.inputs.length) {
    const offset = form.inputs.length
    const renumbered = setup.inputs.map((r, i) => ({ ...r, channel: offset + i + 1 }))
    form.inputs = [...form.inputs, ...renumbered]
    parts.push(`${setup.inputs.length} ch`)
  }

  // Monitor
  const mon = setup.monitor
  const monitor: MonitorMix = {
    id: crypto.randomUUID(),
    band_member_id: memberId,
    custom_name: '',
    type: mon.type,
    mix_description: mon.mix_description,
    iem_own_pack: mon.iem_own_pack,
    transmitter_model: mon.iem_transmitter_model,
    frequency: mon.iem_frequency,
  }
  form.monitors = [...form.monitors, monitor]
  parts.push('monitor')

  // Backline (only if needed)
  if (setup.backline.needed) {
    const bl = setup.backline
    const backlineItem: BacklineItem = {
      id: crypto.randomUUID(),
      category: bl.category as BacklineItem['category'],
      name: itemLabel,
      brand_preference: bl.brand_preference,
      specs: bl.specs,
      notes: bl.notes,
    }
    form.backline = [...form.backline, backlineItem]
    parts.push('backline')
  }

  // Power position
  if (setup.power.outlets_needed > 0) {
    const pos: PowerPosition = {
      id: crypto.randomUUID(),
      location: itemLabel,
      outlets_needed: setup.power.outlets_needed,
      notes: setup.power.notes,
    }
    form.power = { ...form.power, positions: [...form.power.positions, pos] }
    parts.push('power')
  }

  if (parts.length) {
    toast.success(`Imported ${parts.join(', ')} from ${setup.name}`)
  }
}

// ── Section definitions ───────────────────────────────────────────────────────
const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: 'stage',    label: 'Stage Plot',        icon: '🎭' },
  { key: 'cover',    label: 'Contact',           icon: '📋' },
  { key: 'inputs',   label: 'Inputs List',       icon: '🎙️' },
  { key: 'monitors', label: 'Monitors / IEM',    icon: '🔊' },
  { key: 'backline', label: 'Backline',           icon: '🥁' },
  { key: 'pafoh',    label: 'PA / FOH',          icon: '🎛️' },
  { key: 'power',    label: 'Power',             icon: '⚡' },
  { key: 'rf',       label: 'RF / Wireless',     icon: '📡' },
]

const bandProfile = computed(() => profileQ.data.value)
</script>

<template>
  <AdminLayout>
    <div class="rider-shell">

      <!-- ── Template sidebar ────────────────────────────────────────────── -->
      <aside class="template-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-title">Tech Riders</div>
          <button type="button" class="btn-new" @click="showNewModal = true">+</button>
        </div>

        <div v-if="list.isPending.value" class="sidebar-loading">Loading…</div>
        <div v-else-if="list.isError.value" class="sidebar-error">Failed to load</div>
        <div v-else class="template-list">
          <div
            v-for="r in (list.data.value ?? [])"
            :key="r.id"
            class="template-item"
            :class="{ 'template-item--open': openId === r.id }"
            @click="openId = r.id; activeSection = 'stage'"
          >
            <div class="template-item-info">
              <span class="template-name">{{ r.name }}</span>
              <div class="template-badges">
                <span v-if="r.is_active" class="badge-active">Active</span>
                <span class="template-date">{{ new Date(r.updated_at).toLocaleDateString() }}</span>
              </div>
            </div>
            <div class="template-actions">
              <button
                v-if="!r.is_active"
                type="button"
                class="tpl-btn"
                title="Set as active rider"
                @click.stop="setActive(r.id)"
              >✓</button>
              <button
                type="button"
                class="tpl-btn tpl-btn--del"
                title="Delete"
                @click.stop="confirmDeleteId = r.id"
              >✕</button>
            </div>
          </div>
          <div v-if="(list.data.value ?? []).length === 0" class="sidebar-empty">
            No riders yet.<br>Click + to create one.
          </div>
        </div>
      </aside>

      <!-- ── Editor pane ─────────────────────────────────────────────────── -->
      <main class="editor-pane">
        <!-- Nothing open -->
        <div v-if="openId === null" class="no-rider">
          <div class="no-rider-icon">🎛️</div>
          <div class="no-rider-title">No rider open</div>
          <p class="no-rider-hint">Select a template from the sidebar, or create a new one.</p>
          <button type="button" class="btn-primary-lg" @click="showNewModal = true">Create first rider</button>
        </div>

        <!-- Loading -->
        <div v-else-if="riderQ.isPending.value" class="loading-state">Loading rider…</div>

        <!-- Editor -->
        <template v-else-if="riderQ.data.value">
          <!-- Top bar -->
          <div class="editor-topbar">
            <div>
              <div class="editor-title">{{ form.name }}</div>
              <div class="editor-subtitle">
                <span v-if="form.is_active" class="badge-active">Active rider</span>
                <span v-else class="editor-inactive">Not active</span>
              </div>
            </div>
            <div class="topbar-actions">
              <button type="button" class="btn-print" title="Print / Save as PDF" @click="printRider">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print / PDF
              </button>
              <button type="button" class="btn-save" :class="{ 'btn-save--ok': saved }" :disabled="saving" @click="saveRider">
                {{ saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save rider' }}
              </button>
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
              <span class="tab-icon">{{ s.icon }}</span>
              {{ s.label }}
            </button>
          </div>

          <!-- Section content -->
          <div class="section-content">

            <!-- ── 1. Cover / Header ───────────────────────────────────── -->
            <template v-if="activeSection === 'cover'">
              <div class="cover-preview">
                <div class="cover-band-name">{{ bandProfile?.name ?? '—' }}</div>
                <div class="cover-rider-name">Technical Rider — {{ form.name }}</div>
                <div class="cover-contacts">
                  <span v-if="bandProfile?.tech_contact_email">
                    📧 {{ bandProfile.tech_contact_email }}
                  </span>
                  <span v-if="bandProfile?.tech_contact_phone">
                    📞 {{ bandProfile.tech_contact_phone }}
                  </span>
                </div>
                <div v-if="bandProfile?.tech_rider_notes" class="cover-notes-preview">
                  {{ bandProfile.tech_rider_notes }}
                </div>
              </div>
              <div class="cover-info-box">
                <div class="cover-info-title">Sound engineer description</div>
                <p class="cover-info-desc">
                  The tech contact fields and sound engineer description are managed in
                  <RouterLink to="/admin/band-profile" class="cover-link">Band Profile → Contacts</RouterLink>.
                  They appear in the cover header of every rider you generate.
                </p>
                <div class="cover-contact-fields">
                  <div class="cover-field-row">
                    <span class="cover-field-label">Tech contact email</span>
                    <span class="cover-field-val">{{ bandProfile?.tech_contact_email || '—' }}</span>
                  </div>
                  <div class="cover-field-row">
                    <span class="cover-field-label">Tech contact phone</span>
                    <span class="cover-field-val">{{ bandProfile?.tech_contact_phone || '—' }}</span>
                  </div>
                  <div class="cover-field-row cover-field-row--wide">
                    <span class="cover-field-label">Sound engineer description</span>
                    <span class="cover-field-val">{{ bandProfile?.tech_rider_notes || '—' }}</span>
                  </div>
                </div>
                <RouterLink to="/admin/band-profile" class="btn-go-profile">Edit in Band Profile →</RouterLink>
              </div>
            </template>

            <!-- ── 2. Stage plot ───────────────────────────────────────── -->
            <template v-if="activeSection === 'stage'">
              <div class="field-group">
                <label class="field-label">Rider template name</label>
                <input v-model="form.name" class="field-input" placeholder="e.g. Festival rider, Club show, Full production" />
                <p class="field-hint">Internal reference only — not shown to the venue.</p>
              </div>
              <TechRiderStagePlot
                v-model="form.stage_plot_data"
                :band-members="bandMembers"
                :all-setups="allSetups"
                @member-assigned="handleMemberAssigned"
              />
            </template>

            <!-- ── 3. Inputs list ──────────────────────────────────────── -->
            <template v-if="activeSection === 'inputs'">
              <div v-if="form.stage_plot_data.length > 0" class="build-banner">
                <span class="build-banner-icon">🎭</span>
                <div class="build-banner-body">
                  <span class="build-banner-label">Build from stage plot</span>
                  <span class="build-banner-desc">
                    {{ buildCounts.inputs }} channel{{ buildCounts.inputs === 1 ? '' : 's' }} from
                    {{ form.stage_plot_data.length }} stage item{{ form.stage_plot_data.length === 1 ? '' : 's' }}
                  </span>
                </div>
                <template v-if="pendingBuild?.section === 'inputs'">
                  <span class="build-confirm-text">{{ form.inputs.length }} existing rows —</span>
                  <button type="button" class="build-btn build-btn--replace"
                    @click="applyBuild(pendingBuild!, 'replace')">Replace</button>
                  <button type="button" class="build-btn build-btn--append"
                    @click="applyBuild(pendingBuild!, 'append')">Append</button>
                  <button type="button" class="build-btn build-btn--cancel"
                    @click="cancelBuild">Cancel</button>
                </template>
                <button v-else type="button" class="build-btn build-btn--go"
                  @click="requestBuild('inputs')">Build →</button>
              </div>

              <!-- Import from members toolbar -->
              <div class="inputs-toolbar">
                <span class="inputs-toolbar-spacer" />
                <button type="button" class="btn-import-members" @click="showImportPanel = true">
                  👥 Import from members
                </button>
              </div>

              <!-- Dashboard (shown when there are rows) -->
              <TechRiderInputsDashboard :model-value="form.inputs" />

              <TechRiderInputsTable v-model="form.inputs" />
            </template>

            <!-- ── 4. Monitors / IEM ───────────────────────────────────── -->
            <template v-if="activeSection === 'monitors'">
              <div v-if="buildCounts.monitors > 0" class="build-banner">
                <span class="build-banner-icon">🎭</span>
                <div class="build-banner-body">
                  <span class="build-banner-label">Build from stage plot</span>
                  <span class="build-banner-desc">
                    {{ buildCounts.monitors }} wedge mix{{ buildCounts.monitors === 1 ? '' : 'es' }} detected on stage plot
                  </span>
                </div>
                <template v-if="pendingBuild?.section === 'monitors'">
                  <span class="build-confirm-text">{{ form.monitors.length }} existing —</span>
                  <button type="button" class="build-btn build-btn--replace"
                    @click="applyBuild(pendingBuild!, 'replace')">Replace</button>
                  <button type="button" class="build-btn build-btn--append"
                    @click="applyBuild(pendingBuild!, 'append')">Append</button>
                  <button type="button" class="build-btn build-btn--cancel"
                    @click="cancelBuild">Cancel</button>
                </template>
                <button v-else type="button" class="build-btn build-btn--go"
                  @click="requestBuild('monitors')">Build →</button>
              </div>
              <TechRiderMonitors v-model="form.monitors" :members="bandMembers" />
            </template>

            <!-- ── 5. Backline ────────────────────────────────────────── -->
            <template v-if="activeSection === 'backline'">
              <div v-if="buildCounts.backline > 0" class="build-banner">
                <span class="build-banner-icon">🎭</span>
                <div class="build-banner-body">
                  <span class="build-banner-label">Build from stage plot</span>
                  <span class="build-banner-desc">
                    {{ buildCounts.backline }} backline item{{ buildCounts.backline === 1 ? '' : 's' }} detected on stage plot
                  </span>
                </div>
                <template v-if="pendingBuild?.section === 'backline'">
                  <span class="build-confirm-text">{{ form.backline.length }} existing —</span>
                  <button type="button" class="build-btn build-btn--replace"
                    @click="applyBuild(pendingBuild!, 'replace')">Replace</button>
                  <button type="button" class="build-btn build-btn--append"
                    @click="applyBuild(pendingBuild!, 'append')">Append</button>
                  <button type="button" class="build-btn build-btn--cancel"
                    @click="cancelBuild">Cancel</button>
                </template>
                <button v-else type="button" class="build-btn build-btn--go"
                  @click="requestBuild('backline')">Build →</button>
              </div>
              <TechRiderBackline v-model="form.backline" />
            </template>

            <!-- ── 6. PA / FOH ────────────────────────────────────────── -->
            <template v-if="activeSection === 'pafoh'">
              <TechRiderPaFoh v-model="form.pa_foh" />
            </template>

            <!-- ── 7. Power ───────────────────────────────────────────── -->
            <template v-if="activeSection === 'power'">
              <div v-if="buildCounts.power > 0" class="build-banner">
                <span class="build-banner-icon">🎭</span>
                <div class="build-banner-body">
                  <span class="build-banner-label">Build from stage plot</span>
                  <span class="build-banner-desc">
                    {{ buildCounts.power }} power position{{ buildCounts.power === 1 ? '' : 's' }} detected on stage plot
                  </span>
                </div>
                <template v-if="pendingBuild?.section === 'power'">
                  <span class="build-confirm-text">{{ form.power.positions.length }} existing —</span>
                  <button type="button" class="build-btn build-btn--replace"
                    @click="applyBuild(pendingBuild!, 'replace')">Replace</button>
                  <button type="button" class="build-btn build-btn--append"
                    @click="applyBuild(pendingBuild!, 'append')">Append</button>
                  <button type="button" class="build-btn build-btn--cancel"
                    @click="cancelBuild">Cancel</button>
                </template>
                <button v-else type="button" class="build-btn build-btn--go"
                  @click="requestBuild('power')">Build →</button>
              </div>
              <TechRiderPower v-model="form.power" />
            </template>

            <!-- ── 8. RF / Wireless ───────────────────────────────────── -->
            <template v-if="activeSection === 'rf'">
              <TechRiderRfWireless v-model="form.rf_wireless" />
            </template>

          </div><!-- /section-content -->

          <!-- Bottom save bar -->
          <div class="bottom-bar">
            <button type="button" class="btn-save" :class="{ 'btn-save--ok': saved }" :disabled="saving" @click="saveRider">
              {{ saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save rider' }}
            </button>
          </div>

        </template>
      </main>
    </div>

    <!-- New template modal -->
    <AdminModal :open="showNewModal" title="New Rider Template" max-width="28rem" @close="showNewModal = false">
      <form @submit.prevent="createTemplate" class="modal-form">
        <div>
          <label class="field-label">Template name</label>
          <input v-model="newName" class="field-input" placeholder="e.g. Festival rider, Club show, Full production" autofocus />
          <p class="field-hint">You can rename this later. Each rider template stores its own full configuration.</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="showNewModal = false">Cancel</button>
          <button type="submit" :disabled="!newName.trim() || creating" class="btn-primary">
            {{ creating ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </form>
    </AdminModal>

    <!-- Import from members panel -->
    <TechRiderImportPanel
      :open="showImportPanel"
      :existing-count="form.inputs.length"
      @import="handleMemberImport"
      @close="showImportPanel = false"
    />

    <!-- Confirm delete modal -->
    <AdminModal :open="confirmDeleteId !== null" title="Delete rider?" max-width="24rem" @close="confirmDeleteId = null">
      <div class="confirm-delete">
        <p class="confirm-text">This will permanently delete the rider template and all its data. This cannot be undone.</p>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" @click="confirmDeleteId = null">Cancel</button>
          <button type="button" class="btn-danger" @click="confirmDelete">Delete</button>
        </div>
      </div>
    </AdminModal>
  </AdminLayout>
</template>

<style scoped src="./admin-table.css" />
<style scoped src="../../components/admin/form-styles.css" />
<style scoped>
/* ── Shell ───────────────────────────────────────────── */
.rider-shell {
  display: flex; height: calc(100vh - 0px); overflow: hidden;
}

/* ── Template sidebar ────────────────────────────────── */
.template-sidebar {
  width: 17rem; flex-shrink: 0;
  border-right: 1px solid #0f0f28;
  background: #060614;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1rem 0.625rem;
  border-bottom: 1px solid #0f0f28;
}
.sidebar-title { font-size: 0.8125rem; font-weight: 700; color: #94a3b8; }
.btn-new {
  width: 1.75rem; height: 1.75rem; border-radius: 0.375rem;
  background: #1e1b4b; border: 1px solid #312e81; color: #818cf8;
  font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 100ms;
}
.btn-new:hover { background: #252370; }

.sidebar-loading, .sidebar-error, .sidebar-empty {
  padding: 1.5rem 1rem; font-size: 0.8rem; color: #334155; text-align: center; line-height: 1.6;
}
.sidebar-error { color: #f87171; }

.template-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
.template-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.625rem 0.75rem; border-radius: 0.4rem; cursor: pointer;
  border: 1px solid transparent; margin-bottom: 0.25rem;
  transition: background 100ms, border-color 100ms;
}
.template-item:hover  { background: #0d0d28; border-color: #1e2040; }
.template-item--open  { background: #0e0e26; border-color: #312e81; }
.template-item-info   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
.template-name        { font-size: 0.8rem; font-weight: 600; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.template-badges      { display: flex; align-items: center; gap: 0.4rem; }
.badge-active         { font-size: 0.6rem; font-weight: 700; color: #4ade80; background: #052e16; padding: 0.1rem 0.4rem; border-radius: 999px; text-transform: uppercase; }
.template-date        { font-size: 0.65rem; color: #334155; }
.template-actions     { display: flex; gap: 0.25rem; flex-shrink: 0; }
.tpl-btn {
  background: none; border: none; cursor: pointer; color: #334155; font-size: 0.7rem;
  padding: 0.2rem 0.35rem; border-radius: 3px; transition: color 100ms, background 100ms;
}
.tpl-btn:hover { color: #818cf8; background: #1e1b4b; }
.tpl-btn--del:hover { color: #f87171; background: #450a0a; }

/* ── Editor pane ─────────────────────────────────────── */
.editor-pane {
  flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;
}

/* Empty / loading states */
.no-rider, .loading-state {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.75rem; text-align: center; padding: 2rem;
}
.no-rider-icon  { font-size: 3rem; }
.no-rider-title { font-size: 1.1rem; font-weight: 700; color: #e2e8f0; }
.no-rider-hint  { font-size: 0.875rem; color: #475569; max-width: 28rem; }
.loading-state  { color: #475569; font-size: 0.875rem; }
.btn-primary-lg {
  padding: 0.6rem 1.5rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff; margin-top: 0.5rem;
}
.btn-primary-lg:hover { background: #4f46e5; }

/* Top bar */
.editor-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.875rem 1.25rem; border-bottom: 1px solid #0f0f28;
  background: #070718; flex-shrink: 0;
}
.editor-title    { font-size: 1rem; font-weight: 700; color: #e2e8f0; }
.editor-subtitle { font-size: 0.75rem; margin-top: 0.1rem; }
.editor-inactive { color: #334155; font-size: 0.7rem; }

.topbar-actions { display: flex; gap: 0.5rem; align-items: center; }
.btn-print {
  display: flex; align-items: center; gap: 0.375rem;
  padding: 0.4rem 0.875rem; border-radius: 0.375rem; font-size: 0.78rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #1e2040; color: #64748b;
  transition: border-color 100ms, color 100ms;
}
.btn-print:hover { border-color: #334155; color: #94a3b8; }

/* Section tabs */
.section-tabs {
  display: flex; overflow-x: auto; border-bottom: 1px solid #0f0f28;
  background: #070718; flex-shrink: 0; scrollbar-width: none;
}
.section-tabs::-webkit-scrollbar { display: none; }
.section-tab {
  display: flex; align-items: center; gap: 0.35rem;
  padding: 0.5rem 0.875rem; font-size: 0.75rem; font-weight: 500; color: #475569;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; white-space: nowrap; transition: color 120ms, border-color 120ms;
  margin-bottom: -1px;
}
.section-tab:hover  { color: #64748b; }
.section-tab.active { color: #a5b4fc; border-bottom-color: #6366f1; }
.tab-icon { font-size: 0.85rem; }

/* Section content */
.section-content {
  flex: 1; overflow-y: auto; padding: 1.25rem;
  display: flex; flex-direction: column; gap: 1rem;
}

/* Bottom bar */
.bottom-bar {
  border-top: 1px solid #0f0f28; padding: 0.75rem 1.25rem;
  display: flex; justify-content: flex-end; background: #070718; flex-shrink: 0;
}

/* ── Cover section ───────────────────────────────────── */
.cover-preview {
  background: #070718; border: 1px solid #1e2040; border-radius: 0.5rem;
  padding: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem;
  border-left: 3px solid #4338ca;
}
.cover-band-name { font-size: 1.5rem; font-weight: 800; color: #e2e8f0; letter-spacing: -.02em; }
.cover-rider-name { font-size: 0.875rem; color: #818cf8; font-weight: 600; }
.cover-contacts { display: flex; gap: 1.5rem; font-size: 0.8rem; color: #64748b; }
.cover-notes-preview { font-size: 0.8rem; color: #64748b; line-height: 1.6; border-top: 1px solid #1a1a3a; padding-top: 0.5rem; }

.cover-info-box {
  background: #0a0a1e; border: 1px solid #1e2040; border-radius: 0.5rem; padding: 1rem;
  display: flex; flex-direction: column; gap: 0.625rem;
}
.cover-info-title { font-size: 0.8rem; font-weight: 600; color: #94a3b8; }
.cover-info-desc  { font-size: 0.775rem; color: #475569; line-height: 1.5; }
.cover-link       { color: #818cf8; text-decoration: none; }
.cover-link:hover { color: #a5b4fc; }
.cover-contact-fields { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.cover-field-row {
  flex: 1; min-width: 12rem;
  background: #070718; border: 1px solid #0f0f28; border-radius: 0.375rem;
  padding: 0.5rem 0.75rem; display: flex; flex-direction: column; gap: 0.15rem;
}
.cover-field-row--wide { flex-basis: 100%; }
.cover-field-label { font-size: 0.65rem; font-weight: 600; color: #334155; text-transform: uppercase; letter-spacing: .05em; }
.cover-field-val   { font-size: 0.8rem; color: #94a3b8; }
.btn-go-profile {
  align-self: flex-start; padding: 0.35rem 0.875rem; border-radius: 0.375rem;
  font-size: 0.78rem; font-weight: 600; color: #818cf8; text-decoration: none;
  background: #0e0e26; border: 1px solid #1e2040; transition: background 100ms;
}
.btn-go-profile:hover { background: #12123a; }

/* ── Shared buttons ──────────────────────────────────── */
.btn-save {
  padding: 0.45rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
  transition: background 150ms; min-width: 7.5rem;
}
.btn-save:hover:not(:disabled) { background: #4f46e5; }
.btn-save:disabled { opacity: 0.55; cursor: default; }
.btn-save--ok { background: #166534 !important; }

.btn-ghost {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #1e2040; color: #64748b;
}
.btn-ghost:hover { background: #0a0a1e; }
.btn-primary {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
}
.btn-primary:hover:not(:disabled) { background: #4f46e5; }
.btn-primary:disabled { opacity: 0.45; cursor: default; }
.btn-danger {
  padding: 0.4rem 0.9rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #7f1d1d; border: 1px solid #991b1b; color: #fca5a5;
}
.btn-danger:hover { background: #450a0a; }

/* Modal internals */
.modal-form, .confirm-delete { display: flex; flex-direction: column; gap: 1rem; }
.modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
.confirm-text  { font-size: 0.875rem; color: #94a3b8; line-height: 1.6; }

/* ── Build-from-stage-plot banner ────────────────────── */
.build-banner {
  display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap;
  padding: 0.6rem 0.875rem;
  background: #0a0c1e; border: 1px solid #2a2860; border-radius: 0.5rem;
  border-left: 3px solid #4338ca;
}
.build-banner-icon { font-size: 1rem; flex-shrink: 0; }
.build-banner-body {
  display: flex; flex-direction: column; gap: 0.1rem; flex: 1; min-width: 0;
}
.build-banner-label {
  font-size: 0.75rem; font-weight: 700; color: #a5b4fc;
}
.build-banner-desc {
  font-size: 0.7rem; color: #475569;
}
.build-confirm-text {
  font-size: 0.72rem; color: #64748b; white-space: nowrap;
}
.build-btn {
  padding: 0.3rem 0.7rem; border-radius: 0.35rem; font-size: 0.75rem;
  font-weight: 600; cursor: pointer; border: 1px solid transparent;
  white-space: nowrap; transition: background 120ms, border-color 120ms;
}
.build-btn--go {
  background: #1e1b4b; border-color: #312e81; color: #a5b4fc;
}
.build-btn--go:hover { background: #252370; border-color: #4338ca; }

.build-btn--replace {
  background: #4338ca; border-color: #4338ca; color: #fff;
}
.build-btn--replace:hover { background: #4f46e5; }

.build-btn--append {
  background: #0e2a1a; border-color: #14532d; color: #4ade80;
}
.build-btn--append:hover { background: #0d3d20; }

.build-btn--cancel {
  background: transparent; border-color: #1e2040; color: #475569;
}
.build-btn--cancel:hover { color: #64748b; border-color: #334155; }

/* ── Print styles ────────────────────────────────────── */
@media print {
  .template-sidebar, .editor-topbar, .section-tabs, .bottom-bar { display: none !important; }
  .build-banner { display: none !important; }
  .rider-shell { height: auto; }
  .editor-pane { overflow: visible; }
  .section-content { overflow: visible; padding: 0; }
  body { background: white; color: black; }
}
</style>
