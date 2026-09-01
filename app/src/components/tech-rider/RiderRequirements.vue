<script setup lang="ts">
/**
 * Monitors, backline, power and RF on one page.
 *
 * Each list is derived from the placements and shown read-only with its source;
 * below each sits the editor for production-level extras. Four short lists read
 * better together than behind four tabs, and it makes the derived-plus-extras
 * pattern obvious by repetition.
 */
import RigMonitors from '@/components/rig/RigMonitors.vue'
import RigBackline from '@/components/rig/RigBackline.vue'
import RigWireless from '@/components/rig/RigWireless.vue'
import RiderSourceBadge from './RiderSourceBadge.vue'
import type { BacklineSpec, MonitorSpec, WirelessSpec } from '@bandms/rider-core'
import type { PowerNotes } from '@bandms/rider-core'
import type { ResolvedRider } from '@bandms/rider-core'

interface Props {
  resolved: ResolvedRider
  extraMonitors: MonitorSpec[]
  extraBackline: BacklineSpec[]
  extraWireless: WirelessSpec[]
  powerNotes: PowerNotes
}
defineProps<Props>()

const emit = defineEmits<{
  'update:extraMonitors': [value: MonitorSpec[]]
  'update:extraBackline': [value: BacklineSpec[]]
  'update:extraWireless': [value: WirelessSpec[]]
  'update:powerNotes': [value: PowerNotes]
  open: [placementId: string]
}>()

const BACKLINE_LABELS: Record<string, string> = {
  drum_kit: 'Drum kit',
  guitar_amp: 'Guitar amp',
  bass_amp: 'Bass amp',
  keyboard: 'Keyboard / keys',
  other: 'Other',
}
</script>

