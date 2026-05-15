<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAllMemberSetups } from '@/composables/useBandMemberSetups'
import type { InputRow } from '@/types/techRider'
import type { BandMemberSetup } from '@/types/bandMemberSetup'
import { CHAIN_META } from '@/utils/signalChainPresets'

interface Props {
  open: boolean
  existingCount: number   // how many inputs already in the rider (for append offset label)
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
  import: [rows: InputRow[]]
}>()

// ── Data ──────────────────────────────────────────────────────────────────────

const { data: groups, isPending, isError } = useAllMemberSetups()

// ── Selection ─────────────────────────────────────────────────────────────────

const selected = ref<Set<number>>(new Set())   // setup IDs

function toggle(id: number) {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}

function toggleAll(setupIds: number[]) {
  const s = new Set(selected.value)
  const allOn = setupIds.every(id => s.has(id))
  for (const id of setupIds) {
    allOn ? s.delete(id) : s.add(id)
  }
  selected.value = s
}

// ── Preview toggle ────────────────────────────────────────────────────────────

const expanded = ref<Set<number>>(new Set())

function toggleExpand(id: number) {
  const s = new Set(expanded.value)
  s.has(id) ? s.delete(id) : s.add(id)
  expanded.value = s
}

// ── Derived ───────────────────────────────────────────────────────────────────

const allSetups = computed<BandMemberSetup[]>(() => {
  if (!groups.value) return []
  return groups.value.flatMap(g => g.setups)
})

const selectedRows = computed<InputRow[]>(() => {
  return allSetups.value
    .filter(s => selected.value.has(s.id))
    .flatMap(s => s.inputs ?? [])
})

const totalSelectedChannels = computed(() => selectedRows.value.length)

// ── Import ────────────────────────────────────────────────────────────────────

function doImport() {
  emit('import', selectedRows.value)
  selected.value = new Set()
  emit('close')
}

function chainLabel(type: string) {
  return CHAIN_META[type as keyof typeof CHAIN_META]?.label ?? type
}
</script>

