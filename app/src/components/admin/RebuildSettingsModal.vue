<script setup lang="ts">
import { useSiteRebuild } from '@/composables/useSiteRebuild'

const emit = defineEmits<{ close: [] }>()

const { autoRebuild, setAutoRebuild } = useSiteRebuild()
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-panel">
      <h2 class="modal-title">{{ $t('common.rebuild.settingsTitle') }}</h2>

      <label class="auto-rebuild-toggle">
        <input
          type="checkbox"
          :checked="autoRebuild"
          :disabled="setAutoRebuild.isPending.value"
          @change="setAutoRebuild.mutate(!autoRebuild)"
        />
        {{ $t('common.rebuild.autoToggle') }}
      </label>

      <p class="modal-hint">
        {{ $t('common.rebuild.autoHint') }}
      </p>

      <button type="button" class="btn-close" @click="emit('close')">{{ $t('common.actions.close') }}</button>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal-panel {
  width: 22rem;
  padding: 1.5rem;
  border-radius: 0.75rem;
  background: var(--c-161616);
  border: 1px solid var(--c-2a2a2a);
}

.modal-title {
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--c-e2e8f0);
  margin-bottom: 1rem;
}

.auto-rebuild-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--fs-base);
  color: var(--c-d0d0d0);
  cursor: pointer;
}

.modal-hint {
  margin-top: 0.5rem;
  font-size: var(--fs-xs);
  color: var(--c-777777);
}

.btn-close {
  margin-top: 1.25rem;
  padding: 0.375rem 1rem;
  border-radius: 0.375rem;
  border: none;
  background: var(--c-2a2a2a);
  color: var(--c-e2e8f0);
  font-size: var(--fs-sm);
  cursor: pointer;
}
.btn-close:hover {
  background: var(--c-333333);
}
</style>
