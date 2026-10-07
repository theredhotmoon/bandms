<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = defineProps<{ title: string; open: boolean; maxWidth?: string }>()
const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const panel = ref<HTMLElement | null>(null)

// Escape closes, the same way the backdrop does — the consumer decides whether
// a dirty form needs a confirmation first, since both paths emit `close`.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) { // i18n-ignore: key name, not copy
    e.stopPropagation()
    emit('close')
  }
}

// Focus moves into the dialog on open and back to the opener on close, so a
// keyboard user is not left on a button behind the overlay.
let opener: Element | null = null

watch(() => props.open, async (open) => {
  if (open) {
    opener = document.activeElement
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    const first = panel.value?.querySelector<HTMLElement>(
      'input:not([type=hidden]), textarea, select, button:not(.modal-close)', // i18n-ignore: CSS selector
    )
    ;(first ?? panel.value)?.focus({ preventScroll: true })
  } else {
    document.removeEventListener('keydown', onKeydown)
    if (opener instanceof HTMLElement) opener.focus({ preventScroll: true })
    opener = null
  }
}, { immediate: true })

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay">
        <div class="modal-backdrop" @click="$emit('close')" />
        <div
          ref="panel"
          class="modal-panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          :style="`max-width:${maxWidth ?? '34rem'};`"
        >
          <div class="modal-header">
            <h2 :id="titleId" class="modal-title">{{ title }}</h2>
            <button type="button" @click="$emit('close')" class="modal-close" :aria-label="$t('common.actions.close')">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
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
/* The overlay is the scroll container and carries no padding of its own: the
   gutters are the panel's margins, so a sticky header or footer inside the
   panel pins flush to the viewport edge instead of a padding-width short. */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
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
  background: var(--c-141414);
  border: 1px solid var(--c-333333);
  margin: 4rem 1rem 1rem;
  width: calc(100% - 2rem);
  outline: none;
}

/* The overlay is the scroll container, so the header can pin to its top
   while a long form scrolls underneath — the title and close stay reachable
   however far down the body goes. */
.modal-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--c-252525);
  background: var(--c-141414);
  border-radius: 0.75rem 0.75rem 0 0;
}
.modal-title {
  font-size: var(--fs-base);
  font-weight: 600;
  color: var(--c-e2e8f0);
  margin: 0;
}
.modal-close {
  padding: 0.25rem;
  border-radius: 0.375rem;
  cursor: pointer;
  color: var(--c-475569);
  background: transparent;
  border: none;
  transition: background 120ms, color 120ms;
}
.modal-close:hover { background: var(--c-222222); color: var(--c-94a3b8); }

.modal-body { padding: 1.25rem 1.5rem 1.5rem; }

@media (max-width: 640px) {
  .modal-panel { margin: 1rem 0.5rem 0.5rem; width: calc(100% - 1rem); }
  .modal-header { padding: 0.875rem 1rem; }
  .modal-body { padding: 1rem 1rem 1.25rem; }
}

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

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active .modal-panel,
  .modal-leave-active .modal-panel { animation: none; }
}
</style>
