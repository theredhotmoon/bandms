import { computed, inject, onBeforeUnmount, provide, ref, watch } from 'vue'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import { cloneState, deepEqual } from '@/utils/deepEqual'

export interface DirtyGuard {
  isDirty: ComputedRef<boolean>
  /** Take the current state as the new baseline (after load, reset or save). */
  markClean(): void
}

/**
 * Derives "has this form changed since it was loaded/saved" from a snapshot
 * comparison rather than manual flagging — nothing to forget in a new
 * mutator, unlike the hand-rolled `dirty = ref(false)` pattern this replaces.
 *
 * `resetOn` re-baselines whenever that ref turns true: a view whose form is
 * populated and then shown with `showModal.value = true` passes the modal's
 * open flag, and the baseline follows the modal instead of every open
 * handler having to remember `markClean()`. The watch is pre-flush, so it
 * sees the populated state before the modal renders.
 */
export function useDirtyGuard<T>(getState: () => T, resetOn?: Ref<boolean>): DirtyGuard {
  const baseline = ref(cloneState(getState())) as Ref<T>

  const isDirty = computed(() => !deepEqual(baseline.value, getState()))

  function markClean(): void {
    baseline.value = cloneState(getState())
  }

  if (resetOn) watch(resetOn, (open) => { if (open) markClean() })

  return { isDirty, markClean }
}

// ── The modal half ────────────────────────────────────────────────
//
// A form inside AdminModal reports its dirtiness to the modal and routes its
// Cancel button through the modal's close request, so the backdrop, the X,
// Escape and Cancel all ask "Discard changes?" when there is something to
// lose — one guard, owned by the modal, with no per-view wiring. The bridge
// is provide/inject rather than props and emits because the form is the
// modal's *grandchild* (view → modal → form); passing a flag up through the
// view and back down meant every view repeating the same two lines, and
// forgetting them was silent.

export interface ModalGuard {
  /** The form's current dirty state; reporting also marks the modal as guarded. */
  setDirty(dirty: boolean): void
  /** The form is leaving: clears both the dirty state and the guarded mark. */
  release(): void
  /** Close through the guard: asks first when dirty, closes at once otherwise. */
  requestClose(): void
}

export interface ModalGuardHost {
  /** What the form inside reports. */
  dirty: Ref<boolean>
  /** Whether a guarded form has registered — what enables Escape. */
  registered: Ref<boolean>
  /** Forget everything, for the modal's own close. */
  reset(): void
}

export const MODAL_GUARD: InjectionKey<ModalGuard> = Symbol('modalGuard')

/**
 * Host side. AdminModal calls this once; `dirty` is what the forms report and
 * `registered` tells the modal a guarded form is inside it (so Escape may
 * close it — an unguarded modal gets no Escape, because it cannot know what
 * it holds).
 */
export function provideModalGuard(requestClose: () => void): ModalGuardHost {
  const dirty = ref(false)
  const registered = ref(false)

  function reset(): void {
    dirty.value = false
    registered.value = false
  }

  provide(MODAL_GUARD, {
    setDirty(value) {
      registered.value = true
      dirty.value = value
    },
    // Distinct from setDirty(false) on purpose: the form unmounts *after* the
    // modal's close watcher has already reset, and a plain setDirty there
    // would mark the modal guarded again with nothing inside it.
    release: reset,
    requestClose,
  })

  return { dirty, registered, reset }
}

export interface ModalGuardForm {
  /** Bind to the Cancel button: asks through the modal, or falls back outside one. */
  cancel(): void
}

/**
 * Form side. Pass the form's `isDirty` and what Cancel should do when the
 * form is rendered outside a modal (usually `() => emit('cancel')`); bind the
 * returned `cancel` to the Cancel button. Outside AdminModal the composable
 * is inert and `cancel` is just the fallback, so one form component serves
 * both a modal and an inline page.
 */
export function useModalGuard(isDirty: Ref<boolean>, fallbackCancel: () => void): ModalGuardForm {
  const guard = inject(MODAL_GUARD, null)

  if (guard) {
    watch(isDirty, (value) => guard.setDirty(value), { immediate: true })
    // A form swapped out under an open modal (edit → loading → edit) must not
    // leave a stale "dirty" or a stale "guarded" behind it.
    onBeforeUnmount(() => guard.release())
  }

  return {
    cancel: (): void => (guard ? guard.requestClose() : fallbackCancel()),
  }
}
