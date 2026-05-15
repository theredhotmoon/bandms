# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Tech stack

| Layer | Library |
|---|---|
| UI framework | Vue 3 (Composition API, `<script setup>`) |
| Language | TypeScript (strict mode) |
| Routing | Vue Router 4 |
| Server state | TanStack Query v5 |
| Styles | Tailwind CSS v4 |
| Build | Vite 6 |

---

## Folder structure

```
src/
├── api/              # One file per API resource. Contains fetch functions only.
│                     # Always validate params before using them in URLs.
│
├── types/            # One file per domain type (TypeScript interfaces/types).
│
├── composables/      # Reusable Vue composables (use* naming convention).
│                     # One composable per logical concern.
│
├── components/
│   ├── auth/         # Login/register flow components.
│   │                 # AuthTabs.vue, SignInForm.vue, RegisterForm.vue
│   │
│   └── (root)        # Global layout components shared across all views.
│
├── views/            # THIN orchestrators only — compose components, nothing else.
│                     # No business logic, no inline data arrays, template ≤ ~50 lines.
│                     # HomeView.vue, LoginView.vue
│
└── router/
    └── index.ts      # Route definitions + global navigation guards.
```

---

## Conventions

### Component naming
- PascalCase filenames for all `.vue` files.
- Prefix with the feature folder name for feature-specific components: `AuthTabs`, `AuthForm`.
- Generic UI primitives live in `components/ui/` with plain names: `Button.vue`, `Card.vue`.

### Props and emits — always typed
```ts
interface Props {
  activeTab: 'signin' | 'register'
}
defineProps<Props>()

defineEmits<{
  'update:activeTab': [value: 'signin' | 'register']
  success: []
}>()
```

### TypeScript strictness
- No `any`. Use `unknown` and narrow, or define a proper interface.
- Return types on all exported functions.
- `as Promise<SomeType>` over `as any` for `response.json()` calls.

### Views are thin orchestrators
- A view imports and composes components — nothing else.
- No reactive state in views (that belongs in a composable or child component).
- No template longer than ~50 lines.

### Composables
- Named `use*`, placed in `src/composables/`.
- One composable = one logical concern.
- Return only what consumers need; keep internal refs private.

---

## Security rules

### No `v-html` with untrusted content
- `v-html` is forbidden unless the content is explicitly sanitised first.

### Content Security Policy
`index.html` carries a `<meta http-equiv="Content-Security-Policy">` tag.
Update this policy whenever a new external domain (CDN, API) is added.

### API input validation (`src/api/`)
- Validate every parameter before it is interpolated into a URL.
- Use `assertSafeId()` (or equivalent guard) for numeric ID params.
- Never build URLs from unvalidated `route.params` directly.

### Router navigation guards (`src/router/index.ts`)
- A global `beforeEach` guard blocks params containing path-traversal sequences
  (`..`, `//`, backslash, URL-encoded variants) and redirects to home.

### `autocomplete` on auth forms
- Password inputs carry `autocomplete="current-password"` or `autocomplete="new-password"`.

---

## Adding a new feature — checklist

1. **Type** — add interfaces to `src/types/<domain>.ts`.
2. **API** — add fetch functions to `src/api/<resource>.ts` with param validation.
3. **Composable** — extract stateful logic into `src/composables/use<Feature>.ts`.
4. **Components** — build in the appropriate subfolder under `src/components/`.
5. **View** — create/update a thin view that composes the components.
6. **Router** — add the route in `src/router/index.ts`; add a guard if needed.
7. **CSP** — if the feature hits a new external domain, update the CSP meta tag.
