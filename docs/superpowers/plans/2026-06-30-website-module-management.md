# Website Module Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin panel page (`/admin/website-modules`) that lets admins enable/disable the 10 public website sections, with an auto-rebuild toggle and a manual rebuild button that triggers a hot-swap Astro SSG rebuild inside the `web` Docker container.

**Architecture:** Module state lives in a `website_modules` DB table; a public `GET /api/site-config` endpoint lets the Astro build fetch module toggles at build time. A lightweight Node.js webhook server inside the `web` container listens on port 3001 (internal Docker network only) and re-runs the Astro build on demand. The Vue 3 admin SPA reads/writes modules via protected admin endpoints.

**Tech Stack:** Laravel 11 / PHP 8.4 (Pest tests), Vue 3 + TypeScript + TanStack Query v5, Astro 4 SSG, Node.js (webhook), MySQL 8.4.

## Global Constraints

- All backend test files use Pest syntax (`it('...', function() {})`), `uses(RefreshDatabase::class)`, and `Passport::actingAs($user)` for auth
- All frontend API calls go through `app/src/api/client.ts` helpers (`API_BASE`, `authHeaders`, `jsonHeaders`, `handleResponse`)
- Module slugs are the canonical identifiers: `concerts`, `releases`, `posts`, `photos`, `press`, `videos`, `merch`, `epk`, `tech-rider`, `newsletter`
- `tech-rider` module → public URL `/rider` → file `web/src/pages/rider/index.astro` (the public path is `/rider`, not `/tech-rider`)
- Newsletter `confirm/` and `unsubscribe/` sub-pages are **never** gated — only `newsletter/index.astro` is gated
- Site config check fails open: if `siteConfig.modules[slug]` is `undefined` or missing, the module is treated as enabled
- Rebuild webhook is internal-only: port 3001 is never added to `docker-compose.yml` `ports:`
- All migration filenames: `2026_06_30_000001_create_website_modules_table.php`, `2026_06_30_000002_create_site_settings_table.php`

---

## File Map

### Backend (`api/`)
| Action | Path |
|---|---|
| Create | `api/database/migrations/2026_06_30_000001_create_website_modules_table.php` |
| Create | `api/database/migrations/2026_06_30_000002_create_site_settings_table.php` |
| Create | `api/app/Models/WebsiteModule.php` |
| Create | `api/app/Models/SiteSetting.php` |
| Modify | `api/database/seeders/DatabaseSeeder.php` — append website_modules + site_settings seed rows |
| Create | `api/app/Http/Controllers/WebsiteModuleController.php` |
| Create | `api/app/Http/Resources/WebsiteModuleResource.php` |
| Modify | `api/routes/api.php` — add 5 new routes |
| Create | `api/tests/Feature/WebsiteModuleTest.php` |

### Web container (`web/`)
| Action | Path |
|---|---|
| Create | `web/docker/rebuild.sh` |
| Create | `web/docker/rebuild-webhook.js` |
| Modify | `web/docker/start.sh` — launch webhook before `exec nginx` |
| Modify | `web/src/lib/cms.ts` — add `getSiteConfig()` |
| Modify | `web/src/components/Header.astro` — filter nav links by site config |
| Modify | `web/src/pages/concerts/index.astro` |
| Modify | `web/src/pages/concerts/[slug].astro` |
| Modify | `web/src/pages/releases/index.astro` |
| Modify | `web/src/pages/releases/[id].astro` |
| Modify | `web/src/pages/posts/index.astro` |
| Modify | `web/src/pages/posts/[id].astro` |
| Modify | `web/src/pages/merch/index.astro` |
| Modify | `web/src/pages/merch/[slug].astro` |
| Modify | `web/src/pages/photos/index.astro` |
| Modify | `web/src/pages/press/index.astro` |
| Modify | `web/src/pages/videos/index.astro` |
| Modify | `web/src/pages/epk/index.astro` |
| Modify | `web/src/pages/rider/index.astro` |
| Modify | `web/src/pages/newsletter/index.astro` |

### Frontend (`app/`)
| Action | Path |
|---|---|
| Create | `app/src/types/website-module.ts` |
| Create | `app/src/api/website-modules.ts` |
| Create | `app/src/composables/useWebsiteModules.ts` |
| Create | `app/src/views/admin/WebsiteModulesView.vue` |
| Modify | `app/src/router/index.ts` — add `/admin/website-modules` route |
| Modify | admin sidebar/nav component — add "Website Modules" link (grep for `admin-band-profile` or `admin/band-profile` to find the sidebar) |

---

## Task 1: Database Layer — Migrations, Models, Seeder

