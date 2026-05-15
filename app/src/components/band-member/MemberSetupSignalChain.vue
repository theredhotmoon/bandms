<script setup lang="ts">
import { computed } from 'vue'
import TechRiderInputsTable from '@/components/tech-rider/TechRiderInputsTable.vue'
import type { SignalChainType } from '@/types/bandMemberSetup'
import type { InputRow } from '@/types/techRider'
import type { Instrument } from '@/types/instrument'
import {
  CHAIN_META,
  CHAIN_BY_CATEGORY,
  guessChainCategory,
  buildInputsFromChain,
} from '@/utils/signalChainPresets'

interface Props {
  modelValue: InputRow[]
  chainType: SignalChainType
  instrument: Instrument | null
  memberName: string
}

const props  = defineProps<Props>()
const emit   = defineEmits<{
  'update:modelValue': [value: InputRow[]]
  'update:chainType':  [value: SignalChainType]
}>()

// ── Available chain options filtered by instrument ────────────────────────────

const chainOptions = computed(() => {
  const cat = props.instrument
    ? guessChainCategory(props.instrument.name)
    : 'other'

  const primary = CHAIN_BY_CATEGORY[cat] ?? []
  const all     = Object.keys(CHAIN_META) as SignalChainType[]

  // Put instrument-specific ones first, then 'other' last, no duplicates
  const ordered = [
    ...primary,
    ...all.filter((k) => !primary.includes(k) && k !== 'other'),
    'other' as SignalChainType,
  ]

  return ordered.map((k) => ({ value: k, ...CHAIN_META[k] }))
})

const selectedMeta = computed(() => CHAIN_META[props.chainType])

// ── Build from chain type ─────────────────────────────────────────────────────

function buildInputs() {
  const instrName = props.instrument?.name ?? ''
  emit('update:modelValue', buildInputsFromChain(props.chainType, props.memberName, instrName))
}
</script>

<template>
  <div class="signal-chain-section">

    <!-- Chain type selector -->
    <div class="chain-selector">
      <label class="field-label">Signal chain / setup type</label>
      <select
        :value="chainType"
        class="chain-select"
        @change="emit('update:chainType', ($event.target as HTMLSelectElement).value as SignalChainType)"
      >
        <option v-for="opt in chainOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <p v-if="selectedMeta" class="chain-desc">{{ selectedMeta.description }}</p>
    </div>

    <!-- Build banner -->
    <div v-if="chainType !== 'other'" class="build-banner">
      <span class="build-icon">⚡</span>
      <div class="build-body">
        <span class="build-label">Auto-build inputs from signal chain</span>
        <span class="build-desc">
          Generates {{ selectedMeta.channels }} channel{{ selectedMeta.channels === 1 ? '' : 's' }}
          for "{{ selectedMeta.label }}"
        </span>
      </div>
      <button
        v-if="modelValue.length === 0"
        type="button"
        class="build-btn build-btn--go"
        @click="buildInputs"
      >Build →</button>
      <template v-else>
        <span class="build-warn">{{ modelValue.length }} existing rows</span>
        <button type="button" class="build-btn build-btn--replace" @click="buildInputs">
          Replace
        </button>
      </template>
    </div>

    <!-- Inputs table (reused from tech rider) -->
    <TechRiderInputsTable :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" />

  </div>
</template>

<style scoped>
.signal-chain-section { display: flex; flex-direction: column; gap: 0.75rem; }

.chain-selector { display: flex; flex-direction: column; gap: 0.3rem; }
.field-label { font-size: 0.75rem; font-weight: 600; color: #7c8fa6; }
.chain-select {
  width: 100%; max-width: 28rem; padding: 0.5rem 0.75rem;
  border-radius: 0.5rem; border: 1px solid #1e2040;
  background: #0e0e26; color: #e2e8f0; font-size: 0.875rem;
  outline: none; font-family: inherit;
  transition: border-color 150ms;
}
.chain-select:focus { border-color: #5154e5; }
.chain-select option { background: #0e0e26; }
.chain-desc { font-size: 0.72rem; color: #475569; margin-top: 0.15rem; }

/* Build banner */
.build-banner {
  display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap;
  padding: 0.55rem 0.875rem;
  background: #0a0c1e; border: 1px solid #2a2860; border-radius: 0.5rem;
  border-left: 3px solid #6366f1;
}
.build-icon  { font-size: 0.9rem; flex-shrink: 0; }
.build-body  { display: flex; flex-direction: column; gap: 0.1rem; flex: 1; min-width: 0; }
.build-label { font-size: 0.72rem; font-weight: 700; color: #a5b4fc; }
.build-desc  { font-size: 0.68rem; color: #475569; }
.build-warn  { font-size: 0.72rem; color: #64748b; white-space: nowrap; }

.build-btn {
  padding: 0.28rem 0.65rem; border-radius: 0.35rem; font-size: 0.72rem;
  font-weight: 600; cursor: pointer; border: 1px solid transparent;
  white-space: nowrap; transition: background 120ms;
}
.build-btn--go {
  background: #1e1b4b; border-color: #312e81; color: #a5b4fc;
}
.build-btn--go:hover { background: #252370; }
.build-btn--replace {
  background: #4338ca; border-color: #4338ca; color: #fff;
}
.build-btn--replace:hover { background: #4f46e5; }
</style>
