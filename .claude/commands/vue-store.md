# Pinia Store Generator

Generate a well-structured Pinia store for Vue 3 TypeScript.

## Instructions

Create a Pinia store using the **Setup Store** syntax (not Options Store) for the described state domain:

**File & naming:**
- File: `stores/use<Name>Store.ts`
- Export: `export const use<Name>Store = defineStore('<name>', () => { ... })`
- One domain per store; stores should not import each other — use composables for shared logic

**State:**
- Declare state as `ref`/`reactive` inside the setup function
- Never expose raw mutable state directly if it must be protected — use `readonly()`
- Group related state with a comment block

**Getters:**
- Implement as `computed(() => ...)` — not plain functions
- Derived state only; no side effects inside computed

**Actions:**
- Plain `async` functions inside the store
- Handle loading/error state locally (`isLoading`, `error`) per action when async
- Actions should be single-responsibility; complex flows belong in composables that call actions

**Persistence & plugins:**
- If persistence is needed, note it explicitly and use `pinia-plugin-persistedstate` pattern
- Don't persist sensitive data (tokens, PII) — filter with `paths`

**TypeScript:**
- Define a TypeScript `interface` for each entity the store manages
- Explicit return type from the store function: `return { state, getter, action } as const` or typed explicitly

Generate the store for: $ARGUMENTS