**Files:**
- Create: `api/database/migrations/2026_06_30_000001_create_website_modules_table.php`
- Create: `api/database/migrations/2026_06_30_000002_create_site_settings_table.php`
- Create: `api/app/Models/WebsiteModule.php`
- Create: `api/app/Models/SiteSetting.php`
- Modify: `api/database/seeders/DatabaseSeeder.php`
- Test: (schema verified by Task 2's `RefreshDatabase` tests)

**Interfaces:**
- Produces: `WebsiteModule` model with `slug`, `display_name`, `enabled`, `sort_order` columns
- Produces: `SiteSetting` model with static `get(key, default)` and `set(key, value)` helpers
- Produces: 10 module rows + `auto_rebuild` setting row seeded by default

---

- [ ] **Step 1: Create the `website_modules` migration**

```php
// api/database/migrations/2026_06_30_000001_create_website_modules_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('website_modules', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('display_name');
            $table->boolean('enabled')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('website_modules');
    }
};
```

- [ ] **Step 2: Create the `site_settings` migration**

```php
// api/database/migrations/2026_06_30_000002_create_site_settings_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_settings');
    }
};
```

- [ ] **Step 3: Create the `WebsiteModule` model**

```php
// api/app/Models/WebsiteModule.php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebsiteModule extends Model
{
    protected $fillable = ['slug', 'display_name', 'enabled', 'sort_order'];

    protected $casts = [
        'enabled'    => 'boolean',
        'sort_order' => 'integer',
    ];
}
```

- [ ] **Step 4: Create the `SiteSetting` model**

```php
// api/app/Models/SiteSetting.php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model
{
    protected $fillable = ['key', 'value'];

    public static function get(string $key, mixed $default = null): mixed
    {
        return static::where('key', $key)->value('value') ?? $default;
    }

    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
```

- [ ] **Step 5: Seed the 10 modules and the `auto_rebuild` setting in `DatabaseSeeder`**

Open `api/database/seeders/DatabaseSeeder.php` and append these two blocks inside the `run()` method, after the existing `DB::table('concerts')->insertOrIgnore(...)` block:

```php
DB::table('website_modules')->insertOrIgnore([
    ['slug' => 'concerts',    'display_name' => 'Concerts',    'enabled' => true, 'sort_order' => 1,  'created_at' => now(), 'updated_at' => now()],
    ['slug' => 'releases',    'display_name' => 'Releases',    'enabled' => true, 'sort_order' => 2,  'created_at' => now(), 'updated_at' => now()],
    ['slug' => 'posts',       'display_name' => 'News',        'enabled' => true, 'sort_order' => 3,  'created_at' => now(), 'updated_at' => now()],
    ['slug' => 'photos',      'display_name' => 'Photos',      'enabled' => true, 'sort_order' => 4,  'created_at' => now(), 'updated_at' => now()],
    ['slug' => 'press',       'display_name' => 'Press',       'enabled' => true, 'sort_order' => 5,  'created_at' => now(), 'updated_at' => now()],
    ['slug' => 'videos',      'display_name' => 'Videos',      'enabled' => true, 'sort_order' => 6,  'created_at' => now(), 'updated_at' => now()],
    ['slug' => 'merch',       'display_name' => 'Shop',        'enabled' => true, 'sort_order' => 7,  'created_at' => now(), 'updated_at' => now()],
    ['slug' => 'epk',         'display_name' => 'EPK',         'enabled' => true, 'sort_order' => 8,  'created_at' => now(), 'updated_at' => now()],
    ['slug' => 'tech-rider',  'display_name' => 'Tech Rider',  'enabled' => true, 'sort_order' => 9,  'created_at' => now(), 'updated_at' => now()],
    ['slug' => 'newsletter',  'display_name' => 'Newsletter',  'enabled' => true, 'sort_order' => 10, 'created_at' => now(), 'updated_at' => now()],
]);

DB::table('site_settings')->insertOrIgnore([
    ['key' => 'auto_rebuild', 'value' => 'false', 'created_at' => now(), 'updated_at' => now()],
]);
```

- [ ] **Step 6: Run migrations inside the backend container**

```bash
docker exec bandms_backend php artisan migrate
```

Expected output: two new migration lines marked as `DONE`.

- [ ] **Step 7: Run the seeder inside the backend container**

```bash
docker exec bandms_backend php artisan db:seed
```

Expected: no errors. Verify with:

```bash
docker exec bandms_backend php artisan tinker --execute="echo App\Models\WebsiteModule::count();"
```

Expected output: `10`

- [ ] **Step 8: Commit**

```bash
git add api/database/migrations/2026_06_30_000001_create_website_modules_table.php \
        api/database/migrations/2026_06_30_000002_create_site_settings_table.php \
        api/app/Models/WebsiteModule.php \
        api/app/Models/SiteSetting.php \
        api/database/seeders/DatabaseSeeder.php
git commit -m "feat: add website_modules and site_settings tables with models and seeder"
```

---

## Task 2: API Endpoints — Controller, Resource, Routes, Tests

**Files:**
- Create: `api/app/Http/Controllers/WebsiteModuleController.php`
- Create: `api/app/Http/Resources/WebsiteModuleResource.php`
- Modify: `api/routes/api.php`
- Create: `api/tests/Feature/WebsiteModuleTest.php`

**Interfaces:**
- Consumes: `WebsiteModule` model (Task 1), `SiteSetting` model (Task 1)
- Produces:
  - `GET /api/site-config` → `{ modules: { concerts: true, videos: false, … } }`
  - `GET /api/admin/modules` → `{ data: WebsiteModuleResource[], auto_rebuild: bool }`
  - `PUT /api/admin/modules/{slug}` → `{ data: WebsiteModuleResource }` (triggers rebuild if auto_rebuild)
  - `PUT /api/admin/site/settings` → `{ auto_rebuild: bool }`
  - `POST /api/admin/site/rebuild` → `{ status: "rebuild_started" }`

---

- [ ] **Step 1: Write the failing tests**

```php
// api/tests/Feature/WebsiteModuleTest.php
<?php

use App\Models\SiteSetting;
use App\Models\User;
use App\Models\WebsiteModule;
use Illuminate\Support\Facades\Http;
use Laravel\Passport\Passport;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

// ── site-config (public) ──────────────────────────────────────────────────────

it('returns enabled module map on site-config', function () {
    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true,  'sort_order' => 1]);
    WebsiteModule::create(['slug' => 'videos',   'display_name' => 'Videos',   'enabled' => false, 'sort_order' => 2]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('modules.concerts', true)
        ->assertJsonPath('modules.videos', false);
});

it('returns empty modules map when no modules seeded', function () {
    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('modules', []);
});

// ── admin/modules (auth required) ─────────────────────────────────────────────

it('requires auth to list modules', function () {
    $this->getJson('/api/admin/modules')->assertUnauthorized();
});

it('returns all modules and auto_rebuild for admin', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->getJson('/api/admin/modules')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('auto_rebuild', false);
});

it('defaults auto_rebuild to false when setting missing', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    $this->getJson('/api/admin/modules')
        ->assertOk()
        ->assertJsonPath('auto_rebuild', false);
});

// ── PUT /api/admin/modules/{slug} ─────────────────────────────────────────────

it('requires auth to update a module', function () {
    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);
    $this->putJson('/api/admin/modules/concerts', ['enabled' => false])->assertUnauthorized();
});

it('toggles a module enabled state', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/concerts', ['enabled' => false])
        ->assertOk()
        ->assertJsonPath('data.slug', 'concerts')
        ->assertJsonPath('data.enabled', false);

    expect(WebsiteModule::where('slug', 'concerts')->value('enabled'))->toBeFalse();
});

it('returns 404 for unknown module slug', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    $this->putJson('/api/admin/modules/nonexistent', ['enabled' => false])->assertNotFound();
});

it('triggers rebuild when auto_rebuild is true', function () {
    Http::fake(['http://web:3001/rebuild' => Http::response(['status' => 'started'], 200)]);

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'true']);

    $this->putJson('/api/admin/modules/concerts', ['enabled' => false])->assertOk();

    Http::assertSent(fn ($request) => $request->url() === 'http://web:3001/rebuild');
});

it('does not trigger rebuild when auto_rebuild is false', function () {
    Http::fake();

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->putJson('/api/admin/modules/concerts', ['enabled' => false])->assertOk();

    Http::assertNothingSent();
});

// ── PUT /api/admin/site/settings ──────────────────────────────────────────────

it('updates auto_rebuild setting', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->putJson('/api/admin/site/settings', ['auto_rebuild' => true])
        ->assertOk()
        ->assertJsonPath('auto_rebuild', true);

    expect(SiteSetting::get('auto_rebuild'))->toBe('true');
});

// ── POST /api/admin/site/rebuild ──────────────────────────────────────────────

it('triggers rebuild on demand', function () {
    Http::fake(['http://web:3001/rebuild' => Http::response(['status' => 'started'], 200)]);

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    $this->postJson('/api/admin/site/rebuild')
        ->assertOk()
        ->assertJsonPath('status', 'rebuild_started');

    Http::assertSent(fn ($request) => $request->url() === 'http://web:3001/rebuild');
});

it('requires auth to trigger rebuild', function () {
    $this->postJson('/api/admin/site/rebuild')->assertUnauthorized();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker exec bandms_backend php artisan test --filter WebsiteModuleTest
```

Expected: All tests FAIL with `Route [api/site-config] not defined` or similar.

- [ ] **Step 3: Create the `WebsiteModuleResource`**

```php
// api/app/Http/Resources/WebsiteModuleResource.php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebsiteModuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'slug'         => $this->slug,
            'display_name' => $this->display_name,
            'enabled'      => (bool) $this->enabled,
            'sort_order'   => $this->sort_order,
            'updated_at'   => $this->updated_at,
        ];
    }
}
```

- [ ] **Step 4: Create the `WebsiteModuleController`**

```php
// api/app/Http/Controllers/WebsiteModuleController.php
<?php

namespace App\Http\Controllers;

use App\Http\Resources\WebsiteModuleResource;
use App\Models\SiteSetting;
use App\Models\WebsiteModule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class WebsiteModuleController extends Controller
{
    public function siteConfig(): JsonResponse
    {
        $modules = WebsiteModule::all(['slug', 'enabled'])
            ->keyBy('slug')
            ->map(fn ($m) => (bool) $m->enabled);

        return response()->json(['modules' => $modules]);
    }

    public function index(): JsonResponse
    {
        $modules     = WebsiteModule::orderBy('sort_order')->orderBy('slug')->get();
        $autoRebuild = SiteSetting::get('auto_rebuild', 'false') === 'true';

        return response()->json([
            'data'         => WebsiteModuleResource::collection($modules),
            'auto_rebuild' => $autoRebuild,
        ]);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $module = WebsiteModule::where('slug', $slug)->firstOrFail();

        $validated = $request->validate(['enabled' => 'required|boolean']);
        $module->update($validated);

        if (SiteSetting::get('auto_rebuild', 'false') === 'true') {
            $this->triggerRebuild();
        }

        return response()->json(['data' => new WebsiteModuleResource($module)]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate(['auto_rebuild' => 'required|boolean']);

        SiteSetting::set('auto_rebuild', $validated['auto_rebuild'] ? 'true' : 'false');

        return response()->json(['auto_rebuild' => $validated['auto_rebuild']]);
    }

    public function rebuild(): JsonResponse
    {
        $this->triggerRebuild();

        return response()->json(['status' => 'rebuild_started']);
    }

    private function triggerRebuild(): void
    {
        try {
            Http::timeout(5)->post('http://web:3001/rebuild');
        } catch (\Exception) {
            // Fire-and-forget; webhook may be unavailable in tests or dev
        }
    }
}
```

- [ ] **Step 5: Register the routes in `api/routes/api.php`**

Add the `use` import near the top of the file with the other controller imports:

```php
use App\Http\Controllers\WebsiteModuleController;
```

Add the public route in the public routes section (near the `/health` route):

```php
Route::get('/site-config', [WebsiteModuleController::class, 'siteConfig']);
```

Add admin routes inside the existing `Route::middleware(['auth:api', 'role:admin'])->group(...)` block (or create one if needed):

```php
Route::middleware(['auth:api', 'role:admin'])->group(function () {
    Route::get('/admin/modules', [WebsiteModuleController::class, 'index']);
    Route::put('/admin/modules/{slug}', [WebsiteModuleController::class, 'update']);
    Route::put('/admin/site/settings', [WebsiteModuleController::class, 'updateSettings']);
    Route::post('/admin/site/rebuild', [WebsiteModuleController::class, 'rebuild']);
    // … existing admin routes remain here …
});
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
docker exec bandms_backend php artisan test --filter WebsiteModuleTest
```

Expected: All 12 tests PASS.

- [ ] **Step 7: Run the full test suite to check for regressions**

```bash
make test
```

Expected: All tests PASS (no regressions).

- [ ] **Step 8: Commit**

```bash
git add api/app/Http/Controllers/WebsiteModuleController.php \
        api/app/Http/Resources/WebsiteModuleResource.php \
        api/routes/api.php \
        api/tests/Feature/WebsiteModuleTest.php
git commit -m "feat: add website module management API endpoints"
```

---

## Task 3: Rebuild Webhook (web container)

**Files:**
- Create: `web/docker/rebuild.sh`
- Create: `web/docker/rebuild-webhook.js`
- Modify: `web/docker/start.sh`

**Interfaces:**
- Consumes: `GET /api/site-config` (public endpoint from Task 2) — fetched at Astro build time from inside the container; `API_BASE` env var resolves to `http://backend`
- Produces: HTTP server on port 3001 (Docker internal); `POST /rebuild` spawns `rebuild.sh` in background and responds `{ status: "started" }` immediately

---

- [ ] **Step 1: Create `web/docker/rebuild.sh`**

This script re-runs the Astro build and copies output to Nginx's html dir. It is called by the webhook on demand.

```sh
#!/bin/sh
# Rebuild the Astro site and hot-swap Nginx's static files.
# Called by rebuild-webhook.js on POST /rebuild.
set -e

API_BASE="${API_BASE:-http://backend}"

echo "[rebuild] Building Astro site..."
cd /app
API_BASE="${API_BASE}" pnpm build

echo "[rebuild] Copying output to Nginx..."
cp -r /app/dist/* /usr/share/nginx/html/

echo "[rebuild] Done."
```

Make it executable (add to file itself — Docker COPY preserves permissions if you set them in Dockerfile; if not, the webhook calls `sh /docker/rebuild.sh` explicitly):

The webhook calls `sh /docker/rebuild.sh` so no chmod needed.

- [ ] **Step 2: Create `web/docker/rebuild-webhook.js`**

```js
// web/docker/rebuild-webhook.js
'use strict'
const http = require('http')
const { spawn } = require('child_process')

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rebuild') {
    console.log('[webhook] Rebuild triggered')
    const child = spawn('sh', ['/docker/rebuild.sh'], {
      detached: true,
      stdio:    'ignore',
      env:      process.env,
    })
    child.unref()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'started' }))
  } else {
    res.writeHead(404)
    res.end()
  }
})

server.listen(3001, '0.0.0.0', () => {
  console.log('[webhook] Listening on port 3001')
})
```

- [ ] **Step 3: Modify `web/docker/start.sh`**

The current last two lines are:
```sh
echo "🚀  Starting Nginx…"
exec nginx -g "daemon off;"
```

Replace them with:
```sh
echo "🚀  Starting rebuild webhook and Nginx…"
node /docker/rebuild-webhook.js &
exec nginx -g "daemon off;"
```

The webhook starts in the background; `exec nginx` replaces the shell process. Docker PID 1 becomes `nginx`. The webhook process is adopted by the container's init and keeps running.

- [ ] **Step 4: Rebuild the web container to apply the changes**

```bash
bash rebuild.sh --backend-only --skip-tests
```

Wait for the container to start, then verify the webhook is listening:

```bash
docker exec bandms_web wget -qO- --post-data='{}' http://localhost:3001/rebuild
```

Expected output: `{"status":"started"}`

- [ ] **Step 5: Verify the public site still loads**

```bash
make health
curl -s http://localhost:4322 | grep -c "Skanking"
```

Expected: `1` (site still serves normally).

- [ ] **Step 6: Commit**

```bash
git add web/docker/rebuild.sh web/docker/rebuild-webhook.js web/docker/start.sh
git commit -m "feat: add rebuild webhook to web container for hot-swap Astro rebuilds"
```

---

## Task 4: Astro Site Config Integration

**Files:**
- Modify: `web/src/lib/cms.ts`
- Modify: `web/src/components/Header.astro`
- Modify: 14 Astro page files (see list below)

**Interfaces:**
- Consumes: `GET /api/site-config` → `{ modules: Record<string, boolean> }` (Task 2)
- Produces: `getSiteConfig()` function exported from `web/src/lib/cms.ts`; `Header.astro` filters nav links; each page redirects to `/404` when its module is disabled; dynamic pages return no paths when disabled

---

- [ ] **Step 1: Add `getSiteConfig()` to `web/src/lib/cms.ts`**

Add this interface and function to the end of the file (after the last export):

```typescript
export interface SiteConfig {
  modules: Record<string, boolean>
}

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const res = await fetch(`${BASE}/api/site-config`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return { modules: {} }
    return res.json() as Promise<SiteConfig>
  } catch {
    // Fail open: if API is unreachable during build, treat all modules as enabled
    return { modules: {} }
  }
}
```

- [ ] **Step 2: Update `web/src/components/Header.astro`**

The current `Header.astro` has a hardcoded `links` array. Replace the frontmatter with:

```astro
---
import { getSiteConfig } from '@/lib/cms'
import MobileNav from './MobileNav.vue'
import CartIcon from './CartIcon.vue'

const siteConfig = await getSiteConfig()

const allLinks = [
  { href: '/concerts', label: 'Shows',  module: 'concerts' },
  { href: '/releases', label: 'Music',  module: 'releases' },
  { href: '/posts',    label: 'News',   module: 'posts'    },
  { href: '/photos',   label: 'Photos', module: 'photos'   },
  { href: '/videos',   label: 'Videos', module: 'videos'   },
  { href: '/press',    label: 'Press',  module: 'press'    },
  { href: '/merch',    label: 'Shop',   module: 'merch'    },
  { href: '/epk',      label: 'EPK',    module: 'epk'      },
  { href: '/contact',  label: 'Contact', module: null       },
]

// module === null means always show; module === false (explicit) means hide
const links = allLinks.filter(l => l.module === null || siteConfig.modules[l.module] !== false)

const current = Astro.url.pathname
---
```

Leave the rest of the file (the `<header>` HTML and `<style>`) unchanged. The `links` variable now has the same shape as before, so `MobileNav` and the nav rendering loop continue to work without changes.

- [ ] **Step 3: Gate the static index pages**

For each of these pages, add the config check at the **very top** of the frontmatter (before any other imports or data fetches). The pattern is identical for all — only the `slug` string changes.

**`web/src/pages/concerts/index.astro`** — add at top of frontmatter:
```astro
import { getSiteConfig } from '@/lib/cms'
const siteConfig = await getSiteConfig()
if (siteConfig.modules['concerts'] === false) return Astro.redirect('/404', 307)
```

**`web/src/pages/releases/index.astro`** — add at top of frontmatter:
```astro
import { getSiteConfig } from '@/lib/cms'
const siteConfig = await getSiteConfig()
if (siteConfig.modules['releases'] === false) return Astro.redirect('/404', 307)
```

**`web/src/pages/posts/index.astro`** — add at top of frontmatter:
```astro
import { getSiteConfig } from '@/lib/cms'
const siteConfig = await getSiteConfig()
if (siteConfig.modules['posts'] === false) return Astro.redirect('/404', 307)
```

**`web/src/pages/photos/index.astro`** — add at top of frontmatter:
```astro
import { getSiteConfig } from '@/lib/cms'
const siteConfig = await getSiteConfig()
if (siteConfig.modules['photos'] === false) return Astro.redirect('/404', 307)
```

**`web/src/pages/press/index.astro`** — add at top of frontmatter (before `getBandProfile`):
```astro
import { getSiteConfig } from '@/lib/cms'
const siteConfig = await getSiteConfig()
if (siteConfig.modules['press'] === false) return Astro.redirect('/404', 307)
```

**`web/src/pages/videos/index.astro`** — add at top of frontmatter:
```astro
import { getSiteConfig } from '@/lib/cms'
const siteConfig = await getSiteConfig()
if (siteConfig.modules['videos'] === false) return Astro.redirect('/404', 307)
```

**`web/src/pages/merch/index.astro`** — add at top of frontmatter:
```astro
import { getSiteConfig } from '@/lib/cms'
const siteConfig = await getSiteConfig()
if (siteConfig.modules['merch'] === false) return Astro.redirect('/404', 307)
```

**`web/src/pages/epk/index.astro`** — add at top of frontmatter:
```astro
import { getSiteConfig } from '@/lib/cms'
const siteConfig = await getSiteConfig()
if (siteConfig.modules['epk'] === false) return Astro.redirect('/404', 307)
```

**`web/src/pages/rider/index.astro`** (tech-rider module) — add at top of frontmatter:
```astro
import { getSiteConfig } from '@/lib/cms'
const siteConfig = await getSiteConfig()
if (siteConfig.modules['tech-rider'] === false) return Astro.redirect('/404', 307)
```

**`web/src/pages/newsletter/index.astro`** — add at top of frontmatter:
```astro
import { getSiteConfig } from '@/lib/cms'
const siteConfig = await getSiteConfig()
if (siteConfig.modules['newsletter'] === false) return Astro.redirect('/404', 307)
```

- [ ] **Step 4: Gate the dynamic detail pages via `getStaticPaths()`**

For dynamic pages, adding the check inside `getStaticPaths()` is cleaner — returning an empty array prevents the files from being generated at all (true 404 for detail pages).

**`web/src/pages/concerts/[slug].astro`** — inside `getStaticPaths()`, prepend:
```astro
const siteConfig = await getSiteConfig()
if (siteConfig.modules['concerts'] === false) return []
```

Also add the import at the top of the frontmatter:
```astro
import { getSiteConfig } from '@/lib/cms'
```

**`web/src/pages/releases/[id].astro`** — same pattern, slug `'releases'`:
```astro
// At top of frontmatter:
import { getSiteConfig } from '@/lib/cms'

// Inside getStaticPaths():
const siteConfig = await getSiteConfig()
if (siteConfig.modules['releases'] === false) return []
```

**`web/src/pages/posts/[id].astro`** — same pattern, slug `'posts'`:
```astro
import { getSiteConfig } from '@/lib/cms'
// Inside getStaticPaths():
const siteConfig = await getSiteConfig()
if (siteConfig.modules['posts'] === false) return []
```

**`web/src/pages/merch/[slug].astro`** — same pattern, slug `'merch'`:
```astro
import { getSiteConfig } from '@/lib/cms'
// Inside getStaticPaths():
const siteConfig = await getSiteConfig()
if (siteConfig.modules['merch'] === false) return []
```

- [ ] **Step 5: Rebuild the web container and verify**

```bash
docker compose restart web
```

Wait ~30 seconds for the build to complete, then verify a disabled module would redirect:

First, disable concerts via the API to test:

```bash
docker exec bandms_backend php artisan tinker --execute="App\Models\WebsiteModule::where('slug','concerts')->update(['enabled'=>false]);"
docker compose restart web
```

After restart, check:
```bash
curl -sI http://localhost:4322/concerts | head -5
```

Expected: `HTTP/1.1 301` or the response contains `/404`.

Re-enable:
```bash
docker exec bandms_backend php artisan tinker --execute="App\Models\WebsiteModule::where('slug','concerts')->update(['enabled'=>true]);"
docker compose restart web
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/cms.ts web/src/components/Header.astro \
        web/src/pages/concerts/ web/src/pages/releases/ web/src/pages/posts/ \
        web/src/pages/merch/ web/src/pages/photos/ web/src/pages/press/ \
        web/src/pages/videos/ web/src/pages/epk/ web/src/pages/rider/ \
        web/src/pages/newsletter/
git commit -m "feat: gate Astro pages and nav links by site config module toggles"
```

---

## Task 5: Frontend Admin — Types, API, Composable, View, Route

**Files:**
- Create: `app/src/types/website-module.ts`
- Create: `app/src/api/website-modules.ts`
- Create: `app/src/composables/useWebsiteModules.ts`
- Create: `app/src/views/admin/WebsiteModulesView.vue`
- Modify: `app/src/router/index.ts`
- Modify: admin sidebar nav component (grep for the file — see Step 7)

**Interfaces:**
- Consumes: `GET /api/admin/modules`, `PUT /api/admin/modules/{slug}`, `PUT /api/admin/site/settings`, `POST /api/admin/site/rebuild` (Task 2)
- Consumes: `API_BASE`, `authHeaders`, `jsonHeaders`, `handleResponse` from `app/src/api/client.ts`
- Produces: `WebsiteModulesView.vue` at `/admin/website-modules`

---

- [ ] **Step 1: Create `app/src/types/website-module.ts`**

```typescript
// app/src/types/website-module.ts
export interface WebsiteModule {
  slug: string
  display_name: string
  enabled: boolean
  sort_order: number
  updated_at: string
}

export interface WebsiteModulesResponse {
  data: WebsiteModule[]
  auto_rebuild: boolean
}

export interface SiteSettings {
  auto_rebuild: boolean
}
```

- [ ] **Step 2: Create `app/src/api/website-modules.ts`**

```typescript
// app/src/api/website-modules.ts
import type { WebsiteModule, WebsiteModulesResponse, SiteSettings } from '@/types/website-module'
import { API_BASE, authHeaders, jsonHeaders, handleResponse } from './client'

export async function fetchModules(token: string): Promise<WebsiteModulesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/modules`, { headers: authHeaders(token) })
  return handleResponse<WebsiteModulesResponse>(res)
}