<template>
  <div class="requirements">

    <!-- ── Monitors ──────────────────────────────────────────────────────── -->
    <section class="req-block">
      <header class="req-header">
        <h3 class="req-title">🔊 Monitors / IEM</h3>
        <span class="req-count">{{ resolved.monitors.length }} send{{ resolved.monitors.length === 1 ? '' : 's' }}</span>
      </header>

      <div v-if="!resolved.monitors.length" class="req-empty">
        No monitor sends yet — they come from each musician's saved rig.
      </div>
      <table v-else class="req-table">
        <thead>
          <tr>
            <th>#</th><th>Send</th><th>Type</th><th>Mix</th><th>RF</th><th>From</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(mon, idx) in resolved.monitors" :key="mon.key">
            <td class="cell-num">{{ idx + 1 }}</td>
            <td>{{ mon.label || '—' }}</td>
            <td>
              <span class="pill" :class="mon.type === 'iem' ? 'pill--iem' : 'pill--wedge'">
                {{ mon.type === 'iem' ? 'IEM' : 'Wedge' }} · {{ mon.config }}
              </span>
            </td>
            <td class="cell-dim">{{ mon.mix_description || '—' }}</td>
            <td class="cell-dim">
              <template v-if="mon.type === 'iem'">
                {{ mon.iem_transmitter_model || '—' }}
                <span v-if="mon.iem_frequency"> · {{ mon.iem_frequency }} MHz</span>
                <span v-if="!mon.iem_own_pack" class="need-tag">venue pack</span>
              </template>
              <template v-else>—</template>
            </td>
            <td><RiderSourceBadge :source="mon.source" clickable @open="emit('open', $event)" /></td>
          </tr>
        </tbody>
      </table>

      <details class="extras-fold">
        <summary>Extra monitor sends ({{ extraMonitors.length }})</summary>
        <RigMonitors
          :model-value="extraMonitors"
          @update:model-value="emit('update:extraMonitors', $event)"
        />
      </details>
    </section>

    <!-- ── Backline ──────────────────────────────────────────────────────── -->
    <section class="req-block">
      <header class="req-header">
        <h3 class="req-title">🥁 Backline required</h3>
        <span class="req-count">{{ resolved.backline.length }} item{{ resolved.backline.length === 1 ? '' : 's' }}</span>
      </header>

      <div v-if="!resolved.backline.length" class="req-empty">
        Nothing requested from the promoter — every musician brings their own.
      </div>
      <table v-else class="req-table">
        <thead>
          <tr><th>Item</th><th>Category</th><th>Brand</th><th>Specs</th><th>From</th></tr>
        </thead>
        <tbody>
          <tr v-for="item in resolved.backline" :key="item.key">
            <td>{{ item.name || '—' }}</td>
            <td class="cell-dim">{{ BACKLINE_LABELS[item.category] ?? item.category }}</td>
            <td class="cell-dim">{{ item.brand_preference || '—' }}</td>
            <td class="cell-dim">{{ item.specs || '—' }}</td>
            <td><RiderSourceBadge :source="item.source" clickable @open="emit('open', $event)" /></td>
          </tr>
        </tbody>
      </table>

      <details class="extras-fold">
        <summary>Extra backline ({{ extraBackline.length }})</summary>
        <RigBackline
          :model-value="extraBackline"
          @update:model-value="emit('update:extraBackline', $event)"
        />
      </details>
    </section>

    <!-- ── Power ─────────────────────────────────────────────────────────── -->
    <section class="req-block">
      <header class="req-header">
        <h3 class="req-title">⚡ Power</h3>
        <span class="req-count">{{ resolved.power.total_outlets }} outlets across {{ resolved.power.positions.length }} position{{ resolved.power.positions.length === 1 ? '' : 's' }}</span>
      </header>

      <div v-if="!resolved.power.positions.length" class="req-empty">
        No power positions — set outlet counts on each musician's rig.
      </div>
      <table v-else class="req-table">
        <thead>
          <tr><th>Position</th><th>Outlets</th><th>Notes</th><th>From</th></tr>
        </thead>
        <tbody>
          <tr v-for="pos in resolved.power.positions" :key="pos.key">
            <td>{{ pos.location }}</td>
            <td class="cell-num">{{ pos.outlets_needed }}</td>
            <td class="cell-dim">{{ pos.notes || '—' }}</td>
            <td><RiderSourceBadge :source="pos.source" clickable @open="emit('open', $event)" /></td>
          </tr>
        </tbody>
      </table>

      <div class="power-notes">
        <div class="field-group">
          <label class="field-label">Total wattage (optional)</label>
          <input
            :value="powerNotes.total_wattage ?? ''"
            type="number"
            min="0"
            class="field-input"
            placeholder="e.g. 3500"
            @input="emit('update:powerNotes', {
              ...powerNotes,
              total_wattage: ($event.target as HTMLInputElement).value === ''
                ? null
                : Number(($event.target as HTMLInputElement).value),
            })"
          />
        </div>
        <div class="field-group">
          <label class="field-label">Clean power</label>
          <label class="toggle-label">
            <input
              type="checkbox"
              class="toggle-input"
              :checked="powerNotes.needs_clean_power"
              @change="emit('update:powerNotes', {
                ...powerNotes,
                needs_clean_power: ($event.target as HTMLInputElement).checked,
              })"
            />
            <span class="toggle-text">Isolated / clean circuit required</span>
          </label>
        </div>
        <div class="field-group field-group--wide">
          <label class="field-label">General power notes</label>
          <input
            :value="powerNotes.general_notes"
            class="field-input"
            placeholder="e.g. separate circuit from lighting, 3× 16A on stage left"
            @input="emit('update:powerNotes', {
              ...powerNotes,
              general_notes: ($event.target as HTMLInputElement).value,
            })"
          />
        </div>
      </div>
    </section>

    <!-- ── RF ────────────────────────────────────────────────────────────── -->
    <section class="req-block">
      <header class="req-header">
        <h3 class="req-title">📡 RF / Wireless</h3>
        <span class="req-count">{{ resolved.wireless.length }} unit{{ resolved.wireless.length === 1 ? '' : 's' }}</span>
      </header>

      <div v-if="!resolved.wireless.length" class="req-empty">
        No wireless units on this rider.
      </div>
      <table v-else class="req-table">
        <thead>
          <tr><th>Type</th><th>Model</th><th>Band</th><th>Owner</th><th>Notes</th><th>From</th></tr>
        </thead>
        <tbody>
          <tr v-for="unit in resolved.wireless" :key="unit.key">
            <td>{{ unit.type }}</td>
            <td>{{ unit.brand_model || '—' }}</td>
            <td class="cell-dim">{{ unit.frequency_band || '—' }}</td>
            <td class="cell-dim">
              <span v-if="unit.own_unit">Band</span>
              <span v-else class="need-tag">venue</span>
            </td>
            <td class="cell-dim">{{ unit.notes || '—' }}</td>
            <td><RiderSourceBadge :source="unit.source" clickable @open="emit('open', $event)" /></td>
          </tr>
        </tbody>
      </table>

      <details class="extras-fold">
        <summary>Extra wireless units ({{ extraWireless.length }})</summary>
        <RigWireless
          :model-value="extraWireless"
          @update:model-value="emit('update:extraWireless', $event)"
        />
      </details>
    </section>
  </div>
