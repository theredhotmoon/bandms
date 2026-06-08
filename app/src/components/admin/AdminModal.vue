<script setup lang="ts">
defineProps<{ title: string; open: boolean; maxWidth?: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay">
        <div class="modal-backdrop" @click="$emit('close')" />
        <div
          class="modal-panel"
          :style="`max-width:${maxWidth ?? '34rem'};`"
        >
          <div class="modal-header">
            <h2 class="modal-title">{{ title }}</h2>
            <button @click="$emit('close')" class="modal-close" aria-label="Close">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1rem;
  padding-top: 4rem;
  overflow-y: auto;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
}

.modal-panel {
  position: relative;
  z-index: 10;
  width: 100%;
  border-radius: 0.75rem;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  background: #141414;
  border: 1px solid #333333;
  margin: auto 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #252525;
}
.modal-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e2e8f0;
  margin: 0;
}
.modal-close {
  padding: 0.25rem;
  border-radius: 0.375rem;
  cursor: pointer;
  color: #475569;
  background: transparent;
  border: none;
  transition: background 120ms, color 120ms;
}
.modal-close:hover { background: #222222; color: #94a3b8; }

.modal-body { padding: 1.25rem 1.5rem 1.5rem; }

/* ── Transition ──────────────────────────────────── */
.modal-enter-active { transition: opacity 200ms ease-out; }
.modal-leave-active { transition: opacity 150ms ease-in; }
.modal-enter-from,
.modal-leave-to    { opacity: 0; }

.modal-enter-active .modal-panel {
  animation: panel-enter 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-leave-active .modal-panel {
  animation: panel-leave 150ms ease-in forwards;
}

@keyframes panel-enter {
  from { transform: translateY(14px) scale(0.97); opacity: 0; }
  to   { transform: translateY(0)    scale(1);    opacity: 1; }
}
@keyframes panel-leave {
  from { transform: translateY(0)   scale(1);    opacity: 1; }
  to   { transform: translateY(8px) scale(0.98); opacity: 0; }
}
</style>
