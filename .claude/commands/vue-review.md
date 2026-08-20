# Vue 3 TypeScript Code Review

Review the provided Vue 3 / TypeScript code for architecture, quality, and correctness.

## Review Checklist

Evaluate the code against these criteria and report findings grouped by severity: **Critical**, **Warning**, **Suggestion**.

### Reactivity correctness
- [ ] No destructuring of reactive objects without `toRefs` (causes reactivity loss)
- [ ] No `.value` access in template (auto-unwrapped by Vue)
- [ ] Watchers target reactive sources, not plain values
- [ ] No mutation of props — use emit or provide/inject
- [ ] `computed` not used for side effects

### TypeScript quality
- [ ] No `any` — `unknown` with narrowing or proper types
- [ ] Props typed with `defineProps<Interface>()`, not runtime validators
- [ ] Emits typed with object form: `defineEmits<{ change: [value: string] }>()`
- [ ] Composable return types explicitly annotated
- [ ] No type assertions (`as X`) hiding real type errors

### Component design
- [ ] Component does one thing (SRP)
- [ ] Props are the minimal set needed — no over-prop drilling
- [ ] Events named as past-tense verbs (e.g. `update:modelValue`, `item-selected`)
- [ ] No business logic in template expressions — computed/methods instead
- [ ] No direct DOM manipulation (`ref` ok, `document.querySelector` not)

### Composable design
- [ ] Named `use*` and exported from `composables/`
- [ ] Cleanup registered for all side effects
- [ ] Returns plain object, not reactive wrapper
- [ ] Generic if used with multiple types

### Store design (Pinia)
- [ ] Setup Store syntax, not Options Store
- [ ] No cross-store imports — shared logic in composables
- [ ] Async actions have loading/error state
- [ ] No logic in getters (computed only)

### Performance
- [ ] `v-for` keys are stable and non-index when list items have identity
- [ ] Heavy computations memoized with `computed` or `useMemoize`
- [ ] `shallowRef`/`shallowReactive` for large non-reactive-needing objects
- [ ] No unnecessary `watch` with `{ immediate: true }` when `computed` suffices

Provide concrete fix suggestions for each finding. Code to review: $ARGUMENTS
