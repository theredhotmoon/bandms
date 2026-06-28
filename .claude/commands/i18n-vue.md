# Vue 3 / TanStack Query i18n Advisor

You are an expert in frontend internationalisation for this specific project:

- **Vue 3 TypeScript SPA** — Composition API, `<script setup>`, strict mode
- **TanStack Query v5** — `useQuery` / `useMutation`, reactive `queryKey`
- **`useLang` composable** at `src/composables/useLang.ts` — returns `{ lang: Ref<'en'|'pl'>, setLang }`; locale is persisted in `localStorage`
- **`LangToggle.vue`** at `src/components/public/LangToggle.vue` — already exists, just drop it in
- **Two locales:** `en` (default) and `pl`
- **Backend contract:** Laravel + spatie/laravel-translatable accepts `?lang=en|pl` on public GETs and returns the locale-resolved string in the primary field **plus** a `translations` object with all locales for admin edit forms

---

## Taxonomy — two problems, two solutions

Never conflate them:

| # | Problem | Solution |
|---|---------|----------|
| 1 | **Static UI strings** — labels, headings, buttons, nav items, empty states | Inline `T = { en: {...}, pl: {...} }` object inside the component |
| 2 | **Dynamic content** — post titles, bios, release descriptions returned by the API | Pass `?lang=` to fetch functions; include `lang` in the TanStack Query `queryKey` |

---

## Problem 1 — Static UI strings

Already implemented project-wide. The pattern: a plain `T` object with `en`/`pl` sub-objects, accessed as `T[lang].key` in the template.

```ts
// <script setup> — no external library needed
import { useLang } from '@/composables/useLang'
const { lang } = useLang()

const T = {
  en: {
    heading: 'Upcoming Shows',
    cta:     'Buy Tickets',
    empty:   'No upcoming shows.',
  },
  pl: {
    heading: 'Nadchodzące Koncerty',
    cta:     'Kup Bilety',
    empty:   'Brak nadchodzących koncertów.',
  },
}
```

```html
<h1>{{ T[lang].heading }}</h1>
<button>{{ T[lang].cta }}</button>
<p v-if="!items.length">{{ T[lang].empty }}</p>
```

**Rules:**
- `T` is a plain object — zero reactivity overhead, no library, no build step
- Both locales must have identical keys (TypeScript enforces this if you type `T`)
- In templates `lang` is a `Ref` — Vue unwraps it automatically, so `T[lang]` works; in script code, use `T[lang.value]`
- Collocate `T` with the component that uses it — do not centralise into a global file
- Never use `$t()` or any i18n plugin — this project deliberately avoids that dependency

### Optional: type `T` for large components

```ts
import type { Lang } from '@/composables/useLang'

type UI = { heading: string; cta: string; empty: string }
const T: Record<Lang, UI> = { en: { ... }, pl: { ... } }
```

---

## Problem 2 — Dynamic content from the API

### The core principle

The backend resolves to the requested locale when `?lang=en` or `?lang=pl` is appended to public GETs. The frontend's job is:

1. Pass the current locale to every public fetch function
2. Include the locale in the TanStack Query `queryKey` wrapped in `computed()` so the cache invalidates automatically on language switch

### Step 1 — API fetch functions (`src/api/*.ts`)

Add `lang: Lang` as a parameter to every public read function and append it to the URL:

```ts
import type { Lang } from '@/composables/useLang'

// Before:
export async function fetchBandProfile(): Promise<BandProfile> {
  const res = await fetch(`${API_BASE}/api/band-profile`, { headers: jsonHeaders })
  return handleResponse<BandProfileResponse>(res).then(r => r.data)
}

// After:
export async function fetchBandProfile(lang: Lang): Promise<BandProfile> {
  const res = await fetch(`${API_BASE}/api/band-profile?lang=${lang}`, { headers: jsonHeaders })
  return handleResponse<BandProfileResponse>(res).then(r => r.data)
}
```

`lang` applies only to public GET endpoints. Auth-protected mutations (POST/PUT/DELETE) send translatable content as `{ title: { en: '...', pl: '...' } }` — no `?lang=` needed on writes.

### Step 2 — Composables (`src/composables/use*.ts`)

Pull `lang` from `useLang()` and wrap the `queryKey` in `computed()`:

```ts
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useLang } from './useLang'

// Before:
export function useBandProfile() {
  const qk = ['band-profile']
  const query = useQuery<BandProfile>({
    queryKey: qk,
    queryFn: fetchBandProfile,
  })
  ...
}

// After:
export function useBandProfile() {
  const { lang } = useLang()
  const qk = computed(() => ['band-profile', lang.value])

  const query = useQuery<BandProfile>({
    queryKey: qk,
    queryFn: () => fetchBandProfile(lang.value),
  })
  ...
}
```

When the user switches language, the `computed` key changes → TanStack Query sees a new cache entry → automatically refetches. No manual `invalidateQueries` needed.

---

## The `queryKey` reactivity trap

This is the most common mistake when adding locale to an existing composable.