export async function updateModule(token: string, slug: string, enabled: boolean): Promise<{ data: WebsiteModule }> {
  const res = await fetch(`${API_BASE}/api/admin/modules/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ enabled }),
  })
  return handleResponse<{ data: WebsiteModule }>(res)
}

export async function updateSiteSettings(token: string, autoRebuild: boolean): Promise<SiteSettings> {
  const res = await fetch(`${API_BASE}/api/admin/site/settings`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ auto_rebuild: autoRebuild }),
  })
  return handleResponse<SiteSettings>(res)
}

export async function triggerRebuild(token: string): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/admin/site/rebuild`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse<{ status: string }>(res)
}
```

- [ ] **Step 3: Create `app/src/composables/useWebsiteModules.ts`**

```typescript
// app/src/composables/useWebsiteModules.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchModules, updateModule, updateSiteSettings, triggerRebuild } from '@/api/website-modules'
import { useAuth } from './useAuth'

export function useWebsiteModules() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['website-modules'],
    queryFn: () => fetchModules(token.value!),
  })

  const toggleModule = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) =>
      updateModule(token.value!, slug, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['website-modules'] }),
  })

  const setAutoRebuild = useMutation({
    mutationFn: (autoRebuild: boolean) => updateSiteSettings(token.value!, autoRebuild),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['website-modules'] }),
  })

  const rebuild = useMutation({
    mutationFn: () => triggerRebuild(token.value!),
  })

  return { query, toggleModule, setAutoRebuild, rebuild }
}
```

- [ ] **Step 4: Create `app/src/views/admin/WebsiteModulesView.vue`**

```vue
<!-- app/src/views/admin/WebsiteModulesView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useWebsiteModules } from '@/composables/useWebsiteModules'

