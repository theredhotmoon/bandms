<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchActiveTechRider, fetchTechRider } from '@/api/techRiders'
import type { TechRider } from '@/types/techRider'
import type { StagePlotMemberItem, GigTempMusician } from '@/types/stagePlot'
import { isMemberItemComplete } from '@/types/stagePlot'
import { INSTRUMENT_TYPE_LABELS } from '@/types/stagePlot'

const route  = useRoute()
const rider  = ref<TechRider | null>(null)
const loading = ref(true)
const error   = ref<string | null>(null)

onMounted(async () => {
  try {
    const idParam = route.params.id
    if (idParam) {
      const id = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10)
      rider.value = await fetchTechRider(id)
    } else {
      rider.value = await fetchActiveTechRider()
    }
  } catch {
    error.value = 'Could not load the tech rider. Please check that a rider is published.'
  } finally {
    loading.value = false
  }
})

const stagePlot  = computed(() => rider.value?.stage_plot_data ?? [])
const backline   = computed(() => rider.value?.backline ?? [])
const power      = computed(() => rider.value?.power ?? null)
const rfWireless = computed(() => rider.value?.rf_wireless ?? [])
const paFoh      = computed(() => rider.value?.pa_foh ?? null)

interface PreviewInput {
  channel: number
  instrument: string
  mic_di: string
  mic_model: string
  notes: string
}

interface PreviewMonitor {
  label: string
  type: string
  mix_description: string
}

// Normalise saved inputs or derive from stage plot member configs
const effectiveInputs = computed<PreviewInput[]>(() => {
  const saved = rider.value?.inputs ?? []
  if (saved.length) {
    return saved.map(r => ({
      channel:    r.channel,
      instrument: r.instrument,
      mic_di:     r.mic_di,
      mic_model:  r.mic_model,
      notes:      r.notes,
    }))
  }
  const rows: PreviewInput[] = []
  let ch = 1
  for (const item of stagePlot.value) {
    for (const inp of item.inputs) {
      rows.push({ channel: ch++, instrument: inp.instrument, mic_di: inp.mic_di, mic_model: inp.mic_model, notes: inp.notes })
    }
  }
  return rows
})

// Normalise saved monitors or derive from stage plot member configs
const effectiveMonitors = computed<PreviewMonitor[]>(() => {
  const saved = rider.value?.monitors ?? []
  if (saved.length) {
    return saved.map(m => ({
      label:           m.custom_name || m.band_member_id?.toString() || '',
      type:            m.type === 'iem' ? 'IEM' : 'Wedge',
      mix_description: m.mix_description,
    }))
  }
  const mixes: PreviewMonitor[] = []
  for (const item of stagePlot.value) {
    for (const mon of item.monitors) {
      mixes.push({ label: mon.label, type: mon.type === 'iem' ? 'IEM' : 'Wedge', mix_description: mon.mix_description })
    }
  }
  return mixes
})

function memberDisplayName(item: StagePlotMemberItem): string {
  if (item.temp_id) {
    const t = rider.value?.gig_lineup?.temp_musicians?.find((m: GigTempMusician) => m.id === item.temp_id)
    return t ? t.name : 'Guest'
  }
  return `ID ${item.band_member_id}`
}

function printPage() {
  window.print()
}
</script>

