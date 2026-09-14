# Admin Rebuild Guard — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track, per content area, whether the public site has unrebuilt changes — and close the gap where 13 of the ~17 controllers that write baked content never signal that today.

**Architecture:** A new `site_dirty_areas` table (one row per area key, upserted on every relevant write) backs three new/changed `App\Support\SiteRebuild` methods. `SiteRebuild::markDirty(string $area)` replaces `requestIfAuto()` at every call site — it always records the area, and additionally fires the rebuild webhook + clears the table when auto-rebuild is on. The three rebuild-related actions on `WebsiteModuleController` move to a new `SiteRebuildController`, whose `rebuildStatus` response gains `autoRebuild` and `pendingAreas`.

**Tech Stack:** Laravel 11, Eloquent, Pest (`uses(RefreshDatabase::class)`), Passport for test auth (`Passport::actingAs($admin)`).

**Spec:** [docs/superpowers/specs/2026-09-14-admin-rebuild-guard-design.md](../specs/2026-09-14-admin-rebuild-guard-design.md)

## Global Constraints

- Area keys (exact strings, case-sensitive): `band-profile`, `band-members`, `hero-images`, `posts`, `website-modules`, `concerts`, `venues`, `setlists`, `releases`, `photos`, `music-videos`, `press-releases`, `shop`, `faqs`. No other area key may be introduced without updating the spec and the frontend label registry (separate plan).
- Every `SiteRebuild::markDirty($area)` call site must use one of the keys above — no free-form strings.
- Pending state clears the moment a rebuild is *triggered* (manual button or auto-rebuild), not when it finishes — this matches `SiteRebuild::request()`'s existing fire-and-forget philosophy (failures already swallowed there).
- Follow this codebase's existing idiom for a simple lookup table: a thin Eloquent model with static helper methods (see `App\Models\SiteSetting`), never raw `DB::table(...)->updateOrInsert(...)` — that idiom has zero precedent in this codebase.
- Test convention: Pest, `uses(\Illuminate\Foundation\Testing\RefreshDatabase::class)` at file top, `User::factory()->create(['role' => 'admin'])` + `Passport::actingAs($admin)` for auth, `$this->getJson/postJson/putJson('/api/...')`, `Http::fake([...])` + `Http::assertSent(fn ($request) => ...)` / `Http::assertNothingSent()` for the rebuild webhook.

---

### Task 1: `SiteDirtyArea` model + migration

**Files:**
- Create: `api/database/migrations/2026_09_14_000001_create_site_dirty_areas_table.php`
- Create: `api/app/Models/SiteDirtyArea.php`
- Create: `api/tests/Feature/SiteRebuildDirtyTrackingTest.php`

**Interfaces:**
- Produces: `App\Models\SiteDirtyArea::markDirty(string $area): void`, `SiteDirtyArea::clearAll(): void`, `SiteDirtyArea::pending(): array` (each element `['area' => string, 'changedAt' => string|null]`, ordered most-recently-changed first). Task 2 consumes all three.

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
        Schema::create('site_dirty_areas', function (Blueprint $table) {
            $table->string('area')->primary();
            $table->timestamp('changed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_dirty_areas');
    }
};
```

- [ ] **Step 2: Write the model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One row per content area with unrebuilt changes. Upserted, never appended —
 * a second edit to the same area just bumps `changed_at`.
 */
class SiteDirtyArea extends Model
{
    public $timestamps = false;

    protected $primaryKey = 'area';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['area', 'changed_at'];

    protected $casts = ['changed_at' => 'datetime'];

    public static function markDirty(string $area): void
    {
        static::updateOrCreate(['area' => $area], ['changed_at' => now()]);
    }

    public static function clearAll(): void
    {
        static::query()->delete();
    }

    /** Most-recently-changed first, so the admin's pending list reads newest-on-top. */
    public static function pending(): array
    {
        return static::orderByDesc('changed_at')
            ->get()
            ->map(fn (self $row) => [
                'area'      => $row->area,
                'changedAt' => $row->changed_at?->toISOString(),
            ])
            ->all();
    }
}
```

- [ ] **Step 3: Write the failing test**

```php
<?php

use App\Models\SiteDirtyArea;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

it('upserts an area rather than appending a duplicate', function () {
    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('concerts');

    expect(SiteDirtyArea::count())->toBe(1);
});

it('orders pending areas most-recently-changed first', function () {
    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('faqs');

    $pending = SiteDirtyArea::pending();

    expect($pending)->toHaveCount(2);
    expect($pending[0]['area'])->toBe('faqs');
    expect($pending[1]['area'])->toBe('concerts');
});

it('clears every pending area', function () {
    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('faqs');

    SiteDirtyArea::clearAll();

    expect(SiteDirtyArea::count())->toBe(0);
});
```

- [ ] **Step 4: Run the migration and the test**

Run: `docker build --target test -t bandms_test ./api && docker run --rm -e APP_ENV=testing -e APP_KEY="$(grep '^APP_KEY=' .env | cut -d= -f2-)" bandms_test --filter SiteRebuildDirtyTrackingTest`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/database/migrations/2026_09_14_000001_create_site_dirty_areas_table.php api/app/Models/SiteDirtyArea.php api/tests/Feature/SiteRebuildDirtyTrackingTest.php
git commit -m "Add site_dirty_areas table and SiteDirtyArea model"
```

---

### Task 2: `SiteRebuild::markDirty()` — replace `requestIfAuto()`

**Files:**
- Modify: `api/app/Support/SiteRebuild.php`
- Test: `api/tests/Feature/SiteRebuildDirtyTrackingTest.php` (append)

**Interfaces:**
- Consumes: `App\Models\SiteDirtyArea::markDirty/clearAll/pending` (Task 1).
- Produces: `SiteRebuild::markDirty(string $area): void`, `SiteRebuild::clearPending(): void`, `SiteRebuild::pendingAreas(): array`. Every later task (3–8) calls `markDirty()`; Task 3 calls `clearPending()` and `pendingAreas()`.

- [ ] **Step 1: Rewrite `SiteRebuild.php`**

```php
<?php