const { query, toggleModule, setAutoRebuild, rebuild } = useWebsiteModules()

const modules     = computed(() => query.data.value?.data ?? [])
const autoRebuild = computed(() => query.data.value?.auto_rebuild ?? false)
const isRebuilding = computed(() => rebuild.isPending.value)
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between mb-8 gap-4 flex-wrap">
      <h1 class="text-2xl font-bold text-white">Website Modules</h1>

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
          :disabled="isRebuilding || autoRebuild || rebuild.isPending.value"
          :title="autoRebuild ? 'Auto-rebuild is active — changes rebuild automatically' : 'Rebuild the public Astro site'"
          @click="rebuild.mutate()"
        >
          <span>{{ isRebuilding ? 'Rebuilding…' : '↺ Rebuild Public Site' }}</span>
        </button>
      </div>
    </div>

    <div v-if="query.isLoading.value" class="text-zinc-500">Loading…</div>

    <div v-else-if="query.isError.value" class="text-red-400">
      Failed to load modules. Check the API connection.
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="mod in modules"
        :key="mod.slug"
        class="rounded-xl border bg-zinc-900 p-5 flex flex-col gap-3 transition-colors"
        :class="mod.enabled ? 'border-zinc-700' : 'border-zinc-800 opacity-60'"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-semibold text-white">{{ mod.display_name }}</h3>
            <p class="text-xs text-zinc-500 mt-0.5">/{{ mod.slug === 'tech-rider' ? 'rider' : mod.slug }}</p>
          </div>
          <span
            class="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
            :class="mod.enabled ? 'bg-teal-900 text-teal-300' : 'bg-zinc-800 text-zinc-500'"
          >
            {{ mod.enabled ? 'Live' : 'Disabled' }}
          </span>
        </div>

        <label class="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 mt-auto">
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
    </div>
  </div>
