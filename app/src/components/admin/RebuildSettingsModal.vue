<script setup lang="ts">
import { useSiteRebuild } from '@/composables/useSiteRebuild'

const emit = defineEmits<{ close: [] }>()

const { autoRebuild, setAutoRebuild } = useSiteRebuild()
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-panel">
      <h2 class="modal-title">Rebuild settings</h2>

      <label class="auto-rebuild-toggle">
        <input
          type="checkbox"
          :checked="autoRebuild"
          :disabled="setAutoRebuild.isPending.value"
          @change="setAutoRebuild.mutate(!autoRebuild)"
        />
        Auto-rebuild on every change
      </label>

      <p class="modal-hint">
        When on, the public site rebuilds automatically after each save — the manual Rebuild button stays disabled.
      </p>

      <button type="button" class="btn-close" @click="emit('close')">Close</button>
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
  background: #161616;
  border: 1px solid #2a2a2a;
}

.modal-title {
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 1rem;
}

.auto-rebuild-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #d0d0d0;
  cursor: pointer;
}

.modal-hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #777777;
}

.btn-close {
  margin-top: 1.25rem;
  padding: 0.375rem 1rem;
  border-radius: 0.375rem;
  border: none;
  background: #2a2a2a;
  color: #e2e8f0;
  font-size: 0.8125rem;
  cursor: pointer;
}
.btn-close:hover {
  background: #333333;
}
</style>
