<script setup lang="ts">
import { computed } from 'vue'
import type { InputRow } from '@/types/techRider'

const props = defineProps<{ modelValue: InputRow[] }>()

const rows  = computed(() => props.modelValue)
const total = computed(() => rows.value.length)

const mic   = computed(() => rows.value.filter(r => r.mic_di === 'Mic').length)
const di    = computed(() => rows.value.filter(r => r.mic_di === 'DI').length)
const micdi = computed(() => rows.value.filter(r => r.mic_di === 'Mic+DI').length)

function pct(n: number) {
  return total.value ? Math.round((n / total.value) * 100) : 0
}

// ── SVG donut ─────────────────────────────────────────────────────────────────

const R     = 30
const CX    = 40
const CY    = 40
const CIRC  = 2 * Math.PI * R

interface Seg { color: string; dash: string; offset: string; label: string; count: number }

const segments = computed<Seg[]>(() => {
  if (!total.value) return []
  const items = [
    { color: '#c0c0c0', count: mic.value,   label: 'Mic'    },
    { color: '#34d399', count: di.value,    label: 'DI'     },
    { color: '#f59e0b', count: micdi.value, label: 'Mic+DI' },
  ].filter(s => s.count > 0)

  let accOffset = 0
  return items.map(({ color, count, label }) => {
    const fraction = count / total.value
    const dash     = CIRC * fraction
    const offset   = -(accOffset * CIRC) + CIRC / 4  // start at top (90° offset)
    accOffset     += fraction
    return {
      color, label, count,
      dash:   `${dash} ${CIRC - dash}`,
      offset: `${offset}`,
    }
  })
})

// ── Model breakdown list ──────────────────────────────────────────────────────

interface ModelEntry { model: string; count: number }

