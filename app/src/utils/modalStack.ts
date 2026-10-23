/**
 * Which open modal is on top.
 *
 * A modal may open inside another (the concert form's "New venue"), and every
 * open AdminModal listens for Escape on `window` — the outer one registered
 * first, so without this the *outer* modal would take a key pressed inside
 * the nested one and ask to discard the whole concert. Each instance enters
 * on open and leaves on close; only the last one in acts on Escape.
 *
 * A plain module rather than state in AdminModal's `<script setup>`, because
 * top-level code there runs once per instance — a "shared" array declared
 * there is a private one, and every modal believes it is on top.
 */
const stack: symbol[] = []

export function enterModal(token: symbol): void {
  leaveModal(token)
  stack.push(token)
}

export function leaveModal(token: symbol): void {
  const i = stack.indexOf(token)
  if (i !== -1) stack.splice(i, 1)
}

export function isTopmostModal(token: symbol): boolean {
  return stack[stack.length - 1] === token
}
