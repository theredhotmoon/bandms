# Admin Rebuild Guard — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A persistent Rebuild control visible on every admin page, reflecting the backend's dirty-area tracking, plus a reusable `useDirtyGuard` composable wired into every draft-then-Save admin form so each Save button reflects real unsaved-changes state.

**Architecture:** `useSiteRebuild.ts` is a new composable wrapping the extended `GET /admin/site/rebuild/status` endpoint (built in the companion backend plan); `RebuildBar.vue` mounts it once in `AdminLayout.vue` so it's present on every admin route. `useDirtyGuard(getState)` snapshots a form's state on load and does a deep-equal comparison against current state to compute `isDirty` — no per-mutator flagging, unlike the hand-rolled `dirty` ref pattern this replaces in `useTechRiderEditor.ts` and `MemberSetupsPanel.vue`/`MemberDefaultGear.vue`.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), TypeScript strict mode, TanStack Query v5, Vitest (`.spec.ts` suffix, colocated with source).

**Spec:** [docs/superpowers/specs/2026-09-14-admin-rebuild-guard-design.md](../specs/2026-09-14-admin-rebuild-guard-design.md)
**Depends on:** [2026-09-14-admin-rebuild-guard-backend.md](2026-09-14-admin-rebuild-guard-backend.md) — `GET /admin/site/rebuild/status` must already return `autoRebuild` and `pendingAreas` (that plan's Task 3) before Task 3 of this plan can be tested end-to-end against a live backend; Tasks 1-2 and the Vitest-only parts of later tasks have no runtime dependency on it.

## Global Constraints

- Area keys must exactly match the backend plan's registry: `band-profile`, `band-members`, `hero-images`, `posts`, `website-modules`, `concerts`, `venues`, `setlists`, `releases`, `photos`, `music-videos`, `press-releases`, `shop`, `faqs`.
- `useDirtyGuard`'s `isDirty` is *derived* (computed from a deep-equal comparison), never manually flagged — this is the whole point of replacing the existing hand-rolled `dirty = ref(false)` + scattered `dirty.value = true` pattern.
- Vitest spec files use the `.spec.ts` suffix (not `.test.ts`) and live colocated with their source file — `app/vitest.config.ts` only collects `.spec.ts`, so a misnamed file runs zero tests while still reporting green.
- Every form wired to `useDirtyGuard` must call `markClean()` in exactly two places: when the baseline loads (the existing `watch(() => props.initial / query.data.value, ...)` callback), and after a successful save.
- Do not introduce a new dependency for deep-equality — `app/src/utils/deepEqual.ts` (Task 2) is a small dependency-free implementation, consistent with this codebase having no lodash/similar already installed for this purpose.

---

### Task 1: Types, API split, and the area-label registry

**Files:**
- Modify: `app/src/types/website-module.ts` (add `PendingArea`, extend `RebuildStatus`)
- Create: `app/src/api/site-rebuild.ts`
- Modify: `app/src/api/website-modules.ts` (remove the three functions moved out)
- Create: `app/src/config/rebuildAreas.ts`
- Create: `app/src/config/rebuildAreas.spec.ts`

**Interfaces:**
- Produces: `PendingArea { area: string; changedAt: string | null }`, `RebuildStatus` (now including `autoRebuild: boolean; pendingAreas: PendingArea[]`), `updateSiteSettings`, `triggerRebuild`, `fetchRebuildStatus` (moved, same signatures), `rebuildAreaLabel(area: string): string`. Task 3 (`useSiteRebuild.ts`) imports the three API functions from the new location; Task 4 (`RebuildBar.vue`) imports `rebuildAreaLabel`.

- [ ] **Step 1: Extend the types**

Open `app/src/types/website-module.ts`. Add a new exported interface above `RebuildStatus`:

```ts
export interface PendingArea {
  area: string
  changedAt: string | null
}
```

Find the existing `RebuildStatus` interface (it currently declares `status`, `startedAt`, and `finishedAt`, matching `fetchRebuildStatus`'s return shape) and add two fields to it:

```ts
  autoRebuild: boolean
  pendingAreas: PendingArea[]
```

- [ ] **Step 2: Create `app/src/api/site-rebuild.ts`**

```ts
import type { RebuildStatus, SiteSettings, PendingArea } from '@/types/website-module'
import { API_BASE, authHeaders, handleResponse } from './client'

const REBUILD_STATUSES = ['idle', 'building', 'done', 'error', 'unknown'] as const

export async function updateSiteSettings(token: string, autoRebuild: boolean): Promise<SiteSettings> {
  const res = await fetch(`${API_BASE}/api/admin/site/settings`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ auto_rebuild: autoRebuild }),
  })
  return handleResponse<SiteSettings>(res)
}

export async function triggerRebuild(token: string): Promise<Pick<RebuildStatus, 'status'>> {
  const res = await fetch(`${API_BASE}/api/admin/site/rebuild`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse<Pick<RebuildStatus, 'status'>>(res)
}

export async function fetchRebuildStatus(token: string): Promise<RebuildStatus> {
  const res = await fetch(`${API_BASE}/api/admin/site/rebuild/status`, { headers: authHeaders(token) })
  const raw = await handleResponse<Record<string, unknown>>(res)
  const status = REBUILD_STATUSES.includes(raw.status as RebuildStatus['status'])
    ? (raw.status as RebuildStatus['status'])
    : 'unknown'
  return {
    status,
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : null,
    finishedAt: typeof raw.finishedAt === 'number' ? raw.finishedAt : null,
    autoRebuild: raw.autoRebuild === true,
    pendingAreas: Array.isArray(raw.pendingAreas) ? (raw.pendingAreas as PendingArea[]) : [],
  }
}
```

- [ ] **Step 3: Remove the moved functions from `app/src/api/website-modules.ts`**

Delete the `REBUILD_STATUSES` const (line 4), and the `updateSiteSettings` (lines 30-37), `triggerRebuild` (lines 39-45), and `fetchRebuildStatus` (lines 47-58) functions in full — they now live in `site-rebuild.ts`. Keep `fetchModules`, `updateModule`, `reorderModules`, and `updateModuleSettings` (the rest of the file) unchanged. Also remove `RebuildStatus` from the top-of-file type import if nothing else in this file references it after the deletion.

- [ ] **Step 4: Create the area-label registry**

```ts
// app/src/config/rebuildAreas.ts

/**
 * Frontend half of the area-key registry — the backend half lives in
 * api/app/Support/SiteRebuild.php's call sites. The two are not auto-synced
 * (same convention as the locale registry in src/locales.ts): adding an area
 * means updating both.
 */
export const REBUILD_AREA_LABELS: Record<string, string> = {
  'band-profile': 'Band Profile',
  'band-members': 'Band Members',
  'hero-images': 'Hero Images',
  posts: 'Posts',
  'website-modules': 'Website Modules',
  concerts: 'Concerts',
  venues: 'Venues',
  setlists: 'Setlists',
  releases: 'Releases',
  photos: 'Photos',
  'music-videos': 'Music Videos',
  'press-releases': 'Press Releases',
  shop: 'Shop',
  faqs: 'FAQs',
}

/** Falls back to the raw key so a forgotten mapping degrades, not blanks. */
export function rebuildAreaLabel(area: string): string {
  return REBUILD_AREA_LABELS[area] ?? area
}
```

- [ ] **Step 5: Write the failing test, then the file above makes it pass**

```ts
// app/src/config/rebuildAreas.spec.ts

import { describe, it, expect } from 'vitest'
import { rebuildAreaLabel } from './rebuildAreas'

describe('rebuildAreaLabel', () => {
  it('returns the mapped label for a known area', () => {
    expect(rebuildAreaLabel('concerts')).toBe('Concerts')
  })

  it('falls back to the raw key for an unmapped area', () => {
    expect(rebuildAreaLabel('some-new-area')).toBe('some-new-area')
  })
})
```

- [ ] **Step 6: Run the tests**

Run: `cd app && pnpm test:unit -- rebuildAreas`
Expected: 2 tests pass.

- [ ] **Step 7: Type-check and commit**

Run: `cd app && pnpm build` (type-check + build; confirms no other file still imports the three moved functions from `website-modules.ts`)

```bash
git add app/src/types/website-module.ts app/src/api/site-rebuild.ts app/src/api/website-modules.ts app/src/config/rebuildAreas.ts app/src/config/rebuildAreas.spec.ts
git commit -m "Add PendingArea type, split rebuild API into site-rebuild.ts, add area labels"
```

---

### Task 2: `deepEqual`/`cloneState` utils + `useDirtyGuard` composable

**Files:**
- Create: `app/src/utils/deepEqual.ts`
- Create: `app/src/utils/deepEqual.spec.ts`
- Create: `app/src/composables/useDirtyGuard.ts`
- Create: `app/src/composables/useDirtyGuard.spec.ts`

**Interfaces:**
- Produces: `deepEqual(a: unknown, b: unknown): boolean`, `cloneState<T>(value: T): T`, `useDirtyGuard<T>(getState: () => T): { isDirty: ComputedRef<boolean>; markClean: () => void }`. Every task from Task 6 onward imports `useDirtyGuard`.

- [ ] **Step 1: Write `deepEqual.ts` and `cloneState`**

```ts
// app/src/utils/deepEqual.ts

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return false
  if (typeof a !== 'object') return false

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    return a.every((item, i) => deepEqual(item, b[i]))
  }

  const aKeys = Object.keys(a as Record<string, unknown>)
  const bKeys = Object.keys(b as Record<string, unknown>)
  if (aKeys.length !== bKeys.length) return false

  return aKeys.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}

/** Structural clone via JSON round-trip — enough for plain form-draft state (no Dates, Files, or Maps). */
export function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
```

- [ ] **Step 2: Write the failing test**

```ts
// app/src/utils/deepEqual.spec.ts

import { describe, it, expect } from 'vitest'
import { deepEqual, cloneState } from './deepEqual'

describe('deepEqual', () => {
  it('treats two structurally identical objects as equal', () => {
    expect(deepEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toBe(true)
  })

  it('treats a changed nested value as unequal', () => {
    expect(deepEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 3] })).toBe(false)
  })

  it('treats a different key count as unequal', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('treats null and an object as unequal', () => {
    expect(deepEqual(null, {})).toBe(false)
  })

  it('treats two nulls as equal', () => {
    expect(deepEqual(null, null)).toBe(true)
  })
})

describe('cloneState', () => {
  it('produces a deep copy that mutation does not affect', () => {
    const original = { a: [1, 2] }
    const clone = cloneState(original)
    original.a.push(3)
    expect(clone.a).toEqual([1, 2])
  })
})
```

- [ ] **Step 3: Run the tests**

Run: `cd app && pnpm test:unit -- deepEqual`
Expected: 6 tests pass.

- [ ] **Step 4: Write `useDirtyGuard.ts`**

```ts
// app/src/composables/useDirtyGuard.ts

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
```

- [ ] **Step 5: Write the failing test**

```ts
// app/src/composables/useDirtyGuard.spec.ts

import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import { useDirtyGuard } from './useDirtyGuard'

describe('useDirtyGuard', () => {
  it('starts clean', () => {
    const state = reactive({ name: 'a' })
    const { isDirty } = useDirtyGuard(() => state)
    expect(isDirty.value).toBe(false)
  })

  it('becomes dirty when the tracked state changes', () => {
    const state = reactive({ name: 'a' })
    const { isDirty } = useDirtyGuard(() => state)
    state.name = 'b'
    expect(isDirty.value).toBe(true)
  })

  it('becomes clean again after markClean()', () => {
    const state = reactive({ name: 'a' })
    const { isDirty, markClean } = useDirtyGuard(() => state)
    state.name = 'b'
    markClean()
    expect(isDirty.value).toBe(false)
  })

  it('is dirty again after a further change past markClean()', () => {
    const state = reactive({ name: 'a' })
    const { isDirty, markClean } = useDirtyGuard(() => state)
    state.name = 'b'
    markClean()
    state.name = 'c'
    expect(isDirty.value).toBe(true)
  })
})
```

- [ ] **Step 6: Run the tests**

Run: `cd app && pnpm test:unit -- useDirtyGuard`
Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/src/utils/deepEqual.ts app/src/utils/deepEqual.spec.ts app/src/composables/useDirtyGuard.ts app/src/composables/useDirtyGuard.spec.ts
git commit -m "Add deepEqual/cloneState utils and useDirtyGuard composable"
```

---

### Task 3: `useSiteRebuild` composable + `useWebsiteModules` cleanup

**Files:**
- Create: `app/src/composables/useSiteRebuild.ts`
- Modify: `app/src/composables/useWebsiteModules.ts`

**Interfaces:**
- Consumes: `updateSiteSettings`, `triggerRebuild`, `fetchRebuildStatus` from `app/src/api/site-rebuild.ts` (Task 1); `useAuth` (existing).
- Produces: `useSiteRebuild(): { statusQuery, isBuilding: ComputedRef<boolean>, autoRebuild: ComputedRef<boolean>, pendingAreas: ComputedRef<PendingArea[]>, rebuild: UseMutationReturnType, setAutoRebuild: UseMutationReturnType }`. Task 4 (`RebuildBar.vue`, `RebuildSettingsModal.vue`) consumes all of these.

- [ ] **Step 1: Write `useSiteRebuild.ts`**

Unlike `useAuth.ts`'s module-level-ref singleton, this follows the existing `useWebsiteModules.ts` pattern: a plain function-scoped `useQuery`/`useMutation`, sharing state across every caller via TanStack Query's own cache keyed on `['rebuild-status']` — no module-level refs needed, since that's what the query cache already provides.

```ts
import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchRebuildStatus, triggerRebuild, updateSiteSettings } from '@/api/site-rebuild'
import { useAuth } from './useAuth'

const REBUILD_QUERY_KEY = ['rebuild-status']

export function useSiteRebuild() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const statusQuery = useQuery({
    queryKey: REBUILD_QUERY_KEY,
    queryFn: () => fetchRebuildStatus(token.value!),
    enabled: () => token.value !== null,
    refetchInterval: (query) => (query.state.data?.status === 'building' ? 2000 : false),
    staleTime: 0,
  })

  const isBuilding = computed(() => statusQuery.data.value?.status === 'building')
  const autoRebuild = computed(() => statusQuery.data.value?.autoRebuild ?? false)
  const pendingAreas = computed(() => statusQuery.data.value?.pendingAreas ?? [])

  const rebuild = useMutation({
    mutationFn: () => triggerRebuild(token.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REBUILD_QUERY_KEY }),
  })

  const setAutoRebuild = useMutation({
    mutationFn: (nextAutoRebuild: boolean) => updateSiteSettings(token.value!, nextAutoRebuild),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REBUILD_QUERY_KEY }),
  })

  return { statusQuery, isBuilding, autoRebuild, pendingAreas, rebuild, setAutoRebuild }
}
```

- [ ] **Step 2: Rewrite `useWebsiteModules.ts` to drop the duplicated rebuild logic**

Replace the full file with:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchModules,
  updateModule,
  updateModuleSettings,
  reorderModules,
} from '@/api/website-modules'
import { useAuth } from './useAuth'
import type { WebsiteModuleSettingsPayload } from '@/types/website-module'

export function useWebsiteModules() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['website-modules'],
    queryFn: () => fetchModules(token.value!),
    enabled: () => token.value !== null,
  })

  const toggleModule = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) =>
      updateModule(token.value!, slug, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['website-modules'] }),
  })

  const updateSettings = useMutation({
    mutationFn: ({
      slug,
      payload,
    }: {
      slug: string
      payload: WebsiteModuleSettingsPayload
    }) => updateModuleSettings(token.value!, slug, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['website-modules'] }),
  })

  const reorder = useMutation({
    mutationFn: (slugs: string[]) => reorderModules(token.value!, slugs),
    onSuccess: (data) => queryClient.setQueryData(['website-modules'], data),
  })

  return { query, toggleModule, updateSettings, reorder }
}
```

