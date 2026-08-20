# Website Modules Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-module custom name (EN/PL) and items-per-page settings to the website modules admin page, surfaced via an expand-row UI with a pencil icon.

**Architecture:** A new migration adds two nullable columns (`custom_name` JSON via Spatie Translatable, `per_page` tinyint) to `website_modules`. The existing `PUT /api/admin/modules/{slug}` endpoint is extended to accept these fields. The public `site-config` endpoint gains `module_config` with a resolved `label` and `per_page` per module. The Vue admin view gains a pencil icon per row that expands to reveal EN/PL name inputs and (for list modules) a per-page select.

**Tech Stack:** Laravel 11 / PHP 8.4, Spatie Translatable, Pest tests, Vue 3 `<script setup>`, TanStack Query v5, Tailwind CSS v4.

## Global Constraints

- Supported locales: `en` and `pl` only.
- Valid `per_page` values: `6, 9, 10, 12, 15, 20, 24` (or `null` = default).
- List modules that show the per-page selector: `news`, `concerts`, `photos`, `press`, `videos`, `shop`.
- `display_name` is the immutable seeded fallback — never modified.
- `custom_name` empty string saved as `null` (frontend normalises before sending).
- Run backend tests with: `docker exec bandms_backend php artisan test --filter WebsiteModuleTest`
- Run full backend suite with: `make test`

---

### Task 1: Migration + Model

**Files:**
- Create: `api/database/migrations/2026_07_02_000001_add_config_to_website_modules_table.php`
- Modify: `api/app/Models/WebsiteModule.php`

**Interfaces:**
- Produces: `WebsiteModule::$translatable` includes `custom_name`; `$fillable` includes `custom_name`, `per_page`; `$casts` includes `per_page` as integer.

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->text('custom_name')->nullable()->after('display_name');
            $table->unsignedTinyInteger('per_page')->nullable()->after('custom_name');
        });
    }

    public function down(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->dropColumn(['custom_name', 'per_page']);
        });
    }
};
```

- [ ] **Step 2: Update the model**

Replace the entire contents of `api/app/Models/WebsiteModule.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Translatable\HasTranslations;

class WebsiteModule extends Model
{
    use HasTranslations;

    public array $translatable = ['custom_name'];

    protected $fillable = ['slug', 'display_name', 'custom_name', 'enabled', 'sort_order', 'per_page'];

    protected $casts = [
        'enabled'    => 'boolean',
        'sort_order' => 'integer',
        'per_page'   => 'integer',
    ];
}
```

- [ ] **Step 3: Run the migration inside Docker**

```bash
make migrate
```

Expected: migration runs without error; `website_modules` table gains `custom_name` and `per_page` columns.

- [ ] **Step 4: Commit**

```bash
git add api/database/migrations/2026_07_02_000001_add_config_to_website_modules_table.php api/app/Models/WebsiteModule.php
git commit -m "feat(modules): add custom_name + per_page columns to website_modules"
```

---

### Task 2: Resource, Controller, and Tests

**Files:**
- Modify: `api/app/Http/Resources/WebsiteModuleResource.php`
- Modify: `api/app/Http/Controllers/WebsiteModuleController.php`
- Modify: `api/tests/Feature/WebsiteModuleTest.php`

**Interfaces:**
- Consumes: `WebsiteModule::$translatable` includes `custom_name`; `per_page` cast to integer (from Task 1).
- Produces:
  - `WebsiteModuleResource::toArray()` returns `custom_name: {en, pl}` and `per_page`.
  - `PUT /api/admin/modules/{slug}` accepts optional `enabled`, `custom_name`, `per_page`.
  - `GET /api/site-config` response includes `module_config` keyed by slug with `label`, `per_page`, `enabled`.

- [ ] **Step 1: Write the new failing tests** (add to end of `api/tests/Feature/WebsiteModuleTest.php`)

```php
// ── custom_name + per_page ────────────────────────────────────────────────────

