<script setup lang="ts">
/**
 * The channel list — derived, never stored.
 *
 * Rows come from the musicians' rigs; the engineer can reorder them and add
 * channels that belong to no musician (talkback, playback, a spare vocal).
 * Editing a musician's row is not possible here on purpose: it would be
 * ambiguous whether the change was for this gig or for their saved rig. The
 * source badge takes you to the placement, where that choice is explicit.
 */
import { computed } from 'vue'
import RigInputsTable from '@/components/rig/RigInputsTable.vue'
import RiderSourceBadge from './RiderSourceBadge.vue'
import type { InputRow } from '@/types/rig'
import type { ResolvedInput } from '@/utils/riderResolver'

interface Props {
  /** Every channel on the rider, already numbered and ordered. */
  rows: ResolvedInput[]
  extras: InputRow[]
  channelOrder: string[]
}
const props = defineProps<Props>()

const emit = defineEmits<{
  'update:extras': [value: InputRow[]]
  'update:channelOrder': [value: string[]]
  open: [placementId: string]
}>()

const counts = computed(() => {
  const mic = props.rows.filter((r) => r.mic_di === 'Mic').length
  const di = props.rows.filter((r) => r.mic_di === 'DI').length
  const both = props.rows.filter((r) => r.mic_di === 'Mic+DI').length
  return {
    total: props.rows.length,
    // A Mic+DI channel occupies two desk inputs.
    deskInputs: mic + di + both * 2,
    mic,
    di,
    both,
    fromMusicians: props.rows.filter((r) => r.source.kind !== 'extra').length,
    extras: props.rows.filter((r) => r.source.kind === 'extra').length,
  }
})

/** Reordering writes the full key order, so it survives added musicians. */
function move(index: number, dir: -1 | 1) {
  const target = index + dir
  if (target < 0 || target >= props.rows.length) return
  const keys = props.rows.map((r) => r.key)
  ;[keys[index], keys[target]] = [keys[target], keys[index]]
  emit('update:channelOrder', keys)
}

function resetOrder() {
  emit('update:channelOrder', [])
}
</script>

<template>
  <div class="channels">

    <!-- Summary -->
    <div class="stat-row">
      <div class="stat">
        <span class="stat-val">{{ counts.total }}</span>
        <span class="stat-label">channels</span>
      </div>
      <div class="stat">
        <span class="stat-val">{{ counts.deskInputs }}</span>
        <span class="stat-label">desk inputs</span>
      </div>
      <div class="stat stat--dim">
        <span class="stat-val">{{ counts.mic }}</span>
        <span class="stat-label">mic</span>
      </div>
      <div class="stat stat--dim">
        <span class="stat-val">{{ counts.di }}</span>
        <span class="stat-label">DI</span>
      </div>
      <div class="stat stat--dim">
        <span class="stat-val">{{ counts.both }}</span>
        <span class="stat-label">mic + DI</span>
      </div>
      <div class="stat-spacer" />
      <button v-if="channelOrder.length" type="button" class="btn-reset" @click="resetOrder">
        Reset to stage order
      </button>
    </div>

    <!-- Derived list -->
    <div class="table-scroll">
      <table class="chan-table">
        <thead>
          <tr>
            <th class="col-ch">#</th>
            <th class="col-instr">Instrument / source</th>
            <th class="col-micdi">Mic / DI</th>
            <th class="col-model">Model</th>
            <th class="col-stand">Stand</th>
            <th class="col-notes">Notes</th>
            <th class="col-from">From</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td colspan="7" class="empty-row">
              No channels yet. Place musicians on the stage plot — their saved rigs fill this in.
            </td>
          </tr>
          <tr v-for="(row, idx) in rows" :key="row.key" class="data-row">
            <td class="col-ch">
              <div class="ch-cell">
                <span class="ch-num">{{ row.channel }}</span>
                <div class="move-btns">
                  <button type="button" class="move-btn" title="Move up" @click="move(idx, -1)">▲</button>
                  <button type="button" class="move-btn" title="Move down" @click="move(idx, 1)">▼</button>
                </div>
              </div>
            </td>
            <td class="col-instr">{{ row.instrument || '—' }}</td>
            <td class="col-micdi">
              <span class="pill" :class="`pill--${row.mic_di.replace('+', '').toLowerCase()}`">{{ row.mic_di }}</span>
            </td>
            <td class="col-model">{{ row.mic_model || '—' }}</td>
            <td class="col-stand">{{ row.stand_type || '—' }}</td>
            <td class="col-notes">{{ row.notes || '—' }}</td>
            <td class="col-from">
              <RiderSourceBadge :source="row.source" clickable @open="emit('open', $event)" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Extras -->
    <div class="extras">
      <div class="extras-header">
        <span class="extras-title">Extra channels</span>
        <span class="extras-hint">
          Talkback, playback, spare vocal — anything that belongs to the production
          rather than to a musician.
        </span>
      </div>
      <RigInputsTable
        :model-value="extras"
        noun="extra channel"
        @update:model-value="emit('update:extras', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.channels { display: flex; flex-direction: column; gap: 1rem; }

