import { computed, ref } from 'vue'
import type { Ref } from 'vue'
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