namespace App\Support;

use App\Models\SiteDirtyArea;
use App\Models\SiteSetting;
use Illuminate\Support\Facades\Http;

/**
 * Asks the `web` container to rebuild the static public site, and tracks
 * which content areas have unrebuilt changes.
 *
 * Extracted from WebsiteModuleController, which owned the only copy — so every
 * *other* thing the public site bakes had to remember to call a private method
 * on an unrelated controller, and hero images did not. Anything that changes
 * baked content belongs here rather than growing a second copy.
 */
final class SiteRebuild
{
    /**
     * Call this after any write whose result the public site bakes. Always
     * records the area as dirty. If the band has asked for automatic
     * rebuilds, also fires the rebuild and clears the pending list — with
     * auto-rebuild on, the admin hides its manual button, so a save has to
     * reach the public site some other way.
     */
    public static function markDirty(string $area): void
    {
        SiteDirtyArea::markDirty($area);

        if (SiteSetting::get('auto_rebuild', 'false') === 'true') {
            self::request();
            self::clearPending();
        }
    }

    /** Fire-and-forget: the webhook is absent in tests and may be down in dev. */
    public static function request(): void
    {
        try {
            Http::timeout(5)->post('http://web:3001/rebuild');
        } catch (\Exception) {
            // Deliberately swallowed — a rebuild that cannot be reached must not
            // fail the write that triggered it.
        }
    }

    /**
     * Pending state clears the moment a rebuild is triggered, not when it
     * finishes — matching request()'s own fire-and-forget philosophy.
     */
    public static function clearPending(): void
    {
        SiteDirtyArea::clearAll();
    }

    public static function pendingAreas(): array
    {
        return SiteDirtyArea::pending();
    }
}
```

- [ ] **Step 2: Write the failing test**

```php
// Appended to api/tests/Feature/SiteRebuildDirtyTrackingTest.php

use App\Models\SiteSetting;
use App\Support\SiteRebuild;
use Illuminate\Support\Facades\Http;

it('records the area but does not rebuild when auto_rebuild is false', function () {
    Http::fake();
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    SiteRebuild::markDirty('concerts');

    expect(SiteDirtyArea::pending())->toHaveCount(1);
    Http::assertNothingSent();
});

it('rebuilds and clears pending immediately when auto_rebuild is true', function () {
    Http::fake(['http://web:3001/rebuild' => Http::response(['status' => 'started'], 200)]);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'true']);

    SiteRebuild::markDirty('concerts');

    expect(SiteDirtyArea::pending())->toHaveCount(0);
    Http::assertSent(fn ($request) => $request->url() === 'http://web:3001/rebuild');
});
```

- [ ] **Step 3: Run the tests**

Run: same Docker test command as Task 1, `--filter SiteRebuildDirtyTrackingTest`
Expected: all 5 tests pass. (`WebsiteModuleTest.php`'s existing rebuild-related tests still call `SiteRebuild::requestIfAuto()` indirectly through `WebsiteModuleController::update()` at this point — that call site is not changed until Task 4, so those tests are unaffected by this step.)

- [ ] **Step 4: Commit**

```bash
git add api/app/Support/SiteRebuild.php api/tests/Feature/SiteRebuildDirtyTrackingTest.php
git commit -m "Replace SiteRebuild::requestIfAuto() with markDirty()"
```

---

### Task 3: `SiteRebuildController` — relocate rebuild actions, extend status

**Files:**
- Create: `api/app/Http/Controllers/SiteRebuildController.php`
- Modify: `api/app/Http/Controllers/WebsiteModuleController.php` (remove `rebuild()`, `rebuildStatus()`, `updateSettings()`)
- Modify: `api/routes/api.php:488-490`
- Create: `api/tests/Feature/SiteRebuildControllerTest.php`

**Interfaces:**
- Consumes: `SiteRebuild::request/clearPending/pendingAreas` (Task 2), `App\Models\SiteSetting::get/set` (existing).
- Produces: `GET /api/admin/site/rebuild/status` now returns `{status, startedAt, finishedAt, autoRebuild, pendingAreas}`. The frontend plan's `useSiteRebuild.ts` consumes this exact shape.

- [ ] **Step 1: Create `SiteRebuildController`**

```php
<?php

namespace App\Http\Controllers;

