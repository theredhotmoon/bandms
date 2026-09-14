<script setup lang="ts">
import { ref } from 'vue'
import { useSiteRebuild } from '@/composables/useSiteRebuild'
import { rebuildAreaLabel } from '@/config/rebuildAreas'
import RebuildSettingsModal from './RebuildSettingsModal.vue'

const { isBuilding, autoRebuild, pendingAreas, rebuild } = useSiteRebuild()

const showPending = ref(false)
const showSettings = ref(false)

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}
</script>

<template>
  <div class="rebuild-bar">
    <div class="rebuild-bar-pending">
      <button
        type="button"
        class="pending-toggle"
        :disabled="pendingAreas.length === 0"
        @click="showPending = !showPending"
      >
        <span class="pending-count">{{ pendingAreas.length }}</span>
        pending change{{ pendingAreas.length === 1 ? '' : 's' }}
      </button>

      <div v-if="showPending && pendingAreas.length > 0" class="pending-popover">
        <div v-for="item in pendingAreas" :key="item.area" class="pending-row">
          <span>{{ rebuildAreaLabel(item.area) }}</span>
          <span class="pending-time">{{ relativeTime(item.changedAt) }}</span>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="btn-rebuild"
      :disabled="isBuilding || autoRebuild || pendingAreas.length === 0"
      :title="autoRebuild ? 'Auto-rebuild is active — changes rebuild automatically' : 'Rebuild the public site'"
      @click="rebuild.mutate()"
    >
      {{ isBuilding ? 'Rebuilding…' : '↺ Rebuild Public Site' }}
    </button>

    <button type="button" class="btn-settings" title="Rebuild settings" @click="showSettings = true">
      ⚙
    </button>

    <RebuildSettingsModal v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.rebuild-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1.25rem;
  border-bottom: 1px solid #222222;
  background: #111111;
  flex-shrink: 0;
}

.rebuild-bar-pending {
  position: relative;
}

.pending-toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  color: #999999;
  font-size: 0.75rem;
  cursor: pointer;
}
.pending-toggle:disabled {
  cursor: default;
  opacity: 0.5;
}
.pending-toggle:not(:disabled):hover {
  background: #1a1a1a;
}

.pending-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  background: #14b8a6;
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 700;
}

.pending-popover {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  min-width: 12rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 20;
}

.pending-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.25rem 0.375rem;
  font-size: 0.75rem;
  color: #d0d0d0;
}

.pending-time {
  color: #666666;
}

.btn-rebuild {
  padding: 0.375rem 1rem;
  border-radius: 0.5rem;
  border: none;
  background: #0d9488;
  color: #ffffff;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms;
}
.btn-rebuild:hover:not(:disabled) {
  background: #14b8a6;
}
.btn-rebuild:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-settings {
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  color: #999999;
  cursor: pointer;
  font-size: 0.875rem;
}
.btn-settings:hover {
  background: #1a1a1a;
}
</style>
