# Vue Composable Generator

Generate a well-structured Vue 3 TypeScript composable (`use*`) following project conventions.

## Instructions

Create a composable for the described functionality:

**File & naming:**
- File: `composables/use<Name>.ts`, function: `use<Name>`
- Single responsibility — one concern per composable

**Return shape:**
- Return a plain object, not `reactive({})` — let the caller destructure or keep as-is
- Expose only what callers need; keep internals private inside the function

**Reactivity:**
- Use `ref` for primitives, `reactive` only for complex related state that always moves together
- Avoid `reactive` on arrays — use `ref<T[]>`
- Prefer `readonly()` on returned refs to prevent accidental mutation by callers
- Use `shallowRef` / `shallowReactive` for large objects where deep reactivity is wasteful

**Async & cleanup:**
- Always return `{ data, error, isLoading }` pattern for async composables
- Register cleanup in `onUnmounted` / use `watchEffect`'s cleanup callback
- Cancel in-flight requests on unmount (AbortController)

**Side effects:**
- Side effects (watchers, intervals, listeners) must be cleaned up — store return value of `watch`/`watchEffect` and call it in cleanup
- Avoid global side effects without cleanup

**TypeScript:**
- Explicit return type annotation: `function useFoo(): { ... }`
- No `any`; use generics where the composable is reusable across types

Generate the composable now based on: $ARGUMENTS