use App\Models\SiteSetting;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SiteRebuildController extends Controller
{
    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate(['auto_rebuild' => 'required|boolean']);

        SiteSetting::set('auto_rebuild', $validated['auto_rebuild'] ? 'true' : 'false');

        return response()->json(['auto_rebuild' => $validated['auto_rebuild']]);
    }

    public function rebuild(): JsonResponse
    {
        SiteRebuild::request();
        SiteRebuild::clearPending();

        return response()->json(['status' => 'rebuild_started']);
    }

    public function rebuildStatus(): JsonResponse
    {
        $status = ['status' => 'unknown', 'startedAt' => null, 'finishedAt' => null];

        try {
            $response = Http::timeout(5)->get('http://web:3001/status');
            if ($response->successful()) {
                $body = $response->json();
                $status = [
                    'status'     => $body['status']     ?? 'unknown',
                    'startedAt'  => $body['startedAt']  ?? null,
                    'finishedAt' => $body['finishedAt'] ?? null,
                ];
            }
        } catch (\Exception) {
            // fall through with the 'unknown' defaults above
        }

        return response()->json([
            ...$status,
            'autoRebuild'  => SiteSetting::get('auto_rebuild', 'false') === 'true',
            'pendingAreas' => SiteRebuild::pendingAreas(),
        ]);
    }
}
```

- [ ] **Step 2: Remove the three methods from `WebsiteModuleController.php`**

Delete `updateSettings()` (originally lines 298-305), `rebuild()` (originally lines 307-312), and `rebuildStatus()` (originally lines 314-332) in full.

Then grep the file for other uses of `SiteSetting` and `Http` outside those three methods:

Run: `grep -n "SiteSetting::\|Http::" api/app/Http/Controllers/WebsiteModuleController.php`

If nothing remains outside the deleted methods, also remove the now-unused `use App\Models\SiteSetting;` and `use Illuminate\Support\Facades\Http;` lines from the top of the file. Keep `use App\Support\SiteRebuild;` — `update()` (Task 4) still needs it.

- [ ] **Step 3: Update routes**

In `api/routes/api.php`, find the `use App\Http\Controllers\WebsiteModuleController;` import line near the top of the file and add directly after it:

```php
use App\Http\Controllers\SiteRebuildController;
```

Then change lines 488-490 from:

```php
        Route::put('/admin/site/settings', [WebsiteModuleController::class, 'updateSettings'])->name('api.admin.site.settings');
        Route::post('/admin/site/rebuild', [WebsiteModuleController::class, 'rebuild'])->name('api.admin.site.rebuild');
        Route::get('/admin/site/rebuild/status', [WebsiteModuleController::class, 'rebuildStatus'])->name('api.admin.site.rebuild.status');
```

to:

```php
        Route::put('/admin/site/settings', [SiteRebuildController::class, 'updateSettings'])->name('api.admin.site.settings');
        Route::post('/admin/site/rebuild', [SiteRebuildController::class, 'rebuild'])->name('api.admin.site.rebuild');
        Route::get('/admin/site/rebuild/status', [SiteRebuildController::class, 'rebuildStatus'])->name('api.admin.site.rebuild.status');
```

Route paths, names, and middleware nesting (`auth:api` → `role:admin`) are unchanged, so `WebsiteModuleTest.php`'s existing tests hitting these three routes (lines 138-198 in the original file: `'triggers rebuild when auto_rebuild is true'`, `'does not trigger rebuild when auto_rebuild is false'`, `'updates auto_rebuild setting'`, `'triggers rebuild on demand'`, `'requires auth to trigger rebuild'`) keep passing unmodified — they assert against HTTP behavior, not the controller class. Leave them in place; do not move them.

- [ ] **Step 4: Write the new test file**

```php
<?php

use App\Models\SiteDirtyArea;
use App\Models\SiteSetting;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Laravel\Passport\Passport;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

it('includes autoRebuild and pendingAreas in the status response', function () {
    Http::fake(['http://web:3001/status' => Http::response(['status' => 'idle'], 200)]);

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'true']);
    SiteDirtyArea::markDirty('concerts');

    $this->getJson('/api/admin/site/rebuild/status')
        ->assertOk()
        ->assertJsonPath('autoRebuild', true)
        ->assertJsonPath('pendingAreas.0.area', 'concerts');
});

it('includes autoRebuild and pendingAreas even when the status webhook is unreachable', function () {
    Http::fake(['http://web:3001/status' => Http::response(null, 500)]);

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->getJson('/api/admin/site/rebuild/status')
        ->assertOk()
        ->assertJsonPath('status', 'unknown')
        ->assertJsonPath('autoRebuild', false)
        ->assertJsonPath('pendingAreas', []);
});

it('clears pending areas when a manual rebuild is triggered', function () {
    Http::fake(['http://web:3001/rebuild' => Http::response(['status' => 'started'], 200)]);

    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);

    SiteDirtyArea::markDirty('concerts');
    SiteDirtyArea::markDirty('faqs');

    $this->postJson('/api/admin/site/rebuild')->assertOk();

    expect(SiteDirtyArea::count())->toBe(0);
});
```

- [ ] **Step 5: Run the full rebuild-related test suite**

Run: `docker build --target test -t bandms_test ./api && docker run --rm -e APP_ENV=testing -e APP_KEY="$(grep '^APP_KEY=' .env | cut -d= -f2-)" bandms_test --filter "SiteRebuild"`
Expected: `SiteRebuildDirtyTrackingTest` (5) + `SiteRebuildControllerTest` (3) pass. Then also run `--filter WebsiteModuleTest` to confirm the relocated-route tests still pass unmodified.

- [ ] **Step 6: Commit**

```bash
git add api/app/Http/Controllers/SiteRebuildController.php api/app/Http/Controllers/WebsiteModuleController.php api/routes/api.php api/tests/Feature/SiteRebuildControllerTest.php
git commit -m "Move rebuild actions to SiteRebuildController; expose pendingAreas"
```

---

### Task 4: Wire the 4 existing controllers to `markDirty()`

**Files:**
- Modify: `api/app/Http/Controllers/BandProfileController.php:81`
- Modify: `api/app/Http/Controllers/HeroImageController.php:58,73,98,112`
- Modify: `api/app/Http/Controllers/PostController.php:89,126,139`
- Modify: `api/app/Http/Controllers/WebsiteModuleController.php:257`
- Test: `api/tests/Feature/SiteRebuildDirtyTrackingTest.php` (append)

**Interfaces:**
- Consumes: `SiteRebuild::markDirty()` (Task 2).

All four files already `use App\Support\SiteRebuild;` — no import changes needed.

- [ ] **Step 1: Replace each call site**

| File | Line | Before | After |
|---|---|---|---|
| `BandProfileController.php` | 81 | `SiteRebuild::requestIfAuto();` | `SiteRebuild::markDirty('band-profile');` |
| `HeroImageController.php` | 58 | `SiteRebuild::requestIfAuto();` | `SiteRebuild::markDirty('hero-images');` |
| `HeroImageController.php` | 73 | `SiteRebuild::requestIfAuto();` | `SiteRebuild::markDirty('hero-images');` |
| `HeroImageController.php` | 98 | `SiteRebuild::requestIfAuto();` | `SiteRebuild::markDirty('hero-images');` |
| `HeroImageController.php` | 112 | `SiteRebuild::requestIfAuto();` | `SiteRebuild::markDirty('hero-images');` |
| `PostController.php` | 89 | `SiteRebuild::requestIfAuto();` | `SiteRebuild::markDirty('posts');` |
| `PostController.php` | 126 | `SiteRebuild::requestIfAuto();` | `SiteRebuild::markDirty('posts');` |
| `PostController.php` | 139 | `SiteRebuild::requestIfAuto();` | `SiteRebuild::markDirty('posts');` |
| `WebsiteModuleController.php` | 257 | `SiteRebuild::requestIfAuto();` | `SiteRebuild::markDirty('website-modules');` |

- [ ] **Step 2: Write the failing tests**

```php
// Appended to api/tests/Feature/SiteRebuildDirtyTrackingTest.php