const topModels = computed<ModelEntry[]>(() => {
  const counts: Record<string, number> = {}
  for (const r of rows.value) {
    const m = r.mic_model?.trim()
    if (m) counts[m] = (counts[m] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
})
</script>

<template>
  <div v-if="total > 0" class="dashboard">

    <!-- ── Stat cards ────────────────────────────────────────────────── -->
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-num">{{ total }}</div>
        <div class="stat-label">Total channels</div>
      </div>
      <div class="stat-card stat-card--mic">
        <div class="stat-num stat-num--mic">{{ mic }}</div>
        <div class="stat-label">🎙 Mic</div>
      </div>
      <div class="stat-card stat-card--di">
        <div class="stat-num stat-num--di">{{ di }}</div>
        <div class="stat-label">🔌 DI</div>
      </div>
      <div class="stat-card stat-card--micdi">
        <div class="stat-num stat-num--micdi">{{ micdi }}</div>
        <div class="stat-label">🎙🔌 Mic+DI</div>
      </div>
    </div>

    <!-- ── Charts row ────────────────────────────────────────────────── -->
    <div class="charts-row">

      <!-- Donut chart -->
      <div class="chart-panel">
        <div class="chart-title">Type distribution</div>
        <div class="donut-wrap">
          <svg :width="CX * 2" :height="CY * 2" viewBox="0 0 80 80">
            <!-- Background ring -->
            <circle
              :cx="CX" :cy="CY" :r="R"
              fill="none" stroke="#0f0f28" :stroke-width="10"
            />
            <!-- Segments -->
            <circle
              v-for="(seg, i) in segments"
              :key="i"
              :cx="CX" :cy="CY" :r="R"
              fill="none"
              :stroke="seg.color"
              :stroke-width="10"
              :stroke-dasharray="seg.dash"
              :stroke-dashoffset="seg.offset"
              stroke-linecap="butt"
            />
            <!-- Centre label -->
            <text x="40" y="37" text-anchor="middle" class="donut-total-num">{{ total }}</text>
            <text x="40" y="48" text-anchor="middle" class="donut-total-label">ch</text>
          </svg>
          <!-- Legend -->
          <div class="donut-legend">
            <div v-if="mic"   class="legend-row"><span class="legend-dot" style="background:#c0c0c0" />Mic <span class="legend-pct">{{ pct(mic) }}%</span></div>
            <div v-if="di"    class="legend-row"><span class="legend-dot" style="background:#34d399" />DI <span class="legend-pct">{{ pct(di) }}%</span></div>
            <div v-if="micdi" class="legend-row"><span class="legend-dot" style="background:#f59e0b" />Mic+DI <span class="legend-pct">{{ pct(micdi) }}%</span></div>
          </div>
        </div>
      </div>

      <!-- Channel grid -->
      <div class="chart-panel chart-panel--grow">
        <div class="chart-title">Channel map</div>
        <div class="ch-grid">
          <div
            v-for="row in rows"
            :key="row.id"
            class="ch-cell"
            :class="`ch-cell--${row.mic_di === 'Mic+DI' ? 'micdi' : row.mic_di.toLowerCase()}`"
            :title="`Ch ${row.channel}: ${row.instrument || '—'} (${row.mic_di}${row.mic_model ? ' · ' + row.mic_model : ''})`"
          >
            {{ row.channel }}
          </div>
        </div>
      </div>

      <!-- Model tally (only if there are models entered) -->
      <div v-if="topModels.length" class="chart-panel">
        <div class="chart-title">Mic / DI models</div>
        <div class="model-list">
          <div v-for="m in topModels" :key="m.model" class="model-row">
            <span class="model-name">{{ m.model }}</span>
            <span class="model-bar-wrap">
              <span class="model-bar" :style="`width:${(m.count / topModels[0].count) * 100}%`" />
            </span>
            <span class="model-count">{{ m.count }}</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex; flex-direction: column; gap: 0.875rem;
  background: #070718; border: 1px solid #222222; border-radius: 0.625rem;
  padding: 0.875rem; border-left: 3px solid #888888;
}

/* ── Stat row ─────────────────────────────────────────── */
.stat-row { display: flex; gap: 0.625rem; flex-wrap: wrap; }
.stat-card {
  display: flex; flex-direction: column; gap: 0.15rem;
  padding: 0.5rem 0.875rem; border-radius: 0.5rem;
  background: #111111; border: 1px solid #2a2a2a; min-width: 5.5rem;
}
.stat-num { font-size: 1.625rem; font-weight: 800; color: #e2e8f0; line-height: 1; }
.stat-num--mic   { color: #c0c0c0; }
.stat-num--di    { color: #34d399; }
.stat-num--micdi { color: #f59e0b; }
.stat-label { font-size: 0.67rem; color: #475569; font-weight: 500; white-space: nowrap; }
.stat-card--mic   { border-color: #c0c0c020; }
.stat-card--di    { border-color: #34d39920; }
.stat-card--micdi { border-color: #f59e0b20; }

/* ── Charts row ───────────────────────────────────────── */
.charts-row { display: flex; gap: 0.875rem; align-items: flex-start; flex-wrap: wrap; }
.chart-panel {
  background: #111111; border: 1px solid #2a2a2a; border-radius: 0.5rem;
  padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;
}
.chart-panel--grow { flex: 1; min-width: 0; }
.chart-title { font-size: 0.65rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .07em; }

/* Donut */
.donut-wrap { display: flex; align-items: center; gap: 0.875rem; }
.donut-total-num  { font-size: 14px; font-weight: 800; fill: #e2e8f0; }
.donut-total-label { font-size: 7px; fill: #475569; }

.donut-legend { display: flex; flex-direction: column; gap: 0.3rem; }
.legend-row { display: flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; color: #94a3b8; white-space: nowrap; }
.legend-dot { display: inline-block; width: 0.55rem; height: 0.55rem; border-radius: 50%; flex-shrink: 0; }
.legend-pct { color: #475569; margin-left: auto; padding-left: 0.5rem; }

/* Channel grid */
.ch-grid { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.ch-cell {
  width: 2rem; height: 2rem; border-radius: 0.3rem;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.65rem; font-weight: 700; cursor: default;
  border: 1px solid transparent;
  transition: transform 100ms;
}
.ch-cell:hover { transform: scale(1.15); z-index: 1; }
.ch-cell--mic   { background: #2a2a2a; color: #c0c0c0; border-color: #444444; }
.ch-cell--di    { background: #052e16; color: #34d399; border-color: #14532d; }
.ch-cell--micdi { background: #291d02; color: #f59e0b; border-color: #451a03; }

/* Model tally */
.model-list { display: flex; flex-direction: column; gap: 0.35rem; min-width: 9rem; }
.model-row { display: flex; align-items: center; gap: 0.5rem; }
.model-name { font-size: 0.72rem; color: #94a3b8; white-space: nowrap; min-width: 3.5rem; }
.model-bar-wrap { flex: 1; height: 0.35rem; background: #0f0f28; border-radius: 999px; overflow: hidden; }
.model-bar { display: block; height: 100%; background: #888888; border-radius: 999px; transition: width 400ms; }
.model-count { font-size: 0.65rem; color: #475569; min-width: 1rem; text-align: right; }
</style>