`query`, `toggleModule`, `updateSettings`, and `reorder` keep their exact names and behavior from the original file — only `rebuildStatusQuery`, `rebuild`, and `setAutoRebuild` are removed (now in `useSiteRebuild`).

- [ ] **Step 3: Type-check**

Run: `cd app && pnpm build`
Expected: this will show errors in `WebsiteModulesView.vue`, since it still destructures the now-removed names — that's expected and fixed in Task 5. Confirm the *only* errors are in `WebsiteModulesView.vue` (nothing else imported the removed exports).

- [ ] **Step 4: Commit**

```bash
git add app/src/composables/useSiteRebuild.ts app/src/composables/useWebsiteModules.ts
git commit -m "Add useSiteRebuild composable; remove duplicated rebuild logic from useWebsiteModules"
```

(`WebsiteModulesView.vue` is left type-broken until Task 5, in the same commit sequence — this is acceptable since Task 5 immediately follows and the working tree is not shipped between them.)

---

### Task 4: `RebuildBar.vue` + `RebuildSettingsModal.vue`

**Files:**
- Create: `app/src/components/admin/RebuildBar.vue`
- Create: `app/src/components/admin/RebuildSettingsModal.vue`

**Interfaces:**
- Consumes: `useSiteRebuild()` (Task 3), `rebuildAreaLabel()` (Task 1).
- Produces: `<RebuildBar />` — a self-contained component with no props. Task 5 mounts it in `AdminLayout.vue`.