</template>
```

- [ ] **Step 5: Add the route in `app/src/router/index.ts`**

Find the admin routes section (where `requiresAuth: true` routes are defined, near `admin-band-profile`). Add:

```typescript
{
  path: '/admin/website-modules',
  name: 'admin-website-modules',
  component: () => import('@/views/admin/WebsiteModulesView.vue'),
  meta: { requiresAuth: true },
},
```

Also add a title entry in the `ROUTE_TITLES` map near the end of the file:

```typescript
'admin-website-modules': 'Website Modules — Admin',
```

- [ ] **Step 6: Add "Website Modules" to the admin sidebar**

Find the admin sidebar/nav component by running:

```bash
grep -rl "admin-band-profile\|BandProfileAdmin\|band-profile" app/src/components app/src/layouts app/src/views/admin/AdminDashboard.vue 2>/dev/null
```

In the file that contains the admin navigation links, add:

```html
<RouterLink to="/admin/website-modules">Website Modules</RouterLink>
```

Place it after the existing admin links (e.g. after "Band Profile" or in a logical "Site" grouping).

- [ ] **Step 7: Start the Vite dev server and test the admin page**

```bash
cd app && pnpm dev
```

Navigate to `http://localhost:5173/admin/website-modules` (log in first if prompted).

Verify:
- All 10 module cards render with correct names and slugs
- Toggling a module checkbox sends the PUT request (check Network tab)
- "Auto-rebuild on changes" toggle sends the PUT settings request
- "Rebuild Public Site" button is disabled when auto-rebuild is on
- Clicking "Rebuild Public Site" shows "Rebuilding…" briefly

- [ ] **Step 8: Commit**

```bash
git add app/src/types/website-module.ts \
        app/src/api/website-modules.ts \
        app/src/composables/useWebsiteModules.ts \
        app/src/views/admin/WebsiteModulesView.vue \
        app/src/router/index.ts
git commit -m "feat: add website modules admin panel with enable/disable and rebuild controls"
```

---

## Final Verification

- [ ] Run the full backend test suite: `make test` — all tests pass
- [ ] Verify end-to-end: disable a module in the admin, click "Rebuild Public Site", wait 30 s, confirm that visiting the public URL returns 404/redirect and the nav link is gone
- [ ] Re-enable the module, trigger another rebuild, confirm the page and nav link are back
- [ ] Run `make test-all` before shipping
