<script setup lang="ts">
/**
 * The rig editor. One component, two callers:
 *
 *  - Band Members → Stage Setups, editing a saved rig in the library.
 *  - The stage plot, editing what a musician runs *at this gig*.
 *
 * It never decides where an edit is stored: it emits `change(field, value)` and
 * the caller writes that to the setup or to the placement's override patch.
 * That is what stops the two surfaces from growing separate behaviour again.
 */
import { computed, ref } from 'vue'
import RigSignalChain from './RigSignalChain.vue'
import RigMonitors from './RigMonitors.vue'
import RigBackline from './RigBackline.vue'
import RigPower from './RigPower.vue'
import RigWireless from './RigWireless.vue'
import type { Instrument } from '@/types/instrument'
import type {
  BacklineSpec,
  InputRow,
  MonitorSpec,
  PowerSpec,
  RigField,
  RigSpec,
  SignalChainType,
  WirelessSpec,
} from '@/types/rig'

interface Props {
  /** The rig as it currently resolves — inherited values already merged in. */
  modelValue: RigSpec
  /** 'library' edits a saved rig; 'placement' edits one gig's deviation from it. */
  mode?: 'library' | 'placement'
  /** Which fields this placement overrides. Ignored in library mode. */
  overridden?: RigField[]
  /** Name of the saved rig being inherited from, for the revert affordance. */
  baseName?: string | null
  instrument?: Instrument | null
  memberName?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'library',
  overridden: () => [],
  baseName: null,
  instrument: null,
  memberName: '',
})

const emit = defineEmits<{
  change: [field: RigField, value: unknown]
  /**
   * All fields of the active tab at once. One event, not one per field: the
   * caller rebuilds the override patch from its props, and those do not flush
   * between two synchronous emits — the second would be built from pre-first
   * state and reinstate what the first just removed.
   */
  reset: [fields: RigField[]]
}>()

type Tab = 'inputs' | 'monitors' | 'backline' | 'power' | 'wireless' | 'foh'

const TABS: { key: Tab; label: string; icon: string; fields: RigField[] }[] = [
  { key: 'inputs',   label: 'Inputs',   icon: '🎙️', fields: ['inputs', 'signal_chain_type'] },
  { key: 'monitors', label: 'Monitors', icon: '🔊', fields: ['monitors'] },
  { key: 'backline', label: 'Backline', icon: '🥁', fields: ['backline'] },
  { key: 'power',    label: 'Power',    icon: '⚡', fields: ['power'] },
  { key: 'wireless', label: 'Wireless', icon: '📡', fields: ['wireless'] },
  { key: 'foh',      label: 'FOH notes', icon: '🎛️', fields: ['foh_notes'] },
]

const activeTab = ref<Tab>('inputs')

const isPlacement = computed(() => props.mode === 'placement')

function tabOverridden(tab: Tab): boolean {
  if (!isPlacement.value) return false
  const def = TABS.find((t) => t.key === tab)
  return !!def?.fields.some((f) => props.overridden.includes(f))
}

const activeFields = computed<RigField[]>(
  () => TABS.find((t) => t.key === activeTab.value)?.fields ?? [],
)

const activeOverridden = computed(() => tabOverridden(activeTab.value))

function revertActive() {
  emit('reset', [...activeFields.value])
}
</script>

