<script setup lang="ts">
/**
 * Dark/light toggle for the admin panel. A `role="switch"` button rather than
 * a <select>: there are exactly two states and "Light mode: on/off" reads
 * naturally to a screen reader.
 */
import { computed } from 'vue'
import { useAdminTheme } from '@/composables/useAdminTheme'

const { theme, toggleTheme } = useAdminTheme()
const isLight = computed(() => theme.value === 'light')
</script>

<template>
  <button
    type="button"
    role="switch"
    class="theme-switch"
    data-testid="admin-theme-switch"
    :aria-checked="isLight"
    @click="toggleTheme"
  >
    <svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
    <span class="theme-label">{{ $t('shell.theme.light') }}</span>
    <span class="track" aria-hidden="true"><span class="thumb" /></span>
  </button>
</template>

<style scoped>
.theme-switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 0.375rem;
  background: var(--c-141414);
  border: 1px solid var(--c-2a2a2a);
  color: var(--c-94a3b8);
  font-size: var(--fs-xs);
  cursor: pointer;
  text-align: left;
}
.theme-switch:hover { background: var(--c-1a1a1a); color: var(--c-e2e8f0); }
.theme-switch:focus-visible { outline: 2px solid var(--c-1f8f7a); outline-offset: 1px; }

.theme-icon { width: 0.875rem; height: 0.875rem; flex-shrink: 0; }
.theme-label { flex: 1; }

.track {
  position: relative;
  width: 1.75rem;
  height: 1rem;
  border-radius: 9999px;
  background: var(--c-2a2a2a);
  transition: background 150ms;
  flex-shrink: 0;
}
.thumb {
  position: absolute;
  top: 0.125rem;
  left: 0.125rem;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 9999px;
  background: var(--c-888888);
  transition: transform 150ms, background 150ms;
}
.theme-switch[aria-checked="true"] .track { background: var(--c-1f8f7a); }
.theme-switch[aria-checked="true"] .thumb { transform: translateX(0.75rem); background: #fff; } /* token-lint-ignore: white thumb on the teal track in both themes */

@media (prefers-reduced-motion: reduce) {
  .track, .thumb { transition: none; }
}
</style>
