<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchPublishedRider } from '@/api/techRiders'
import type { TechRider } from '@/types/techRider'
import type { BandMember } from '@/types/bandMember'
import type { TechRiderVersion } from '@/types/techRiderVersion'
import type { StagePlacement, GigTempMusician } from '@/types/stagePlot'
import { INSTRUMENT_TYPE_LABELS } from '@/types/stagePlot'
import { placementStatus, resolveRider, resolveRig } from '@/utils/riderResolver'
import { resolveStageInstruments, instrumentBadgesFor, BADGE_R } from '@/utils/stageInstruments'
import InstrumentIcon from '@/components/ui/InstrumentIcon.vue'

// ── Data loading ──────────────────────────────────────────────────────────────
//
// This page renders a *published version*, never the live rider — see
// App\Services\TechRiderSnapshotBuilder. The snapshot carries everything the
// sheet shows: the rider, the rigs its placements reference, the musicians
// placed on it, and the band's logo as it was at the time. So one request is
// enough, and nothing on the page can shift because someone edited a saved rig
// after the link was sent.

const route   = useRoute()
const rider   = ref<TechRider | null>(null)
const members = ref<BandMember[]>([])
const version = ref<TechRiderVersion | null>(null)
const logoUrl = ref<string | null>(null)
const loading = ref(true)
const error   = ref<string | null>(null)

onMounted(async () => {
  const token = Array.isArray(route.params.token) ? route.params.token[0] : route.params.token
  if (!token) {
    error.value = 'No rider token provided.'
    loading.value = false
    return
  }
  try {
    const published = await fetchPublishedRider(token)
    rider.value   = published.rider
    members.value = published.members ?? []
    version.value = published.version
    logoUrl.value = published.profile?.logo_url ?? null
  } catch {
    error.value = 'This rider link is invalid, or the rider has not been published yet.'
  } finally {
    loading.value = false
  }
})

