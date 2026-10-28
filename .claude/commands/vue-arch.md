# Vue 3 Architecture Advisor

Advise on architecture, folder structure, and design decisions for a Vue 3 TypeScript project.

## Instructions

Answer architecture questions or propose structure for the described scenario. Apply these principles (aligned with `app/CLAUDE.md`):

**Folder structure:**
```
src/
  api/                  # One file per API resource. Contains fetch functions only.
                        # Validate all parameters (assertSafeId / assertSafeSlug) before interpolating into URLs.
  types/                # One file per domain type (TypeScript interfaces/types).
  composables/          # Reusable Vue composables (use* naming convention).
                        # One composable per logical concern.
  components/
    admin/              # Admin shell, tables, modals, and form sub-components
      forms/            # Shared form inputs and upload controls
    auth/               # Sign-in / authentication flow components
    ui/                 # Generic stateless UI primitives
  views/                # THIN orchestrators only — compose components, nothing else.
    admin/              # Admin route views
  router/
    index.ts            # Route definitions + global navigation guards.
  i18n/                 # Typed English/Polish translation catalogues (en/ and pl/).
  utils/                # Pure, Node/SSR-safe helper functions with colocated *.spec.ts tests.
```

**Component hierarchy:**
- Views (`src/views/`): routing + layout orchestration only, no business logic or inline data arrays, template kept concise
- Feature/admin components (`src/components/admin/`): orchestrate form state and UI interactions for a domain
- UI primitives (`src/components/ui/`): stateless, purely presentational, zero business logic

**State ownership & data fetching:**
- Local `ref`/`reactive` for UI-only state (modal open/close, active tabs, form drafts)
- Composables (`src/composables/use*.ts`) for shared domain logic and state
- TanStack Query v5 (`@tanstack/vue-query`) for all server state: caching, reactive `queryKey`s, `enabled` guards, and targeted `invalidateQueries` on mutations (no Pinia)
- Never call `fetch` in components or views directly — always place HTTP calls in `src/api/` and wrap them in composables

**Dependency direction:**
- `views` → `components` / `composables` → `api` / `utils` / `types`
- Never reverse; never circular

**When to split a component:**
- >200 lines of template → split into focused child components
- >1 concern in script → extract composable (`src/composables/`) or pure helper (`src/utils/`) first, then split if still large
- Repeated 3+ times → extract to shared component or composable

Advise on: $ARGUMENTS