- [ ] **Step 1: Write `RebuildSettingsModal.vue`**

```vue
<script setup lang="ts">
import { useSiteRebuild } from '@/composables/useSiteRebuild'

const emit = defineEmits<{ close: [] }>()

const { autoRebuild, setAutoRebuild } = useSiteRebuild()
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-panel">
      <h2 class="modal-title">Rebuild settings</h2>

      <label class="auto-rebuild-toggle">
        <input
          type="checkbox"
          :checked="autoRebuild"
          :disabled="setAutoRebuild.isPending.value"
          @change="setAutoRebuild.mutate(!autoRebuild)"
        />
        Auto-rebuild on every change
      </label>

      <p class="modal-hint">
        When on, the public site rebuilds automatically after each save — the manual Rebuild button stays disabled.
      </p>

      <button type="button" class="btn-close" @click="emit('close')">Close</button>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal-panel {
  width: 22rem;
  padding: 1.5rem;
  border-radius: 0.75rem;
  background: #161616;
  border: 1px solid #2a2a2a;
}

.modal-title {
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 1rem;
}

.auto-rebuild-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #d0d0d0;
  cursor: pointer;
}

.modal-hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #777777;
}

.btn-close {
  margin-top: 1.25rem;
  padding: 0.375rem 1rem;
  border-radius: 0.375rem;
  border: none;
  background: #2a2a2a;
  color: #e2e8f0;
  font-size: 0.8125rem;
  cursor: pointer;
}
.btn-close:hover {
  background: #333333;
}
</style>
```

