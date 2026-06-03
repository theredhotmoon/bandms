<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchActiveTechRider, fetchTechRider } from '@/api/techRiders'
import { fetchBandMembers } from '@/api/bandMembers'
import { fetchBandProfile } from '@/api/bandProfile'
import type { TechRider } from '@/types/techRider'
import type { BandMember } from '@/types/bandMember'
import type { BandProfile } from '@/types/bandProfile'
import type { StagePlotMemberItem, GigTempMusician } from '@/types/stagePlot'
import { isMemberItemComplete, INSTRUMENT_TYPE_LABELS } from '@/types/stagePlot'

// ── Data loading ──────────────────────────────────────────────────────────────

const route   = useRoute()
const rider   = ref<TechRider | null>(null)
const members = ref<BandMember[]>([])
const profile = ref<BandProfile | null>(null)
const loading = ref(true)
const error   = ref<string | null>(null)

onMounted(async () => {
  try {
    const [riderData, membersData, profileData] = await Promise.all([
      route.params.id
        ? fetchTechRider(parseInt(Array.isArray(route.params.id) ? route.params.id[0] : route.params.id, 10))
        : fetchActiveTechRider(),
      fetchBandMembers().catch(() => [] as BandMember[]),
      fetchBandProfile().catch(() => null),
    ])
    rider.value   = riderData
    members.value = membersData
    profile.value = profileData
  } catch {
    error.value = 'Could not load the tech rider. Please check that a rider is published.'
  } finally {
    loading.value = false
  }
})