.stat-row {
  display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;
  padding: 0.625rem 0.875rem; background: #0d0d0d;
  border: 1px solid #2a2a2a; border-radius: 0.5rem;
}
.stat { display: flex; align-items: baseline; gap: 0.35rem; }
.stat-val { font-size: 1.05rem; font-weight: 800; color: #e2e8f0; }
.stat-label { font-size: 0.68rem; color: #475569; text-transform: uppercase; letter-spacing: .04em; }
.stat--dim .stat-val { font-size: 0.85rem; color: #94a3b8; font-weight: 600; }
.stat-spacer { flex: 1; }
.btn-reset {
  padding: 0.25rem 0.6rem; border-radius: 0.3rem; font-size: 0.7rem; font-weight: 600;
  cursor: pointer; background: transparent; border: 1px solid #2a2a2a; color: #64748b;
}
.btn-reset:hover { border-color: #444444; color: #94a3b8; }

.table-scroll { overflow-x: auto; border-radius: 0.5rem; border: 1px solid #2a2a2a; }
.chan-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.chan-table thead th {
  background: #070718; color: #475569; font-weight: 600; font-size: 0.7rem;
  text-transform: uppercase; letter-spacing: .05em; padding: 0.5rem 0.625rem;
  text-align: left; border-bottom: 1px solid #2a2a2a; white-space: nowrap;
}
.data-row { border-bottom: 1px solid #0f0f28; }
.data-row:last-child { border-bottom: none; }
.data-row td { padding: 0.4rem 0.625rem; vertical-align: middle; background: #111111; color: #cbd5e1; }
.data-row:hover td { background: #0d0d28; }

.col-ch { width: 3.5rem; }
.col-instr { min-width: 12rem; }
.col-micdi { width: 6rem; }
.col-model { min-width: 8rem; }
.col-stand { width: 8rem; }
.col-notes { min-width: 9rem; color: #64748b; }
.col-from { width: 1%; white-space: nowrap; }

.ch-cell { display: flex; align-items: center; gap: 0.3rem; }
.ch-num { font-weight: 700; color: #e2e8f0; min-width: 1.4rem; text-align: center; }
.move-btns { display: flex; flex-direction: column; }
.move-btn {
  background: none; border: none; cursor: pointer; color: #334155;
  font-size: 0.55rem; padding: 0; line-height: 1; transition: color 100ms;
}
.move-btn:hover { color: #c0c0c0; }

.pill {
  display: inline-block; padding: 0.1rem 0.4rem; border-radius: 0.25rem;
  font-size: 0.68rem; font-weight: 600;
}
.pill--mic { background: #0e2233; color: #7dd3fc; }
.pill--di { background: #1a1230; color: #c4b5fd; }
.pill--micdi { background: #0e2a1a; color: #86efac; }

.empty-row { text-align: center; color: #334155; font-size: 0.8rem; padding: 2rem 1rem; line-height: 1.6; }

.extras { display: flex; flex-direction: column; gap: 0.5rem; }
.extras-header { display: flex; flex-direction: column; gap: 0.15rem; }
.extras-title { font-size: 0.78rem; font-weight: 700; color: #94a3b8; }
.extras-hint { font-size: 0.7rem; color: #475569; line-height: 1.5; }
</style>