- [ ] **Step 2: Write `RebuildBar.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useSiteRebuild } from '@/composables/useSiteRebuild'
import { rebuildAreaLabel } from '@/config/rebuildAreas'
import RebuildSettingsModal from './RebuildSettingsModal.vue'

const { isBuilding, autoRebuild, pendingAreas, rebuild } = useSiteRebuild()

const showPending = ref(false)
const showSettings = ref(false)

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}
</script>

<template>
  <div class="rebuild-bar">
    <div class="rebuild-bar-pending">
      <button
        type="button"
        class="pending-toggle"
        :disabled="pendingAreas.length === 0"
        @click="showPending = !showPending"
      >
        <span class="pending-count">{{ pendingAreas.length }}</span>
        pending change{{ pendingAreas.length === 1 ? '' : 's' }}
      </button>

      <div v-if="showPending && pendingAreas.length > 0" class="pending-popover">
        <div v-for="item in pendingAreas" :key="item.area" class="pending-row">
          <span>{{ rebuildAreaLabel(item.area) }}</span>
          <span class="pending-time">{{ relativeTime(item.changedAt) }}</span>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="btn-rebuild"
      :disabled="isBuilding || autoRebuild || pendingAreas.length === 0"
      :title="autoRebuild ? 'Auto-rebuild is active — changes rebuild automatically' : 'Rebuild the public site'"
      @click="rebuild.mutate()"
    >
      {{ isBuilding ? 'Rebuilding…' : '↺ Rebuild Public Site' }}
    </button>

    <button type="button" class="btn-settings" title="Rebuild settings" @click="showSettings = true">
      ⚙
    </button>

    <RebuildSettingsModal v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.rebuild-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1.25rem;
  border-bottom: 1px solid #222222;
  background: #111111;
  flex-shrink: 0;
}

.rebuild-bar-pending {
  position: relative;
}

.pending-toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  color: #999999;
  font-size: 0.75rem;
  cursor: pointer;
}
.pending-toggle:disabled {
  cursor: default;
  opacity: 0.5;
}
.pending-toggle:not(:disabled):hover {
  background: #1a1a1a;
}

.pending-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  background: #14b8a6;
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 700;
}

.pending-popover {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  min-width: 12rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 20;
}

.pending-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.25rem 0.375rem;
  font-size: 0.75rem;
  color: #d0d0d0;
}

.pending-time {
  color: #666666;
}

.btn-rebuild {
  padding: 0.375rem 1rem;
  border-radius: 0.5rem;
  border: none;
  background: #0d9488;
  color: #ffffff;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms;
}
.btn-rebuild:hover:not(:disabled) {
  background: #14b8a6;
}
.btn-rebuild:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-settings {
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  color: #999999;
  cursor: pointer;
  font-size: 0.875rem;
}
.btn-settings:hover {
  background: #1a1a1a;
}
</style>
```

- [ ] **Step 3: Type-check**

Run: `cd app && pnpm build`
Expected: no new errors from these two files (the pre-existing `WebsiteModulesView.vue` errors from Task 3 remain until Task 5).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/admin/RebuildBar.vue app/src/components/admin/RebuildSettingsModal.vue
git commit -m "Add RebuildBar and RebuildSettingsModal components"
```

---

### Task 5: Mount `RebuildBar` in `AdminLayout`; remove old rebuild UI from `WebsiteModulesView`

**Files:**
- Modify: `app/src/components/admin/AdminLayout.vue`
- Modify: `app/src/views/admin/WebsiteModulesView.vue`

**Interfaces:**
- Consumes: `RebuildBar` (Task 4), `useWebsiteModules()` (Task 3, already trimmed).

- [ ] **Step 1: Mount `RebuildBar` in `AdminLayout.vue`**

Add the import near the top of `<script setup>` (alongside the existing `useAuth` import):

```ts
import RebuildBar from './RebuildBar.vue'
```

Replace the `main-content` block (originally lines 291-293):

```html
    <main class="main-content">
      <slot />
    </main>
```

with:

```html
    <main class="main-content">
      <RebuildBar />
      <div class="main-content-body">
        <slot />
      </div>
    </main>
```

Then replace the `.main-content` CSS rule (originally lines 500-504):

```css
.main-content {
  flex: 1;
  min-width: 0;
  overflow: auto;
}
```

with:

```css
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-content-body {
  flex: 1;
  overflow: auto;
}
```

(`.main-content` no longer scrolls directly — `.main-content-body` does, so the new `RebuildBar` stays pinned above the scrolling page content rather than scrolling away with it.)

- [ ] **Step 2: Remove the old rebuild UI from `WebsiteModulesView.vue`**

In `<script setup>`, replace line 12:

```ts
const { query, rebuildStatusQuery, toggleModule, updateSettings, reorder, setAutoRebuild, rebuild } = useWebsiteModules()
```

with:

```ts
const { query, toggleModule, updateSettings, reorder } = useWebsiteModules()
```

Delete line 14 (`const autoRebuild = computed(...)`), lines 16-17 (`rebuildStatus`/`rebuildStarted` computeds), and the entire elapsed-time-ticker block, lines 19-51 (from the `// ── Elapsed-time ticker ──` comment through the `showBar` computed).

In `<template>`, replace lines 242-296 (the header row containing the title/description plus the auto-rebuild checkbox, rebuild button, and progress bar) with just the title block:

```html
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-white">Website Modules</h1>
      <p class="text-sm text-zinc-500 mt-1">Drag rows to set the nav order. Order takes effect after a rebuild.</p>
    </div>
```

- [ ] **Step 3: Leave the inline edit panel's Save button as-is for now**

The inline edit panel's Save button (lines 542-548, disabled on `updateSettings.isPending.value` alone) is untouched by this task — Task 6 adds the dirty guard to this same view and updates this button's `:disabled` binding then. No action needed here.

- [ ] **Step 4: Type-check**

Run: `cd app && pnpm build`
Expected: no errors (the Task 3 destructuring errors are now resolved).

- [ ] **Step 5: Manually verify in the browser**

Run: `docker compose up -d` (if not already running), open `http://localhost:8081/admin/website-modules`, confirm the Rebuild bar appears above the page content on every admin route (check at least one other route, e.g. `/admin/faqs`), and that it no longer duplicates inside Website Modules itself.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/admin/AdminLayout.vue app/src/views/admin/WebsiteModulesView.vue
git commit -m "Mount RebuildBar globally; remove the old per-page rebuild controls"
```

---

### Task 6: Dirty guard for `WebsiteModulesView`'s inline edit panel

**Files:**
- Modify: `app/src/views/admin/WebsiteModulesView.vue`

**Interfaces:**
- Consumes: `useDirtyGuard` (Task 2).

- [ ] **Step 1: Add the dirty guard**

In `<script setup>`, after the existing draft state declarations (`editingSlug`, `draftNameEn`, `draftNamePl`, `draftSlugEn`, `draftSlugPl`, `draftPerPage`, `draftSettings`, `draftVisibility` — originally lines 102-120), add:

```ts
import { useDirtyGuard } from '@/composables/useDirtyGuard'