<template>
  <Teleport to="body">
    <Transition name="panel">
      <div v-if="open" class="panel-overlay" @mousedown.self="$emit('close')">
        <div class="panel">

          <!-- Header -->
          <div class="panel-header">
            <div>
              <div class="panel-title">Import from band members</div>
              <div class="panel-subtitle">Select setups to append to the inputs list</div>
            </div>
            <button type="button" class="close-btn" @click="$emit('close')">✕</button>
          </div>

          <!-- Body -->
          <div class="panel-body">

            <div v-if="isPending" class="panel-state">Loading member setups…</div>
            <div v-else-if="isError" class="panel-state panel-state--err">Failed to load setups</div>
            <div v-else-if="!groups?.length" class="panel-state">
              No member setups found. Add setups via Band Members → Stage Setups.
            </div>

            <div v-else class="groups-list">
              <div v-for="group in groups" :key="group.member_id" class="member-group">

                <!-- Group header -->
                <div class="group-header">
                  <div class="group-info">
                    <span class="group-name">{{ group.member_name }}</span>
                    <span v-if="group.member_role" class="group-role">{{ group.member_role }}</span>
                  </div>
                  <button
                    type="button"
                    class="select-all-btn"
                    @click="toggleAll(group.setups.map(s => s.id))"
                  >
                    {{ group.setups.every(s => selected.has(s.id)) ? 'Deselect all' : 'Select all' }}
                  </button>
                </div>

                <!-- Setups -->
                <div class="setups-list">
                  <div
                    v-for="setup in group.setups"
                    :key="setup.id"
                    class="setup-card"
                    :class="{ 'setup-card--selected': selected.has(setup.id) }"
                  >
                    <!-- Card header row -->
                    <div class="setup-card-row">
                      <label class="setup-check-label">
                        <input
                          type="checkbox"
                          class="setup-check"
                          :checked="selected.has(setup.id)"
                          @change="toggle(setup.id)"
                        />
                        <span class="setup-name">{{ setup.name }}</span>
                      </label>
                      <div class="setup-badges">
                        <span class="badge-chain">{{ chainLabel(setup.signal_chain_type) }}</span>
                        <span class="badge-ch">{{ setup.inputs?.length ?? 0 }} ch</span>
                        <button
                          type="button"
                          class="expand-btn"
                          :title="expanded.has(setup.id) ? 'Collapse' : 'Preview channels'"
                          @click="toggleExpand(setup.id)"
                        >
                          {{ expanded.has(setup.id) ? '▲' : '▼' }}
                        </button>
                      </div>
                    </div>

                    <!-- Expandable channel preview -->
                    <div v-if="expanded.has(setup.id) && setup.inputs?.length" class="channel-preview">
                      <div v-for="row in setup.inputs" :key="row.id" class="ch-preview-row">
                        <span class="ch-num">{{ row.channel }}</span>
                        <span class="ch-instr">{{ row.instrument || '—' }}</span>
                        <span class="ch-type" :class="`ch-type--${row.mic_di === 'Mic+DI' ? 'micdi' : row.mic_di.toLowerCase()}`">
                          {{ row.mic_di }}
                        </span>
                        <span v-if="row.mic_model" class="ch-model">{{ row.mic_model }}</span>
                      </div>
                    </div>
                    <div v-else-if="expanded.has(setup.id)" class="channel-preview channel-preview--empty">
                      No input channels defined in this setup.
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="panel-footer">
            <span v-if="totalSelectedChannels > 0" class="footer-info">
              {{ totalSelectedChannels }} channel{{ totalSelectedChannels === 1 ? '' : 's' }} selected
              <span v-if="existingCount > 0" class="footer-info--dim"> → will append after ch {{ existingCount }}</span>
            </span>
            <span v-else class="footer-info footer-info--dim">Select setups above to import</span>
            <div class="footer-actions">
              <button type="button" class="btn-ghost" @click="$emit('close')">Cancel</button>
              <button
                type="button"
                class="btn-import"
                :disabled="totalSelectedChannels === 0"
                @click="doImport"
              >
                Import {{ totalSelectedChannels > 0 ? totalSelectedChannels + ' ch' : '' }}
              </button>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Overlay + panel ──────────────────────────────────── */
.panel-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: flex; justify-content: flex-end;
}
.panel {
  width: min(42rem, 95vw);
  height: 100%;
  background: #070718;
  border-left: 1px solid #1e2040;
  display: flex; flex-direction: column;
  box-shadow: -1rem 0 3rem rgba(0,0,0,0.5);
}

/* Transition */
.panel-enter-active,
.panel-leave-active { transition: transform 260ms ease, opacity 200ms; }
.panel-enter-from,
.panel-leave-to     { transform: translateX(100%); opacity: 0; }

