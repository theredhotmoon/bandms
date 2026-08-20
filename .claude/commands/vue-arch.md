# Vue 3 Architecture Advisor

Advise on architecture, folder structure, and design decisions for a Vue 3 TypeScript project.

## Instructions

Answer architecture questions or propose structure for the described scenario. Apply these principles:

**Folder structure (feature-based, not type-based):**
```
src/
  features/
    <feature>/
      components/       # feature-local components
      composables/      # feature-local composables
      stores/           # feature-local store
      types.ts          # feature types
      index.ts          # public API — only export what other features need
  shared/
    components/         # truly reusable UI primitives
    composables/        # truly reusable logic
    types/              # shared domain types
  layouts/
  pages/                # route-level components, thin — delegate to features
  router/
  lib/                  # third-party wrappers / adapters
  assets/
```

**Component hierarchy:**
- Pages: routing + layout only, no business logic
- Feature components: orchestrate state and data flow for a feature
- UI primitives (`shared/components`): stateless, purely presentational, zero business logic
- Never import from a sibling feature directly — go through `index.ts` public APIs

**State ownership:**
- Local `ref`/`reactive` for UI-only state (open/close, hover)
- Composable for shared logic without global persistence
- Pinia store for: cross-feature shared state, persisted state, server cache
- Avoid putting server-fetched data in Pinia unless it's truly global — prefer composable-local state with a query library (VueQuery/TanStack Query)

**Data fetching:**
- Use TanStack Query (Vue Query) for server state: caching, deduplication, background refresh
- Use Pinia only for client/UI state
- Never fetch in components directly — always in composables or query hooks

**Dependency direction:**
- `pages` → `features` → `shared` → `lib`
- Never reverse; never circular
- A feature's `index.ts` is its contract — breaking changes must be intentional

**When to split a component:**
- >200 lines of template → split
- >1 concern in script → extract composable first, then split if still large
- Repeated 3+ times → extract to shared

Advise on: $ARGUMENTS