const { isDirty, markClean } = useDirtyGuard(() => ({
  name: { en: draftNameEn.value, pl: draftNamePl.value },
  slug: { en: draftSlugEn.value, pl: draftSlugPl.value },
  perPage: draftPerPage.value,
  settings: draftSettings.value,
  visibility: draftVisibility.value,
}))
```

(the `import` line goes with the other imports at the top of the file, not inline where shown above)

- [ ] **Step 2: Snapshot the baseline when a row opens for editing**

At the end of `startEdit()` (originally lines 133-157), immediately before its closing `}`, add:

```ts
  markClean()
```

- [ ] **Step 3: Reset after a successful save**

In `saveEdit()`, immediately after `editingSlug.value = null` (originally line 229), add:

```ts
    markClean()
```

- [ ] **Step 4: Gate the Save button on `isDirty`**

Change the Save button inside the edit panel (lines 542-548, currently disabled on `updateSettings.isPending.value` alone):

```html
<button
  class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  :disabled="updateSettings.isPending.value"
  @click="saveEdit(mod.slug)"
>
  {{ updateSettings.isPending.value ? 'Saving…' : 'Save' }}
</button>
```

to:

```html
<button
  class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  :disabled="updateSettings.isPending.value || !isDirty"
  @click="saveEdit(mod.slug)"
>
  {{ updateSettings.isPending.value ? 'Saving…' : 'Save' }}
</button>
```

- [ ] **Step 5: Type-check and manually verify**

Run: `cd app && pnpm build`

In the browser, open a module's edit panel, confirm Save starts disabled, becomes enabled after changing a field, and returns to disabled after a successful save (without closing/reopening the panel).

- [ ] **Step 6: Commit**

```bash
git add app/src/views/admin/WebsiteModulesView.vue
git commit -m "Wire useDirtyGuard into the website modules edit panel"
```

---

### Task 7: Dirty guard for the FAQ editor

**Files:**
- Modify: `app/src/components/admin/FaqEditor.vue`

**Interfaces:**
- Consumes: `useDirtyGuard` (Task 2).

The draft state lives in `FaqEditor.vue` itself (not a `forms/` subfolder — it's directly under `app/src/components/admin/`), imported by `app/src/views/admin/FaqsAdminView.vue`. The view renders it with `v-if="editing === faq.id"` (existing row) or `v-if="editing === 'new'"` (new entry) — same unmount-on-close pattern as the Concert/Release/Post/ShopItem forms in Task 10, so no explicit `markClean()` after save is needed here either: `handleSave()` in the view sets `editing.value = null` on success, unmounting `FaqEditor` entirely: the next open remounts it fresh and the load-sync watcher re-snapshots the baseline.

- [ ] **Step 1: Add the dirty guard**

Add the import and, after the existing state declarations (`draft`, `draftModule`, `published` — lines 23-29):

```ts
import { useDirtyGuard } from '@/composables/useDirtyGuard'

const { isDirty, markClean } = useDirtyGuard(() => ({
  question: draft.question,
  answer: draft.answer,
  module: draftModule.value,
  published: published.value,
}))
```

- [ ] **Step 2: Snapshot the baseline when the target changes**

In the `watch(() => props.faq, ..., { immediate: true })` callback (lines 33-44), add `markClean()` as the last statement inside the callback, immediately before its closing `}` (the line just before line 44's `},`):

```ts
watch(
  () => props.faq,
  (faq) => {
    draftModule.value = faq?.module_slug ?? props.moduleSlug
    published.value = faq?.is_published ?? true
    for (const l of LOCALES) {
      draft.question[l] = faq?.question?.[l] ?? ''
      draft.answer[l] = faq?.answer?.[l] ?? ''
    }
    markClean()
  },
  { immediate: true },
)
```

- [ ] **Step 3: Gate the Save button on `isDirty`**

Change the Save button (lines 182-188):

```html
<button
  type="submit"
  class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  :disabled="pending"
>
  {{ pending ? 'Saving…' : 'Save' }}
</button>
```

to:

```html
<button
  type="submit"
  class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  :disabled="pending || !isDirty"
>
  {{ pending ? 'Saving…' : 'Save' }}
</button>
```

- [ ] **Step 4: Type-check and manually verify**

Run: `cd app && pnpm build`

In the browser, open `/admin/faqs`, confirm Save starts disabled when editing an existing FAQ, becomes enabled after a change, and disables again after saving. Also confirm the "new entry" flow: Save starts disabled on an empty draft and enables once a field is filled in.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/admin/FaqEditor.vue
git commit -m "Wire useDirtyGuard into the FAQ editor"
```

---

### Task 8: Replace `useTechRiderEditor`'s hand-rolled `dirty` with `useDirtyGuard`

**Files:**
- Modify: `app/src/composables/useTechRiderEditor.ts`

**Interfaces:**
- Consumes: `useDirtyGuard` (Task 2).
- Produces: same public shape as before — `dirty` is still the name returned (aliased from `isDirty`), so `TechRiderAdminView.vue` needs **no changes** (it reads `dirty.value`, passes `:dirty="dirty"` as a prop, and calls nothing that sets `dirty` directly — `patch()` is its only mutation gateway, which this task changes internally, not at its call sites).

- [ ] **Step 1: Add the import**

```ts
import { useDirtyGuard } from './useDirtyGuard'
```

- [ ] **Step 2: Replace the `dirty` ref declaration**

Replace (originally lines 77-81):

```ts
  const draft = reactive<RiderDraft>(emptyDraft())
  const dirty = ref(false)
  /** Which rider the draft was loaded from, so a refetch is not mistaken for a switch. */
  const loadedId = ref<number | null>(null)
```

with:

```ts
  const draft = reactive<RiderDraft>(emptyDraft())
  /** Which rider the draft was loaded from, so a refetch is not mistaken for a switch. */
  const loadedId = ref<number | null>(null)
  const { isDirty: dirty, markClean } = useDirtyGuard(() => draft)
```