use App\Models\BandProfile;
use App\Models\HeroImage;
use App\Models\Post;
use App\Models\User;
use App\Models\WebsiteModule;
use Laravel\Passport\Passport;

it('marks band-profile dirty on a profile update', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    BandProfile::factory()->create(['id' => 1]);

    $this->putJson('/api/band-profile', ['name' => 'New Name'])->assertOk();

    expect(SiteDirtyArea::where('area', 'band-profile')->exists())->toBeTrue();
});

it('marks hero-images dirty on a hero image reorder', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $image = HeroImage::factory()->create(['scope' => 'main', 'position' => 0]);

    $this->putJson('/api/admin/hero-images/main/order', ['order' => [$image->id]])->assertOk();

    expect(SiteDirtyArea::where('area', 'hero-images')->exists())->toBeTrue();
});

it('marks posts dirty on a post creation', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->postJson('/api/admin/posts', ['title' => ['en' => 'A post']])->assertCreated();

    expect(SiteDirtyArea::where('area', 'posts')->exists())->toBeTrue();
});

it('marks website-modules dirty on a module update', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    WebsiteModule::create(['slug' => 'concerts', 'display_name' => 'Concerts', 'enabled' => true, 'sort_order' => 1]);

    $this->putJson('/api/admin/modules/concerts', ['enabled' => false])->assertOk();

    expect(SiteDirtyArea::where('area', 'website-modules')->exists())->toBeTrue();
});
```

If `BandProfile::factory()`, `HeroImage::factory()`, or the exact admin-posts endpoint/payload shape differ from what's assumed above, check the corresponding existing feature test file for that model/controller (e.g. an existing `HeroImageTest.php`, `PostTest.php` if present) and match its factory/payload conventions exactly — the assertion (`SiteDirtyArea::where('area', '...')->exists()`) is what matters; adjust only the setup/request lines to fit this codebase's actual factories.

- [ ] **Step 3: Run the tests**

Run: same Docker test command, `--filter SiteRebuildDirtyTrackingTest`
Expected: all 9 tests (5 from Tasks 1-2 + 4 new) pass.

- [ ] **Step 4: Commit**

```bash
git add api/app/Http/Controllers/BandProfileController.php api/app/Http/Controllers/HeroImageController.php api/app/Http/Controllers/PostController.php api/app/Http/Controllers/WebsiteModuleController.php api/tests/Feature/SiteRebuildDirtyTrackingTest.php
git commit -m "Wire the 4 existing baked-content controllers to markDirty()"
```

---

### Task 5: Wire concerts, venues, setlists

**Files:**
- Modify: `api/app/Http/Controllers/ConcertController.php`
- Modify: `api/app/Http/Controllers/VenueController.php`
- Modify: `api/app/Http/Controllers/SetlistController.php`
- Modify: `api/app/Http/Controllers/SongController.php`
- Test: `api/tests/Feature/SiteRebuildDirtyTrackingTest.php` (append)

**Interfaces:**
- Consumes: `SiteRebuild::markDirty()` (Task 2).

- [ ] **Step 1: Add the import to all four files**

Add `use App\Support\SiteRebuild;` to the `use` block of `ConcertController.php`, `VenueController.php`, `SetlistController.php`, and `SongController.php` (none currently import it).

- [ ] **Step 2: Insert `SiteRebuild::markDirty('concerts');` in `ConcertController.php`**

| Method | Insert after line | Insert before |
|---|---|---|
| `store()` | 54 (`$this->syncLinks($concert, ...)`) | 56 (blank line before return) |
| `update()` | 72 (`$this->syncLinks($concert, ...)`) | 74 (blank line before return) |
| `destroy()` | 82 (`$concert->delete();`) | 84 (return) |
| `uploadPoster()` | 96 (`$concert->update(['poster' => $path]);`) | 98 (blank line before return) |
| `destroyPoster()` | 106 (closing `}` of the `if` block) | 108 (blank line before return) |

Example (`store()`, lines 52-57 before → after):

```php
        $concert = Concert::create(Arr::except($data, ['bands', 'tag_ids', 'links']));

        $this->syncBands($concert, $data['bands'] ?? []);
        $this->syncTags($concert, $data['tag_ids'] ?? null);
        $this->syncLinks($concert, $data['links'] ?? []);

        SiteRebuild::markDirty('concerts');

        return new ConcertResource($concert->load(['venue', 'bands', 'tags', 'links']));