```ts
// WRONG — captures lang.value once at call time, never reacts:
const qk = ['band-profile', lang.value]
useQuery({ queryKey: qk, ... })

// WRONG — same problem, harder to spot:
useQuery({ queryKey: ['band-profile', lang.value], ... })

// CORRECT — reactive; TanStack Query v5 accepts ComputedRef natively:
const qk = computed(() => ['band-profile', lang.value])
useQuery({ queryKey: qk, queryFn: () => fetchBandProfile(lang.value) })
```

TanStack Query v5 watches `ComputedRef` queryKeys natively — no plugin or extra config needed.

---

## Admin write forms — per-locale payload

When an admin creates or updates a translatable resource, send the full translations object:

```ts
// src/types/shared.ts — add this once, reuse everywhere:
export type TranslationMap = { en: string; pl?: string | null }
```

Update the payload type for translatable fields:

```ts
// src/types/bandProfile.ts
import type { TranslationMap } from './shared'

export interface BandProfilePayload {
  name?:       string
  bio_short?:  string | TranslationMap | null   // both legacy plain string and per-locale object work
  bio_medium?: string | TranslationMap | null
  bio_long?:   string | TranslationMap | null
  bio_full?:   string | TranslationMap | null
  artistic_statement?: string | TranslationMap | null
  // non-translatable fields unchanged:
  formation_year?: number | null
  // ...
}
```

In the admin form component:

```ts
const bioEn = ref(profile.value?.translations?.bio_short?.en ?? '')
const bioPl = ref(profile.value?.translations?.bio_short?.pl ?? '')

function save() {
  update.mutate({
    bio_short: { en: bioEn.value, pl: bioPl.value || undefined },
  })
}
```

The backend controller accepts both plain strings and `{ en: '...', pl: '...' }` — both are valid.

---

## Reading translations for admin form pre-population

The API response includes a `translations` object alongside the locale-resolved field:

```json
{
  "data": {
    "bio_short": "Short bio in current locale",
    "translations": {
      "bio_short": { "en": "Short bio", "pl": "Krótkie bio" }
    }
  }
}
```

Reflect this in the TypeScript type:

```ts
// src/types/bandProfile.ts
export interface BandProfile {
  bio_short: string | null          // locale-resolved (public display)
  // ...
  translations?: {
    bio_short:          { en?: string | null; pl?: string | null }
    bio_medium:         { en?: string | null; pl?: string | null }
    bio_long:           { en?: string | null; pl?: string | null }
    bio_full:           { en?: string | null; pl?: string | null }
    artistic_statement: { en?: string | null; pl?: string | null }
  }
}
```

In an admin edit form:

```ts
const { query } = useBandProfile()

const bioEn = computed(() => query.data.value?.translations?.bio_short?.en ?? '')
const bioPl = computed(() => query.data.value?.translations?.bio_short?.pl ?? '')
```

For public views, ignore `translations` — just render `profile.bio_short` (already locale-resolved by the backend).

---

## Which fetch functions need `lang`

Only public read endpoints return translatable content:

| File | Functions | Translatable fields |
|------|-----------|---------------------|
| `api/bandProfile.ts` | `fetchBandProfile`, `fetchEpk` | bio_*, artistic_statement |
| `api/posts.ts` | `fetchPosts`, `fetchPost` | title, intro, content |
| `api/releases.ts` | `fetchReleases`, `fetchRelease` | title, description |

Do **not** add `lang` to:
- Auth endpoints (`login`, `register`, `logout`)
- Protected mutations (POST/PUT/DELETE)
- Resources with no translatable fields: shop items, concerts, members, social links, venues, etc.

---

## LangToggle component

Already exists — just import and place it:

```html
<LangToggle />               <!-- light mode (default) -->
<LangToggle :dark="true" />  <!-- for dark/inverted backgrounds -->
```

Calls `setLang()` internally, which updates the singleton `lang` ref and writes to `localStorage`. All `computed` queryKeys referencing `lang.value` will react immediately.

---

## Step-by-step checklist per resource

1. **`src/api/<resource>.ts`**
   - Add `lang: Lang` parameter to each public fetch function
   - Append `?lang=${lang}` to the fetch URL

2. **`src/composables/use<Resource>.ts`**
   - `import { useLang } from './useLang'`
   - `import { computed } from 'vue'`
   - Inside the composable: `const { lang } = useLang()`
   - Wrap queryKey: `const qk = computed(() => ['resource', lang.value])`
   - Pass `lang.value` in `queryFn`: `queryFn: () => fetchResource(lang.value)`

3. **`src/types/<resource>.ts`**
   - Add `translations?: { field: { en?: string | null; pl?: string | null } }` to the read interface
   - Update write payload type: `field?: string | TranslationMap | null` for translatable fields

4. **Admin forms** (when they exist)
   - Pre-populate from `data.translations.field.en` / `.pl`
   - Submit as `{ field: { en: '...', pl: '...' } }`

**Priority order** (highest user-visible impact first):
1. `bandProfile` / `epk` — bios appear on the homepage and EPK
2. `posts` — news content
3. `releases` — music page titles and descriptions

---

Advise on: $ARGUMENTS