<template>
  <div class="preview-root">
    <!-- Loading -->
    <div v-if="loading" class="preview-loading">Loading tech rider…</div>
    <div v-else-if="error" class="preview-error">{{ error }}</div>

    <template v-else-if="rider">
      <!-- Print toolbar (screen only) -->
      <div class="print-toolbar no-print">
        <div class="toolbar-left">
          <span class="toolbar-badge">Tech Rider Preview</span>
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

      <!-- Document -->
      <div class="document">

        <!-- Cover -->
        <div class="cover-page page-break">
          <div class="cover-header">
            <div class="cover-title">Technical Rider</div>
            <div class="cover-rider-name">{{ rider.name }}</div>
          </div>
          <div class="cover-divider" />
          <div class="cover-meta">
            <div class="cover-meta-item">
              <span class="meta-label">Document type</span>
              <span class="meta-value">Technical Rider</span>
            </div>
            <div class="cover-meta-item">
              <span class="meta-label">Status</span>
              <span class="meta-value">{{ rider.is_active ? 'Active' : 'Draft' }}</span>
            </div>
          </div>
        </div>

        <!-- Stage plot (member list) -->
        <section v-if="stagePlot.length" class="section page-break">
          <h2 class="section-title">Stage Plot — Musician Configuration</h2>
          <div
            v-for="(item, idx) in stagePlot"
            :key="item.id"
            class="member-block"
          >
            <div class="member-header">
              <span class="member-number">{{ idx + 1 }}</span>
              <div>
                <div class="member-name">{{ memberDisplayName(item) }}</div>
                <div class="member-position">Stage position {{ Math.round(item.x) }}% L, {{ Math.round(item.y) }}% D</div>
              </div>
              <span v-if="item.temp_id" class="guest-badge">GUEST</span>
              <span :class="isMemberItemComplete(item) ? 'status-complete' : 'status-incomplete'">
                {{ isMemberItemComplete(item) ? '✓ Complete' : '⚠ Incomplete' }}
              </span>
            </div>

            <!-- Instruments (visual list) -->
            <div v-if="item.instruments.length" class="detail-section">
              <div class="detail-title">Instruments</div>
              <div class="instrument-list">
                <span
                  v-for="inst in item.instruments"
                  :key="inst.id"
                  class="instrument-tag"
                >
                  <strong>{{ INSTRUMENT_TYPE_LABELS[inst.type] }}</strong>
                  <span v-if="inst.label"> — {{ inst.label }}</span>
                </span>
              </div>
            </div>

            <!-- Inputs (member level) -->
            <div v-if="item.inputs.length" class="detail-section">
              <div class="detail-title">
                Inputs
                <span class="instrument-chain">{{ item.signal_chain_type.replace(/_/g, ' ') }}</span>
              </div>
              <table class="inputs-table">
                <thead>
                  <tr><th>Ch</th><th>Instrument</th><th>Mic/DI</th><th>Model</th><th>Stand</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in item.inputs" :key="row.id">
                    <td>{{ row.channel }}</td>
                    <td>{{ row.instrument }}</td>
                    <td>{{ row.mic_di }}</td>
                    <td>{{ row.mic_model }}</td>
                    <td>{{ row.stand_type }}</td>
                    <td>{{ row.notes }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Monitors -->
            <div v-if="item.monitors.length" class="detail-section">
              <div class="detail-title">Monitor requirements</div>
              <div class="monitor-list">
                <div
                  v-for="mon in item.monitors"
                  :key="mon.id"
                  class="monitor-item"
                >
                  <span class="monitor-type">{{ mon.type === 'iem' ? '📡 IEM' : '🔊 Wedge' }}</span>
                  <span v-if="mon.label" class="monitor-label">{{ mon.label }}</span>
                  <span v-if="mon.mix_description" class="monitor-desc">— {{ mon.mix_description }}</span>
                  <span v-if="mon.type === 'iem' && mon.iem_transmitter_model" class="monitor-model">{{ mon.iem_transmitter_model }}</span>
                  <span v-if="mon.type === 'iem' && mon.iem_frequency" class="monitor-freq">{{ mon.iem_frequency }}</span>
                </div>
              </div>
            </div>

            <!-- FOH notes -->
            <div v-if="item.foh_notes" class="detail-section">
              <div class="detail-title">FOH notes</div>
              <p class="foh-notes">{{ item.foh_notes }}</p>
            </div>
          </div>
        </section>

        <!-- Inputs list (if explicitly filled out) -->
        <section v-if="effectiveInputs.length" class="section">
          <h2 class="section-title">Input List</h2>
          <table class="inputs-table">
            <thead>
              <tr><th>Ch</th><th>Instrument</th><th>Mic / DI</th><th>Model</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr v-for="row in effectiveInputs" :key="row.channel">
                <td>{{ row.channel }}</td>
                <td>{{ row.instrument }}</td>
                <td>{{ row.mic_di }}</td>
                <td>{{ row.mic_model }}</td>
                <td>{{ row.notes }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Monitors -->
        <section v-if="effectiveMonitors.length" class="section">
          <h2 class="section-title">Monitor / IEM Requirements</h2>
          <div class="monitor-grid">
            <div v-for="(mon, i) in effectiveMonitors" :key="i" class="monitor-card">
              <div class="monitor-card-type">{{ mon.type }}</div>
              <div class="monitor-card-label">{{ mon.label }}</div>
              <div v-if="mon.mix_description" class="monitor-card-desc">{{ mon.mix_description }}</div>
            </div>
          </div>
        </section>

        <!-- Backline -->
        <section v-if="backline.length" class="section">
          <h2 class="section-title">Backline Requirements</h2>
          <table class="inputs-table">
            <thead>
              <tr><th>Category</th><th>Item</th><th>Brand preference</th><th>Specs</th><th>Notes</th></tr>
            </thead>
            <tbody>
              <tr v-for="bl in backline" :key="bl.id">
                <td>{{ bl.category.replace(/_/g, ' ') }}</td>
                <td>{{ bl.name }}</td>
                <td>{{ bl.brand_preference }}</td>
                <td>{{ bl.specs }}</td>
                <td>{{ bl.notes }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- PA / FOH -->
        <section v-if="paFoh" class="section">
          <h2 class="section-title">PA / FOH Requirements</h2>
          <div class="kv-grid">
            <template v-if="paFoh.room_coverage_notes">
              <span class="kv-key">Room coverage</span><span class="kv-val">{{ paFoh.room_coverage_notes }}</span>
            </template>
            <template v-if="paFoh.console_preference">
              <span class="kv-key">Console preference</span><span class="kv-val">{{ paFoh.console_preference }}</span>
            </template>
            <template v-if="paFoh.brings_own_foh_engineer">
              <span class="kv-key">Engineer</span><span class="kv-val">{{ paFoh.foh_engineer_name || 'Brings own FOH engineer' }}</span>
            </template>
          </div>
        </section>

        <!-- Power -->
        <section v-if="power?.positions?.length" class="section">
          <h2 class="section-title">Power Requirements</h2>
          <table class="inputs-table">
            <thead><tr><th>Location</th><th>Outlets needed</th><th>Notes</th></tr></thead>
            <tbody>
              <tr v-for="pos in power.positions" :key="pos.id">
                <td>{{ pos.location }}</td>
                <td>{{ pos.outlets_needed }}</td>
                <td>{{ pos.notes }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- RF / Wireless -->
        <section v-if="rfWireless.length" class="section">
          <h2 class="section-title">RF / Wireless</h2>
          <table class="inputs-table">
            <thead><tr><th>Model</th><th>Type</th><th>Frequency band</th><th>Programmed frequency</th><th>Notes</th></tr></thead>
            <tbody>
              <tr v-for="unit in rfWireless" :key="unit.id">
                <td>{{ unit.model }}</td>
                <td>{{ unit.type }}</td>
                <td>{{ unit.frequency_band }}</td>
                <td>{{ unit.programmed_frequency }}</td>
                <td>{{ unit.notes }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Footer -->
        <div class="doc-footer">
          <p>Generated by BandMS · Tech Rider: {{ rider.name }}</p>
        </div>

      </div><!-- /document -->
    </template>
  </div>
</template>

<style scoped>
/* ── Base ─────────────────────────────────────────────────── */
.preview-root {
  min-height: 100vh;
  background: #f8fafc;
  color: #0f172a;
  font-family: 'Georgia', serif;
}

.preview-loading, .preview-error {
  display: flex; align-items: center; justify-content: center;
  height: 100vh; font-size: 1rem; color: #64748b;
}
.preview-error { color: #dc2626; }

/* ── Screen toolbar ────────────────────────────────────────── */
.print-toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: #1e1b4b; border-bottom: 1px solid #312e81;
}
.toolbar-left { display: flex; align-items: center; gap: 1rem; }
.toolbar-badge {
  padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.7rem; font-weight: 700;
  background: #312e81; color: #a5b4fc; text-transform: uppercase; letter-spacing: .05em;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.toolbar-name { font-size: 0.9rem; font-weight: 600; color: #e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif; }
.toolbar-print-btn {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.45rem 1.1rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
  font-family: ui-sans-serif, system-ui, sans-serif;
  transition: background 150ms;
}
.toolbar-print-btn:hover { background: #4f46e5; }

/* ── Document ──────────────────────────────────────────────── */
.document {
  max-width: 900px; margin: 0 auto; padding: 2rem 2rem 4rem;
}

/* ── Cover ─────────────────────────────────────────────────── */
.cover-page { padding: 4rem 0 2rem; }
.cover-header { margin-bottom: 1rem; }
.cover-title { font-size: 0.75rem; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: .15em; margin-bottom: 0.5rem; }
.cover-rider-name { font-size: 2.25rem; font-weight: 800; color: #0f172a; line-height: 1.2; }
.cover-divider { height: 3px; background: linear-gradient(90deg, #6366f1, transparent); margin: 1.5rem 0; }
.cover-meta { display: flex; gap: 2rem; }
.cover-meta-item { display: flex; flex-direction: column; gap: 0.25rem; }
.meta-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; }
.meta-value { font-size: 0.9rem; font-weight: 600; color: #334155; }

/* ── Sections ──────────────────────────────────────────────── */
.section { margin-bottom: 2rem; }
.section-title {
  font-size: 1.1rem; font-weight: 700; color: #1e1b4b;
  padding-bottom: 0.5rem; margin-bottom: 1rem;
  border-bottom: 2px solid #e2e8f0;
}

/* ── Member blocks ─────────────────────────────────────────── */
.member-block {
  border: 1px solid #e2e8f0; border-radius: 0.5rem; margin-bottom: 1rem; overflow: hidden;
}
.member-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1rem; background: #f1f5f9; border-bottom: 1px solid #e2e8f0;
}
.member-number {
  width: 1.5rem; height: 1.5rem; border-radius: 50%;
  background: #1e1b4b; color: #fff; font-size: 0.7rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.member-name { font-size: 0.9rem; font-weight: 700; color: #0f172a; }
.member-position { font-size: 0.7rem; color: #64748b; }
.guest-badge {
  padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700;
  background: #fef3c7; color: #92400e; text-transform: uppercase;
}
.status-complete { font-size: 0.7rem; color: #166534; font-weight: 600; margin-left: auto; }
.status-incomplete { font-size: 0.7rem; color: #92400e; font-weight: 600; margin-left: auto; }

.detail-section { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; }
.detail-section:last-child { border-bottom: none; }
.detail-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin-bottom: 0.5rem; }

.instrument-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.instrument-tag { font-size: 0.8rem; background: #f1f5f9; padding: 0.2rem 0.6rem; border-radius: 0.25rem; color: #334155; }
.instrument-chain { font-size: 0.7rem; background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 3px; color: #64748b; margin-left: 0.5rem; }

.monitor-list { display: flex; flex-direction: column; gap: 0.35rem; }
.monitor-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
.monitor-type { font-weight: 700; }
.monitor-label { color: #334155; }
.monitor-desc { color: #64748b; }
.monitor-model, .monitor-freq { font-size: 0.75rem; color: #94a3b8; }

.foh-notes { font-size: 0.85rem; color: #334155; line-height: 1.6; margin: 0; }

/* ── Tables ────────────────────────────────────────────────── */
.inputs-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.inputs-table th {
  text-align: left; padding: 0.4rem 0.5rem;
  background: #f1f5f9; color: #475569; font-size: 0.7rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: .05em;
  border-bottom: 2px solid #e2e8f0;
}
.inputs-table td {
  padding: 0.35rem 0.5rem; border-bottom: 1px solid #f1f5f9; color: #334155;
}
.inputs-table tr:last-child td { border-bottom: none; }

/* ── Monitor grid ──────────────────────────────────────────── */
.monitor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; }
.monitor-card { border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.75rem; }
.monitor-card-type { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #6366f1; margin-bottom: 0.25rem; }
.monitor-card-label { font-size: 0.875rem; font-weight: 600; color: #0f172a; }
.monitor-card-desc { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }

/* ── KV grid ────────────────────────────────────────────────── */
.kv-grid { display: grid; grid-template-columns: 12rem 1fr; gap: 0.5rem 1rem; }
.kv-key { font-size: 0.8rem; font-weight: 600; color: #64748b; align-self: start; }
.kv-val { font-size: 0.85rem; color: #334155; }

/* ── Footer ─────────────────────────────────────────────────── */
.doc-footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #94a3b8; text-align: center; }

/* ── Print ──────────────────────────────────────────────────── */
@media print {
  .no-print { display: none !important; }
  .preview-root { background: white; }
  .document { max-width: none; padding: 0; }
  .page-break { page-break-after: always; }
  .section { page-break-inside: avoid; }
  .member-block { page-break-inside: avoid; }
  body { font-size: 11pt; }
  .section-title { color: black; }
}
</style>