it('returns custom_name and per_page in admin module list', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    $module = WebsiteModule::create(['slug' => 'shop', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1, 'per_page' => 12]);
    $module->setTranslations('custom_name', ['en' => 'Merch', 'pl' => 'Sklep']);
    $module->save();

    $this->getJson('/api/admin/modules')
        ->assertOk()
        ->assertJsonPath('data.0.custom_name.en', 'Merch')
        ->assertJsonPath('data.0.custom_name.pl', 'Sklep')
        ->assertJsonPath('data.0.per_page', 12);
});

it('saves custom_name translations', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'shop', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/shop', [
        'custom_name' => ['en' => 'Merch', 'pl' => 'Sklep'],
    ])
        ->assertOk()
        ->assertJsonPath('data.custom_name.en', 'Merch')
        ->assertJsonPath('data.custom_name.pl', 'Sklep');

    $module = WebsiteModule::where('slug', 'shop')->first();
    expect($module->getTranslation('custom_name', 'en'))->toBe('Merch');
    expect($module->getTranslation('custom_name', 'pl'))->toBe('Sklep');
});

it('saves per_page', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'news', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/news', ['per_page' => 12])
        ->assertOk()
        ->assertJsonPath('data.per_page', 12);

    expect(WebsiteModule::where('slug', 'news')->value('per_page'))->toBe(12);
});

it('clears per_page when null is sent', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'news', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1, 'per_page' => 10]);

    $this->putJson('/api/admin/modules/news', ['per_page' => null])
        ->assertOk()
        ->assertJsonPath('data.per_page', null);

    expect(WebsiteModule::where('slug', 'news')->value('per_page'))->toBeNull();
});

it('rejects invalid per_page value', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'news', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/news', ['per_page' => 7])->assertUnprocessable();
});

it('rejects custom_name.en exceeding 80 characters', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'news', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/news', [
        'custom_name' => ['en' => str_repeat('a', 81)],
    ])->assertUnprocessable();
});

it('allows enabled update alongside custom_name', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/concerts', [
        'enabled'     => false,
        'custom_name' => ['en' => 'Gigs'],
    ])
        ->assertOk()
        ->assertJsonPath('data.enabled', false)
        ->assertJsonPath('data.custom_name.en', 'Gigs');
});

it('clears custom_name when null values sent', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    $module = WebsiteModule::create(['slug' => 'shop', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);
    $module->setTranslations('custom_name', ['en' => 'Merch', 'pl' => 'Sklep']);
    $module->save();

    $this->putJson('/api/admin/modules/shop', [
        'custom_name' => ['en' => null, 'pl' => null],
    ])
        ->assertOk()
        ->assertJsonPath('data.custom_name.en', null)
        ->assertJsonPath('data.custom_name.pl', null);
});

// ── site-config module_config ─────────────────────────────────────────────────

