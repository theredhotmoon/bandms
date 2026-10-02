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
import type { InputRow } from '@bandms/rider-core'
import type { ResolvedInput } from '@bandms/rider-core'

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
  const mic = props.rows.filter((r) => r.mic_di === 'Mic').length // i18n-ignore: persisted MicDiChoice
  const di = props.rows.filter((r) => r.mic_di === 'DI').length // i18n-ignore: persisted MicDiChoice
  const both = props.rows.filter((r) => r.mic_di === 'Mic+DI').length // i18n-ignore: persisted MicDiChoice
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
        <span class="stat-label">{{ $t('rider.channels.channels') }}</span>
      </div>
      <div class="stat">
        <span class="stat-val">{{ counts.deskInputs }}</span>
        <span class="stat-label">{{ $t('rider.channels.deskInputs') }}</span>
      </div>
      <div class="stat stat--dim">
        <span class="stat-val">{{ counts.mic }}</span>
        <span class="stat-label">{{ $t('rider.channels.mic') }}</span>
      </div>
      <div class="stat stat--dim">
        <span class="stat-val">{{ counts.di }}</span>
        <span class="stat-label">{{ $t('rider.channels.di') }}</span>
      </div>
      <div class="stat stat--dim">
        <span class="stat-val">{{ counts.both }}</span>
        <span class="stat-label">{{ $t('rider.channels.micDi') }}</span>
      </div>
      <div class="stat-spacer" />
      <button v-if="channelOrder.length" type="button" class="btn-reset" @click="resetOrder">
        {{ $t('rider.channels.resetOrder') }}
      </button>
    </div>

    <!-- Derived list -->
    <div class="table-scroll">
      <table class="chan-table">
        <thead>
          <tr>
            <th class="col-ch">#</th>
            <th class="col-instr">{{ $t('rider.channels.cols.instrument') }}</th>
            <th class="col-micdi">{{ $t('rider.channels.cols.micDi') }}</th>
            <th class="col-model">{{ $t('rider.channels.cols.model') }}</th>
            <th class="col-stand">{{ $t('rider.channels.cols.stand') }}</th>
            <th class="col-notes">{{ $t('rider.channels.cols.notes') }}</th>
            <th class="col-from">{{ $t('rider.channels.cols.from') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length">
            <td colspan="7" class="empty-row">
              {{ $t('rider.channels.empty') }}
            </td>
          </tr>
          <tr v-for="(row, idx) in rows" :key="row.key" class="data-row">
            <td class="col-ch">
              <div class="ch-cell">
                <span class="ch-num">{{ row.channel }}</span>
                <div class="move-btns">
                  <button type="button" class="move-btn" :title="$t('rider.channels.moveUp')" @click="move(idx, -1)">▲</button>
                  <button type="button" class="move-btn" :title="$t('rider.channels.moveDown')" @click="move(idx, 1)">▼</button>
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
        <span class="extras-title">{{ $t('rider.channels.extraTitle') }}</span>
        <span class="extras-hint">{{ $t('rider.channels.extraHint') }}</span>
      </div>
      <RigInputsTable
        :model-value="extras"
        noun="extraChannel"
        @update:model-value="emit('update:extras', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.channels { display: flex; flex-direction: column; gap: 1rem; }

.stat-row {
  display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;
  padding: 0.625rem 0.875rem; background: var(--c-0d0d0d);
  border: 1px solid var(--c-2a2a2a); border-radius: 0.5rem;
}
.stat { display: flex; align-items: baseline; gap: 0.35rem; }
.stat-val { font-size: var(--fs-lg); font-weight: 800; color: var(--c-e2e8f0); }
.stat-label { font-size: var(--fs-2xs); color: var(--c-475569); text-transform: uppercase; letter-spacing: .04em; }
.stat--dim .stat-val { font-size: var(--fs-base); color: var(--c-94a3b8); font-weight: 600; }
.stat-spacer { flex: 1; }
.btn-reset {
  padding: 0.25rem 0.6rem; border-radius: 0.3rem; font-size: var(--fs-2xs); font-weight: 600;
  cursor: pointer; background: transparent; border: 1px solid var(--c-2a2a2a); color: var(--c-64748b);
}
.btn-reset:hover { border-color: var(--c-444444); color: var(--c-94a3b8); }

.table-scroll { overflow-x: auto; border-radius: 0.5rem; border: 1px solid var(--c-2a2a2a); }
.chan-table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.chan-table thead th {
  background: var(--c-070718); color: var(--c-475569); font-weight: 600; font-size: var(--fs-2xs);
  text-transform: uppercase; letter-spacing: .05em; padding: 0.5rem 0.625rem;
  text-align: left; border-bottom: 1px solid var(--c-2a2a2a); white-space: nowrap;
}
.data-row { border-bottom: 1px solid var(--c-0f0f28); }
.data-row:last-child { border-bottom: none; }
.data-row td { padding: 0.4rem 0.625rem; vertical-align: middle; background: var(--c-111111); color: var(--c-cbd5e1); }
.data-row:hover td { background: var(--c-0d0d28); }

.col-ch { width: 3.5rem; }
.col-instr { min-width: 12rem; }
.col-micdi { width: 6rem; }
.col-model { min-width: 8rem; }
.col-stand { width: 8rem; }
.col-notes { min-width: 9rem; color: var(--c-64748b); }
.col-from { width: 1%; white-space: nowrap; }

.ch-cell { display: flex; align-items: center; gap: 0.3rem; }
.ch-num { font-weight: 700; color: var(--c-e2e8f0); min-width: 1.4rem; text-align: center; }
.move-btns { display: flex; flex-direction: column; }
.move-btn {
  background: none; border: none; cursor: pointer; color: var(--c-334155);
  font-size: var(--fs-2xs); padding: 0; line-height: 1; transition: color 100ms;
}
.move-btn:hover { color: var(--c-c0c0c0); }

.pill {
  display: inline-block; padding: 0.1rem 0.4rem; border-radius: 0.25rem;
  font-size: var(--fs-2xs); font-weight: 600;
}
.pill--mic { background: var(--c-0e2233); color: var(--c-7dd3fc); }
.pill--di { background: var(--c-1a1230); color: var(--c-c4b5fd); }
.pill--micdi { background: var(--c-0e2a1a); color: var(--c-86efac); }

.empty-row { text-align: center; color: var(--c-334155); font-size: var(--fs-sm); padding: 2rem 1rem; line-height: 1.6; }

.extras { display: flex; flex-direction: column; gap: 0.5rem; }
.extras-header { display: flex; flex-direction: column; gap: 0.15rem; }
.extras-title { font-size: var(--fs-xs); font-weight: 700; color: var(--c-94a3b8); }
.extras-hint { font-size: var(--fs-2xs); color: var(--c-475569); line-height: 1.5; }
</style>
