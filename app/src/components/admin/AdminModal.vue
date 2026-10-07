<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import { provideModalGuard } from '@/composables/useDirtyGuard'

/**
 * The discard guard: while the modal holds unsaved input, every way out
 * (backdrop, ✕, Escape, Cancel, or a consumer calling `requestClose()`) asks
 * before `close` is emitted.
 *
 * A form component inside the modal reports its state through
 * `useModalGuard()` (see useDirtyGuard.ts) and needs no wiring in the view.
 * A view whose form is inline in the modal body passes `dirty` itself.
 *
 * A modal with neither keeps the old behaviour — backdrop and ✕ close at
 * once — and gets **no** Escape key, deliberately: a modal that cannot say
 * whether it holds unsaved input must not gain a keystroke that throws it
 * away, and Escape is routinely pressed to dismiss a browser autocomplete or
 * an in-modal popover.
 */
// `dirty` is tri-state: undefined means "not declared by the view, ask the
// forms inside". Vue casts an absent Boolean prop to `false` unless a default
// is declared, which would make every modal look declared-and-clean.
const props = withDefaults(
  defineProps<{ title: string; open: boolean; maxWidth?: string; dirty?: boolean }>(),
  { dirty: undefined },
)
const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const panel = ref<HTMLElement | null>(null)
const header = ref<HTMLElement | null>(null)
const confirming = ref(false)

const guard = provideModalGuard(requestClose)
const isDirty = computed(() => props.dirty ?? guard.dirty.value)
const guarded = computed(() => props.dirty !== undefined || guard.registered.value)

// The header's rendered height is published on the panel as --modal-header-h
// so content that pins itself under the sticky header (PostForm's settings
// rail) can offset by the real value — a title that wraps, or a padding
// retune, changes it, and a hard-coded rem would slide under the header.
let headerObserver: ResizeObserver | null = null
function observeHeader() {
  headerObserver?.disconnect()
  headerObserver = null
  if (!header.value || !panel.value || typeof ResizeObserver === 'undefined') return
  const el = panel.value
  headerObserver = new ResizeObserver(([entry]) => {
    el.style.setProperty('--modal-header-h', `${entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height}px`) // i18n-ignore: CSS variable name
  })
  headerObserver.observe(header.value)
}

function requestClose() {
  if (isDirty.value) confirming.value = true
  else emit('close')
}

function discard() {
  confirming.value = false
  emit('close')
}

defineExpose({ requestClose })

// Listens on `window`, which fires after every document-level handler, so an
// in-modal popover (member tags, the icon picker, the confirm dialog) that
// consumed the key with preventDefault() is honoured and only the modal's own
// Escape reaches here.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !props.open || e.defaultPrevented || !guarded.value) return // i18n-ignore: key name, not copy
  e.preventDefault()
  requestClose()
}

// Focus moves into the dialog on open and back to the opener on close, so a
// keyboard user is not left on a button behind the overlay.
let opener: Element | null = null

watch(() => props.open, async (open) => {
  if (open) {
    opener = document.activeElement
    window.addEventListener('keydown', onKeydown)
    await nextTick()
    observeHeader()
    const first = panel.value?.querySelector<HTMLElement>(
      'input:not([type=hidden]), textarea, select, button:not(.modal-close)', // i18n-ignore: CSS selector
    )
    ;(first ?? panel.value)?.focus({ preventScroll: true })
  } else {
    confirming.value = false
    guard.reset()
    headerObserver?.disconnect()
    headerObserver = null
    window.removeEventListener('keydown', onKeydown)
    if (opener instanceof HTMLElement) opener.focus({ preventScroll: true })
    opener = null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  headerObserver?.disconnect()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-overlay">
        <div class="modal-backdrop" @click="requestClose" />
        <div
          ref="panel"
          class="modal-panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          :style="`max-width:${maxWidth ?? '34rem'};`"
        >
          <div ref="header" class="modal-header">
            <h2 :id="titleId" class="modal-title">{{ title }}</h2>
            <button type="button" @click="requestClose" class="modal-close" :aria-label="$t('common.actions.close')">
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

  <ConfirmDialog
    :open="confirming"
    :title="$t('common.confirm.discardTitle')"
    :message="$t('common.confirm.discardMessage')"
    :confirm-label="$t('common.confirm.discard')"
    @confirm="discard"
    @cancel="confirming = false"
  />
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
  width: calc(100% - 2rem);
  margin: 4rem 1rem 1rem;
  border-radius: 0.75rem;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  background: var(--c-141414);
  border: 1px solid var(--c-333333);
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

/* The body's padding is published as variables so a form that pins its own
   footer to the panel edge, or a rail under the header (PostForm), reads the
   same values instead of repeating them. --modal-header-h is set from a
   ResizeObserver above. */
.modal-body {
  --modal-pad-t: 1.25rem;
  --modal-pad-x: 1.5rem;
  --modal-pad-b: 1.5rem;
  padding: var(--modal-pad-t) var(--modal-pad-x) var(--modal-pad-b);
}

@media (max-width: 640px) {
  .modal-panel { margin: 1rem 0.5rem 0.5rem; width: calc(100% - 1rem); }
  .modal-header { padding: 0.875rem 1rem; }
  .modal-body { --modal-pad-t: 1rem; --modal-pad-x: 1rem; --modal-pad-b: 1.25rem; }
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