(`dirty` is still the local name used everywhere below and in the returned object — only its declaration changes, from a plain ref to a computed alias.)

- [ ] **Step 3: Replace `dirty.value = false` on load with `markClean()`**

In the `watch(() => riderQ.data.value, ...)` callback (originally lines 82-113), replace line 110:

```ts
      dirty.value = false
```

with:

```ts
      markClean()
```

The guard at line 91 (`if (dirty.value && rider.id === loadedId.value) return`) is unchanged — `dirty.value` still reads correctly through the computed alias.

- [ ] **Step 4: Remove the manual set in `patch()`**

Replace (originally lines 116-119):

```ts
  function patch<K extends keyof RiderDraft>(key: K, value: RiderDraft[K]) {
    draft[key] = value
    dirty.value = true
  }
```

with:

```ts
  /** Every mutation of the draft goes through here; `dirty` is now derived, not flagged. */
  function patch<K extends keyof RiderDraft>(key: K, value: RiderDraft[K]) {
    draft[key] = value
  }
```

- [ ] **Step 5: Replace `dirty.value = false` after save with `markClean()`**

In `save()` (originally lines 166-188), replace line 177:

```ts
      dirty.value = false
```

with:

```ts
      markClean()
```

- [ ] **Step 6: Type-check**

Run: `cd app && pnpm build`
Expected: no errors — `TechRiderAdminView.vue` and `RiderPublishModal` still receive a `dirty` of the same reactive shape (a `Ref`/`ComputedRef` with `.value: boolean`), unchanged from their perspective.

- [ ] **Step 7: Manually verify**

Run: open `/admin/tech-rider`, edit a rider, confirm the "Unsaved changes" hint and the discard-confirm on switching riders still work exactly as before, and that saving clears the dirty state.

- [ ] **Step 8: Commit**

```bash
git add app/src/composables/useTechRiderEditor.ts
git commit -m "Replace useTechRiderEditor's hand-rolled dirty ref with useDirtyGuard"
```

---

### Task 9: Replace hand-rolled `dirty` in `MemberDefaultGear.vue` and `MemberSetupsPanel.vue`

**Files:**
- Modify: `app/src/components/band-member/MemberDefaultGear.vue`
- Modify: `app/src/components/band-member/MemberSetupsPanel.vue`

**Interfaces:**
- Consumes: `useDirtyGuard` (Task 2).

- [ ] **Step 1: `MemberDefaultGear.vue` — add the import and replace the `dirty` ref**

Replace (originally lines 24-26):

```ts
const items = ref<DefaultGearItem[]>([])
const saving = ref(false)
const dirty  = ref(false)
```

with:

```ts
import { useDirtyGuard } from '@/composables/useDirtyGuard'

const items = ref<DefaultGearItem[]>([])
const saving = ref(false)
const { isDirty: dirty, markClean } = useDirtyGuard(() => items.value)
```

(the `import` line goes with the file's other imports, not inline as shown)

- [ ] **Step 2: `MemberDefaultGear.vue` — replace `dirty.value = false` on prop load**

In the `watch(() => props.member.default_gear, ...)` callback (originally lines 28-34), replace:

```ts
    dirty.value = false
```

with:

```ts
    markClean()
```

- [ ] **Step 3: `MemberDefaultGear.vue` — remove the manual `dirty.value = true` sets**

Delete the `dirty.value = true` line from each of `addItem()` (originally line 46), `removeItem()` (line 51), and `patchItem()` (line 56) — these three functions keep every other line unchanged; `isDirty` now derives automatically from `items.value` changing.

- [ ] **Step 4: `MemberDefaultGear.vue` — replace `dirty.value = false` after save**

In `save()` (originally lines 59-70), replace:

```ts
    dirty.value = false
```

with:

```ts
    markClean()
```

The Save button's existing `:disabled="saving || !dirty"` binding (originally line 160) needs no change — `dirty` still reads the same way through the computed alias.

- [ ] **Step 5: `MemberDefaultGear.vue` — type-check**

Run: `cd app && pnpm build`

- [ ] **Step 6: `MemberDefaultGear.vue` — commit**

```bash
git add app/src/components/band-member/MemberDefaultGear.vue
git commit -m "Replace MemberDefaultGear's hand-rolled dirty ref with useDirtyGuard"
```

- [ ] **Step 7: `MemberSetupsPanel.vue` — add the dirty guard**

Add the import and replace the state declarations (lines 32-37):

```ts
const name = ref('')
const instrumentId = ref<number | null>(null)
const rig = ref<RigSpec>(defaultRigSpec())
const dirty = ref(false)
/** Which setup the draft was loaded from, so a refetch is not mistaken for a switch. */
const loadedId = ref<number | null>(null)
```

with:

```ts
const name = ref('')
const instrumentId = ref<number | null>(null)
const rig = ref<RigSpec>(defaultRigSpec())
/** Which setup the draft was loaded from, so a refetch is not mistaken for a switch. */
const loadedId = ref<number | null>(null)
const { isDirty: dirty, markClean } = useDirtyGuard(() => ({
  name: name.value,
  instrumentId: instrumentId.value,
  rig: rig.value,
}))
```

(add `import { useDirtyGuard } from '@/composables/useDirtyGuard'` with the file's other imports)

- [ ] **Step 8: `MemberSetupsPanel.vue` — wire baseline resets and remove manual flagging**

In the `watch(() => setupQ.data.value, ..., { immediate: true })` callback (lines 39-62), replace line 59:

```ts
    dirty.value = false
```

with:

```ts
    markClean()
```

In `onRigChange()` (lines 64-67), remove the `dirty.value = true` line:

```ts
function onRigChange(field: RigField, value: unknown) {
  rig.value = { ...rig.value, [field]: value } as RigSpec
}
```

In the template, remove `@input="dirty = true"` from the name input (line 231-232) — it becomes:

```html
<input
  v-model="name"
  class="meta-input"
  placeholder="e.g. Festival rig"
/>
```

And remove the `; dirty = true` fragment from the instrument select's `@change` handler (line 239) — it becomes:

```html
@change="instrumentId = Number(($event.target as HTMLSelectElement).value) || null"
```

In `save()` (lines 87-111), replace line 102:

```ts
    dirty.value = false
```

with:

```ts
    markClean()
```

`openSetup()`'s `if (dirty.value && !confirm('Discard unsaved changes to this setup?')) return` guard (line 155) needs no change — `dirty.value` still reads correctly through the computed alias.

- [ ] **Step 9: `MemberSetupsPanel.vue` — align the Save button with the rest of the app**

The design spec requires every Save button to reflect real dirty state. This file's Save button currently disables only on `saving` (originally line 267 — `:disabled="saving"`, notably *not* gated on `dirty`, unlike `MemberDefaultGear.vue`'s `:disabled="saving || !dirty"`). Change it to match:

```html
:disabled="saving || !dirty"
```

- [ ] **Step 10: `MemberSetupsPanel.vue` — type-check and manually verify**

Run: `cd app && pnpm build`

In the browser, open a band member's setups panel, confirm Save starts disabled, enables after changing the rig/name/instrument, and disables again after saving; confirm the discard-confirm on switching setups still fires correctly.

- [ ] **Step 11: `MemberSetupsPanel.vue` — commit**

```bash
git add app/src/components/band-member/MemberSetupsPanel.vue
git commit -m "Replace MemberSetupsPanel's hand-rolled dirty ref with useDirtyGuard"
```

---

### Task 10: Dirty guard for Concert, Release, Post, and Shop Item forms

**Files:**
- Modify: `app/src/components/admin/forms/ConcertForm.vue`
- Modify: `app/src/components/admin/forms/ReleaseForm.vue`
- Modify: `app/src/components/admin/forms/PostForm.vue`
- Modify: `app/src/components/admin/forms/ShopItemForm.vue`

**Interfaces:**
- Consumes: `useDirtyGuard` (Task 2).

All four forms share one shape: a reactive `form` object (plus a couple of extra refs for some of them) populated by a `watch(() => props.initial, ..., { immediate: true })` callback, with the actual save/network call living in the parent view (not these components) — the form just emits `submit`. Because a successful submit closes the modal and unmounts the form (confirmed pattern: `closeModal()` in each parent view resets `editingId`/`showModal`), there is no separate "mark clean after save" hook needed here — reopening the modal remounts the component fresh, re-running the baseline watcher. Each subtask below follows the same four steps.

- [ ] **Step 1: `ConcertForm.vue`**

Add the import and the dirty guard, tracking `form` plus the two extra draft refs (`lineup`, `links`):

```ts
import { useDirtyGuard } from '@/composables/useDirtyGuard'

const { isDirty } = useDirtyGuard(() => ({ ...form, lineup: lineup.value, links: links.value }))
```

This form also has pending-file state (`posterFile`, `posterPreview`, `posterDelete`, originally lines 30-32) that a plain deep-equal can't track (`File` objects aren't JSON-cloneable). Add a `canSave` computed that ORs the two together:

```ts
const canSave = computed(() => isDirty.value || posterFile.value !== null || posterDelete.value)
```

(`computed` must already be imported from `vue` in this file — add it to the existing import if not.)

In the `watch(() => props.initial, ..., { immediate: true })` callback (originally lines 113-165), the baseline needs to be taken *after* every field is populated — add `markClean()` (returned alongside `isDirty` from `useDirtyGuard`, so change the destructure to `const { isDirty, markClean } = useDirtyGuard(...)`) as the very last statement inside that callback, immediately before its closing `}` (the line just before the callback's `{ immediate: true }` options object).

Change the Save button's `:disabled` (originally lines 590-595, currently `:disabled="loading"`) to:

```html
:disabled="loading || !canSave"
```

- [ ] **Step 2: `ReleaseForm.vue`**

Same pattern, tracking `form` plus `tracks`:

```ts
import { useDirtyGuard } from '@/composables/useDirtyGuard'

const { isDirty, markClean } = useDirtyGuard(() => ({ ...form, tracks: tracks.value }))
const canSave = computed(() => isDirty.value || coverFile.value !== null || coverDelete.value)
```

(`coverFile`/`coverDelete` are the existing pending-cover-upload refs, originally lines 36-39.)

Add `markClean()` as the last statement inside the `watch(() => props.initial, ..., { immediate: true })` callback (originally lines 124-187), immediately before its closing `}`.

Change the Save button's `:disabled` (originally lines 427-433, currently `:disabled="loading"`) to:

```html
:disabled="loading || !canSave"
```

- [ ] **Step 3: `PostForm.vue`**

`blocks` is already a field inside the `form` reactive object (not a separate ref), so no extra state composition is needed here — and there's no file-upload state to OR in:

```ts
import { useDirtyGuard } from '@/composables/useDirtyGuard'

const { isDirty, markClean } = useDirtyGuard(() => form)
```

Add `markClean()` as the last statement inside the `watch(() => props.initial, ..., { immediate: true })` callback (originally lines 56-77), immediately before its closing `}`.

Change the Save button's `:disabled` (originally lines 176-181, currently `:disabled="loading"`) to:

```html
:disabled="loading || !isDirty"
```

- [ ] **Step 4: `ShopItemForm.vue`**

Track `form` plus `prices` (variants save independently via their own mutations, per the parent view's `handleAddVariant`/`handleSaveVariant`/`handleDeleteVariant`, and are out of scope for this form's Save button):

```ts
import { useDirtyGuard } from '@/composables/useDirtyGuard'

const { isDirty, markClean } = useDirtyGuard(() => ({ ...form, prices: { ...prices } }))
```

Add `markClean()` as the last statement inside the `watch(() => props.initial, ..., { immediate: true })` callback (originally lines 68-108), immediately before its closing `}`.

Change the Save button's `:disabled` (originally lines 373-379, currently `:disabled="loading"`) to:

```html
:disabled="loading || !isDirty"
```

- [ ] **Step 5: Type-check all four**

Run: `cd app && pnpm build`

- [ ] **Step 6: Manually verify each**

For each of the four admin screens (`/admin/concerts`, `/admin/releases`, `/admin/posts`, `/admin/shop`): open "Create new", confirm Save is disabled until a required field is filled in (since an empty form is deep-equal to the baseline); open "Edit" on an existing record, confirm Save starts disabled and enables on any change.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/admin/forms/ConcertForm.vue app/src/components/admin/forms/ReleaseForm.vue app/src/components/admin/forms/PostForm.vue app/src/components/admin/forms/ShopItemForm.vue
git commit -m "Wire useDirtyGuard into concert, release, post, and shop item forms"
```

---

### Task 11: Dirty guard for the band profile form

**Files:**
- Modify: `app/src/views/admin/BandProfileAdminView.vue`

**Interfaces:**
- Consumes: `useDirtyGuard` (Task 2).

This task covers only the shared Bio/Career/Contacts/Stats/EPK form and its one Save button (`saveProfile()`) — the Social and Logo tabs have their own independent save flows (`saveSocialLinks`, `BandLogoManager`'s `saveContextPins`) and are out of scope here.

- [ ] **Step 1: Add the dirty guard**

Add the import and, after the `form` reactive declaration (originally lines 39-64 — do not include `contextPins`, originally lines 65-67, since that belongs to the separate Logo tab save flow):

```ts
import { useDirtyGuard } from '@/composables/useDirtyGuard'

const { isDirty, markClean } = useDirtyGuard(() => form)
```

- [ ] **Step 2: Snapshot the baseline once the profile loads**

In the `watch(() => query.data.value, ..., { immediate: true })` callback (originally lines 79-115), add `markClean()` as the very last statement, immediately before its closing `}`.

- [ ] **Step 3: Reset after a successful save**

In `saveProfile()` (originally lines 126-168), immediately after `saved.value = true` (inside the `try` block, right after the `await update.mutateAsync({...})` call resolves), add:

```ts
    markClean()