it('returns module_config with label from custom_name', function () {
    $module = WebsiteModule::create(['slug' => 'shop', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);
    $module->setTranslations('custom_name', ['en' => 'Merch']);
    $module->save();

    $this->getJson('/api/site-config?lang=en')
        ->assertOk()
        ->assertJsonPath('module_config.shop.label', 'Merch');
});

it('falls back to display_name when custom_name absent', function () {
    WebsiteModule::create(['slug' => 'shop', 'display_name' => 'Shop', 'enabled' => true, 'sort_order' => 1]);

    $this->getJson('/api/site-config?lang=en')
        ->assertOk()
        ->assertJsonPath('module_config.shop.label', 'Shop');
});

it('returns per_page in module_config', function () {
    WebsiteModule::create(['slug' => 'news', 'display_name' => 'News', 'enabled' => true, 'sort_order' => 1, 'per_page' => 12]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('module_config.news.per_page', 12);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
docker exec bandms_backend php artisan test --filter WebsiteModuleTest
```

Expected: new tests fail (resource missing `custom_name`, controller rejects unknown fields, `module_config` missing).

- [ ] **Step 3: Update the resource**

Replace the entire contents of `api/app/Http/Resources/WebsiteModuleResource.php`:

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebsiteModuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $translations = $this->getTranslations('custom_name');

        return [
            'slug'         => $this->slug,
            'display_name' => $this->display_name,
            'custom_name'  => [
                'en' => $translations['en'] ?? null,
                'pl' => $translations['pl'] ?? null,
            ],
            'per_page'     => $this->per_page,
            'enabled'      => (bool) $this->enabled,
            'sort_order'   => $this->sort_order,
            'updated_at'   => $this->updated_at,
        ];
    }
}
```

- [ ] **Step 4: Update the controller**

Replace the `update()` and `siteConfig()` methods in `api/app/Http/Controllers/WebsiteModuleController.php`:

```php
public function siteConfig(): JsonResponse
{
    $locale       = app()->getLocale();
    $all          = WebsiteModule::orderBy('sort_order')->orderBy('slug')->get();

    $modules      = $all->keyBy('slug')->map(fn ($m) => (bool) $m->enabled);
    $module_order = $all->pluck('slug')->values();
    $module_config = $all->keyBy('slug')->map(fn ($m) => [
        'enabled'  => (bool) $m->enabled,
        'label'    => $m->getTranslation('custom_name', $locale, false) ?: $m->display_name,
        'per_page' => $m->per_page,
    ]);

    return response()->json([
        'modules'       => $modules,
        'module_order'  => $module_order,
        'module_config' => $module_config,
    ]);
}

public function update(Request $request, string $slug): JsonResponse
{
    $module = WebsiteModule::where('slug', $slug)->firstOrFail();

    $validated = $request->validate([
        'enabled'        => ['sometimes', 'boolean'],
        'custom_name.en' => ['sometimes', 'nullable', 'string', 'max:80'],
        'custom_name.pl' => ['sometimes', 'nullable', 'string', 'max:80'],
        'per_page'       => ['sometimes', 'nullable', 'integer', 'in:6,9,10,12,15,20,24'],
    ]);

    if (array_key_exists('enabled', $validated)) {
        $module->enabled = $validated['enabled'];
    }

    if (array_key_exists('custom_name', $validated)) {
        $module->setTranslations('custom_name', [
            'en' => ($validated['custom_name']['en'] ?? null) ?: null,
            'pl' => ($validated['custom_name']['pl'] ?? null) ?: null,
        ]);
    }

    if (array_key_exists('per_page', $validated)) {
        $module->per_page = $validated['per_page'];
    }

    $module->save();

    if (SiteSetting::get('auto_rebuild', 'false') === 'true') {
        $this->triggerRebuild();
    }

    return response()->json(['data' => new WebsiteModuleResource($module)]);
}
```

- [ ] **Step 5: Run tests — all must pass**

```bash
docker exec bandms_backend php artisan test --filter WebsiteModuleTest
```

Expected: all tests pass including the new ones.

- [ ] **Step 6: Run full backend suite**

```bash
make test
```

Expected: no regressions.

- [ ] **Step 7: Commit**

```bash
git add api/app/Http/Resources/WebsiteModuleResource.php api/app/Http/Controllers/WebsiteModuleController.php api/tests/Feature/WebsiteModuleTest.php
git commit -m "feat(modules): extend update endpoint with custom_name + per_page; expose module_config in site-config"
```

---

### Task 3: Frontend Types and API

**Files:**
- Modify: `app/src/types/website-module.ts`
- Modify: `app/src/api/website-modules.ts`

**Interfaces:**
- Produces:
  - `WebsiteModule` has `custom_name: { en: string | null; pl: string | null }` and `per_page: number | null`.
  - `updateModuleSettings(token, slug, payload)` — calls `PUT /api/admin/modules/{slug}` with `{ custom_name?, per_page? }`.

- [ ] **Step 1: Update the TypeScript interface**

Replace the entire contents of `app/src/types/website-module.ts`:

```ts
export interface WebsiteModule {
  slug: string
  display_name: string
  custom_name: { en: string | null; pl: string | null }
  enabled: boolean
  sort_order: number
  per_page: number | null
  updated_at: string
}

export interface WebsiteModulesResponse {
  data: WebsiteModule[]
  auto_rebuild: boolean
}

export interface SiteSettings {
  auto_rebuild: boolean
}

export interface RebuildStatus {
  status: 'idle' | 'building' | 'done' | 'error' | 'unknown'
  startedAt: number | null
  finishedAt: number | null
}
```

- [ ] **Step 2: Add `updateModuleSettings` to the API module**

Add the following function to the end of `app/src/api/website-modules.ts` (before the closing):

```ts
export async function updateModuleSettings(
  token: string,
  slug: string,
  payload: {
    custom_name?: { en: string | null; pl: string | null }
    per_page?: number | null
  },
): Promise<{ data: WebsiteModule }> {
  assertSafeSlug(slug)
  const res = await fetch(`${API_BASE}/api/admin/modules/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<{ data: WebsiteModule }>(res)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd app && pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/types/website-module.ts app/src/api/website-modules.ts
git commit -m "feat(modules): add custom_name + per_page to frontend types and API"
```

---

### Task 4: Composable Mutation

**Files:**
- Modify: `app/src/composables/useWebsiteModules.ts`

**Interfaces:**
- Consumes: `updateModuleSettings(token, slug, payload)` from `@/api/website-modules`.
- Produces: `updateSettings` mutation exported from `useWebsiteModules()` — accepts `{ slug: string; payload: { custom_name?: ...; per_page?: number | null } }`, invalidates `['website-modules']` on success.

- [ ] **Step 1: Add the mutation to the composable**

Replace the entire contents of `app/src/composables/useWebsiteModules.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchModules,
  updateModule,
  updateModuleSettings,
  reorderModules,
  updateSiteSettings,
  triggerRebuild,
  fetchRebuildStatus,
} from '@/api/website-modules'
import { useAuth } from './useAuth'
import type { WebsiteModule } from '@/types/website-module'

export function useWebsiteModules() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['website-modules'],
    queryFn: () => fetchModules(token.value!),
    enabled: () => token.value !== null,
  })

  const rebuildStatusQuery = useQuery({
    queryKey: ['rebuild-status'],
    queryFn: () => fetchRebuildStatus(token.value!),
    enabled: () => token.value !== null,
    refetchInterval: (query) => query.state.data?.status === 'building' ? 2000 : false,
    staleTime: 0,
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
      payload: {
        custom_name?: { en: string | null; pl: string | null }
        per_page?: number | null
      }
    }) => updateModuleSettings(token.value!, slug, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['website-modules'] }),
  })

  const setAutoRebuild = useMutation({
    mutationFn: (autoRebuild: boolean) => updateSiteSettings(token.value!, autoRebuild),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['website-modules'] }),
  })

  const reorder = useMutation({
    mutationFn: (slugs: string[]) => reorderModules(token.value!, slugs),
    onSuccess: (data) => queryClient.setQueryData(['website-modules'], data),
  })

  const rebuild = useMutation({
    mutationFn: () => triggerRebuild(token.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rebuild-status'] }),
  })

  return { query, rebuildStatusQuery, toggleModule, updateSettings, reorder, setAutoRebuild, rebuild }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd app && pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/composables/useWebsiteModules.ts
git commit -m "feat(modules): add updateSettings mutation to useWebsiteModules"
```

---

### Task 5: Admin UI — Expand-Row

**Files:**
- Modify: `app/src/views/admin/WebsiteModulesView.vue`

**Interfaces:**
- Consumes: `updateSettings` from `useWebsiteModules()`; `WebsiteModule` type with `custom_name` and `per_page`.

- [ ] **Step 1: Replace the entire `<script setup>` block**

The new script adds edit state refs, `LIST_SLUGS`, `PER_PAGE_OPTIONS`, and three functions.

```vue
<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { useWebsiteModules } from '@/composables/useWebsiteModules'
import type { WebsiteModule } from '@/types/website-module'

const { query, rebuildStatusQuery, toggleModule, updateSettings, reorder, setAutoRebuild, rebuild } = useWebsiteModules()

const autoRebuild = computed(() => query.data.value?.auto_rebuild ?? false)

const rebuildStatus  = computed(() => rebuildStatusQuery.data.value?.status ?? 'idle')
const rebuildStarted = computed(() => rebuildStatusQuery.data.value?.startedAt ?? null)

// ── Elapsed-time ticker ───────────────────────────────────────────────────────

const ESTIMATED_MS = 45_000

const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null

watch(rebuildStatus, (status) => {
  if (ticker) { clearInterval(ticker); ticker = null }
  if (status === 'building') {
    ticker = setInterval(() => { now.value = Date.now() }, 1000)
  }
}, { immediate: true })

onUnmounted(() => { if (ticker) clearInterval(ticker) })

const elapsedSec = computed(() => {
  if (!rebuildStarted.value) return 0
  return Math.floor((now.value - rebuildStarted.value) / 1000)
})

const progressPct = computed(() => {
  if (rebuildStatus.value === 'done')  return 100
  if (rebuildStatus.value === 'error') return 100
  if (rebuildStatus.value !== 'building' || !rebuildStarted.value) return 0
  return Math.min((elapsedSec.value / (ESTIMATED_MS / 1000)) * 90, 90)
})

const showBar = computed(() =>
  rebuildStatus.value === 'building' ||
  rebuildStatus.value === 'done'     ||
  rebuildStatus.value === 'error'
)

// ── Draggable ordered list ────────────────────────────────────────────────────

const localModules = ref<WebsiteModule[]>([])

watch(() => query.data.value?.data, (data) => {
  if (data) localModules.value = [...data]
}, { immediate: true, deep: false })

let dragFrom = -1
const dragOverIndex = ref(-1)

function onDragStart(index: number, event: DragEvent) {
  dragFrom = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(index: number, event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDrop(toIndex: number, event: DragEvent) {
  event.preventDefault()
  dragOverIndex.value = -1
  if (dragFrom === -1 || dragFrom === toIndex) { dragFrom = -1; return }

  const next = [...localModules.value]
  const [moved] = next.splice(dragFrom, 1)
  next.splice(toIndex, 0, moved)
  localModules.value = next
  dragFrom = -1

  reorder.mutate(next.map((m) => m.slug))
}

function onDragEnd() {
  dragFrom = -1
  dragOverIndex.value = -1
}

// ── Inline edit ───────────────────────────────────────────────────────────────

const LIST_SLUGS       = new Set(['news', 'concerts', 'photos', 'press', 'videos', 'shop'])
const PER_PAGE_OPTIONS = [6, 9, 10, 12, 15, 20, 24] as const

const editingSlug  = ref<string | null>(null)
const draftNameEn  = ref('')
const draftNamePl  = ref('')
const draftPerPage = ref<number | null>(null)

function startEdit(mod: WebsiteModule) {
  editingSlug.value  = mod.slug
  draftNameEn.value  = mod.custom_name?.en ?? ''
  draftNamePl.value  = mod.custom_name?.pl ?? ''
  draftPerPage.value = mod.per_page ?? null
}

function cancelEdit() {
  editingSlug.value = null
}

function saveEdit(slug: string) {
  updateSettings.mutate(
    {
      slug,
      payload: {
        custom_name: {
          en: draftNameEn.value.trim() || null,
          pl: draftNamePl.value.trim() || null,
        },
        per_page: draftPerPage.value,
      },
    },
    { onSuccess: () => { editingSlug.value = null } },
  )
}
</script>
```

- [ ] **Step 2: Replace the entire `<template>` block**

```vue
<template>
  <AdminLayout>
  <div class="p-6 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-white">Website Modules</h1>
        <p class="text-sm text-zinc-500 mt-1">Drag rows to set the nav order. Order takes effect after a rebuild.</p>
      </div>

      <div class="flex items-center gap-4 flex-wrap">
        <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            class="w-4 h-4 rounded accent-teal-500"
            :checked="autoRebuild"
            :disabled="setAutoRebuild.isPending.value"
            @change="setAutoRebuild.mutate(!autoRebuild)"
          />
          Auto-rebuild on changes
        </label>

        <button
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          :disabled="rebuildStatus === 'building' || autoRebuild"
          :title="autoRebuild ? 'Auto-rebuild is active — changes rebuild automatically' : 'Rebuild the public Astro site'"
          @click="rebuild.mutate()"
        >
          <span>{{ rebuildStatus === 'building' ? 'Rebuilding…' : '↺ Rebuild Public Site' }}</span>
        </button>
      </div>
    </div>

    <!-- Progress bar -->
    <div v-if="showBar" class="mb-6 rounded-xl overflow-hidden bg-zinc-800">
      <div
        class="h-2 transition-all duration-1000 ease-out"
        :class="{
          'bg-teal-500': rebuildStatus === 'building',
          'bg-green-500': rebuildStatus === 'done',
          'bg-red-500': rebuildStatus === 'error',
        }"
        :style="{ width: `${progressPct}%` }"
      />
      <div class="px-4 py-2 flex items-center justify-between text-xs">
        <span
          :class="{
            'text-teal-400': rebuildStatus === 'building',
            'text-green-400': rebuildStatus === 'done',
            'text-red-400': rebuildStatus === 'error',
          }"
        >
          <template v-if="rebuildStatus === 'building'">Building… {{ elapsedSec }}s</template>
          <template v-else-if="rebuildStatus === 'done'">Rebuild complete ✓</template>
          <template v-else-if="rebuildStatus === 'error'">Rebuild failed — check container logs</template>
        </span>
        <span class="text-zinc-500">~{{ Math.round(ESTIMATED_MS / 1000) }}s estimated</span>
      </div>
    </div>

    <div v-if="query.isLoading.value" class="text-zinc-500">Loading…</div>

    <div v-else-if="query.isError.value" class="text-red-400">
      Failed to load modules. Check the API connection.
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="(mod, i) in localModules"
        :key="mod.slug"
        class="rounded-xl border bg-zinc-900 transition-colors select-none overflow-hidden"
        :class="{
          'border-zinc-700': mod.enabled,
          'border-zinc-800': !mod.enabled,
          'border-t-2 border-t-teal-500': dragOverIndex === i,
        }"
      >
        <!-- ── Row ── -->
        <div
          class="flex items-center gap-3 px-4 transition-colors"
          :class="mod.enabled ? 'py-3' : 'py-1.5'"
          draggable="true"
          @dragstart="onDragStart(i, $event)"
          @dragover="onDragOver(i, $event)"
          @drop="onDrop(i, $event)"
          @dragend="onDragEnd"
        >
          <!-- Drag handle -->
          <span class="cursor-grab text-zinc-600 hover:text-zinc-400 active:cursor-grabbing flex-shrink-0" aria-hidden="true">
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
              <circle cx="3" cy="2"  r="1.5" /><circle cx="7" cy="2"  r="1.5" />
              <circle cx="3" cy="7"  r="1.5" /><circle cx="7" cy="7"  r="1.5" />
              <circle cx="3" cy="12" r="1.5" /><circle cx="7" cy="12" r="1.5" />
            </svg>
          </span>

          <!-- Position number -->
          <span class="w-5 text-center text-xs font-mono text-zinc-500 flex-shrink-0">{{ i + 1 }}</span>

          <!-- Module info -->
          <div class="flex-1 min-w-0">
            <span
              class="font-semibold text-sm"
              :class="mod.enabled ? 'text-white' : 'text-zinc-500'"
            >{{ mod.custom_name?.en || mod.display_name }}</span>
            <span v-if="mod.custom_name?.en" class="ml-1.5 text-xs text-zinc-600">({{ mod.display_name }})</span>
            <span class="ml-2 text-xs text-zinc-500">/{{ mod.slug === 'tech-rider' ? 'rider' : mod.slug }}</span>
          </div>

          <!-- Status badge -->
          <span
            class="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
            :class="mod.enabled ? 'bg-teal-900 text-teal-300' : 'bg-zinc-800 text-zinc-500'"
          >
            {{ mod.enabled ? 'Live' : 'Off' }}
          </span>

          <!-- Edit button -->
          <button
            class="flex-shrink-0 p-1 rounded transition-colors"
            :class="editingSlug === mod.slug ? 'text-teal-400' : 'text-zinc-600 hover:text-zinc-400'"
            :aria-label="`Edit ${mod.display_name} settings`"
            @click="editingSlug === mod.slug ? cancelEdit() : startEdit(mod)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>

          <!-- Toggle -->
          <label class="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-400 flex-shrink-0">
            <input
              type="checkbox"
              class="w-4 h-4 rounded accent-teal-500"
              :checked="mod.enabled"
              :disabled="toggleModule.isPending.value"
              @change="toggleModule.mutate({ slug: mod.slug, enabled: !mod.enabled })"
            />
            {{ mod.enabled ? 'Enabled' : 'Disabled' }}
          </label>
        </div>

        <!-- ── Expand area ── -->
        <div v-if="editingSlug === mod.slug" class="border-t border-zinc-800 px-4 py-3 flex flex-col gap-3">

          <!-- Custom name inputs -->
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Custom name</span>
            <div class="flex gap-3">
              <div class="flex flex-col gap-1 flex-1">
                <span class="text-xs text-zinc-600">EN</span>
                <input
                  v-model="draftNameEn"
                  type="text"
                  maxlength="80"
                  :placeholder="mod.display_name"
                  class="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>
              <div class="flex flex-col gap-1 flex-1">
                <span class="text-xs text-zinc-600">PL</span>
                <input
                  v-model="draftNamePl"
                  type="text"
                  maxlength="80"
                  :placeholder="mod.display_name"
                  class="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <!-- Per-page select (list modules only) -->
          <div v-if="LIST_SLUGS.has(mod.slug)" class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Items per page</span>
            <select
              v-model="draftPerPage"
              class="w-44 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
            >
              <option :value="null">Default</option>
              <option v-for="n in PER_PAGE_OPTIONS" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2 pt-1">
            <button
              class="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              @click="cancelEdit"
            >
              Cancel
            </button>
            <button
              class="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="updateSettings.isPending.value"
              @click="saveEdit(mod.slug)"
            >
              {{ updateSettings.isPending.value ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  </AdminLayout>
</template>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd app && pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Smoke-test in the running dev server**

Navigate to `http://localhost:5174/admin/website-modules` (or restart `pnpm dev` if not running).

Verify:
1. All rows render with existing names, badges, toggles intact.
2. Clicking the pencil icon on a row opens the expand area with EN + PL inputs.
3. EN/PL placeholder text matches the module's `display_name`.
4. For a list module (e.g. `news`), the "Items per page" select appears.
5. For a non-list module (e.g. `epk`), no per-page select appears.
6. Typing "Merch" in EN and clicking Save closes the row; the row name updates to "Merch" with "(Shop)" hint.
7. Opening a second row while one is open closes the first without saving.
8. Disabled modules render with reduced padding and dimmer name text.

- [ ] **Step 5: Run backend tests one final time**

```bash
make test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/src/views/admin/WebsiteModulesView.vue
git commit -m "feat(modules): expand-row UI for custom name + per-page settings"
```