<template>
  <div class="rig-editor">
    <div class="rig-tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        class="rig-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        {{ tab.label }}
        <span v-if="tabOverridden(tab.key)" class="override-dot" title="Changed for this gig" />
      </button>
    </div>

    <div class="rig-body">
      <div v-if="isPlacement" class="inherit-bar" :class="{ 'inherit-bar--changed': activeOverridden }">
        <template v-if="activeOverridden">
          <span class="inherit-text">
            Changed for this gig{{ baseName ? ` — differs from “${baseName}”` : '' }}
          </span>
          <button type="button" class="btn-revert" @click="revertActive">
            Revert to saved rig
          </button>
        </template>
        <span v-else class="inherit-text">
          {{ baseName ? `Inherited from “${baseName}”` : 'No saved rig linked — edits apply to this gig only' }}
        </span>
      </div>

      <RigSignalChain
        v-if="activeTab === 'inputs'"
        :model-value="modelValue.inputs"
        :chain-type="modelValue.signal_chain_type"
        :instrument="instrument"
        :member-name="memberName"
        @update:model-value="emit('change', 'inputs', $event as InputRow[])"
        @update:chain-type="emit('change', 'signal_chain_type', $event as SignalChainType)"
      />

      <RigMonitors
        v-else-if="activeTab === 'monitors'"
        :model-value="modelValue.monitors"
        @update:model-value="emit('change', 'monitors', $event as MonitorSpec[])"
      />

      <RigBackline
        v-else-if="activeTab === 'backline'"
        :model-value="modelValue.backline"
        @update:model-value="emit('change', 'backline', $event as BacklineSpec[])"
      />

      <RigPower
        v-else-if="activeTab === 'power'"
        :model-value="modelValue.power"
        @update:model-value="emit('change', 'power', $event as PowerSpec)"
      />

      <RigWireless
        v-else-if="activeTab === 'wireless'"
        :model-value="modelValue.wireless"
        @update:model-value="emit('change', 'wireless', $event as WirelessSpec[])"
      />

      <div v-else-if="activeTab === 'foh'" class="rig-section">
        <div class="rig-hint">
          Anything the FOH engineer should know that does not fit the other sections.
        </div>
        <textarea
          :value="modelValue.foh_notes"
          class="foh-textarea"
          rows="8"
          placeholder="e.g. heavy reverb on the last song, no compression on the lead vocal…"
          @input="emit('change', 'foh_notes', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped src="./rig-form.css" />
<style scoped>
.rig-editor { display: flex; flex-direction: column; min-height: 0; flex: 1; }

.rig-tabs {
  display: flex; gap: 0.125rem; overflow-x: auto; flex-shrink: 0;
  border-bottom: 1px solid #1a1a1a; scrollbar-width: none;
}
.rig-tabs::-webkit-scrollbar { display: none; }
.rig-tab {
  display: flex; align-items: center; gap: 0.3rem;
  padding: 0.45rem 0.8rem; font-size: 0.75rem; font-weight: 500; color: #475569;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; white-space: nowrap; margin-bottom: -1px;
  transition: color 120ms, border-color 120ms;
}
.rig-tab:hover { color: #64748b; }
.rig-tab.active { color: #d0d0d0; border-bottom-color: #888888; }
.tab-icon { font-size: 0.85rem; }

.override-dot {
  width: 0.4rem; height: 0.4rem; border-radius: 50%;
  background: #fbbf24; flex-shrink: 0;
}

.rig-body {
  flex: 1; min-height: 0; overflow-y: auto; padding: 0.875rem 0.125rem 0.25rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}

.inherit-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.4rem 0.75rem; border-radius: 0.375rem;
  background: #101010; border: 1px solid #222222;
}
.inherit-bar--changed { background: #1c1608; border-color: #4d3c10; }
.inherit-text { font-size: 0.72rem; color: #64748b; }
.inherit-bar--changed .inherit-text { color: #fbbf24; }
.btn-revert {
  padding: 0.2rem 0.6rem; border-radius: 0.3rem; font-size: 0.7rem; font-weight: 600;
  cursor: pointer; background: transparent; border: 1px solid #4d3c10; color: #fbbf24;
  white-space: nowrap; transition: background 100ms;
}
.btn-revert:hover { background: #2a2008; }

.foh-textarea {
  width: 100%; padding: 0.6rem 0.75rem; border-radius: 0.4rem;
  border: 1px solid #2a2a2a; background: #0d0d0d; color: #e2e8f0;
  font-size: 0.8rem; font-family: inherit; line-height: 1.6; outline: none;
  resize: vertical; transition: border-color 150ms;
}
.foh-textarea:focus { border-color: #5154e5; }
.foh-textarea::placeholder { color: #1e2a40; }
</style>
