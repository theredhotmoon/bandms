import { shallowRef } from 'vue'

/**
 * Which open modal is on top.
 *
 * A modal may open inside another (the concert form's "New venue"), and every
 * open AdminModal listens for Escape on `window` — the outer one registered
 * first, so without this the *outer* modal would take a key pressed inside
 * the nested one and ask to discard the whole concert. Each instance enters
 * on open and leaves on close; only the last one in acts on Escape, and the
 * same order decides what paints on top and what is `inert` underneath, so
 * one mechanism owns all three rather than Escape following open order while
 * stacking follows teleport order.
 *
 * A plain module rather than state in AdminModal's `<script setup>`, because
 * top-level code there runs once per instance — a "shared" array declared
 * there is a private one, and every modal believes it is on top. Reactive so
 * a computed in the modal follows it.
 */
const stack = shallowRef<readonly symbol[]>([])

export function enterModal(token: symbol): void {
  stack.value = [...stack.value.filter(t => t !== token), token]
}

export function leaveModal(token: symbol): void {
  if (stack.value.includes(token)) stack.value = stack.value.filter(t => t !== token)
}

export function isTopmostModal(token: symbol): boolean {
  return stack.value[stack.value.length - 1] === token
}

/** 0 for the bottom-most open modal, counting up; -1 when not open. */
export function modalDepth(token: symbol): number {
  return stack.value.indexOf(token)
}
