<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSiteRebuild } from '@/composables/useSiteRebuild'
import { rebuildAreaMessageKey } from '@/config/rebuildAreas'
import RebuildSettingsModal from './RebuildSettingsModal.vue'

const { isBuilding, autoRebuild, pendingAreas, rebuild } = useSiteRebuild()
const { t } = useI18n()

const showPending = ref(false)
const showSettings = ref(false)

// An area with no catalogue entry prints its raw key rather than a missing
// message — see rebuildAreaMessageKey.
function areaLabel(area: string): string {
  const key = rebuildAreaMessageKey(area)
  return key ? t(key) : area
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return t('common.time.justNow')
  if (minutes < 60) return t('common.time.minutesAgo', { n: minutes })
  return t('common.time.hoursAgo', { n: Math.floor(minutes / 60) })
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
        {{ $t('common.rebuild.pendingChanges', pendingAreas.length) }}
      </button>

      <div v-if="showPending && pendingAreas.length > 0" class="pending-popover">
        <div v-for="item in pendingAreas" :key="item.area" class="pending-row">
          <span>{{ areaLabel(item.area) }}</span>
          <span class="pending-time">{{ relativeTime(item.changedAt) }}</span>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="btn-rebuild"
      :disabled="isBuilding || autoRebuild || pendingAreas.length === 0"
      :title="autoRebuild ? $t('common.rebuild.autoActive') : $t('common.rebuild.rebuildTitle')"
      @click="rebuild.mutate()"
    >
      {{ isBuilding ? $t('common.rebuild.rebuilding') : $t('common.rebuild.rebuild') }}
    </button>

    <button type="button" class="btn-settings" :title="$t('common.rebuild.settingsTitle')" :aria-label="$t('common.rebuild.settingsTitle')" @click="showSettings = true">
      <svg class="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    </button>

    <!-- Teleported: the sticky bar is a z-index 30 stacking context, and a
         fixed modal left inside it renders under the top bar and drawer. -->
    <Teleport to="body">
      <RebuildSettingsModal v-if="showSettings" @close="showSettings = false" />
    </Teleport>
  </div>
</template>

<style scoped>
.rebuild-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1.25rem;
  border-bottom: 1px solid var(--c-222222);
  background: var(--c-111111);
  flex-shrink: 0;
  position: sticky;
  /* Under AdminLayout's fixed top bar; 0 where that bar is hidden. */
  top: var(--admin-topbar-h, 0px);
  z-index: 30;
}
@media (max-width: 1023px) {
  .rebuild-bar { padding-inline: 1rem; }
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
  color: var(--c-999999);
  font-size: var(--fs-xs);
  cursor: pointer;
}
.pending-toggle:disabled {
  cursor: default;
  opacity: 0.5;
}
.pending-toggle:not(:disabled):hover {
  background: var(--c-1a1a1a);
}

.pending-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  background: var(--c-14b8a6);
  color: #ffffff; /* token-lint-ignore: white count on the teal pill */
  font-size: var(--fs-2xs);
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
  background: var(--c-1a1a1a);
  border: 1px solid var(--c-2a2a2a);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 20;
}

.pending-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.25rem 0.375rem;
  font-size: var(--fs-xs);
  color: var(--c-d0d0d0);
}

.pending-time {
  color: var(--c-888888);
  font-variant-numeric: tabular-nums;
}

.btn-rebuild {
  padding: 0.375rem 1rem;
  border-radius: 0.5rem;
  border: none;
  background: var(--c-0d9488);
  color: #ffffff; /* token-lint-ignore: white label on the teal button */
  font-size: var(--fs-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms;
}
.btn-rebuild:hover:not(:disabled) {
  background: var(--c-14b8a6);
}
.btn-rebuild:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-settings {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  color: var(--c-999999);
  cursor: pointer;
}
.btn-settings:hover { color: var(--c-e2e8f0); background: var(--c-1a1a1a); }
.settings-icon { width: 1rem; height: 1rem; }
</style>
