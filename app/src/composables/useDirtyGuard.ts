import { computed, inject, onBeforeUnmount, provide, ref, watch } from 'vue'
import type { InjectionKey, Ref } from 'vue'
import { cloneState, deepEqual } from '@/utils/deepEqual'

/**
 * Derives "has this form changed since it was loaded/saved" from a snapshot
 * comparison rather than manual flagging — nothing to forget in a new
 * mutator, unlike the hand-rolled `dirty = ref(false)` pattern this replaces.
 */
export function useDirtyGuard<T>(getState: () => T) {
  const baseline = ref(cloneState(getState())) as Ref<T>

  const isDirty = computed(() => !deepEqual(baseline.value, getState()))

  function markClean(): void {
    baseline.value = cloneState(getState())
  }

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
  /** The form's current dirty state; registering also enables Escape. */
  setDirty(dirty: boolean): void
  /** Close through the guard: asks first when dirty, closes at once otherwise. */
  requestClose(): void
}

export const MODAL_GUARD: InjectionKey<ModalGuard> = Symbol('modalGuard')

/**
 * Host side. AdminModal calls this once; `dirty` is what the forms report and
 * `registered` tells the modal a guarded form is inside it (so Escape may
 * close it — an unguarded modal gets no Escape, because it cannot know what
 * it holds).
 */
export function provideModalGuard(requestClose: () => void) {
  const dirty = ref(false)
  const registered = ref(false)

  provide(MODAL_GUARD, {
    setDirty(value) {
      registered.value = true
      dirty.value = value
    },
    requestClose,
  })

  function reset(): void {
    dirty.value = false
    registered.value = false
  }

  return { dirty, registered, reset }
}

/**
 * Form side. Pass the form's `isDirty` and what Cancel should do when the
 * form is rendered outside a modal (usually `() => emit('cancel')`); bind the
 * returned `cancel` to the Cancel button. Outside AdminModal the composable
 * is inert and `cancel` is just the fallback, so one form component serves
 * both a modal and an inline page.
 */
export function useModalGuard(isDirty: Ref<boolean>, fallbackCancel: () => void) {
  const guard = inject(MODAL_GUARD, null)

  if (guard) {
    watch(isDirty, (value) => guard.setDirty(value), { immediate: true })
    // A form swapped out under an open modal (edit → loading → edit) must not
    // leave a stale "dirty" behind it.
    onBeforeUnmount(() => guard.setDirty(false))
  }

  return {
    cancel: (): void => (guard ? guard.requestClose() : fallbackCancel()),
  }
}