```

Apply the same one-line insertion (`SiteRebuild::markDirty('concerts');` on its own line, blank line before and after) at each of the other four locations in the table above.

- [ ] **Step 3: Insert `SiteRebuild::markDirty('venues');` in `VenueController.php`**

| Method | Insert after line |
|---|---|
| `store()` | 39 (the `foreach` loop creating social links closes) |
| `update()` | 72 (closing `}` of the `if (array_key_exists('social_links', ...))` block) |
| `destroy()` | 79 (`$venue->delete();`) |

- [ ] **Step 4: Insert `SiteRebuild::markDirty('setlists');` in `SetlistController.php`**

| Method | Insert after line |
|---|---|
| `store()` | 40 (`$setlist = Setlist::create($data);`) |
| `update()` | 52 (`$setlist->update($data);`) |
| `destroy()` | 58 (`$setlist->delete();`) |
| `addItem()` | 82 (`$item->load('song');`) |
| `updateItem()` | 101 (`$item->load('song');`) |
| `removeItem()` | 110 (`$this->resequence($setlist);`) |
| `reorderItems()` | 125 (closing `}` of the `foreach` loop) |
| `importFromSetlistFm()` | 161 (closing `}` of the `foreach` loop) |

- [ ] **Step 5: Insert `SiteRebuild::markDirty('setlists');` in `SongController.php`**

`store()` currently returns inline (`return new SongResource(Song::create($data));`) — restructure it:

```php
    public function store(Request $request): SongResource
    {
        $data = $this->validated($request);
        $song = Song::create($data);

        SiteRebuild::markDirty('setlists');

        return new SongResource($song);
    }
```

For `update()` (insert after line 27, `$song->update($data);`) and `destroy()` (insert after line 33, `$song->delete();`), a plain one-line insertion is enough — no restructuring needed there.

- [ ] **Step 6: Write representative tests**

```php
// Appended to api/tests/Feature/SiteRebuildDirtyTrackingTest.php

use App\Models\Concert;
use App\Models\Setlist;
use App\Models\SetlistItem;
use App\Models\Song;
use App\Models\Venue;

it('marks concerts dirty when a concert is deleted', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $concert = Concert::factory()->create();

    $this->deleteJson("/api/admin/concerts/{$concert->id}")->assertNoContent();

    expect(SiteDirtyArea::where('area', 'concerts')->exists())->toBeTrue();
});

it('marks venues dirty when a venue is created', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->postJson('/api/admin/venues', ['name' => 'A New Venue'])->assertCreated();

    expect(SiteDirtyArea::where('area', 'venues')->exists())->toBeTrue();
});

it('marks setlists dirty when a setlist item is reordered', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $setlist = Setlist::factory()->create();
    $song = Song::factory()->create();
    $item = SetlistItem::factory()->create(['setlist_id' => $setlist->id, 'song_id' => $song->id, 'position' => 1]);

    $this->putJson("/api/admin/setlists/{$setlist->id}/items/reorder", ['order' => [$item->id]])->assertOk();

    expect(SiteDirtyArea::where('area', 'setlists')->exists())->toBeTrue();
});
```

Check the exact admin route paths for concerts/venues/setlists (`grep -n "admin/concerts\|admin/venues\|admin/setlists" api/routes/api.php`) and adjust the URLs above if they differ; also confirm `Concert::factory()`, `Venue`, `Setlist::factory()`, `Song::factory()`, `SetlistItem::factory()` exist (`ls api/database/factories/`) and match required fields to whatever each factory actually needs.

- [ ] **Step 7: Run the tests**

Run: same Docker test command, `--filter SiteRebuildDirtyTrackingTest`
Expected: all 12 tests pass.

- [ ] **Step 8: Commit**

```bash
git add api/app/Http/Controllers/ConcertController.php api/app/Http/Controllers/VenueController.php api/app/Http/Controllers/SetlistController.php api/app/Http/Controllers/SongController.php api/tests/Feature/SiteRebuildDirtyTrackingTest.php
git commit -m "Wire concerts, venues, and setlists to markDirty()"
```

---

### Task 6: Wire releases, photos, music videos, press releases

**Files:**
- Modify: `api/app/Http/Controllers/ReleaseController.php`
- Modify: `api/app/Http/Controllers/AlbumController.php`
- Modify: `api/app/Http/Controllers/PhotoController.php`
- Modify: `api/app/Http/Controllers/MusicVideoController.php`
- Modify: `api/app/Http/Controllers/PressReleaseController.php`
- Test: `api/tests/Feature/SiteRebuildDirtyTrackingTest.php` (append)

**Interfaces:**
- Consumes: `SiteRebuild::markDirty()` (Task 2).

- [ ] **Step 1: Add `use App\Support\SiteRebuild;` to all five files**

- [ ] **Step 2: Insert `SiteRebuild::markDirty('releases');` in `ReleaseController.php`**

| Method | Insert after line |
|---|---|
| `store()` | 94 (`$release->load('tracks.links', 'links', 'photos');`) |
| `update()` | 152 (`$release->load('tracks.links', 'links', 'photos');`) |
| `destroy()` | 167 (`$release->delete();`) |
| `uploadCover()` | 181 (`$release->update(['cover_image' => $path]);`) |
| `destroyCover()` | 191 (closing `}` of the `if` block) |
| `addPhotos()` | 214 (closing `}` of the `foreach` loop) |
| `removePhoto()` | 222 (`$photo->delete();`) |
| `reorderPhotos()` | 236 (closing `}` of the `foreach` loop) |

- [ ] **Step 3: Insert `SiteRebuild::markDirty('photos');` in `AlbumController.php`**

| Method | Insert after line |
|---|---|
| `batchStore()` | 75 (closing `}` of the photo-creation `foreach`) |
| `update()` | 99 (closing `}` of the `if (array_key_exists('tag_ids', ...))` block) |
| `destroy()` | 130 (closing `}` of the `foreach ($paths as $path)` loop, i.e. after storage cleanup completes) |
| `addPhotos()` | 154 (closing `}` of the `foreach` loop) |
| `removePhoto()` | 167 (`$photo->delete();`) |
| `reorderPhotos()` | 181 (closing `}` of the `foreach` loop) |

- [ ] **Step 4: Insert `SiteRebuild::markDirty('photos');` in `PhotoController.php`**

| Method | Insert after line |
|---|---|
| `update()` | 33 (`$photo->update($data);`) |
| `destroy()` | 44 (`$photo->delete();`) |

- [ ] **Step 5: Insert `SiteRebuild::markDirty('music-videos');` in `MusicVideoController.php`**

`store()` currently ends with `$item = MusicVideo::create($data); return response()->json(...)` — insert between them (after line 34, before line 36):

```php
        $data['profile_id'] = BandProfile::value('id') ?? 1;
        $item = MusicVideo::create($data);

        SiteRebuild::markDirty('music-videos');

        return response()->json(['data' => $this->format($item)], 201);