const logoUrl = computed(() => {
  // Use tech_rider_logo_id pin if set, else fall back to global default
  if (profile.value?.tech_rider_logo_id && profile.value?.logos?.length) {
    const pinned = profile.value.logos.find(l => l.id === profile.value!.tech_rider_logo_id)
    if (pinned) return pinned.url
  }
  return profile.value?.logo_url ?? null
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const stagePlot  = computed(() => rider.value?.stage_plot_data ?? [])
const backline   = computed(() => rider.value?.backline ?? [])
const power      = computed(() => rider.value?.power ?? null)
const rfWireless = computed(() => rider.value?.rf_wireless ?? [])
const paFoh      = computed(() => rider.value?.pa_foh ?? null)

function findMember(id: number | null): BandMember | null {
  if (!id) return null
  return members.value.find(m => m.id === id) ?? null
}

function memberDisplayName(item: StagePlotMemberItem): string {
  if (item.temp_id) {
    const t = rider.value?.gig_lineup?.temp_musicians?.find((m: GigTempMusician) => m.id === item.temp_id)
    return t ? t.name : 'Guest'
  }
  const m = findMember(item.band_member_id)
  if (m) return m.nickname ?? `${m.first_name} ${m.last_name}`
  return `Member #${item.band_member_id}`
}

function memberInitials(item: StagePlotMemberItem): string {
  if (item.temp_id) {
    const t = rider.value?.gig_lineup?.temp_musicians?.find((m: GigTempMusician) => m.id === item.temp_id)
    return (t?.name?.[0] ?? '?').toUpperCase()
  }
  const m = findMember(item.band_member_id)
  if (m) return `${m.first_name[0] ?? ''}${m.last_name[0] ?? ''}`.toUpperCase()
  return '?'
}

function memberRole(item: StagePlotMemberItem): string {
  if (item.temp_id) {
    const t = rider.value?.gig_lineup?.temp_musicians?.find((m: GigTempMusician) => m.id === item.temp_id)
    return t?.role || 'Guest'
  }
  return findMember(item.band_member_id)?.role ?? ''
}

// ── Consolidated inputs / monitors derived from stage plot ────────────────────

interface PreviewInput {
  channel: number; instrument: string; mic_di: string; mic_model: string; stand_type: string; notes: string
}

const effectiveInputs = computed<PreviewInput[]>(() => {
  const saved = rider.value?.inputs ?? []
  if (saved.length) return saved.map(r => ({ channel: r.channel, instrument: r.instrument, mic_di: r.mic_di, mic_model: r.mic_model, stand_type: r.stand_type, notes: r.notes }))
  const rows: PreviewInput[] = []
  let ch = 1
  for (const item of stagePlot.value) {
    for (const inp of item.inputs) {
      rows.push({ channel: ch++, instrument: inp.instrument, mic_di: inp.mic_di, mic_model: inp.mic_model, stand_type: inp.stand_type, notes: inp.notes })
    }
  }
  return rows
})

interface PreviewMonitor { label: string; type: string; mix_description: string; iem: boolean; model: string; freq: string }

const effectiveMonitors = computed<PreviewMonitor[]>(() => {
  const saved = rider.value?.monitors ?? []
  if (saved.length) {
    return saved.map(m => ({
      label: m.custom_name || memberDisplayName(stagePlot.value.find(i => i.band_member_id === m.band_member_id) ?? stagePlot.value[0]) || '',
      type:  m.type === 'iem' ? 'IEM' : 'Wedge',
      mix_description: m.mix_description,
      iem:   m.type === 'iem',
      model: m.transmitter_model,
      freq:  m.frequency,
    }))
  }
  const mixes: PreviewMonitor[] = []
  for (const item of stagePlot.value) {
    for (const mon of item.monitors) {
      mixes.push({
        label: `${memberDisplayName(item)}${mon.label ? ` — ${mon.label}` : ''}`,
        type:  mon.type === 'iem' ? 'IEM' : 'Wedge',
        mix_description: mon.mix_description,
        iem:   mon.type === 'iem',
        model: mon.iem_transmitter_model,
        freq:  mon.iem_frequency,
      })
    }
  }
  return mixes
})

// All wireless from all members + rider-level RF list
const allWireless = computed(() => {
  const rows: { name: string; type: string; model: string; band: string; own: boolean; notes: string }[] = []
  for (const item of stagePlot.value) {
    const name = memberDisplayName(item)
    for (const u of (item.wireless ?? [])) {
      rows.push({ name, type: u.type, model: u.brand_model, band: u.frequency_band, own: u.own_unit, notes: u.notes })
    }
  }
  return rows
})

// All backline from all members (needed=true) + rider-level backline
const allBackline = computed(() => {
  const rows: { name: string; category: string; brand: string; specs: string; notes: string }[] = []
  for (const item of stagePlot.value) {
    if (item.backline?.needed) {
      rows.push({
        name:     memberDisplayName(item),
        category: item.backline.category || '—',
        brand:    item.backline.brand_preference,
        specs:    item.backline.specs,
        notes:    item.backline.notes,
      })
    }
  }
  // Rider-level backline (from admin)
  for (const bl of backline.value) {
    rows.push({ name: bl.name, category: bl.category.replace(/_/g, ' '), brand: bl.brand_preference, specs: bl.specs, notes: bl.notes })
  }
  return rows
})

// Power from all members + rider-level power positions
const allPowerPositions = computed(() => {
  const rows: { location: string; outlets: number; notes: string }[] = []
  for (const item of stagePlot.value) {
    if ((item.power?.outlets_needed ?? 0) > 0) {
      rows.push({
        location: `${memberDisplayName(item)} — stage position`,
        outlets:  item.power.outlets_needed,
        notes:    item.power.notes,
      })
    }
  }
  for (const pos of (power.value?.positions ?? [])) {
    rows.push({ location: pos.location, outlets: pos.outlets_needed, notes: pos.notes })
  }
  return rows
})

// ── Stage SVG ─────────────────────────────────────────────────────────────────

// Colours used in the SVG stage diagram
const SVG_W   = 800
const SVG_H   = 450  // 16:9 ratio
const PAD     = 40   // inner padding from edge

function svgX(pct: number): number { return PAD + (pct / 100) * (SVG_W - PAD * 2) }
function svgY(pct: number): number { return PAD + (pct / 100) * (SVG_H - PAD * 2) }

function printPage() { window.print() }
</script>

<template>
  <div class="preview-root">
    <div v-if="loading" class="preview-loading">Loading tech rider…</div>
    <div v-else-if="error" class="preview-error">{{ error }}</div>

    <template v-else-if="rider">
      <!-- Screen toolbar -->
      <div class="print-toolbar no-print">
        <div class="toolbar-left">
          <span class="toolbar-badge">Tech Rider</span>
          <img v-if="logoUrl" :src="logoUrl" alt="" class="toolbar-logo" />
          <span class="toolbar-name">{{ rider.name }}</span>
        </div>
        <button type="button" class="toolbar-print-btn" @click="printPage">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Print / Save PDF
        </button>
      </div>

      <div class="document">

        <!-- ── Cover ──────────────────────────────────────────── -->
        <div class="cover-page page-break">
          <div class="cover-title">Technical Rider</div>
          <img
            v-if="logoUrl"
            :src="logoUrl"
            alt="Band logo"
            class="cover-logo"
          />
          <div class="cover-rider-name">{{ rider.name }}</div>
          <div class="cover-divider" />
          <div class="cover-meta">
            <div class="cover-meta-item">
              <span class="meta-label">Musicians</span>
              <span class="meta-value">{{ stagePlot.length }}</span>
            </div>
            <div class="cover-meta-item">
              <span class="meta-label">Total inputs</span>
              <span class="meta-value">{{ effectiveInputs.length }}</span>
            </div>
            <div class="cover-meta-item">
              <span class="meta-label">Status</span>
              <span class="meta-value">{{ rider.is_active ? 'Active' : 'Draft' }}</span>
            </div>
          </div>
        </div>

        <!-- ── Stage Plot Diagram ─────────────────────────────── -->
        <section v-if="stagePlot.length" class="section page-break">
          <h2 class="section-title">Stage Plot</h2>

          <div class="stage-diagram-wrap">
            <svg
              :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
              class="stage-svg"
              xmlns="http://www.w3.org/2000/svg"
            >
              <!-- Stage floor -->
              <rect x="0" y="0" :width="SVG_W" :height="SVG_H" class="svg-stage-bg" rx="8"/>
              <!-- Border -->
              <rect x="1" y="1" :width="SVG_W-2" :height="SVG_H-2" fill="none" class="svg-stage-border" rx="8"/>

              <!-- Stage back line -->
              <line :x1="PAD" :y1="PAD*0.8" :x2="SVG_W-PAD" :y2="PAD*0.8" class="svg-edge-line"/>
              <text :x="SVG_W/2" :y="PAD*0.55" text-anchor="middle" class="svg-edge-label">STAGE BACK</text>

              <!-- Audience line -->
              <line :x1="PAD" :y1="SVG_H-PAD*0.8" :x2="SVG_W-PAD" :y2="SVG_H-PAD*0.8" class="svg-edge-line"/>
              <text :x="SVG_W/2" :y="SVG_H-PAD*0.25" text-anchor="middle" class="svg-edge-label">▲ AUDIENCE ▲</text>

              <!-- Musicians -->
              <g v-for="(item, idx) in stagePlot" :key="item.id">
                <!-- Shadow -->
                <circle
                  :cx="svgX(item.x) + 1"
                  :cy="svgY(item.y) + 1"
                  r="26"
                  class="svg-member-shadow"
                />
                <!-- Circle -->
                <circle
                  :cx="svgX(item.x)"
                  :cy="svgY(item.y)"
                  r="26"
                  :class="item.temp_id ? 'svg-member-circle--guest' : 'svg-member-circle'"
                />
                <!-- Initials -->
                <text
                  :x="svgX(item.x)"
                  :y="svgY(item.y) + 5"
                  text-anchor="middle"
                  class="svg-member-initials"
                >{{ memberInitials(item) }}</text>
                <!-- Number badge -->
                <circle
                  :cx="svgX(item.x) + 19"
                  :cy="svgY(item.y) - 19"
                  r="10"
                  class="svg-badge-circle"
                />
                <text
                  :x="svgX(item.x) + 19"
                  :y="svgY(item.y) - 15"
                  text-anchor="middle"
                  class="svg-badge-text"
                >{{ idx + 1 }}</text>
                <!-- Name -->
                <text
                  :x="svgX(item.x)"
                  :y="svgY(item.y) + 42"
                  text-anchor="middle"
                  class="svg-member-name"
                >{{ memberDisplayName(item) }}</text>
                <!-- Instruments -->
                <text
                  :x="svgX(item.x)"
                  :y="svgY(item.y) + 55"
                  text-anchor="middle"
                  class="svg-member-role"
                >{{ item.instruments.map(i => i.label || INSTRUMENT_TYPE_LABELS[i.type]).join(' / ') }}</text>
              </g>
            </svg>
          </div>

          <!-- Musician index below diagram -->
          <div class="stage-index">
            <div v-for="(item, idx) in stagePlot" :key="item.id" class="stage-index-item">
              <span class="stage-index-num">{{ idx + 1 }}</span>
              <span class="stage-index-name">{{ memberDisplayName(item) }}</span>
              <span class="stage-index-role">{{ item.instruments.map(i => i.label || INSTRUMENT_TYPE_LABELS[i.type]).join(' · ') }}</span>
              <span v-if="item.temp_id" class="guest-badge">GUEST</span>
            </div>
          </div>
        </section>

        <!-- ── Per-Musician Configuration ────────────────────── -->
        <section v-if="stagePlot.length" class="section">
          <h2 class="section-title">Musician Configuration</h2>

          <div
            v-for="(item, idx) in stagePlot"
            :key="item.id"
            class="member-block"
          >
            <!-- Header -->
            <div class="member-header">
              <span class="member-number">{{ idx + 1 }}</span>
              <div class="member-header-info">
                <div class="member-name">{{ memberDisplayName(item) }}</div>
                <div class="member-role-line">
                  {{ memberRole(item) }}
                  <span v-if="item.instruments.length">
                    — {{ item.instruments.map(i => i.label || INSTRUMENT_TYPE_LABELS[i.type]).join(', ') }}
                  </span>
                </div>
              </div>
              <span v-if="item.temp_id" class="guest-badge">GUEST</span>
              <span :class="isMemberItemComplete(item) ? 'status-complete' : 'status-incomplete'">
                {{ isMemberItemComplete(item) ? '✓ Complete' : '⚠ Incomplete' }}
              </span>
            </div>

            <!-- Signal chain / Inputs -->
            <div v-if="item.inputs.length" class="detail-section">
              <div class="detail-title">
                Signal chain / Inputs
                <span class="chain-badge">{{ item.signal_chain_type.replace(/_/g, ' ') }}</span>
              </div>
              <table class="data-table">
                <thead>
                  <tr><th>Ch</th><th>Instrument / Source</th><th>Mic / DI</th><th>Model</th><th>Stand</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in item.inputs" :key="row.id">
                    <td class="td-num">{{ row.channel }}</td>
                    <td>{{ row.instrument }}</td>
                    <td>{{ row.mic_di }}</td>
                    <td>{{ row.mic_model }}</td>
                    <td>{{ row.stand_type }}</td>
                    <td class="td-notes">{{ row.notes }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="detail-section detail-empty">No inputs configured</div>

            <!-- Monitors -->
            <div v-if="item.monitors.length" class="detail-section">
              <div class="detail-title">Monitor / IEM</div>
              <table class="data-table">
                <thead>
                  <tr><th>Type</th><th>Label</th><th>Config</th><th>Mix description</th><th>IEM model</th><th>Frequency</th></tr>
                </thead>
                <tbody>
                  <tr v-for="mon in item.monitors" :key="mon.id">
                    <td>{{ mon.type === 'iem' ? 'IEM' : 'Wedge' }}</td>
                    <td>{{ mon.label }}</td>
                    <td>{{ mon.config }}</td>
                    <td>{{ mon.mix_description || '—' }}</td>
                    <td>{{ mon.type === 'iem' ? (mon.iem_transmitter_model || '—') : '—' }}</td>
                    <td>{{ mon.type === 'iem' ? (mon.iem_frequency || '—') : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="detail-section detail-empty">No monitors configured</div>

            <!-- Wireless -->
            <div v-if="item.wireless?.length" class="detail-section">
              <div class="detail-title">Wireless</div>
              <table class="data-table">
                <thead>
                  <tr><th>Type</th><th>Brand / Model</th><th>Freq. band</th><th>Own unit</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(u, i) in item.wireless" :key="i">
                    <td>{{ u.type }}</td>
                    <td>{{ u.brand_model || '—' }}</td>
                    <td>{{ u.frequency_band || '—' }}</td>
                    <td>{{ u.own_unit ? 'Yes' : 'No' }}</td>
                    <td class="td-notes">{{ u.notes }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Backline -->
            <div v-if="item.backline?.needed" class="detail-section">
              <div class="detail-title">Backline required</div>
              <div class="kv-row">
                <span class="kv-key">Category</span><span class="kv-val">{{ item.backline.category || '—' }}</span>
                <span class="kv-key">Brand preference</span><span class="kv-val">{{ item.backline.brand_preference || '—' }}</span>
                <span class="kv-key">Specs</span><span class="kv-val">{{ item.backline.specs || '—' }}</span>
                <template v-if="item.backline.notes">
                  <span class="kv-key">Notes</span><span class="kv-val">{{ item.backline.notes }}</span>
                </template>
              </div>
            </div>

            <!-- Power -->
            <div v-if="(item.power?.outlets_needed ?? 0) > 0" class="detail-section">
              <div class="detail-title">Power</div>
              <div class="kv-row">
                <span class="kv-key">Outlets needed</span><span class="kv-val">{{ item.power.outlets_needed }}</span>
                <template v-if="item.power.notes">
                  <span class="kv-key">Notes</span><span class="kv-val">{{ item.power.notes }}</span>
                </template>
              </div>
            </div>

            <!-- FOH notes -->
            <div v-if="item.foh_notes" class="detail-section">
              <div class="detail-title">FOH notes</div>
              <p class="foh-notes">{{ item.foh_notes }}</p>
            </div>
          </div>
        </section>

        <!-- ── Consolidated Input List ────────────────────────── -->
        <section v-if="effectiveInputs.length" class="section page-break">
          <h2 class="section-title">Complete Input List</h2>
          <table class="data-table">
            <thead>
              <tr><th>Ch</th><th>Instrument / Source</th><th>Mic / DI</th><th>Model</th><th>Stand</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in effectiveInputs" :key="row.channel">
                <td class="td-num">{{ row.channel }}</td>
                <td>{{ row.instrument }}</td>
                <td>{{ row.mic_di }}</td>
                <td>{{ row.mic_model }}</td>
                <td>{{ row.stand_type }}</td>
                <td class="td-notes">{{ row.notes }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- ── Monitor Summary ────────────────────────────────── -->
        <section v-if="effectiveMonitors.length" class="section">
          <h2 class="section-title">Monitor / IEM Summary</h2>
          <table class="data-table">
            <thead>
              <tr><th>Musician</th><th>Type</th><th>Mix description</th><th>IEM model</th><th>Frequency</th></tr>
            </thead>
            <tbody>
              <tr v-for="(mon, i) in effectiveMonitors" :key="i">
                <td>{{ mon.label }}</td>
                <td>{{ mon.type }}</td>
                <td>{{ mon.mix_description || '—' }}</td>
                <td>{{ mon.iem ? (mon.model || '—') : '—' }}</td>
                <td>{{ mon.iem ? (mon.freq || '—') : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- ── Wireless Registry ──────────────────────────────── -->
        <section v-if="allWireless.length || rfWireless.length" class="section">
          <h2 class="section-title">RF / Wireless Registry</h2>
          <table class="data-table">
            <thead>
              <tr><th>Musician / Unit</th><th>Type</th><th>Brand / Model</th><th>Freq. band</th><th>Own</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr v-for="(u, i) in allWireless" :key="`m-${i}`">
                <td>{{ u.name }}</td>
                <td>{{ u.type }}</td>
                <td>{{ u.model || '—' }}</td>
                <td>{{ u.band || '—' }}</td>
                <td>{{ u.own ? 'Yes' : 'No' }}</td>
                <td class="td-notes">{{ u.notes }}</td>
              </tr>
              <!-- Rider-level RF wireless -->
              <tr v-for="unit in rfWireless" :key="unit.id">
                <td>{{ unit.type }}</td>
                <td>{{ unit.type }}</td>
                <td>{{ unit.model }}</td>
                <td>{{ unit.frequency_band }}</td>
                <td>—</td>
                <td>{{ unit.programmed_frequency }}{{ unit.notes ? ` · ${unit.notes}` : '' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- ── Backline ────────────────────────────────────────── -->
        <section v-if="allBackline.length" class="section">
          <h2 class="section-title">Backline Requirements</h2>
          <table class="data-table">
            <thead>
              <tr><th>Musician / Item</th><th>Category</th><th>Brand preference</th><th>Specs</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr v-for="(bl, i) in allBackline" :key="i">
                <td>{{ bl.name }}</td>
                <td>{{ bl.category }}</td>
                <td>{{ bl.brand || '—' }}</td>
                <td>{{ bl.specs || '—' }}</td>
                <td class="td-notes">{{ bl.notes }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- ── PA / FOH ────────────────────────────────────────── -->
        <section v-if="paFoh && (paFoh.room_coverage_notes || paFoh.console_preference || paFoh.brings_own_foh_engineer || paFoh.subwoofer_notes || paFoh.processing_notes)" class="section">
          <h2 class="section-title">PA / FOH Requirements</h2>
          <div class="kv-grid">
            <template v-if="paFoh.room_coverage_notes">
              <span class="kv-key">Room coverage</span><span class="kv-val">{{ paFoh.room_coverage_notes }}</span>
            </template>
            <template v-if="paFoh.subwoofer_notes">
              <span class="kv-key">Subwoofer</span><span class="kv-val">{{ paFoh.subwoofer_notes }}</span>
            </template>
            <template v-if="paFoh.processing_notes">
              <span class="kv-key">Processing</span><span class="kv-val">{{ paFoh.processing_notes }}</span>
            </template>
            <template v-if="paFoh.console_preference">
              <span class="kv-key">Console preference</span><span class="kv-val">{{ paFoh.console_preference }}</span>
            </template>
            <template v-if="paFoh.brings_own_foh_engineer">
              <span class="kv-key">FOH engineer</span>
              <span class="kv-val">{{ paFoh.foh_engineer_name || 'Band brings own engineer' }}</span>
            </template>
            <template v-if="paFoh.brings_show_file">
              <span class="kv-key">Show file</span>
              <span class="kv-val">Yes — format: {{ paFoh.show_file_format || 'TBD' }}</span>
            </template>
          </div>
        </section>

        <!-- ── Power ──────────────────────────────────────────── -->
        <section v-if="allPowerPositions.length" class="section">
          <h2 class="section-title">Power Requirements</h2>
          <table class="data-table">
            <thead><tr><th>Location / Musician</th><th>Outlets</th><th>Notes</th></tr></thead>
            <tbody>
              <tr v-for="(pos, i) in allPowerPositions" :key="i">
                <td>{{ pos.location }}</td>
                <td class="td-num">{{ pos.outlets }}</td>
                <td class="td-notes">{{ pos.notes }}</td>
              </tr>
              <tr v-if="power?.needs_clean_power" class="tr-highlight">
                <td colspan="3"><strong>Clean / isolated power required.</strong> {{ power.general_notes }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Footer -->
        <div class="doc-footer no-page-break">
          <p>Generated by BandMS · Tech Rider: <strong>{{ rider.name }}</strong></p>
        </div>

      </div><!-- /document -->
    </template>
  </div>
</template>

<style scoped>
/* ── Base ─────────────────────────────────────────────────── */
.preview-root { min-height: 100vh; background: #f8fafc; color: #0f172a; font-family: 'Georgia', serif; }
.preview-loading, .preview-error { display: flex; align-items: center; justify-content: center; height: 100vh; font-size: 1rem; color: #64748b; }
.preview-error { color: #dc2626; }

/* ── Screen toolbar ────────────────────────────────────────── */
.print-toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: #1e1b4b; border-bottom: 1px solid #312e81;
}
.toolbar-left { display: flex; align-items: center; gap: 1rem; }
.toolbar-badge { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.7rem; font-weight: 700; background: #312e81; color: #a5b4fc; text-transform: uppercase; letter-spacing: .05em; font-family: ui-sans-serif, system-ui, sans-serif; }
.toolbar-logo { height: 1.5rem; object-fit: contain; margin-right: 0.5rem; }
.toolbar-name { font-size: 0.9rem; font-weight: 600; color: #e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif; }
.toolbar-print-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 1.1rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; background: #4338ca; border: none; color: #fff; font-family: ui-sans-serif, system-ui, sans-serif; transition: background 150ms; }
.toolbar-print-btn:hover { background: #4f46e5; }

/* ── Document ──────────────────────────────────────────────── */
.document { max-width: 960px; margin: 0 auto; padding: 2rem 2rem 4rem; }

/* ── Cover ─────────────────────────────────────────────────── */
.cover-page { padding: 4rem 0 2rem; }
.cover-title { font-size: 0.75rem; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: .15em; margin-bottom: 0.5rem; font-family: ui-sans-serif, system-ui, sans-serif; }
.cover-logo { max-height: 3.5rem; max-width: 16rem; object-fit: contain; margin-bottom: 0.5rem; display: block; }
.cover-rider-name { font-size: 2.5rem; font-weight: 800; color: #0f172a; line-height: 1.15; }
.cover-divider { height: 3px; background: linear-gradient(90deg, #6366f1, transparent); margin: 1.5rem 0; }
.cover-meta { display: flex; gap: 2.5rem; }
.cover-meta-item { display: flex; flex-direction: column; gap: 0.25rem; }
.meta-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; font-family: ui-sans-serif, system-ui, sans-serif; }
.meta-value { font-size: 1rem; font-weight: 700; color: #1e1b4b; }

/* ── Sections ──────────────────────────────────────────────── */
.section { margin-bottom: 2.5rem; }
.section-title { font-size: 1rem; font-weight: 700; color: #1e1b4b; padding-bottom: 0.5rem; margin-bottom: 1rem; border-bottom: 2px solid #1e1b4b; text-transform: uppercase; letter-spacing: .04em; font-family: ui-sans-serif, system-ui, sans-serif; }

/* ── Stage diagram ─────────────────────────────────────────── */
.stage-diagram-wrap { border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden; margin-bottom: 1rem; background: #1a1f3a; }
.stage-svg { display: block; width: 100%; height: auto; }

/* SVG classes */
.svg-stage-bg { fill: #1a1f3a; }
.svg-stage-border { stroke: #2d3461; stroke-width: 2; }
.svg-edge-line { stroke: #3d4480; stroke-width: 1.5; stroke-dasharray: 6 3; }
.svg-edge-label { fill: #475569; font-size: 13px; font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 600; letter-spacing: 2px; }
.svg-member-shadow { fill: rgba(0,0,0,0.4); }
.svg-member-circle { fill: #3730a3; }
.svg-member-circle--guest { fill: #92400e; }
.svg-member-initials { fill: #fff; font-size: 16px; font-weight: 700; font-family: ui-sans-serif, system-ui, sans-serif; }
.svg-badge-circle { fill: #ef4444; }
.svg-badge-text { fill: #fff; font-size: 12px; font-weight: 700; font-family: ui-sans-serif, system-ui, sans-serif; }
.svg-member-name { fill: #e2e8f0; font-size: 11px; font-weight: 600; font-family: ui-sans-serif, system-ui, sans-serif; }
.svg-member-role { fill: #94a3b8; font-size: 9px; font-family: ui-sans-serif, system-ui, sans-serif; }

/* Stage index below diagram */
.stage-index { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.stage-index-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.35rem 0.7rem; font-family: ui-sans-serif, system-ui, sans-serif; }
.stage-index-num { width: 1.25rem; height: 1.25rem; border-radius: 50%; background: #1e1b4b; color: #fff; font-size: 0.65rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stage-index-name { font-weight: 600; color: #0f172a; }
.stage-index-role { color: #64748b; }

/* ── Member blocks ─────────────────────────────────────────── */
.member-block { border: 1px solid #e2e8f0; border-radius: 0.5rem; margin-bottom: 1.25rem; overflow: hidden; page-break-inside: avoid; }
.member-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #f1f5f9; border-bottom: 2px solid #1e1b4b; }
.member-number { width: 1.75rem; height: 1.75rem; border-radius: 50%; background: #1e1b4b; color: #fff; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
.member-header-info { flex: 1; min-width: 0; }
.member-name { font-size: 0.95rem; font-weight: 700; color: #0f172a; font-family: ui-sans-serif, system-ui, sans-serif; }
.member-role-line { font-size: 0.75rem; color: #64748b; margin-top: 0.1rem; }
.guest-badge { padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700; background: #fef3c7; color: #92400e; text-transform: uppercase; font-family: ui-sans-serif, system-ui, sans-serif; flex-shrink: 0; }
.status-complete { font-size: 0.7rem; color: #166534; font-weight: 600; flex-shrink: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
.status-incomplete { font-size: 0.7rem; color: #92400e; font-weight: 600; flex-shrink: 0; font-family: ui-sans-serif, system-ui, sans-serif; }

.detail-section { padding: 0.65rem 1rem; border-bottom: 1px solid #f1f5f9; }
.detail-section:last-child { border-bottom: none; }
.detail-title { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #475569; margin-bottom: 0.5rem; font-family: ui-sans-serif, system-ui, sans-serif; display: flex; align-items: center; gap: 0.5rem; }
.detail-empty { font-size: 0.8rem; color: #94a3b8; font-style: italic; padding: 0.5rem 1rem; }

.chain-badge { display: inline-block; font-size: 0.65rem; background: #ede9fe; color: #4338ca; padding: 0.1rem 0.5rem; border-radius: 3px; text-transform: none; font-weight: 600; letter-spacing: 0; }
.foh-notes { font-size: 0.85rem; color: #334155; line-height: 1.6; margin: 0; }

/* ── Tables ────────────────────────────────────────────────── */
.data-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.data-table th { text-align: left; padding: 0.4rem 0.5rem; background: #f1f5f9; color: #475569; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; border-bottom: 2px solid #e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif; }
.data-table td { padding: 0.35rem 0.5rem; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }
.data-table tr:last-child td { border-bottom: none; }
.data-table .tr-highlight td { background: #fefce8; font-size: 0.8rem; color: #713f12; }
.td-num { font-weight: 700; font-variant-numeric: tabular-nums; width: 2.5rem; text-align: center; font-family: ui-monospace, monospace; }
.td-notes { color: #64748b; font-size: 0.75rem; }

/* ── KV layouts ────────────────────────────────────────────── */
.kv-grid { display: grid; grid-template-columns: 14rem 1fr; gap: 0.5rem 1rem; }
.kv-row  { display: grid; grid-template-columns: 12rem 1fr; gap: 0.35rem 0.75rem; }
.kv-key { font-size: 0.75rem; font-weight: 600; color: #64748b; font-family: ui-sans-serif, system-ui, sans-serif; }
.kv-val { font-size: 0.85rem; color: #334155; }

/* ── Footer ─────────────────────────────────────────────────── */
.doc-footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #94a3b8; text-align: center; font-family: ui-sans-serif, system-ui, sans-serif; }

/* ── Print ──────────────────────────────────────────────────── */
@media print {
  .no-print { display: none !important; }
  .preview-root { background: white; }
  .document { max-width: none; padding: 0; }
  .page-break { page-break-after: always; }
  .no-page-break { page-break-inside: avoid; }
  .section { page-break-inside: avoid; }
  .member-block { page-break-inside: avoid; }

  /* Stage SVG: invert to black on white for print */
  .stage-diagram-wrap { background: #f8fafc !important; border-color: #cbd5e1 !important; }
  .svg-stage-bg { fill: #f8fafc !important; }
  .svg-stage-border { stroke: #cbd5e1 !important; }
  .svg-edge-line { stroke: #94a3b8 !important; }
  .svg-edge-label { fill: #64748b !important; }
  .svg-member-shadow { fill: rgba(0,0,0,0.08) !important; }
  .svg-member-circle { fill: #1e1b4b !important; }
  .svg-member-circle--guest { fill: #78350f !important; }
  .svg-member-name { fill: #0f172a !important; }
  .svg-member-role { fill: #475569 !important; }

  .section-title { color: black; border-bottom-color: black; }
  .member-header { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .data-table th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  body { font-size: 10pt; }
}
</style>