/** Printed on the sheet so a venue can say which rider they are looking at. */
const versionLabel = computed(() => {
  if (!version.value) return ''
  const date = version.value.published_at
    ? new Date(version.value.published_at).toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : ''
  return date ? `v${version.value.version_number} · ${date}` : `v${version.value.version_number}`
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const stagePlot = computed<StagePlacement[]>(() => rider.value?.placements ?? [])
const paFoh = computed(() => rider.value?.pa_foh ?? null)

/**
 * The referenced setups ship with the rider, so this unauthenticated page
 * resolves placements with the same code as the admin editor rather than
 * relying on a server-side copy of the rules.
 */
const setups = computed(() =>
  Object.fromEntries(
    Object.entries(rider.value?.referenced_setups ?? {}).map(([id, s]) => [Number(id), s]),
  ),
)

const resolved = computed(() => {
  if (!rider.value) return null
  return resolveRider(rider.value, setups.value, members.value)
})

function rigFor(item: StagePlacement) {
  return resolveRig(item, setups.value)
}

function isComplete(item: StagePlacement): boolean {
  return placementStatus(item, setups.value, members.value, rider.value?.gig_lineup?.temp_musicians ?? []).complete
}

/**
 * Channel number for one of a musician's rows, taken from the master list so
 * the per-musician detail and the input list can never disagree.
 */
function channelOf(item: StagePlacement, rowId: string): number | string {
  return resolved.value?.inputs.find((r) => r.key === `${item.id}:${rowId}`)?.channel ?? '—'
}

function findMember(id: number | null): BandMember | null {
  if (!id) return null
  return members.value.find(m => m.id === id) ?? null
}

function memberDisplayName(item: StagePlacement): string {
  if (item.temp_id) {
    const t = rider.value?.gig_lineup?.temp_musicians?.find((m: GigTempMusician) => m.id === item.temp_id)
    return t ? t.name : 'Guest'
  }
  const m = findMember(item.band_member_id)
  if (m) return m.nickname ?? `${m.first_name} ${m.last_name}`
  return `Member #${item.band_member_id}`
}

function memberInitials(item: StagePlacement): string {
  if (item.temp_id) {
    const t = rider.value?.gig_lineup?.temp_musicians?.find((m: GigTempMusician) => m.id === item.temp_id)
    return (t?.name?.[0] ?? '?').toUpperCase()
  }
  const m = findMember(item.band_member_id)
  if (m) return `${m.first_name[0] ?? ''}${m.last_name[0] ?? ''}`.toUpperCase()
  return '?'
}

function memberRole(item: StagePlacement): string {
  if (item.temp_id) {
    const t = rider.value?.gig_lineup?.temp_musicians?.find((m: GigTempMusician) => m.id === item.temp_id)
    return t?.role || 'Guest'
  }
  return findMember(item.band_member_id)?.role ?? ''
}

// ── Printed lists ─────────────────────────────────────────────────────────────
// Derived by the shared resolver; the mapping below is presentation only.

const effectiveInputs = computed(() => resolved.value?.inputs ?? [])

const effectiveMonitors = computed(() =>
  (resolved.value?.monitors ?? []).map((m) => ({
    label: m.source.kind === 'extra' ? m.label : `${m.source.name}${m.label ? ` — ${m.label}` : ''}`,
    type: m.type === 'iem' ? 'IEM' : 'Wedge',
    mix_description: m.mix_description,
    iem: m.type === 'iem',
    model: m.iem_transmitter_model,
    freq: m.iem_frequency,
  })),
)

const allWireless = computed(() =>
  (resolved.value?.wireless ?? []).map((u) => ({
    name: u.source.name,
    type: u.type,
    model: u.brand_model,
    band: u.frequency_band,
    own: u.own_unit,
    notes: u.notes,
  })),
)

const allBackline = computed(() =>
  (resolved.value?.backline ?? []).map((b) => ({
    name: b.name || b.source.name,
    category: b.category.replace(/_/g, ' '),
    brand: b.brand_preference,
    specs: b.specs,
    notes: b.notes,
  })),
)

const allPowerPositions = computed(() =>
  (resolved.value?.power.positions ?? []).map((p) => ({
    location: p.location,
    outlets: p.outlets_needed,
    notes: p.notes,
  })),
)

const power = computed(() => resolved.value?.power ?? null)

// ── Stage SVG ─────────────────────────────────────────────────────────────────

const SVG_W = 800
const SVG_H = 450
const PAD   = 40

function svgX(pct: number): number { return PAD + (pct / 100) * (SVG_W - PAD * 2) }
function svgY(pct: number): number { return PAD + (pct / 100) * (SVG_H - PAD * 2) }

// Icon badges for a placed musician — one per instrument they play at this
// position (up to 3), arranged down the left side of the avatar circle.
function instrumentBadges(item: StagePlacement) {
  return instrumentBadgesFor(item, members.value)
}

// True when nothing was configured on this position and we are showing the
// member's profile instrument instead — the printed name is dimmed to match.
function isInferred(item: StagePlacement): boolean {
  return resolveStageInstruments(item, members.value).some(i => i.inferred)
}

// Instrument names shown under each musician, with the same profile fallback.
function instrumentNames(item: StagePlacement, sep: string): string {
  return resolveStageInstruments(item, members.value).map(i => i.label).join(sep)
}

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
          <div class="toolbar-info">
            <span class="toolbar-name">{{ rider.name }}</span>
            <span v-if="rider.concert" class="toolbar-concert">
              {{ rider.concert.date }} · {{ rider.concert.venue ?? '' }}
            </span>
            <span v-if="versionLabel" class="toolbar-version">{{ versionLabel }}</span>
          </div>
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
          <img v-if="logoUrl" :src="logoUrl" alt="Band logo" class="cover-logo" />
          <div class="cover-rider-name">{{ rider.name }}</div>
          <div v-if="rider.concert" class="cover-concert">
            {{ rider.concert.date }}
            <span v-if="rider.concert.venue"> · {{ rider.concert.venue }}</span>
          </div>
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
            <svg :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="stage-svg" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" :width="SVG_W" :height="SVG_H" class="svg-stage-bg" rx="8"/>
              <rect x="1" y="1" :width="SVG_W-2" :height="SVG_H-2" fill="none" class="svg-stage-border" rx="8"/>
              <line :x1="PAD" :y1="PAD*0.8" :x2="SVG_W-PAD" :y2="PAD*0.8" class="svg-edge-line"/>
              <text :x="SVG_W/2" :y="PAD*0.55" text-anchor="middle" class="svg-edge-label">STAGE BACK</text>
              <line :x1="PAD" :y1="SVG_H-PAD*0.8" :x2="SVG_W-PAD" :y2="SVG_H-PAD*0.8" class="svg-edge-line"/>
              <text :x="SVG_W/2" :y="SVG_H-PAD*0.25" text-anchor="middle" class="svg-edge-label">▲ AUDIENCE ▲</text>
              <g v-for="(item, idx) in stagePlot" :key="item.id">
                <circle :cx="svgX(item.x)+1" :cy="svgY(item.y)+1" r="26" class="svg-member-shadow"/>
                <circle :cx="svgX(item.x)" :cy="svgY(item.y)" r="26" :class="item.temp_id ? 'svg-member-circle--guest' : 'svg-member-circle'"/>
                <text :x="svgX(item.x)" :y="svgY(item.y)+5" text-anchor="middle" class="svg-member-initials">{{ memberInitials(item) }}</text>
                <circle :cx="svgX(item.x)+19" :cy="svgY(item.y)-19" r="10" class="svg-badge-circle"/>
                <text :x="svgX(item.x)+19" :y="svgY(item.y)-15" text-anchor="middle" class="svg-badge-text">{{ idx+1 }}</text>
                <template v-for="badge in instrumentBadges(item)" :key="badge.id">
                  <circle :cx="svgX(item.x)+badge.dx" :cy="svgY(item.y)+badge.dy" :r="BADGE_R" class="svg-instrument-badge"/>
                  <InstrumentIcon
                    :type="badge.type"
                    :size="20"
                    :x="svgX(item.x)+badge.dx-10"
                    :y="svgY(item.y)+badge.dy-10"
                    class="svg-instrument-icon"
                    :class="{ 'is-inferred': badge.inferred }"
                  />
                </template>
                <text :x="svgX(item.x)" :y="svgY(item.y)+42" text-anchor="middle" class="svg-member-name">{{ memberDisplayName(item) }}</text>
                <text :x="svgX(item.x)" :y="svgY(item.y)+55" text-anchor="middle" class="svg-member-role" :class="{ 'is-inferred': isInferred(item) }">{{ instrumentNames(item, ' / ') }}</text>
              </g>
            </svg>
          </div>
          <div class="stage-index">
            <div v-for="(item, idx) in stagePlot" :key="item.id" class="stage-index-item">
              <span class="stage-index-num">{{ idx+1 }}</span>
              <InstrumentIcon
                v-for="inst in instrumentBadges(item)"
                :key="inst.id"
                :type="inst.type"
                :size="18"
                class="stage-index-icon"
                :class="{ 'is-inferred': inst.inferred }"
              />
              <span class="stage-index-name">{{ memberDisplayName(item) }}</span>
              <span class="stage-index-role" :class="{ 'is-inferred': isInferred(item) }">{{ instrumentNames(item, ' · ') }}</span>
              <span v-if="item.temp_id" class="guest-badge">GUEST</span>
            </div>
          </div>
        </section>

        <!-- ── Per-Musician Configuration ────────────────────── -->
        <section v-if="stagePlot.length" class="section">
          <h2 class="section-title">Musician Configuration</h2>
          <div v-for="(item, idx) in stagePlot" :key="item.id" class="member-block">
            <div class="member-header">
              <span class="member-number">{{ idx+1 }}</span>
              <div class="member-header-info">
                <div class="member-name">{{ memberDisplayName(item) }}</div>
                <div class="member-role-line">
                  {{ memberRole(item) }}
                  <span v-if="item.instruments?.length"> — {{ (item.instruments ?? []).map(i => i.label || INSTRUMENT_TYPE_LABELS[i.type]).join(', ') }}</span>
                </div>
              </div>
              <span v-if="item.temp_id" class="guest-badge">GUEST</span>
              <span :class="isComplete(item) ? 'status-complete' : 'status-incomplete'">
                {{ isComplete(item) ? '✓ Complete' : '⚠ Incomplete' }}
              </span>
            </div>
            <div v-if="rigFor(item).inputs.length" class="detail-section">
              <div class="detail-title">Signal chain / Inputs <span class="chain-badge">{{ rigFor(item).signal_chain_type.replace(/_/g, ' ') }}</span></div>
              <table class="data-table">
                <thead><tr><th>Ch</th><th>Instrument / Source</th><th>Mic / DI</th><th>Model</th><th>Stand</th><th>Notes</th></tr></thead>
                <tbody>
                  <tr v-for="row in rigFor(item).inputs" :key="row.id">
                    <td class="td-num">{{ channelOf(item, row.id) }}</td><td>{{ row.instrument }}</td><td>{{ row.mic_di }}</td><td>{{ row.mic_model }}</td><td>{{ row.stand_type }}</td><td class="td-notes">{{ row.notes }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="detail-section detail-empty">No inputs configured</div>
            <div v-if="rigFor(item).monitors.length" class="detail-section">
              <div class="detail-title">Monitor / IEM</div>
              <table class="data-table">
                <thead><tr><th>Type</th><th>Label</th><th>Config</th><th>Mix description</th><th>IEM model</th><th>Frequency</th></tr></thead>
                <tbody>
                  <tr v-for="mon in rigFor(item).monitors" :key="mon.id">
                    <td>{{ mon.type === 'iem' ? 'IEM' : 'Wedge' }}</td><td>{{ mon.label }}</td><td>{{ mon.config }}</td><td>{{ mon.mix_description || '—' }}</td><td>{{ mon.type === 'iem' ? (mon.iem_transmitter_model||'—') : '—' }}</td><td>{{ mon.type === 'iem' ? (mon.iem_frequency||'—') : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="detail-section detail-empty">No monitors configured</div>
            <div v-if="rigFor(item).wireless.length" class="detail-section">
              <div class="detail-title">Wireless</div>
              <table class="data-table">
                <thead><tr><th>Type</th><th>Brand / Model</th><th>Freq. band</th><th>Own unit</th><th>Notes</th></tr></thead>
                <tbody>
                  <tr v-for="(u, i) in rigFor(item).wireless" :key="i">
                    <td>{{ u.type }}</td><td>{{ u.brand_model||'—' }}</td><td>{{ u.frequency_band||'—' }}</td><td>{{ u.own_unit ? 'Yes' : 'No' }}</td><td class="td-notes">{{ u.notes }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="rigFor(item).backline.some(b => b.needed)" class="detail-section">
              <div class="detail-title">Backline required</div>
              <div v-for="bl in rigFor(item).backline.filter(b => b.needed)" :key="bl.id" class="kv-row">
                <span class="kv-key">Item</span><span class="kv-val">{{ bl.name || bl.category.replace(/_/g, ' ') }}</span>
                <span class="kv-key">Brand preference</span><span class="kv-val">{{ bl.brand_preference||'—' }}</span>
                <span class="kv-key">Specs</span><span class="kv-val">{{ bl.specs||'—' }}</span>
                <template v-if="bl.notes"><span class="kv-key">Notes</span><span class="kv-val">{{ bl.notes }}</span></template>
              </div>
            </div>
            <div v-if="rigFor(item).power.outlets_needed > 0" class="detail-section">
              <div class="detail-title">Power</div>
              <div class="kv-row">
                <span class="kv-key">Outlets needed</span><span class="kv-val">{{ rigFor(item).power.outlets_needed }}</span>
                <template v-if="rigFor(item).power.notes"><span class="kv-key">Notes</span><span class="kv-val">{{ rigFor(item).power.notes }}</span></template>
              </div>
            </div>
            <div v-if="rigFor(item).foh_notes" class="detail-section">
              <div class="detail-title">FOH notes</div>
              <p class="foh-notes">{{ rigFor(item).foh_notes }}</p>
            </div>
          </div>
        </section>

        <!-- ── Consolidated Input List ────────────────────────── -->
        <section v-if="effectiveInputs.length" class="section page-break">
          <h2 class="section-title">Complete Input List</h2>
          <table class="data-table">
            <thead><tr><th>Ch</th><th>Instrument / Source</th><th>Mic / DI</th><th>Model</th><th>Stand</th><th>Notes</th></tr></thead>
            <tbody>
              <tr v-for="row in effectiveInputs" :key="row.key">
                <td class="td-num">{{ row.channel }}</td><td>{{ row.instrument }}</td><td>{{ row.mic_di }}</td><td>{{ row.mic_model }}</td><td>{{ row.stand_type }}</td><td class="td-notes">{{ row.notes }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- ── Monitor Summary ────────────────────────────────── -->
        <section v-if="effectiveMonitors.length" class="section">
          <h2 class="section-title">Monitor / IEM Summary</h2>
          <table class="data-table">
            <thead><tr><th>Musician</th><th>Type</th><th>Mix description</th><th>IEM model</th><th>Frequency</th></tr></thead>
            <tbody>
              <tr v-for="(mon, i) in effectiveMonitors" :key="i">
                <td>{{ mon.label }}</td><td>{{ mon.type }}</td><td>{{ mon.mix_description||'—' }}</td><td>{{ mon.iem ? (mon.model||'—') : '—' }}</td><td>{{ mon.iem ? (mon.freq||'—') : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- ── Wireless Registry ──────────────────────────────── -->
        <section v-if="allWireless.length" class="section">
          <h2 class="section-title">RF / Wireless Registry</h2>
          <table class="data-table">
            <thead><tr><th>Musician / Unit</th><th>Type</th><th>Brand / Model</th><th>Freq. band</th><th>Own</th><th>Notes</th></tr></thead>
            <tbody>
              <tr v-for="(u, i) in allWireless" :key="`m-${i}`">
                <td>{{ u.name }}</td><td>{{ u.type }}</td><td>{{ u.model||'—' }}</td><td>{{ u.band||'—' }}</td><td>{{ u.own ? 'Yes' : 'No' }}</td><td class="td-notes">{{ u.notes }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- ── Backline ────────────────────────────────────────── -->
        <section v-if="allBackline.length" class="section">
          <h2 class="section-title">Backline Requirements</h2>
          <table class="data-table">
            <thead><tr><th>Musician / Item</th><th>Category</th><th>Brand preference</th><th>Specs</th><th>Notes</th></tr></thead>
            <tbody>
              <tr v-for="(bl, i) in allBackline" :key="i">
                <td>{{ bl.name }}</td><td>{{ bl.category }}</td><td>{{ bl.brand||'—' }}</td><td>{{ bl.specs||'—' }}</td><td class="td-notes">{{ bl.notes }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- ── PA / FOH ────────────────────────────────────────── -->
        <section v-if="paFoh && (paFoh.room_coverage_notes || paFoh.console_preference || paFoh.brings_own_foh_engineer || paFoh.subwoofer_notes || paFoh.processing_notes)" class="section">
          <h2 class="section-title">PA / FOH Requirements</h2>
          <div class="kv-grid">
            <template v-if="paFoh.room_coverage_notes"><span class="kv-key">Room coverage</span><span class="kv-val">{{ paFoh.room_coverage_notes }}</span></template>
            <template v-if="paFoh.subwoofer_notes"><span class="kv-key">Subwoofer</span><span class="kv-val">{{ paFoh.subwoofer_notes }}</span></template>
            <template v-if="paFoh.processing_notes"><span class="kv-key">Processing</span><span class="kv-val">{{ paFoh.processing_notes }}</span></template>
            <template v-if="paFoh.console_preference"><span class="kv-key">Console preference</span><span class="kv-val">{{ paFoh.console_preference }}</span></template>
            <template v-if="paFoh.brings_own_foh_engineer"><span class="kv-key">FOH engineer</span><span class="kv-val">{{ paFoh.foh_engineer_name || 'Band brings own engineer' }}</span></template>
            <template v-if="paFoh.brings_show_file"><span class="kv-key">Show file</span><span class="kv-val">Yes — format: {{ paFoh.show_file_format || 'TBD' }}</span></template>
          </div>
        </section>

        <!-- ── Power ──────────────────────────────────────────── -->
        <section v-if="allPowerPositions.length" class="section">
          <h2 class="section-title">Power Requirements</h2>
          <table class="data-table">
            <thead><tr><th>Location / Musician</th><th>Outlets</th><th>Notes</th></tr></thead>
            <tbody>
              <tr v-for="(pos, i) in allPowerPositions" :key="i">
                <td>{{ pos.location }}</td><td class="td-num">{{ pos.outlets }}</td><td class="td-notes">{{ pos.notes }}</td>
              </tr>
              <tr v-if="power?.needs_clean_power" class="tr-highlight">
                <td colspan="3"><strong>Clean / isolated power required.</strong> {{ power.general_notes }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Footer -->
        <div class="doc-footer no-page-break">
          <p>
            Technical Rider — <strong>{{ rider.name }}</strong>
            <span v-if="versionLabel"> · {{ versionLabel }}</span>
          </p>
        </div>

      </div><!-- /document -->
    </template>
  </div>
</template>

<style scoped>
.preview-root { min-height: 100vh; background: #f8fafc; color: #0d0d0d; font-family: 'Georgia', serif; }

/* Which frozen copy this is — the venue's way of quoting it back to you. */
.toolbar-version {
  font-size: 0.7rem; color: #94a3b8; font-family: system-ui, sans-serif;
}
.preview-loading, .preview-error { display: flex; align-items: center; justify-content: center; height: 100vh; font-size: 1rem; color: #64748b; }
.preview-error { color: #dc2626; }

.print-toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: #2a2a2a; border-bottom: 1px solid #444444;
}
.toolbar-left { display: flex; align-items: center; gap: 1rem; }
.toolbar-badge { padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.7rem; font-weight: 700; background: #444444; color: #d0d0d0; text-transform: uppercase; letter-spacing: .05em; font-family: ui-sans-serif, system-ui, sans-serif; }
.toolbar-logo { height: 1.5rem; object-fit: contain; }
.toolbar-info { display: flex; flex-direction: column; gap: 0.1rem; }
.toolbar-name { font-size: 0.9rem; font-weight: 600; color: #e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif; }
.toolbar-concert { font-size: 0.72rem; color: #64748b; font-family: ui-sans-serif, system-ui, sans-serif; }
.toolbar-print-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 1.1rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; background: #e8e8e8; border: none; color: #111111; font-family: ui-sans-serif, system-ui, sans-serif; transition: background 150ms; }
.toolbar-print-btn:hover { background: #333333; }

.document { max-width: 960px; margin: 0 auto; padding: 2rem 2rem 4rem; }

.cover-page { padding: 4rem 0 2rem; }
.cover-title { font-size: 0.75rem; font-weight: 700; color: #888888; text-transform: uppercase; letter-spacing: .15em; margin-bottom: 0.5rem; font-family: ui-sans-serif, system-ui, sans-serif; }
.cover-logo { max-height: 3.5rem; max-width: 16rem; object-fit: contain; margin-bottom: 0.5rem; display: block; }
.cover-rider-name { font-size: 2.5rem; font-weight: 800; color: #0d0d0d; line-height: 1.15; }
.cover-concert { font-size: 1rem; color: #475569; margin-top: 0.35rem; font-family: ui-sans-serif, system-ui, sans-serif; }
.cover-divider { height: 3px; background: linear-gradient(90deg, #888888, transparent); margin: 1.5rem 0; }
.cover-meta { display: flex; gap: 2.5rem; }
.cover-meta-item { display: flex; flex-direction: column; gap: 0.25rem; }
.meta-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; font-family: ui-sans-serif, system-ui, sans-serif; }
.meta-value { font-size: 1rem; font-weight: 700; color: #2a2a2a; }

.section { margin-bottom: 2.5rem; }
.section-title { font-size: 1rem; font-weight: 700; color: #2a2a2a; padding-bottom: 0.5rem; margin-bottom: 1rem; border-bottom: 2px solid #2a2a2a; text-transform: uppercase; letter-spacing: .04em; font-family: ui-sans-serif, system-ui, sans-serif; }

.stage-diagram-wrap { border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden; margin-bottom: 1rem; background: #1a1a1a; }
.stage-svg { display: block; width: 100%; height: auto; }

.svg-stage-bg { fill: #1a1a1a; }
.svg-stage-border { stroke: #2a2a2a; stroke-width: 2; }
.svg-edge-line { stroke: #3d4480; stroke-width: 1.5; stroke-dasharray: 6 3; }
.svg-edge-label { fill: #475569; font-size: 13px; font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 600; letter-spacing: 2px; }
.svg-member-shadow { fill: rgba(0,0,0,0.4); }
.svg-member-circle { fill: #555555; }
.svg-member-circle--guest { fill: #92400e; }
.svg-member-initials { fill: #fff; font-size: 16px; font-weight: 700; font-family: ui-sans-serif, system-ui, sans-serif; }
.svg-badge-circle { fill: #ef4444; }
.svg-instrument-badge { fill: #1f2937; stroke: #4b5563; stroke-width: 1; }
.svg-instrument-icon { color: #e5e7eb; }
.stage-index-icon { color: #9ca3af; flex-shrink: 0; }
/* Taken from the member's profile rather than configured on this position */
.is-inferred { opacity: 0.55; }
.svg-badge-text { fill: #fff; font-size: 12px; font-weight: 700; font-family: ui-sans-serif, system-ui, sans-serif; }
.svg-member-name { fill: #e2e8f0; font-size: 11px; font-weight: 600; font-family: ui-sans-serif, system-ui, sans-serif; }
.svg-member-role { fill: #94a3b8; font-size: 9px; font-family: ui-sans-serif, system-ui, sans-serif; }

.stage-index { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.stage-index-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.375rem; padding: 0.35rem 0.7rem; font-family: ui-sans-serif, system-ui, sans-serif; }
.stage-index-num { width: 1.25rem; height: 1.25rem; border-radius: 50%; background: #2a2a2a; color: #fff; font-size: 0.65rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stage-index-name { font-weight: 600; color: #0d0d0d; }
.stage-index-role { color: #64748b; }

.member-block { border: 1px solid #e2e8f0; border-radius: 0.5rem; margin-bottom: 1.25rem; overflow: hidden; page-break-inside: avoid; }
.member-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #f1f5f9; border-bottom: 2px solid #2a2a2a; }
.member-number { width: 1.75rem; height: 1.75rem; border-radius: 50%; background: #2a2a2a; color: #fff; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
.member-header-info { flex: 1; min-width: 0; }
.member-name { font-size: 0.95rem; font-weight: 700; color: #0d0d0d; font-family: ui-sans-serif, system-ui, sans-serif; }
.member-role-line { font-size: 0.75rem; color: #64748b; margin-top: 0.1rem; }
.guest-badge { padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700; background: #fef3c7; color: #92400e; text-transform: uppercase; font-family: ui-sans-serif, system-ui, sans-serif; flex-shrink: 0; }
.status-complete { font-size: 0.7rem; color: #166534; font-weight: 600; flex-shrink: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
.status-incomplete { font-size: 0.7rem; color: #92400e; font-weight: 600; flex-shrink: 0; font-family: ui-sans-serif, system-ui, sans-serif; }

.detail-section { padding: 0.65rem 1rem; border-bottom: 1px solid #f1f5f9; }
.detail-section:last-child { border-bottom: none; }
.detail-title { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #475569; margin-bottom: 0.5rem; font-family: ui-sans-serif, system-ui, sans-serif; display: flex; align-items: center; gap: 0.5rem; }
.detail-empty { font-size: 0.8rem; color: #94a3b8; font-style: italic; padding: 0.5rem 1rem; }
.chain-badge { display: inline-block; font-size: 0.65rem; background: #f0f0f0; color: #888888; padding: 0.1rem 0.5rem; border-radius: 3px; text-transform: none; font-weight: 600; letter-spacing: 0; }
.foh-notes { font-size: 0.85rem; color: #334155; line-height: 1.6; margin: 0; }

.data-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.data-table th { text-align: left; padding: 0.4rem 0.5rem; background: #f1f5f9; color: #475569; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; border-bottom: 2px solid #e2e8f0; font-family: ui-sans-serif, system-ui, sans-serif; }
.data-table td { padding: 0.35rem 0.5rem; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: top; }
.data-table tr:last-child td { border-bottom: none; }
.data-table .tr-highlight td { background: #fefce8; font-size: 0.8rem; color: #713f12; }
.td-num { font-weight: 700; font-variant-numeric: tabular-nums; width: 2.5rem; text-align: center; font-family: ui-monospace, monospace; }
.td-notes { color: #64748b; font-size: 0.75rem; }

.kv-grid { display: grid; grid-template-columns: 14rem 1fr; gap: 0.5rem 1rem; }
.kv-row  { display: grid; grid-template-columns: 12rem 1fr; gap: 0.35rem 0.75rem; }
.kv-key { font-size: 0.75rem; font-weight: 600; color: #64748b; font-family: ui-sans-serif, system-ui, sans-serif; }
.kv-val { font-size: 0.85rem; color: #334155; }

.doc-footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #94a3b8; text-align: center; font-family: ui-sans-serif, system-ui, sans-serif; }

@media (max-width: 640px) {
  .document { padding: 1rem 1rem 3rem; }
  .cover-rider-name { font-size: 1.75rem; }
  .cover-meta { gap: 1.5rem; flex-wrap: wrap; }
  .kv-grid { grid-template-columns: 1fr; }
  .kv-row  { grid-template-columns: 1fr; }
  .data-table { font-size: 0.75rem; }
  .data-table th, .data-table td { padding: 0.3rem 0.35rem; }
}

@media print {
  .no-print { display: none !important; }
  .preview-root { background: white; }
  .document { max-width: none; padding: 0; }
  .page-break { page-break-after: always; }
  .no-page-break { page-break-inside: avoid; }
  .section { page-break-inside: avoid; }
  .member-block { page-break-inside: avoid; }
  .stage-diagram-wrap { background: #f8fafc !important; border-color: #cbd5e1 !important; }
  .svg-stage-bg { fill: #f8fafc !important; }
  .svg-stage-border { stroke: #cbd5e1 !important; }
  .svg-edge-line { stroke: #94a3b8 !important; }
  .svg-edge-label { fill: #64748b !important; }
  .svg-member-shadow { fill: rgba(0,0,0,0.08) !important; }
  .svg-member-circle { fill: #2a2a2a !important; }
  .svg-member-circle--guest { fill: #78350f !important; }
  .svg-member-name { fill: #0d0d0d !important; }
  .svg-member-role { fill: #475569 !important; }
  .section-title { color: black; border-bottom-color: black; }
  .member-header { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .data-table th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-size: 10pt; }
}
</style>