</template>

<style scoped>
.requirements { display: flex; flex-direction: column; gap: 1.5rem; }

.req-block { display: flex; flex-direction: column; gap: 0.5rem; }
.req-header { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; }
.req-title { font-size: 0.875rem; font-weight: 700; color: #e2e8f0; }
.req-count { font-size: 0.7rem; color: #475569; }

.req-empty {
  padding: 1rem; font-size: 0.78rem; color: #334155; line-height: 1.6;
  border: 1px dashed #2a2a2a; border-radius: 0.5rem;
}

.req-table {
  width: 100%; border-collapse: collapse; font-size: 0.78rem;
  border: 1px solid #2a2a2a; border-radius: 0.5rem; overflow: hidden;
}
.req-table thead th {
  background: #070718; color: #475569; font-weight: 600; font-size: 0.68rem;
  text-transform: uppercase; letter-spacing: .05em; padding: 0.4rem 0.625rem;
  text-align: left; border-bottom: 1px solid #2a2a2a; white-space: nowrap;
}
.req-table tbody tr { border-bottom: 1px solid #0f0f28; }
.req-table tbody tr:last-child { border-bottom: none; }
.req-table td { padding: 0.4rem 0.625rem; background: #111111; color: #cbd5e1; vertical-align: middle; }
.req-table tbody tr:hover td { background: #0d0d28; }
.cell-num { font-weight: 700; color: #e2e8f0; width: 3rem; }
.cell-dim { color: #64748b; }

.pill { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.68rem; font-weight: 600; }
.pill--wedge { background: #0e2233; color: #7dd3fc; }
.pill--iem { background: #1a1230; color: #c4b5fd; }
.need-tag {
  display: inline-block; margin-left: 0.35rem; padding: 0.05rem 0.3rem;
  border-radius: 0.2rem; background: #2a1a06; color: #fbbf24; font-size: 0.62rem; font-weight: 600;
}

.extras-fold {
  border: 1px solid #1a1a1a; border-radius: 0.5rem; padding: 0.5rem 0.75rem; background: #0a0a0a;
}
.extras-fold summary {
  cursor: pointer; font-size: 0.72rem; font-weight: 600; color: #64748b; user-select: none;
}
.extras-fold summary:hover { color: #94a3b8; }
.extras-fold[open] summary { margin-bottom: 0.75rem; }

.power-notes { display: grid; grid-template-columns: auto auto; gap: 0.75rem 1.25rem; align-items: start; }
.field-group { display: flex; flex-direction: column; gap: 0.25rem; }
.field-group--wide { grid-column: 1 / -1; }
.field-label { font-size: 0.68rem; font-weight: 600; color: #7c8fa6; }
.field-input {
  padding: 0.35rem 0.55rem; border-radius: 0.35rem; border: 1px solid #2a2a2a;
  background: #0d0d0d; color: #e2e8f0; font-size: 0.78rem; outline: none; font-family: inherit;
  min-width: 10rem; width: 100%;
}
.field-input:focus { border-color: #5154e5; }
.field-input::placeholder { color: #1e2a40; }
.toggle-label { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; margin-top: 0.35rem; }
.toggle-input { accent-color: #888888; width: 0.9rem; height: 0.9rem; cursor: pointer; }
.toggle-text { font-size: 0.75rem; color: #94a3b8; }
</style>