/* ── Header ───────────────────────────────────────────── */
.panel-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid #0f0f28;
  flex-shrink: 0;
}
.panel-title    { font-size: 0.975rem; font-weight: 700; color: #e2e8f0; }
.panel-subtitle { font-size: 0.75rem; color: #475569; margin-top: 0.2rem; }
.close-btn {
  background: none; border: none; cursor: pointer; color: #475569; font-size: 0.9rem;
  padding: 0.2rem 0.4rem; transition: color 120ms;
}
.close-btn:hover { color: #94a3b8; }

/* ── Body ─────────────────────────────────────────────── */
.panel-body { flex: 1; overflow-y: auto; padding: 1rem; }

.panel-state {
  padding: 2rem 1rem; text-align: center; font-size: 0.82rem; color: #475569; line-height: 1.6;
}
.panel-state--err { color: #f87171; }

/* ── Groups ───────────────────────────────────────────── */
.groups-list { display: flex; flex-direction: column; gap: 1.25rem; }
.member-group { display: flex; flex-direction: column; gap: 0.5rem; }

.group-header {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 0.3rem; border-bottom: 1px solid #0f0f28;
}
.group-info   { display: flex; align-items: baseline; gap: 0.5rem; }
.group-name   { font-size: 0.82rem; font-weight: 700; color: #e2e8f0; }
.group-role   { font-size: 0.7rem; color: #6366f1; }
.select-all-btn {
  font-size: 0.68rem; color: #475569; background: none; border: none; cursor: pointer;
  padding: 0.15rem 0.4rem; border-radius: 0.25rem; transition: color 100ms, background 100ms;
}
.select-all-btn:hover { color: #94a3b8; background: #0a0a1e; }

/* ── Setup cards ──────────────────────────────────────── */
.setups-list { display: flex; flex-direction: column; gap: 0.375rem; }
.setup-card {
  background: #0a0a1e; border: 1px solid #1a1a38; border-radius: 0.5rem;
  overflow: hidden; transition: border-color 120ms;
}
.setup-card--selected { border-color: #312e81; background: #0e0e26; }

.setup-card-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 0.75rem; gap: 0.625rem;
}

.setup-check-label {
  display: flex; align-items: center; gap: 0.5rem; cursor: pointer; flex: 1; min-width: 0;
}
.setup-check { accent-color: #4338ca; width: 0.9rem; height: 0.9rem; cursor: pointer; flex-shrink: 0; }
.setup-name  { font-size: 0.82rem; font-weight: 600; color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.setup-badges { display: flex; align-items: center; gap: 0.375rem; flex-shrink: 0; }
.badge-chain {
  font-size: 0.65rem; color: #818cf8; background: #1e1b4b; border-radius: 0.3rem;
  padding: 0.1rem 0.4rem; white-space: nowrap;
}
.badge-ch {
  font-size: 0.65rem; color: #475569; background: #0f0f28; border-radius: 0.3rem;
  padding: 0.1rem 0.4rem; white-space: nowrap;
}
.expand-btn {
  background: none; border: none; cursor: pointer; color: #334155; font-size: 0.55rem;
  padding: 0.2rem 0.3rem; transition: color 100ms;
}
.expand-btn:hover { color: #818cf8; }

/* Channel preview */
.channel-preview {
  border-top: 1px solid #0f0f28;
  padding: 0.5rem 0.75rem 0.625rem;
  display: flex; flex-direction: column; gap: 0.25rem;
}
.channel-preview--empty { color: #334155; font-size: 0.75rem; text-align: center; }

.ch-preview-row {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.75rem; padding: 0.1rem 0;
}
.ch-num   { font-weight: 700; color: #475569; min-width: 1.5rem; text-align: right; font-size: 0.7rem; }
.ch-instr { flex: 1; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-type  { font-size: 0.65rem; font-weight: 600; padding: 0.05rem 0.35rem; border-radius: 0.25rem; white-space: nowrap; }
.ch-type--mic   { background: #1e1b4b; color: #818cf8; }
.ch-type--di    { background: #052e16; color: #34d399; }
.ch-type--micdi { background: #291d02; color: #f59e0b; }
.ch-model { font-size: 0.65rem; color: #475569; }

/* ── Footer ───────────────────────────────────────────── */
.panel-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.875rem 1.25rem; border-top: 1px solid #0f0f28;
  background: #070718; flex-shrink: 0;
  gap: 0.75rem; flex-wrap: wrap;
}
.footer-info { font-size: 0.8rem; color: #94a3b8; }
.footer-info--dim { color: #334155; }
.footer-actions { display: flex; gap: 0.5rem; margin-left: auto; }

.btn-ghost {
  padding: 0.4rem 0.875rem; border-radius: 0.4rem; font-size: 0.8rem; font-weight: 500;
  cursor: pointer; background: transparent; border: 1px solid #1e2040; color: #64748b;
  transition: background 100ms;
}
.btn-ghost:hover { background: #0a0a1e; }
.btn-import {
  padding: 0.4rem 1.1rem; border-radius: 0.4rem; font-size: 0.8rem; font-weight: 700;
  cursor: pointer; background: #4338ca; border: none; color: #fff;
  transition: background 150ms; min-width: 8rem;
}
.btn-import:hover:not(:disabled) { background: #4f46e5; }
.btn-import:disabled { opacity: 0.4; cursor: default; }
</style>