```

| Method | Insert after line |
|---|---|
| `update()` | 53 (`$musicVideo->update($data);`) |
| `destroy()` | 123 (`$musicVideo->delete();`) |
| `fetchPreview()` | 149 (closing `]);` of the `$musicVideo->update([...])` call) |

- [ ] **Step 6: Insert `SiteRebuild::markDirty('press-releases');` in `PressReleaseController.php`**

| Method | Insert after line |
|---|---|
| `store()` | 65 (`$pr->load('concerts', 'posts', 'albums', 'releases', 'tours', 'tags');`) |
| `update()` | 76 (`$pressRelease->load('concerts', 'posts', 'albums', 'releases', 'tours', 'tags');`) |
| `destroy()` | 83 (`$pressRelease->delete();`) |

- [ ] **Step 7: Write representative tests**

```php
// Appended to api/tests/Feature/SiteRebuildDirtyTrackingTest.php

use App\Models\Album;
use App\Models\MusicVideo;
use App\Models\PressRelease;
use App\Models\Release;

it('marks releases dirty when a release is deleted', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $release = Release::factory()->create();

    $this->deleteJson("/api/admin/releases/{$release->id}")->assertNoContent();

    expect(SiteDirtyArea::where('area', 'releases')->exists())->toBeTrue();
});

it('marks photos dirty when a photo caption is updated', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $album = Album::factory()->create();
    $photo = $album->photos()->create(['image' => 'photos/a.jpg', 'sort_order' => 0]);

    $this->putJson("/api/admin/photos/{$photo->id}", ['caption' => 'New caption'])->assertOk();

    expect(SiteDirtyArea::where('area', 'photos')->exists())->toBeTrue();
});

it('marks music-videos dirty when a music video is created', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->postJson('/api/admin/music-videos', ['title' => 'A Video', 'video_url' => 'https://youtube.com/watch?v=abc'])
        ->assertCreated();

    expect(SiteDirtyArea::where('area', 'music-videos')->exists())->toBeTrue();
});

it('marks press-releases dirty when a press release is deleted', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $pr = PressRelease::factory()->create();

    $this->deleteJson("/api/admin/press-releases/{$pr->id}")->assertNoContent();

    expect(SiteDirtyArea::where('area', 'press-releases')->exists())->toBeTrue();
});
```

Check exact admin route paths and required factory fields the same way as Task 5's Step 6 — `grep -n "admin/releases\|admin/photos\|admin/music-videos\|admin/press-releases" api/routes/api.php` and `ls api/database/factories/`, adjusting URLs/payloads to match.

- [ ] **Step 8: Run the tests**

Run: same Docker test command, `--filter SiteRebuildDirtyTrackingTest`
Expected: all 16 tests pass.

- [ ] **Step 9: Commit**

```bash
git add api/app/Http/Controllers/ReleaseController.php api/app/Http/Controllers/AlbumController.php api/app/Http/Controllers/PhotoController.php api/app/Http/Controllers/MusicVideoController.php api/app/Http/Controllers/PressReleaseController.php api/tests/Feature/SiteRebuildDirtyTrackingTest.php
git commit -m "Wire releases, photos, music videos, and press releases to markDirty()"
```

---

### Task 7: Wire shop items, shop categories, FAQs

**Files:**
- Modify: `api/app/Http/Controllers/ShopItemController.php`
- Modify: `api/app/Http/Controllers/ShopCategoryController.php`
- Modify: `api/app/Http/Controllers/FaqController.php`
- Test: `api/tests/Feature/SiteRebuildDirtyTrackingTest.php` (append)

**Interfaces:**
- Consumes: `SiteRebuild::markDirty()` (Task 2).

- [ ] **Step 1: Add `use App\Support\SiteRebuild;` to all three files**

`FaqController.php` already imports `App\Support\Locales` — add the `SiteRebuild` import as a separate line, don't conflate the two.

- [ ] **Step 2: Insert `SiteRebuild::markDirty('shop');` in `ShopItemController.php`**

| Method | Insert after line |
|---|---|
| `store()` | 78 (`$this->syncRelations($request, $item);`) |
| `update()` | 112 (`$this->syncRelations($request, $shopItem);`) |
| `destroy()` | 124 (`$shopItem->delete();`) |
| `uploadPhoto()` | 142 (closing `]);` of the `$shopItem->photos()->create([...])` call) |
| `deletePhoto()` | 156 (`$photo->delete();`) |
| `reorderPhotos()` | 169 (closing `});` of the `DB::transaction(...)` call) |
| `updateCurrencies()` | 190 (`$profile->update(['shop_currencies' => ...]);`) |

- [ ] **Step 3: Insert `SiteRebuild::markDirty('shop');` in `ShopCategoryController.php`**

| Method | Insert after line |
|---|---|
| `store()` | 28 (`$category = ShopCategory::create($data);`) |
| `update()` | 41 (`$shopCategory->update($data);`) |
| `destroy()` | 48 (`$shopCategory->delete();`) |

- [ ] **Step 4: Insert `SiteRebuild::markDirty('faqs');` in `FaqController.php`**

| Method | Insert after line |
|---|---|
| `store()` | 65 (`$faq->save();`) |
| `update()` | 90 (`$faq->save();`) |
| `destroy()` | 97 (`$faq->delete();`) |
| `reorder()` | 117 (closing `}` of the `foreach` loop) |

- [ ] **Step 5: Write representative tests**

```php
// Appended to api/tests/Feature/SiteRebuildDirtyTrackingTest.php