```

- [ ] **Step 4: Gate the Save button on `isDirty`**

Change the Save button (originally lines 568-572):

```html
<div v-if="section !== 'social' && section !== 'logo'" class="flex justify-end pt-1">
  <button type="submit" :disabled="saving" class="btn-save" :class="{ 'btn-save--ok': saved }">
    {{ saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save profile' }}
  </button>
</div>
```

to:

```html
<div v-if="section !== 'social' && section !== 'logo'" class="flex justify-end pt-1">
  <button type="submit" :disabled="saving || !isDirty" class="btn-save" :class="{ 'btn-save--ok': saved }">
    {{ saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save profile' }}
  </button>
</div>
```

- [ ] **Step 5: Type-check and manually verify**

Run: `cd app && pnpm build`

In the browser, open `/admin/band-profile`, confirm the Save button starts disabled on the Bio tab, enables after editing a field, and disables again after saving. Switch to the Social and Logo tabs and confirm their own save buttons are unaffected (still visible and working, since this task deliberately left them alone).

- [ ] **Step 6: Commit**

```bash
git add app/src/views/admin/BandProfileAdminView.vue
git commit -m "Wire useDirtyGuard into the band profile form"
```

---

### Task 12: E2E coverage

**Files:**
- Create: `e2e/tests/admin/rebuild-bar.spec.ts`
- Modify: one existing admin form spec (locate via Step 1) to add a Save-button-dirty-gating check

**Interfaces:**
- Consumes: this codebase's existing Playwright admin auth pattern.

- [ ] **Step 1: Read an existing admin spec for conventions first**

Open one existing file under `e2e/tests/admin/` (check for `website-modules.spec.ts` or `hero-images.spec.ts` first, since the root CLAUDE.md documents a specific footgun in `hero-images.spec.ts`: `test.use({ storageState })` only restores cookies for an API `request.newContext`, not this app's `localStorage`-held bearer token — so any spec issuing raw API calls reads `auth_token` out of the storage-state JSON file directly and sends it as an `Authorization: Bearer` header, rather than relying on `request.newContext({ storageState })` alone). Confirm the exact helper/import used for this, and the general `test()`/`expect()` conventions (Playwright test framework, `workers` pinned to 2 per `app/playwright.config.ts`), then follow the same conventions in Steps 2-3 below rather than the illustrative shape given here.

- [ ] **Step 2: Write `rebuild-bar.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

test.describe('rebuild bar', () => {
  test('shows a pending change after editing a FAQ, and clears it after a manual rebuild', async ({ page }) => {
    await page.goto('/admin/faqs')

    // Create a throwaway FAQ to produce a real pending change.
    await page.getByRole('button', { name: /add.*faq/i }).click()
    await page.getByLabel(/question/i).first().fill('E2E pending-change probe')
    await page.getByLabel(/answer/i).first().fill('Probe answer')
    await page.getByRole('button', { name: /save/i }).click()

    await expect(page.getByText(/pending change/i)).toContainText('1')

    await page.getByRole('button', { name: /pending change/i }).click()
    await expect(page.getByText('FAQs')).toBeVisible()

    await page.getByRole('button', { name: /rebuild public site/i }).click()
    await expect(page.getByText(/pending change/i)).toContainText('0')
  })
})
```

Adjust selectors to match the actual FAQ editor's real labels/roles once Task 7's implementation is in place — the shape above (create something, assert the pending badge, open the popover, trigger rebuild, assert it clears) is what matters, not the exact selector text.

- [ ] **Step 3: Add a Save-disabled-until-dirty check to one existing form spec**

In whichever existing spec already exercises the FAQ editor (or another of the ten wired forms) end-to-end, add one assertion sequence: open an existing record for editing, assert the Save button is `toBeDisabled()`, change one field, assert it is enabled, save, assert it becomes disabled again.

- [ ] **Step 4: Run the E2E suite**

Run: `cd app && pnpm test:e2e -- rebuild-bar`
Then run the full suite: `bash scripts/test-all.sh --skip-unit` (or `make test-all` if `make` is available) to confirm nothing else regressed.

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/admin/rebuild-bar.spec.ts
git commit -m "Add E2E coverage for the rebuild bar and dirty-gated Save buttons"
```

(add the modified existing spec file from Step 3 to this commit too)

---

## Self-Review Notes

- **Spec coverage:** area registry (Task 1), `useSiteRebuild`/`useWebsiteModules` cleanup (Task 3), `RebuildBar`/`RebuildSettingsModal` (Task 4), global mounting + old-UI removal (Task 5), and `useDirtyGuard` wired into all ten named forms (Tasks 6-11) all map to the approved design spec. E2E coverage (Task 12) matches the spec's Testing section.
- **Type consistency:** `useDirtyGuard<T>(getState: () => T): { isDirty: ComputedRef<boolean>; markClean: () => void }` is defined once in Task 2 and every consuming task destructures the same two names (`isDirty`, `markClean`) with no renaming except the deliberate `isDirty: dirty` alias in Tasks 8-9, called out explicitly where used.
- **Known gaps flagged rather than guessed:** Task 7 (FAQ editor) and Task 9's `MemberSetupsPanel.vue` portion require a read-the-file-first step because this plan's research never captured their full source — each names exactly what to look for and how to apply the same pattern used elsewhere in this plan, rather than inventing unverified code. Task 12 similarly defers to whatever this codebase's real Playwright conventions turn out to be.