use App\Models\Faq;
use App\Models\ShopCategory;
use App\Models\ShopItem;

it('marks shop dirty when a shop item is deleted', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $item = ShopItem::factory()->create();

    $this->deleteJson("/api/admin/shop-items/{$item->id}")->assertOk();

    expect(SiteDirtyArea::where('area', 'shop')->exists())->toBeTrue();
});

it('marks shop dirty when a shop category is created', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->postJson('/api/admin/shop-categories', ['name' => 'Apparel'])->assertCreated();

    expect(SiteDirtyArea::where('area', 'shop')->exists())->toBeTrue();
});

it('marks faqs dirty when a faq is created', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);

    $this->postJson('/api/admin/faqs', [
        'module_slug' => 'contact',
        'question' => ['en' => 'Q?'],
        'answer' => ['en' => 'A.'],
    ])->assertCreated();

    expect(SiteDirtyArea::where('area', 'faqs')->exists())->toBeTrue();
});
```

Check exact admin route paths (`grep -n "admin/shop\|admin/faqs" api/routes/api.php`) and `ShopItem::factory()`/`ShopCategory` requirements the same way as prior tasks, adjusting URLs/payloads to match.

- [ ] **Step 6: Run the tests**

Run: same Docker test command, `--filter SiteRebuildDirtyTrackingTest`
Expected: all 19 tests pass.

- [ ] **Step 7: Commit**

```bash
git add api/app/Http/Controllers/ShopItemController.php api/app/Http/Controllers/ShopCategoryController.php api/app/Http/Controllers/FaqController.php api/tests/Feature/SiteRebuildDirtyTrackingTest.php
git commit -m "Wire shop items, shop categories, and FAQs to markDirty()"
```

---

### Task 8: Wire band members, band logos, social links (owner-dispatch)

**Files:**
- Modify: `api/app/Http/Controllers/BandMemberController.php`
- Modify: `api/app/Http/Controllers/BandLogoController.php`
- Modify: `api/app/Http/Controllers/SocialLinkController.php`
- Test: `api/tests/Feature/SiteRebuildDirtyTrackingTest.php` (append)

**Interfaces:**
- Consumes: `SiteRebuild::markDirty()` (Task 2).
- Produces: `SocialLinkController::dirtyArea(SocialLink $link): ?string` — a private helper, not consumed elsewhere.

- [ ] **Step 1: Add `use App\Support\SiteRebuild;` to all three files**

- [ ] **Step 2: Insert `SiteRebuild::markDirty('band-members');` in `BandMemberController.php`**

| Method | Insert after line |
|---|---|
| `store()` | 71 (`$member->load(['socialLinks', 'instruments', 'mainInstrument']);`) |
| `update()` | 121 (`$member->instruments()->sync($request->input('instrument_ids', []));`) — insert before the `load()` call that follows it |
| `uploadPhoto()` | 141 (`$member->update(['photo' => '/storage/' . $path]);`) |
| `reorder()` | 159 (closing `}` of the `foreach` loop) |
| `destroy()` | 166 (`$member->delete();`) |

- [ ] **Step 3: Insert `SiteRebuild::markDirty('band-profile');` in `BandLogoController.php`**

(Logos affect the band-profile area's baked pages — homepage hero, EPK, contact section — per the design spec's controller table.)

| Method | Insert after line |
|---|---|
| `store()` | 74 (closing `]);` of the `BandLogo::create([...])` call) |
| `update()` | 100 (`$logo->update($data);`) |
| `setDefault()` | 117 (closing `});` of the `DB::transaction(...)` call) |
| `destroy()` | 137 (`$logo->delete();`) |

- [ ] **Step 4: Add owner-dispatch to `SocialLinkController.php`**

Add a private helper method to the class:

```php
    /**
     * Which area a social link's write affects, based on its owner column —
     * not on how this controller reached it, since update()/destroy() act on
     * whichever SocialLink the route binds, regardless of owner.
     */
    private function dirtyArea(SocialLink $link): ?string
    {
        return match (true) {
            $link->profile_id !== null => 'band-profile',
            $link->venue_id !== null   => 'venues',
            default => null, // member_id/author_id owners aren't baked publicly
        };
    }
```

`store()` and `sync()` always act on the band profile (`$this->profile()->socialLinks()`), so they call `markDirty('band-profile')` unconditionally — no dispatch needed:

```php
        $link = $this->profile()->socialLinks()->create($data);

        SiteRebuild::markDirty('band-profile');

        return new SocialLinkResource($link);
```

(insert after line 32, before the `store()` return)

```php
        foreach ($data['links'] ?? [] as $index => $link) {
            $profile->socialLinks()->create(array_merge($link, ['position' => $index]));
        }

        SiteRebuild::markDirty('band-profile');

        return SocialLinkResource::collection(
```

(insert after line 69, before the `sync()` return)

`update()` and `destroy()` use the dispatch helper:

```php
    public function update(Request $request, SocialLink $link): SocialLinkResource
    {
        $data = $request->validate([
            'platform' => ['required', 'in:spotify,instagram,facebook,youtube,tiktok,bandcamp,soundcloud,twitter,website'],
            'url'      => ['required', 'url', 'max:500'],
        ]);

        $link->update($data);

        if ($area = $this->dirtyArea($link)) {
            SiteRebuild::markDirty($area);
        }

        return new SocialLinkResource($link);
    }
```

```php
    public function destroy(SocialLink $link): \Illuminate\Http\Response
    {
        $area = $this->dirtyArea($link);
        $link->delete();

        if ($area) {
            SiteRebuild::markDirty($area);
        }

        return response()->noContent();
    }
```

(these replace the full bodies of `update()` lines 37-47 and `destroy()` lines 49-54)

- [ ] **Step 5: Write representative tests**

```php
// Appended to api/tests/Feature/SiteRebuildDirtyTrackingTest.php

use App\Models\BandMember;
use App\Models\SocialLink;

it('marks band-members dirty when a member is created', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    BandProfile::factory()->create(['id' => 1]);

    $this->postJson('/api/admin/band-members', ['first_name' => 'Jane', 'last_name' => 'Doe'])
        ->assertCreated();

    expect(SiteDirtyArea::where('area', 'band-members')->exists())->toBeTrue();
});

it('marks band-profile dirty when a profile-owned social link is deleted', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $profile = BandProfile::factory()->create(['id' => 1]);
    $link = SocialLink::create(['profile_id' => $profile->id, 'platform' => 'instagram', 'url' => 'https://instagram.com/x', 'position' => 0]);

    $this->deleteJson("/api/admin/social-links/{$link->id}")->assertNoContent();

    expect(SiteDirtyArea::where('area', 'band-profile')->exists())->toBeTrue();
});

it('marks venues dirty when a venue-owned social link is deleted, not band-profile', function () {
    Http::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($admin);
    SiteSetting::create(['key' => 'auto_rebuild', 'value' => 'false']);
    $venue = Venue::factory()->create();
    $link = SocialLink::create(['venue_id' => $venue->id, 'platform' => 'instagram', 'url' => 'https://instagram.com/x', 'position' => 0]);

    $this->deleteJson("/api/admin/social-links/{$link->id}")->assertNoContent();

    expect(SiteDirtyArea::where('area', 'venues')->exists())->toBeTrue();
    expect(SiteDirtyArea::where('area', 'band-profile')->exists())->toBeFalse();
});
```

Check the exact admin route paths for band-members/social-links (`grep -n "admin/band-members\|admin/social-links" api/routes/api.php`) and `BandMember`/`SocialLink` required fields, adjusting as needed. Confirm `SocialLink`'s actual fillable columns (`api/app/Models/SocialLink.php`) match `profile_id`/`venue_id`/`member_id`/`author_id` as assumed.

- [ ] **Step 6: Run the full new test file**

Run: same Docker test command, `--filter SiteRebuildDirtyTrackingTest`
Expected: all 22 tests pass.

- [ ] **Step 7: Run the entire backend suite**

Run: `bash rebuild.sh --backend-only`
Expected: all green, including `WebsiteModuleTest`, `SiteRebuildControllerTest`, `SiteRebuildDirtyTrackingTest`, and every other existing suite (confirming nothing in Tasks 1-8 broke unrelated behavior).

- [ ] **Step 8: Commit**

```bash
git add api/app/Http/Controllers/BandMemberController.php api/app/Http/Controllers/BandLogoController.php api/app/Http/Controllers/SocialLinkController.php api/tests/Feature/SiteRebuildDirtyTrackingTest.php
git commit -m "Wire band members, band logos, and social links to markDirty()"
```

---

## Self-Review Notes

- **Spec coverage:** every backend section of the design spec (`site_dirty_areas` table, `markDirty`/`clearPending`/`pendingAreas`, the 14-area registry, the `SiteRebuildController` relocation, the extended status endpoint, and all 13 previously-unwired controllers) maps to a task above. The frontend half (area labels, `useSiteRebuild`, `useDirtyGuard`, `RebuildBar`, per-form wiring) is covered by the companion frontend plan.
- **Type consistency:** `markDirty(string $area): void`, `clearPending(): void`, and `pendingAreas(): array` are defined once in Task 2 and referenced identically (same names, same signatures) in every later task — no drift.
- **Ambiguity:** `SocialLinkController::update()`/`destroy()` owner-dispatch reads the bound model's own columns, not the controller's `profile()` helper, since the route can bind to any owner's row — made explicit in Task 8 Step 4.
