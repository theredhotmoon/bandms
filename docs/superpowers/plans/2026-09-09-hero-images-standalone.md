# Standalone Hero Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple hero background images from the gallery/album system entirely — hero images get their own upload, their own storage, and a per-picture active/inactive toggle — while keeping the public rendering contract (`web/`) unchanged.

**Architecture:** `hero_images` stops being a join table to `photos` and becomes the asset itself (`image`, `caption`, `active` columns added directly). The admin API moves from one whole-scope-replace `PUT` to four per-row endpoints (upload / patch / reorder / delete), mirroring the existing `AlbumController` photo-management pattern. The admin UI drops its draft/dirty/Save pattern in favor of immediate actions against those endpoints, matching how `PhotosAdminView.vue` already handles per-photo delete and toggles.

**Tech Stack:** Laravel 11 (Pest), Vue 3 + TypeScript (Vitest, Playwright), Vue Query v5.

**Spec:** `docs/superpowers/specs/2026-09-09-hero-images-standalone-design.md`

## Global Constraints

- Nothing real is set yet in `hero_images` — the table is reset, not migrated (confirmed with the user).
- Uploads use the same file-array bound as `AlbumController::addPhotos`: `files` array `max:100`, each file `image|max:20480` (20 MB).
- Every mutating admin endpoint (upload / patch / reorder / delete) calls `SiteRebuild::requestIfAuto()` — unchanged reasoning from the current controller.
- `hero-images/` is its own folder on the `public` disk, separate from `photos/`.
- Every response except `DELETE`'s `204` returns the full `{data: {scope: [...]}}` map (same shape `GET` returns), so the frontend can always seed its query cache from one response.
- Run backend tests via the documented single-test flow (root `CLAUDE.md`):
  ```bash
  docker build --target test -t bandms_test ./api
  APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
  docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter HeroImageTest
  ```
- Run frontend unit tests from `app/`: `pnpm test:unit src/utils/heroImageScopes.spec.ts`.
- Run E2E specs from `app/`: `pnpm test:e2e -- <file>`.

---

## Task 1: Redesign the `hero_images` schema and model

**Files:**
- Create: `api/database/migrations/2026_09_09_000002_redesign_hero_images_table.php`
- Modify: `api/app/Models/HeroImage.php`
- Test: `api/tests/Feature/HeroImageTest.php` (rewritten from scratch — the old file's tests are all built around `photo_id`/`Photo`, which no longer exist)

**Interfaces:**
- Produces: `HeroImage` model with `fillable = ['scope', 'image', 'caption', 'position', 'active']`, casts `position:integer`, `active:boolean`. `HeroImage::allowedScopes(): array` and `HeroImage::RESERVED_SCOPES` unchanged in signature/behaviour — every later task relies on these being untouched.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `api/tests/Feature/HeroImageTest.php` with:

```php
<?php

use App\Models\HeroImage;
use App\Models\User;
use App\Models\WebsiteModule;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Passport\Passport;

beforeEach(fn () => Storage::fake('public'));

function heroAdmin(): void
{
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
}

/** A hero_images row under the new standalone schema. */
function heroRow(array $overrides = []): HeroImage
{
    return HeroImage::create(array_merge([
        'scope'    => 'main',
        'image'    => 'hero-images/a.jpg',
        'caption'  => null,
        'position' => 0,
        'active'   => true,
    ], $overrides));
}

// ── schema / model ──────────────────────────────────────────────────────────────

it('orders a scope by position, not by id', function () {
    // position deliberately inverted against id: a read that leans on the
    // auto-increment tiebreaker instead of the column passes without this.
    $first  = heroRow(['image' => 'hero-images/first.jpg', 'position' => 1]);
    $second = heroRow(['image' => 'hero-images/second.jpg', 'position' => 0]);

    $ordered = HeroImage::where('scope', 'main')->orderBy('position')->pluck('id');

    expect($ordered->all())->toBe([$second->id, $first->id]);
});

it('defaults a new row to active', function () {
    expect(heroRow()->active)->toBeTrue();
});

it('treats every live module slug plus main and home as a valid scope', function () {
    $allowed = HeroImage::allowedScopes();

    expect($allowed)->toContain('main')
        ->and($allowed)->toContain('home')
        // Seeded by migrations — see the note in the original hero images test.
        ->and($allowed)->toContain('contact');
});

it('keeps a disabled module as a valid scope', function () {
    WebsiteModule::create(['slug' => 'photos', 'display_name' => 'Gallery', 'enabled' => false]);

    expect(HeroImage::allowedScopes())->toContain('photos');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run the backend test command from Global Constraints. Expected: FAIL — `heroRow()` (and thus every test) errors, because the `hero_images` table has no `image`, `caption` or `active` columns yet and `photo_id` is still `NOT NULL` with no value supplied.

- [ ] **Step 3: Write the migration**

Create `api/database/migrations/2026_09_09_000002_redesign_hero_images_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hero_images', function (Blueprint $table) {
            $table->dropForeign(['photo_id']);
        });

        // Confirmed with the band: nothing real is set yet, so the table is
        // reset rather than migrated. A photo_id row has no meaning under the
        // new schema — hero images are no longer gallery photos.
        DB::table('hero_images')->truncate();

        Schema::table('hero_images', function (Blueprint $table) {
            $table->dropColumn('photo_id');
            $table->string('image')->after('scope');
            $table->string('caption')->nullable()->after('image');
            $table->boolean('active')->default(true)->after('position');
        });
    }

    public function down(): void
    {
        Schema::table('hero_images', function (Blueprint $table) {
            $table->dropColumn(['image', 'caption', 'active']);
        });

        DB::table('hero_images')->truncate();

        Schema::table('hero_images', function (Blueprint $table) {
            $table->foreignId('photo_id')->after('id')->constrained()->cascadeOnDelete();
        });
    }
};
```

- [ ] **Step 4: Update the model**

Replace the entire contents of `api/app/Models/HeroImage.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HeroImage extends Model
{
    protected $fillable = ['scope', 'image', 'caption', 'position', 'active'];

    protected $casts = [
        'position' => 'integer',
        'active'   => 'boolean',
    ];

    /**
     * Scopes that exist without a website_modules row behind them.
     *
     * The homepage is not a module, so a nullable "means main" column would
     * still have needed a second reserved name. Two explicit strings read
     * better than one null with two meanings.
     */
    public const RESERVED_SCOPES = ['main', 'home'];

    /**
     * Every scope a hero set may be saved under, resolved against live modules.
     *
     * Reading the table rather than a hardcoded list means adding a website
     * module makes it a hero scope with no code change — and a *disabled*
     * module stays valid, because switching a section off must not make its
     * pictures unsavable.
     *
     * @return array<int, string>
     */
    public static function allowedScopes(): array
    {
        return array_merge(self::RESERVED_SCOPES, WebsiteModule::pluck('slug')->all());
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run the backend test command from Global Constraints. Expected: PASS — all 4 tests green.

- [ ] **Step 6: Commit**

```bash
git add api/database/migrations/2026_09_09_000002_redesign_hero_images_table.php api/app/Models/HeroImage.php api/tests/Feature/HeroImageTest.php
git commit -m "feat(api): redesign hero_images to store its own upload, not a gallery photo link"
```

---

## Task 2: Update `HeroImageResource`

**Files:**
- Modify: `api/app/Http/Resources/HeroImageResource.php`

**Interfaces:**
- Consumes: `HeroImage` model from Task 1 (`image`, `caption`, `position`, `active` fields).
- Produces: `HeroImageResource::toArray()` → `{id, url, caption, position, active}`. Every controller task below (3, 4, 5, 6) renders rows through this resource.

- [ ] **Step 1: Replace the resource**

Replace the entire contents of `api/app/Http/Resources/HeroImageResource.php`:

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HeroImageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'       => $this->id,
            'url'      => $this->image ? '/storage/' . $this->image : null,
            'caption'  => $this->caption,
            'position' => $this->position,
            'active'   => $this->active,
        ];
    }
}
```

This has no test of its own — it's exercised through `HeroImageController::index()` in the next task.

- [ ] **Step 2: Commit**

```bash
git add api/app/Http/Resources/HeroImageResource.php
git commit -m "feat(api): shape HeroImageResource around the standalone image column"
```

---

## Task 3: `GET /admin/hero-images` — include inactive rows, drop the photo join

**Files:**
- Modify: `api/app/Http/Controllers/HeroImageController.php`
- Test: `api/tests/Feature/HeroImageTest.php`

**Interfaces:**
- Consumes: `HeroImageResource` from Task 2.
- Produces: `HeroImageController::allScopes(): array` (private) — every later controller task (4, 5, 6, 7) returns `response()->json(['data' => (object) $this->allScopes()])` from this same method.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/Feature/HeroImageTest.php`:

```php
// ── GET /admin/hero-images ──────────────────────────────────────────────────────

it('rejects hero image reads without auth', function () {
    $this->getJson('/api/admin/hero-images')->assertUnauthorized();
});

it('includes inactive rows for the admin, unlike the public payload', function () {
    heroAdmin();
    heroRow(['image' => 'hero-images/off.jpg', 'active' => false]);

    $this->getJson('/api/admin/hero-images')
        ->assertOk()
        ->assertJsonCount(1, 'data.main')
        ->assertJsonPath('data.main.0.active', false);
});

it('serves an empty admin payload as an object, not an array', function () {
    // The payload is a map keyed by scope. PHP's empty array encodes as [],
    // which contradicts the client's Record<string, HeroImage[]> type.
    heroAdmin();

    $this->getJson('/api/admin/hero-images')
        ->assertOk()
        ->assertJsonPath('data', []);

    expect($this->getJson('/api/admin/hero-images')->content())
        ->toContain('"data":{}');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run the backend test command. Expected: the two new tests FAIL — `HeroImageController::allScopes()` still calls `->with('photo')` and reads `$h->photo_id`/`$h->photo->image`, which no longer exist, so the request 500s instead of returning the new shape.

- [ ] **Step 3: Update the controller**

In `api/app/Http/Controllers/HeroImageController.php`, replace the `index()` method and `allScopes()` private method:

```php
    public function index(): JsonResponse
    {
        return response()->json(['data' => (object) $this->allScopes()]);
    }
```

```php
    /**
     * All hero sets keyed by scope, each ordered by position.
     *
     * Includes inactive rows — the admin needs to see and re-enable them,
     * unlike the public site-config payload, which filters to active only.
     * A scope with zero rows is simply absent rather than present-and-empty.
     *
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function allScopes(): array
    {
        return HeroImage::orderBy('scope')
            ->orderBy('position')
            ->get()
            ->groupBy('scope')
            ->map(fn ($rows) => HeroImageResource::collection($rows)->resolve())
            ->all();
    }
```

Leave `update()` in place for now — Task 7 removes it once `destroy()` takes its route.

- [ ] **Step 4: Run the test to verify it passes**

Run the backend test command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/Http/Controllers/HeroImageController.php api/tests/Feature/HeroImageTest.php
git commit -m "feat(api): serve inactive hero rows to the admin, drop the photo join"
```

---

## Task 4: `POST /admin/hero-images/{scope}` — upload

**Files:**
- Modify: `api/app/Http/Controllers/HeroImageController.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/HeroImageTest.php`

**Interfaces:**
- Consumes: `HeroImage::allowedScopes()` (Task 1), `$this->allScopes()` (Task 3).
- Produces: `POST /api/admin/hero-images/{scope}` — multipart `files[]` (+ optional `captions[]`) → `{data: {...}}`.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/Feature/HeroImageTest.php`:

```php
// ── POST /admin/hero-images/{scope} ─────────────────────────────────────────────

it('uploads one or more pictures into a scope', function () {
    heroAdmin();
    $file = UploadedFile::fake()->create('a.jpg', 100, 'image/jpeg');

    $this->postJson('/api/admin/hero-images/main', [
        'files'      => [$file],
        'captions'   => ['A caption'],
    ])
        ->assertOk()
        ->assertJsonCount(1, 'data.main')
        ->assertJsonPath('data.main.0.caption', 'A caption')
        ->assertJsonPath('data.main.0.active', true);

    $stored = HeroImage::first();
    Storage::disk('public')->assertExists($stored->image);
    expect($stored->image)->toStartWith('hero-images/');
});

it('appends uploads after the current max position', function () {
    heroAdmin();
    heroRow(['position' => 0]);
    $file = UploadedFile::fake()->create('b.jpg', 100, 'image/jpeg');

    $this->postJson('/api/admin/hero-images/main', ['files' => [$file]])
        ->assertOk()
        ->assertJsonPath('data.main.1.position', 1);
});

it('rejects an unknown scope on upload', function () {
    heroAdmin();
    $file = UploadedFile::fake()->create('a.jpg', 100, 'image/jpeg');

    $this->postJson('/api/admin/hero-images/not-a-page', ['files' => [$file]])
        ->assertStatus(422);
});

it('rejects a non-image upload', function () {
    heroAdmin();
    $file = UploadedFile::fake()->create('notes.txt', 10, 'text/plain');

    $this->postJson('/api/admin/hero-images/main', ['files' => [$file]])
        ->assertStatus(422);
});

it('rejects an unbounded files array', function () {
    heroAdmin();
    $files = array_map(fn () => UploadedFile::fake()->create('a.jpg', 10, 'image/jpeg'), range(1, 101));

    $this->postJson('/api/admin/hero-images/main', ['files' => $files])
        ->assertStatus(422);
});

it('asks the public site to rebuild after an upload, when auto-rebuild is on', function () {
    Http::fake();
    App\Models\SiteSetting::set('auto_rebuild', 'true');
    heroAdmin();
    $file = UploadedFile::fake()->create('a.jpg', 100, 'image/jpeg');

    $this->postJson('/api/admin/hero-images/main', ['files' => [$file]])->assertOk();

    Http::assertSent(fn ($request) => str_contains($request->url(), '/rebuild'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run the backend test command. Expected: FAIL — `POST /api/admin/hero-images/main` has no route yet (404), so every new test fails.

- [ ] **Step 3: Add the controller method**

In `api/app/Http/Controllers/HeroImageController.php`, add `store()` (below `index()`):

```php
    /**
     * Upload one or more new pictures into a scope, appended after whatever
     * is already there.
     */
    public function store(Request $request, string $scope): JsonResponse
    {
        $request->merge(['scope' => $scope]);

        $data = $request->validate([
            'scope'      => ['required', 'string', Rule::in(HeroImage::allowedScopes())],
            // Same bound as AlbumController::addPhotos — each file becomes its
            // own INSERT inside this request, so an unbounded array is an
            // unbounded write.
            'files'      => 'required|array|min:1|max:100',
            'files.*'    => 'required|image|max:20480',
            'captions'   => 'nullable|array',
            'captions.*' => 'nullable|string|max:255',
        ]);

        $maxPosition  = HeroImage::where('scope', $data['scope'])->max('position');
        $nextPosition = $maxPosition === null ? 0 : $maxPosition + 1;

        foreach (array_values($data['files']) as $index => $file) {
            $path = $file->store('hero-images', 'public');
            HeroImage::create([
                'scope'    => $data['scope'],
                'image'    => $path,
                'caption'  => $data['captions'][$index] ?? null,
                'position' => $nextPosition + $index,
            ]);
        }

        // The public site bakes these, so a save that does not rebuild leaves
        // the band looking at an unchanged page.
        SiteRebuild::requestIfAuto();

        return response()->json(['data' => (object) $this->allScopes()]);
    }
```

Add `use Illuminate\Http\Request;` and `use Illuminate\Validation\Rule;` to the top of the file if not already present (they are — carried over from the original `update()` method).

- [ ] **Step 4: Add the route**

In `api/routes/api.php`, replace:

```php
        Route::put('/admin/hero-images/{scope}', [HeroImageController::class, 'update'])
            ->name('api.admin.hero-images.update');
```

with:

```php
        Route::post('/admin/hero-images/{scope}', [HeroImageController::class, 'store'])
            ->name('api.admin.hero-images.store');
```

(The `update()` method and its old route registration are removed together in Task 7, once `destroy()` exists and nothing references `update()` any more — leaving `update()` unregistered-but-present for one task is fine since it's private-adjacent controller code, not a public contract.)

- [ ] **Step 5: Run the test to verify it passes**

Run the backend test command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app/Http/Controllers/HeroImageController.php api/routes/api.php api/tests/Feature/HeroImageTest.php
git commit -m "feat(api): add direct upload endpoint for hero images"
```

---

## Task 5: `PATCH /admin/hero-images/{heroImage}` — caption / active

**Files:**
- Modify: `api/app/Http/Controllers/HeroImageController.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/HeroImageTest.php`

**Interfaces:**
- Consumes: `$this->allScopes()` (Task 3).
- Produces: `PATCH /api/admin/hero-images/{id}` — `{caption?, active?}` → `{data: {...}}`.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/Feature/HeroImageTest.php`:

```php
// ── PATCH /admin/hero-images/{heroImage} ────────────────────────────────────────

it('updates a caption alone', function () {
    heroAdmin();
    $row = heroRow(['caption' => 'old']);

    $this->patchJson("/api/admin/hero-images/{$row->id}", ['caption' => 'new'])
        ->assertOk()
        ->assertJsonPath('data.main.0.caption', 'new')
        ->assertJsonPath('data.main.0.active', true);
});

it('toggles active alone', function () {
    heroAdmin();
    $row = heroRow(['active' => true]);

    $this->patchJson("/api/admin/hero-images/{$row->id}", ['active' => false])
        ->assertOk()
        ->assertJsonPath('data.main.0.active', false)
        ->assertJsonPath('data.main.0.caption', null);
});

it('rejects an unknown hero image id on patch', function () {
    heroAdmin();

    $this->patchJson('/api/admin/hero-images/999999', ['active' => false])
        ->assertNotFound();
});

it('asks the public site to rebuild after a patch, when auto-rebuild is on', function () {
    Http::fake();
    App\Models\SiteSetting::set('auto_rebuild', 'true');
    heroAdmin();
    $row = heroRow();

    $this->patchJson("/api/admin/hero-images/{$row->id}", ['active' => false])->assertOk();

    Http::assertSent(fn ($request) => str_contains($request->url(), '/rebuild'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run the backend test command. Expected: FAIL — no `PATCH /api/admin/hero-images/{id}` route exists yet (404).

- [ ] **Step 3: Add the controller method**

In `api/app/Http/Controllers/HeroImageController.php`, add `patch()`:

```php
    /** Partial update of one row — caption and/or active. */
    public function patch(Request $request, HeroImage $heroImage): JsonResponse
    {
        $data = $request->validate([
            'caption' => 'sometimes|nullable|string|max:255',
            'active'  => 'sometimes|boolean',
        ]);

        $heroImage->update($data);

        SiteRebuild::requestIfAuto();

        return response()->json(['data' => (object) $this->allScopes()]);
    }
```

- [ ] **Step 4: Add the route**

In `api/routes/api.php`, add directly after the `store` route added in Task 4:

```php
        Route::patch('/admin/hero-images/{heroImage}', [HeroImageController::class, 'patch'])
            ->name('api.admin.hero-images.patch');
```

- [ ] **Step 5: Run the test to verify it passes**

Run the backend test command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app/Http/Controllers/HeroImageController.php api/routes/api.php api/tests/Feature/HeroImageTest.php
git commit -m "feat(api): add caption/active patch endpoint for one hero image"
```

---

## Task 6: `PUT /admin/hero-images/{scope}/order` — reorder

**Files:**
- Modify: `api/app/Http/Controllers/HeroImageController.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/HeroImageTest.php`

**Interfaces:**
- Consumes: `$this->allScopes()` (Task 3).
- Produces: `PUT /api/admin/hero-images/{scope}/order` — `{order: [ids...]}` → `{data: {...}}`.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/Feature/HeroImageTest.php`:

```php
// ── PUT /admin/hero-images/{scope}/order ────────────────────────────────────────

it('writes position from the given order', function () {
    heroAdmin();
    $a = heroRow(['image' => 'hero-images/a.jpg', 'position' => 0]);
    $b = heroRow(['image' => 'hero-images/b.jpg', 'position' => 1]);

    $this->putJson('/api/admin/hero-images/main/order', ['order' => [$b->id, $a->id]])
        ->assertOk()
        ->assertJsonPath('data.main.0.id', $b->id)
        ->assertJsonPath('data.main.0.position', 0)
        ->assertJsonPath('data.main.1.id', $a->id)
        ->assertJsonPath('data.main.1.position', 1);
});

it('rejects an id that belongs to a different scope', function () {
    heroAdmin();
    $other = heroRow(['scope' => 'contact']);

    $this->putJson('/api/admin/hero-images/main/order', ['order' => [$other->id]])
        ->assertStatus(422);
});

it('rejects reordering into an unknown scope', function () {
    heroAdmin();
    $a = heroRow();

    $this->putJson('/api/admin/hero-images/not-a-page/order', ['order' => [$a->id]])
        ->assertStatus(422);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run the backend test command. Expected: FAIL — no `PUT /api/admin/hero-images/{scope}/order` route exists yet (404).

- [ ] **Step 3: Add the controller method**

In `api/app/Http/Controllers/HeroImageController.php`, add `reorder()`:

```php
    /**
     * Reorder every row already in one scope. Every id in `order` must
     * already belong to that scope — Rule::exists's `where` clause rejects
     * anything else with a 422 rather than silently ignoring it, so a
     * mis-scoped id cannot leave the set half-reordered.
     */
    public function reorder(Request $request, string $scope): JsonResponse
    {
        $request->merge(['scope' => $scope]);

        $data = $request->validate([
            'scope'   => ['required', 'string', Rule::in(HeroImage::allowedScopes())],
            'order'   => 'required|array',
            'order.*' => ['integer', Rule::exists('hero_images', 'id')->where('scope', $scope)],
        ]);

        foreach ($data['order'] as $position => $id) {
            HeroImage::where('id', $id)->where('scope', $data['scope'])->update(['position' => $position]);
        }

        SiteRebuild::requestIfAuto();

        return response()->json(['data' => (object) $this->allScopes()]);
    }
```

- [ ] **Step 4: Add the route**

In `api/routes/api.php`, add directly after the `patch` route added in Task 5:

```php
        Route::put('/admin/hero-images/{scope}/order', [HeroImageController::class, 'reorder'])
            ->name('api.admin.hero-images.reorder');
```

- [ ] **Step 5: Run the test to verify it passes**

Run the backend test command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app/Http/Controllers/HeroImageController.php api/routes/api.php api/tests/Feature/HeroImageTest.php
git commit -m "feat(api): add per-scope reorder endpoint for hero images"
```

---

## Task 7: `DELETE /admin/hero-images/{heroImage}` — remove, and retire the old `update()`

**Files:**
- Modify: `api/app/Http/Controllers/HeroImageController.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/HeroImageTest.php`

**Interfaces:**
- Produces: `DELETE /api/admin/hero-images/{id}` → `204 No Content`.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/Feature/HeroImageTest.php`:

```php
// ── DELETE /admin/hero-images/{heroImage} ───────────────────────────────────────

it('deletes the file and the row', function () {
    heroAdmin();
    Storage::disk('public')->put('hero-images/gone.jpg', 'x');
    $row = heroRow(['image' => 'hero-images/gone.jpg']);

    $this->deleteJson("/api/admin/hero-images/{$row->id}")->assertNoContent();

    Storage::disk('public')->assertMissing('hero-images/gone.jpg');
    expect(HeroImage::count())->toBe(0);
});

it('404s deleting an id that no longer exists', function () {
    heroAdmin();

    $this->deleteJson('/api/admin/hero-images/999999')->assertNotFound();
});

it('asks the public site to rebuild after a delete, when auto-rebuild is on', function () {
    Http::fake();
    App\Models\SiteSetting::set('auto_rebuild', 'true');
    heroAdmin();
    $row = heroRow();

    $this->deleteJson("/api/admin/hero-images/{$row->id}")->assertNoContent();

    Http::assertSent(fn ($request) => str_contains($request->url(), '/rebuild'));
});

it('does not rebuild when auto-rebuild is off', function () {
    Http::fake();
    App\Models\SiteSetting::set('auto_rebuild', 'false');
    heroAdmin();
    $row = heroRow();

    $this->deleteJson("/api/admin/hero-images/{$row->id}")->assertNoContent();

    Http::assertNothingSent();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run the backend test command. Expected: FAIL — no `DELETE /api/admin/hero-images/{id}` route exists yet (404, not 204/404-as-designed).

- [ ] **Step 3: Add the controller method, remove the old `update()`**

In `api/app/Http/Controllers/HeroImageController.php`, add `destroy()`:

```php
    public function destroy(HeroImage $heroImage): JsonResponse
    {
        if ($heroImage->image) {
            Storage::disk('public')->delete($heroImage->image);
        }

        $heroImage->delete();

        SiteRebuild::requestIfAuto();

        return response()->json(null, 204);
    }
```

Add `use Illuminate\Support\Facades\Storage;` to the top of the file.

Now delete the old `update()` method entirely — its route was already replaced in Task 4, so nothing calls it:

```php
    public function update(Request $request, string $scope): JsonResponse
    {
        $request->merge(['scope' => $scope]);

        $data = $request->validate([
            'scope'       => ['required', 'string', Rule::in(HeroImage::allowedScopes())],
            'photo_ids'   => ['present', 'array', 'max:100'],
            'photo_ids.*' => ['integer', 'exists:photos,id'],
        ]);

        DB::transaction(function () use ($data) {
            HeroImage::where('scope', $data['scope'])->delete();

            foreach ($data['photo_ids'] as $position => $photoId) {
                HeroImage::create([
                    'photo_id' => $photoId,
                    'scope'    => $data['scope'],
                    'position' => $position,
                ]);
            }
        });

        SiteRebuild::requestIfAuto();

        return response()->json(['data' => (object) $this->allScopes()]);
    }
```

Remove this whole method. It was the only user of `DB::transaction` in this controller — remove the now-unused `use Illuminate\Support\Facades\DB;` import from the top of the file too.

- [ ] **Step 4: Add the route**

In `api/routes/api.php`, add directly after the `reorder` route added in Task 6:

```php
        Route::delete('/admin/hero-images/{heroImage}', [HeroImageController::class, 'destroy'])
            ->name('api.admin.hero-images.destroy');
```

The full block (`GET`, `POST`, `PATCH`, `PUT .../order`, `DELETE`) should now read:

```php
        // ── Hero background images ────────────────────────────────────────────
        Route::get('/admin/hero-images', [HeroImageController::class, 'index'])
            ->name('api.admin.hero-images.index');
        Route::post('/admin/hero-images/{scope}', [HeroImageController::class, 'store'])
            ->name('api.admin.hero-images.store');
        Route::patch('/admin/hero-images/{heroImage}', [HeroImageController::class, 'patch'])
            ->name('api.admin.hero-images.patch');
        Route::put('/admin/hero-images/{scope}/order', [HeroImageController::class, 'reorder'])
            ->name('api.admin.hero-images.reorder');
        Route::delete('/admin/hero-images/{heroImage}', [HeroImageController::class, 'destroy'])
            ->name('api.admin.hero-images.destroy');
```

- [ ] **Step 5: Run the full HeroImageTest suite**

Run the backend test command. Expected: PASS — every test added across Tasks 1–7.

- [ ] **Step 6: Commit**

```bash
git add api/app/Http/Controllers/HeroImageController.php api/routes/api.php api/tests/Feature/HeroImageTest.php
git commit -m "feat(api): add delete endpoint for hero images, retire the whole-scope PUT"
```

---

## Task 8: Public `/api/site-config` — active-only, no photo join

**Files:**
- Modify: `api/app/Http/Controllers/WebsiteModuleController.php`
- Test: `api/tests/Feature/HeroImageTest.php`

**Interfaces:**
- Consumes: `HeroImage` model (Task 1).
- Produces: `GET /api/site-config`'s `hero_images` key — unchanged shape (`{scope: [{id, url, caption}]}`), now filtered to `active` rows.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/Feature/HeroImageTest.php`:

```php
// ── site-config ───────────────────────────────────────────────────────────────

it('serves hero images from site-config without auth', function () {
    $row = heroRow(['image' => 'hero-images/a.jpg']);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonCount(1, 'hero_images.main')
        ->assertJsonPath('hero_images.main.0.id', $row->id)
        ->assertJsonPath('hero_images.main.0.url', '/storage/hero-images/a.jpg');
});

it('omits inactive rows from site-config', function () {
    heroRow(['active' => false]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonMissingPath('hero_images.main');
});

it('serves an empty hero_images object rather than null when none are active', function () {
    // A null here throws during astro build, which takes down all 35 pages.
    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('hero_images', []);
});

it('keeps hero images out of module_config so the slug map is unaffected', function () {
    heroRow(['scope' => 'home']);

    $response = $this->getJson('/api/site-config')->assertOk();

    expect(array_keys($response->json('module_config')))->not->toContain('home');
    expect($response->json('hero_images.home'))->toHaveCount(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run the backend test command. Expected: FAIL — `WebsiteModuleController@index` still calls `->with('photo')` and reads `$h->photo_id`/`$h->photo->image`, which error against the new schema.

- [ ] **Step 3: Update the site-config assembly**

In `api/app/Http/Controllers/WebsiteModuleController.php`, replace the `$hero_images` block:

```php
        // Hero backdrops, keyed by scope ('main', 'home', or a module slug).
        //
        // Deliberately NOT inside module_config: slugs.ts builds the site's
        // slug map from that object's keys, so the non-module scopes would
        // appear there as phantom modules — green build, wrong nav map.
        $hero_images = HeroImage::where('active', true)
            ->orderBy('scope')
            ->orderBy('position')
            ->get()
            ->groupBy('scope')
            ->map(fn ($rows) => $rows
                ->map(fn ($h) => [
                    'id'      => $h->id,
                    'url'     => '/storage/' . $h->image,
                    'caption' => $h->caption,
                ])->values()->all())
            // A scope left empty by the active filter is dropped too, so
            // "present but unusable" never reaches the resolver as a
            // non-empty override.
            ->filter(fn ($rows) => count($rows) > 0)
            ->all();
```

- [ ] **Step 4: Run the test to verify it passes**

Run the backend test command. Expected: PASS.

- [ ] **Step 5: Run the full backend suite**

```bash
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test
```

Expected: PASS — no other suite references `HeroImage::photo()` or `photo_id` (confirm with a repo-wide search if anything fails).

- [ ] **Step 6: Commit**

```bash
git add api/app/Http/Controllers/WebsiteModuleController.php api/tests/Feature/HeroImageTest.php
git commit -m "feat(api): filter public hero images to active rows, drop the photo join"
```

---

## Task 9: Frontend types and API client

**Files:**
- Modify: `app/src/types/heroImage.ts`
- Modify: `app/src/api/heroImages.ts`

**Interfaces:**
- Produces:
  - `HeroImage { id, url, caption, position, active }`, `HeroImageSets = Record<string, HeroImage[]>`, `HeroImagesResponse { data: HeroImageSets }` — consumed by Tasks 10, 11, 12.
  - `fetchHeroImages(token)`, `uploadHeroImages(token, scope, files: {file, caption}[])`, `updateHeroImage(token, id, {caption?, active?})`, `reorderHeroImages(token, scope, order: number[])`, `deleteHeroImage(token, id)` — consumed by Task 10.

No test of its own — this is a thin types/fetch layer, consistent with how `app/src/api/albums.ts` has no direct test in this codebase. It is exercised through Task 12's E2E coverage.

- [ ] **Step 1: Replace the types file**

Replace the entire contents of `app/src/types/heroImage.ts`:

```ts
/**
 * One hero backdrop picture, uploaded directly for hero use — not a gallery
 * photo. `id` is the hero_images row's own id.
 */
export interface HeroImage {
  id: number
  /** Null only if the stored file is somehow missing — render a placeholder, not a broken img. */
  url: string | null
  caption: string | null
  position: number
  active: boolean
}

/** Hero sets keyed by scope: 'main', 'home', or a website module slug. */
export type HeroImageSets = Record<string, HeroImage[]>

export interface HeroImagesResponse {
  data: HeroImageSets
}
```

- [ ] **Step 2: Replace the API client**

Replace the entire contents of `app/src/api/heroImages.ts`:

```ts
import type { HeroImagesResponse } from '@/types/heroImage'
import { API_BASE, assertSafeId, authHeaders, handleResponse } from './client'

export async function fetchHeroImages(token: string): Promise<HeroImagesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/hero-images`, { headers: authHeaders(token) })
  return handleResponse<HeroImagesResponse>(res)
}

/**
 * Upload one or more new hero pictures into a scope, appended after whatever
 * is already there.
 *
 * Multipart, so it cannot go through authHeaders (that sets
 * Content-Type: application/json, which would break the multipart boundary) —
 * Authorization and Accept only, the same way batchCreateAlbum builds its
 * request. The scope is path-encoded because it is a slug from the API, not
 * free text.
 */
export async function uploadHeroImages(
  token: string,
  scope: string,
  files: { file: File; caption: string }[],
): Promise<HeroImagesResponse> {
  const body = new FormData()
  files.forEach(({ file, caption }) => {
    body.append('files[]', file)
    body.append('captions[]', caption)
  })

  const res = await fetch(`${API_BASE}/api/admin/hero-images/${encodeURIComponent(scope)}`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body,
  })
  return handleResponse<HeroImagesResponse>(res)
}

/** Partial update — caption and/or active — for one hero image row. */
export async function updateHeroImage(
  token: string,
  id: number,
  payload: { caption?: string | null; active?: boolean },
): Promise<HeroImagesResponse> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/admin/hero-images/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return handleResponse<HeroImagesResponse>(res)
}

/**
 * Reorder every row in one scope. `order` is the full list of that scope's
 * ids in the desired position order — the server writes `position` from the
 * array index.
 */
export async function reorderHeroImages(
  token: string,
  scope: string,
  order: number[],
): Promise<HeroImagesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/hero-images/${encodeURIComponent(scope)}/order`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ order }),
  })
  return handleResponse<HeroImagesResponse>(res)
}

export async function deleteHeroImage(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/admin/hero-images/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  return handleResponse<void>(res)
}
```

- [ ] **Step 3: Type-check**

```bash
cd app && npx vue-tsc -b
```

Expected: fails here, because `useHeroImages.ts` (Task 10) and `HeroImagesAdminView.vue` (Task 12) still import the old `saveHeroImageScope` / old `HeroImage` shape. This is expected at this point in the plan — re-run after Task 12.

- [ ] **Step 4: Commit**

```bash
git add app/src/types/heroImage.ts app/src/api/heroImages.ts
git commit -m "feat(app): add standalone hero image types and API client functions"
```

---

## Task 10: `useHeroImages` composable

**Files:**
- Modify: `app/src/composables/useHeroImages.ts`

**Interfaces:**
- Consumes: `fetchHeroImages`, `uploadHeroImages`, `updateHeroImage`, `reorderHeroImages`, `deleteHeroImage` (Task 9).
- Produces: `useHeroImages()` → `{ query, upload, update, reorder, remove }` — each a Vue Query object. Consumed by Task 12.
  - `upload.mutateAsync({ scope, files: {file, caption}[] })`
  - `update.mutateAsync({ id, payload: {caption?, active?} })`
  - `reorder.mutateAsync({ scope, order: number[] })`
  - `remove.mutateAsync(id)`

No test of its own — this composable pulls in `useAuth`, which reads `localStorage` at module load, and the admin's vitest environment is `node` (see root `CLAUDE.md`). It is exercised through Task 13's E2E coverage.

- [ ] **Step 1: Replace the composable**

Replace the entire contents of `app/src/composables/useHeroImages.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  fetchHeroImages,
  uploadHeroImages,
  updateHeroImage,
  reorderHeroImages,
  deleteHeroImage,
} from '@/api/heroImages'
import { useAuth } from './useAuth'
import type { HeroImagesResponse } from '@/types/heroImage'

const HERO_IMAGES_KEY = ['hero-images'] as const

export function useHeroImages() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: HERO_IMAGES_KEY,
    queryFn: () => fetchHeroImages(token.value!),
    enabled: () => token.value !== null,
  })

  // Upload/update/reorder all return the full map already ordered, so seeding
  // the cache from the response avoids a refetch that would briefly snap
  // thumbnails back to their pre-mutation order.
  const onMapResponse = (data: HeroImagesResponse) => queryClient.setQueryData(HERO_IMAGES_KEY, data)

  const upload = useMutation({
    mutationFn: ({ scope, files }: { scope: string; files: { file: File; caption: string }[] }) =>
      uploadHeroImages(token.value!, scope, files),
    onSuccess: onMapResponse,
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { caption?: string | null; active?: boolean } }) =>
      updateHeroImage(token.value!, id, payload),
    onSuccess: onMapResponse,
  })

  const reorder = useMutation({
    mutationFn: ({ scope, order }: { scope: string; order: number[] }) =>
      reorderHeroImages(token.value!, scope, order),
    onSuccess: onMapResponse,
  })

  // DELETE returns 204, not the map — invalidate and refetch instead, the
  // same handling PhotosAdminView already uses for removeAlbumPhoto.
  const remove = useMutation({
    mutationFn: (id: number) => deleteHeroImage(token.value!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HERO_IMAGES_KEY }),
  })

  return { query, upload, update, reorder, remove }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/composables/useHeroImages.ts
git commit -m "feat(app): replace single hero image save mutation with four per-action ones"
```

---

## Task 11: `heroImageScopes.ts` — active-aware `hasOwnSet`, drop `shouldReseedDraft`

**Files:**
- Modify: `app/src/utils/heroImageScopes.ts`
- Modify: `app/src/utils/heroImageScopes.spec.ts`

**Interfaces:**
- Produces: `scopeSet(sets, scope): HeroImage[]` (unchanged signature — includes inactive rows), `hasOwnSet(sets, scope): boolean` (now true only if the scope has at least one **active** row). `shouldReseedDraft` is removed. Consumed by Task 12.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `app/src/utils/heroImageScopes.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scopeSet, hasOwnSet } from './heroImageScopes'
import type { HeroImageSets } from '@/types/heroImage'

const SETS: HeroImageSets = {
  main: [{ id: 1, url: '/storage/a.jpg', caption: null, position: 0, active: true }],
  contact: [],
  about: [{ id: 2, url: '/storage/b.jpg', caption: null, position: 0, active: false }],
}

describe('scopeSet', () => {
  it('returns the scope’s own list, including inactive rows', () => {
    expect(scopeSet(SETS, 'about')).toHaveLength(1)
  })

  it('returns an empty list for a scope with no entry', () => {
    expect(scopeSet(SETS, 'nowhere')).toEqual([])
  })

  it('returns an empty list when the sets are undefined', () => {
    // The query is still loading, or the request failed.
    expect(scopeSet(undefined, 'main')).toEqual([])
  })
})

describe('hasOwnSet', () => {
  it('is true only when the scope has at least one active picture', () => {
    expect(hasOwnSet(SETS, 'main')).toBe(true)
    // An empty stored set is "inherits main", matching the public resolver —
    // the two must agree or the admin lies about what the page will show.
    expect(hasOwnSet(SETS, 'contact')).toBe(false)
    expect(hasOwnSet(SETS, 'nowhere')).toBe(false)
  })

  it('treats a scope holding only inactive pictures as no override', () => {
    // resolveHeroImages() on the public side never learns an inactive picture
    // exists, so the admin summary has to agree: "inherits Main," not "1 picture."
    expect(hasOwnSet(SETS, 'about')).toBe(false)
  })

  it('treats a missing sets object as no override', () => {
    expect(hasOwnSet(undefined, 'contact')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app && pnpm test:unit src/utils/heroImageScopes.spec.ts
```

Expected: FAIL — `hasOwnSet(SETS, 'about')` currently returns `true` (it only checks length, not `active`), and the fixture objects (missing `photo_id` in the old type, now missing nothing but the old spec imported `shouldReseedDraft`) won't compile against the current source without the change below.

- [ ] **Step 3: Update the source**

Replace the entire contents of `app/src/utils/heroImageScopes.ts`:

```ts
import type { HeroImage, HeroImageSets } from '@/types/heroImage'

/**
 * Pure helpers for reading hero image sets.
 *
 * They live here rather than in useHeroImages so they can be tested without a
 * DOM: the composable imports useAuth, which reads localStorage at module
 * load, and the admin's vitest environment is `node`.
 */

/** The pictures stored against one scope, or an empty list. Includes inactive rows. */
export function scopeSet(sets: HeroImageSets | undefined, scope: string): HeroImage[] {
  return sets?.[scope] ?? []
}

/**
 * Whether a scope overrides the main set.
 *
 * Filtered to *active* rows: a scope holding only inactive pictures must
 * report "inherits Main" the same way an empty scope does, because that is
 * exactly what a visitor sees — resolveHeroImages() on the public side never
 * learns a picture exists if it isn't active. The editor would otherwise show
 * "N pictures" for a scope that renders nothing.
 */
export function hasOwnSet(sets: HeroImageSets | undefined, scope: string): boolean {
  return scopeSet(sets, scope).some((h) => h.active)
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd app && pnpm test:unit src/utils/heroImageScopes.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/utils/heroImageScopes.ts app/src/utils/heroImageScopes.spec.ts
git commit -m "feat(app): make hasOwnSet active-aware, drop the now-unused draft reseed helper"
```

---

## Task 12: Rewrite `HeroImagesAdminView.vue`

**Files:**
- Modify: `app/src/views/admin/HeroImagesAdminView.vue`

**Interfaces:**
- Consumes: `useHeroImages()` (Task 10), `scopeSet`/`hasOwnSet` (Task 11), `HeroImage` type (Task 9).

No unit test — views in this app aren't unit-tested (only `src/utils` is, per root `CLAUDE.md`). Covered by Task 13's E2E rewrite.

- [ ] **Step 1: Replace the view**

Replace the entire contents of `app/src/views/admin/HeroImagesAdminView.vue`:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import { useHeroImages } from '@/composables/useHeroImages'
import { useWebsiteModules } from '@/composables/useWebsiteModules'
import { scopeSet, hasOwnSet } from '@/utils/heroImageScopes'
import { NON_PAGE_MODULES } from '@/config/moduleSettings'
import type { HeroImage } from '@/types/heroImage'

const { query, upload, update, reorder, remove } = useHeroImages()
const { query: modulesQ, rebuild, rebuildStatusQuery } = useWebsiteModules()

const sets = computed(() => query.data.value?.data)

/**
 * Modules whose public page renders no hero, so a picture here would do nothing.
 *
 * Kept local rather than folded into NON_PAGE_MODULES: tech-rider *does* have a
 * route and a URL slug, so hiding it there would remove inputs that work. What
 * it lacks is a PageHero — its page is the token-gated rider document, which is
 * built to print black-on-white and deliberately carries no backdrop.
 */
const NO_HERO_MODULES = new Set(['tech-rider'])

/**
 * Scopes in editing order: the fallback first, then the homepage, then pages.
 *
 * NON_PAGE_MODULES is excluded because those rows have no route at all — a hero
 * for the footer would be a control that changes nothing. Disabled modules stay
 * in the list: switching a section off must not make its pictures unreachable.
 */
const scopes = computed(() => [
  { key: 'main', label: 'Main', hint: 'Used by every page that has none of its own' },
  { key: 'home', label: 'Homepage', hint: '' },
  ...(modulesQ.data.value?.data ?? [])
    .filter(m => !NON_PAGE_MODULES.has(m.slug) && !NO_HERO_MODULES.has(m.slug))
    .map(m => ({
      key: m.slug,
      label: m.display_name,
      hint: m.enabled ? '' : 'module currently switched off',
    })),
])

const selected = ref('main')

/** The selected scope's rows, in server order — includes inactive rows. */
const current = computed<HeroImage[]>(() => scopeSet(sets.value, selected.value))

const fileInput = ref<HTMLInputElement | null>(null)

async function onFilesChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length === 0) return

  try {
    await upload.mutateAsync({
      scope: selected.value,
      files: files.map(file => ({ file, caption: '' })),
    })
    toast.success(files.length === 1 ? 'Picture uploaded' : `${files.length} pictures uploaded`)
  } catch {
    toast.error('Upload failed')
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

/**
 * Captions are edited inline, after upload, rather than in a pre-upload form —
 * an optional field doesn't earn a second form. Keyed by image id so a pending
 * edit in one thumbnail survives a cache update to another.
 */
const captionDrafts = ref<Record<number, string>>({})

function captionFor(image: HeroImage): string {
  return captionDrafts.value[image.id] ?? image.caption ?? ''
}

async function saveCaption(image: HeroImage, value: string) {
  delete captionDrafts.value[image.id]
  if (value === (image.caption ?? '')) return
  try {
    await update.mutateAsync({ id: image.id, payload: { caption: value || null } })
  } catch {
    toast.error('Could not save caption')
  }
}

async function toggleActive(image: HeroImage) {
  try {
    await update.mutateAsync({ id: image.id, payload: { active: !image.active } })
  } catch {
    toast.error('Could not update')
  }
}

/**
 * Fires the reorder call immediately per click — no separate "Save order" bar.
 * These lists are a handful of pictures, not a full photo album, so a
 * dirty-tracked batch save isn't worth the extra state.
 */
async function move(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= current.value.length) return
  const order = current.value.map(h => h.id)
  const [moved] = order.splice(index, 1)
  order.splice(next, 0, moved)
  try {
    await reorder.mutateAsync({ scope: selected.value, order })
  } catch {
    toast.error('Could not reorder')
  }
}

async function removeImage(image: HeroImage) {
  try {
    await remove.mutateAsync(image.id)
    toast.success('Picture removed')
  } catch {
    toast.error('Could not remove picture')
  }
}

/** Count shown beside each scope, or the inheritance note. */
function scopeSummary(key: string): string {
  if (!hasOwnSet(sets.value, key)) return key === 'main' ? 'none set' : 'inherits Main'
  const n = scopeSet(sets.value, key).filter(h => h.active).length
  return n === 1 ? '1 picture' : `${n} pictures`
}

const rebuilding = computed(() => rebuildStatusQuery.data.value?.status === 'building')
const autoRebuild = computed(() => modulesQ.data.value?.auto_rebuild ?? false)
</script>

<template>
  <AdminLayout>
    <div class="p-6 max-w-5xl mx-auto">
      <div class="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-bold text-white">Hero Images</h1>
          <p class="text-sm text-zinc-500 mt-1">
            Pictures shown behind a page's title. With more than one active picture, one
            is chosen at random on each visit. A page with none of its own uses Main.
            Uploaded here directly — never from the photo gallery.
          </p>
        </div>

        <button
          v-if="!autoRebuild"
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          :disabled="rebuilding"
          title="Rebuild the public site so the change becomes visible"
          @click="rebuild.mutate()"
        >
          {{ rebuilding ? 'Rebuilding…' : '↺ Rebuild Public Site' }}
        </button>
      </div>

      <p v-if="query.isError.value" class="text-sm text-red-400 mb-4">
        Could not load hero images.
      </p>

      <div class="grid gap-6 md:grid-cols-[240px_1fr]">
        <!-- Scopes -->
        <ul class="space-y-1">
          <li v-for="s in scopes" :key="s.key">
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-lg transition-colors"
              :class="selected === s.key ? 'bg-zinc-700 text-white' : 'text-zinc-300 hover:bg-zinc-800'"
              @click="selected = s.key"
            >
              <span class="font-semibold">{{ s.label }}</span>
              <span class="block text-xs text-zinc-500">{{ scopeSummary(s.key) }}</span>
              <span v-if="s.hint" class="block text-xs text-zinc-600">{{ s.hint }}</span>
            </button>
          </li>
        </ul>

        <!-- Selected scope -->
        <div>
          <p v-if="current.length === 0" class="text-sm text-zinc-500 mb-4">
            No pictures yet.
            <template v-if="selected !== 'main'">This page uses the Main set.</template>
          </p>

          <ul v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            <li
              v-for="(image, i) in current" :key="image.id"
              class="rounded-lg overflow-hidden bg-zinc-800"
              :class="{ 'opacity-40': !image.active }"
            >
              <img
                v-if="image.url"
                :src="image.url"
                :alt="image.caption ?? ''"
                class="w-full h-28 object-cover"
              />
              <div v-else class="w-full h-28 grid place-items-center text-xs text-zinc-500">no file</div>

              <input
                :value="captionFor(image)"
                placeholder="Caption (optional)"
                class="w-full bg-transparent border-0 border-b border-zinc-700 text-xs text-zinc-300 px-2 py-1 focus:outline-none focus:border-teal-500"
                @input="captionDrafts[image.id] = ($event.target as HTMLInputElement).value"
                @blur="saveCaption(image, captionFor(image))"
              />

              <div class="flex items-center gap-1 p-2 text-xs">
                <button
                  type="button" class="px-2 py-1 rounded bg-zinc-700 disabled:opacity-40 text-white"
                  :disabled="i === 0 || reorder.isPending.value" aria-label="Move earlier" @click="move(i, -1)"
                >←</button>
                <button
                  type="button" class="px-2 py-1 rounded bg-zinc-700 disabled:opacity-40 text-white"
                  :disabled="i === current.length - 1 || reorder.isPending.value" aria-label="Move later" @click="move(i, 1)"
                >→</button>
                <label class="ml-auto flex items-center gap-1 cursor-pointer select-none text-zinc-400">
                  <input type="checkbox" :checked="image.active" @change="toggleActive(image)" />
                  Active
                </label>
              </div>
              <div class="p-2 pt-0">
                <button
                  type="button" class="w-full px-2 py-1 rounded text-red-400 hover:bg-zinc-700"
                  :disabled="remove.isPending.value"
                  @click="removeImage(image)"
                >Remove</button>
              </div>
            </li>
          </ul>

          <label
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold cursor-pointer"
            :class="{ 'opacity-50 cursor-not-allowed': upload.isPending.value }"
          >
            {{ upload.isPending.value ? 'Uploading…' : '+ Upload pictures' }}
            <input
              ref="fileInput" type="file" accept="image/*" multiple class="hidden"
              :disabled="upload.isPending.value"
              @change="onFilesChosen"
            />
          </label>

          <p v-if="!autoRebuild" class="text-xs text-zinc-500 mt-3">
            The public site is static — hero changes appear after a rebuild.
          </p>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>
```

- [ ] **Step 2: Type-check the whole app**

```bash
cd app && npx vue-tsc -b
```

Expected: PASS — this resolves the failure noted at the end of Task 9.

- [ ] **Step 3: Manually verify in the browser**

```bash
bash rebuild.sh --backend-only
```

Then in the admin (`http://localhost:8081/admin/hero-images`): upload a picture, edit its caption, toggle it inactive (thumbnail dims), reorder with the arrows, remove it. Confirm no console errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/views/admin/HeroImagesAdminView.vue
git commit -m "feat(app): rewrite Hero Images admin to upload directly and toggle active"
```

---

## Task 13: E2E specs — admin flow rewrite, public inactive-picture case

**Files:**
- Modify: `app/e2e/tests/admin/hero-images.spec.ts`
- Modify: `app/e2e/tests/public/hero-backdrop.spec.ts`

**Interfaces:** none — terminal task, exercises the full stack built in Tasks 1–12.

- [ ] **Step 1: Rewrite the admin spec**

Replace the entire contents of `app/e2e/tests/admin/hero-images.spec.ts`:

```ts
import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'

test.use({ storageState: 'e2e/.auth/admin.json' })

// Relative to the Playwright cwd (app/), the same way test.use() names it above.
// __dirname is unavailable — these specs are ESM.
const AUTH_FILE = 'e2e/.auth/admin.json'

/**
 * The bearer token, read out of the stored auth state.
 *
 * `request.newContext({ storageState })` replays **cookies only**, and this app
 * keeps its token in localStorage — so an API context built that way is
 * anonymous, every call 401s, and a restore that does not check its response
 * silently does nothing.
 */
function adminToken(): string {
  const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'))
  for (const origin of state.origins ?? []) {
    const entry = (origin.localStorage ?? []).find((kv: { name: string }) => kv.name === 'auth_token')
    if (entry?.value) return entry.value
  }
  throw new Error('No auth_token in e2e/.auth/admin.json — did the auth setup run?')
}

/** A 1×1 transparent PNG — small enough to embed, real enough to pass Laravel's `image` rule. */
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

/**
 * These tests upload real pictures into the shared dev database's `main`
 * scope, and the public site bakes whatever is there at container start — so
 * a run that does not clean up leaves a probe picture behind the title of
 * every page. Unlike the old whole-scope PUT, there is no single "restore"
 * call any more: each per-row endpoint only touches the row it names. So
 * instead of restoring a snapshot, the ids present before the run are
 * captured, and anything introduced beyond them is deleted individually.
 */
test.describe('Hero Images Admin', () => {
  test.describe.configure({ mode: 'serial' })

  let originalMainIds: number[] | null = null

  const apiOptions = (baseURL: string | undefined) => ({
    baseURL,
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: `Bearer ${adminToken()}`,
    },
  })

  /** Throws rather than returning [] on a failed read — see readMainIds below. */
  async function readMainIds(request: APIRequestContext): Promise<number[]> {
    const res = await request.get('/api/admin/hero-images')
    if (!res.ok()) {
      throw new Error(`Could not read hero images (${res.status()}) — refusing to guess the original state`)
    }
    const body = await res.json()
    return (body.data?.main ?? []).map((h: { id: number }) => h.id)
  }

  test.beforeAll(async ({ playwright, baseURL }) => {
    const request = await playwright.request.newContext(apiOptions(baseURL))
    originalMainIds = await readMainIds(request)
    await request.dispose()
  })

  test.afterAll(async ({ playwright, baseURL }) => {
    if (originalMainIds === null) return
    const request = await playwright.request.newContext(apiOptions(baseURL))
    const currentIds = await readMainIds(request)
    const introduced = currentIds.filter((id) => !originalMainIds!.includes(id))
    for (const id of introduced) {
      const res = await request.delete(`/api/admin/hero-images/${id}`)
      expect(res.ok(), `cleanup delete failed with ${res.status()}`).toBeTruthy()
    }
    await request.dispose()
  })

  test('page loads and lists every scope', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Hero Images' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Main/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Homepage/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Contact/ })).toBeVisible()
  })

  test('a page with no set of its own reports that it inherits Main', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    // Contact has no set in a clean dev database, so its row carries the
    // inheritance note rather than a count.
    await expect(page.getByRole('button', { name: /^Contact/ })).toContainText('inherits Main')
  })

  test('omits modules whose page renders no hero', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    // tech-rider has a route and a slug, so it is not a NON_PAGE_MODULE — but
    // its page is the token-gated rider document and shows no backdrop.
    await expect(page.getByRole('button', { name: /^Tech Rider/ })).toHaveCount(0)
    // footer is chrome, not a page, and is excluded by NON_PAGE_MODULES.
    await expect(page.getByRole('button', { name: /^Footer/ })).toHaveCount(0)
  })

  test('uploads a picture directly and it persists across a reload', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    await page.locator('input[type="file"]').setInputFiles({
      name: 'e2e-hero.png',
      mimeType: 'image/png',
      buffer: TEST_PNG,
    })

    await expect(page.locator('img[alt=""]').last()).toBeVisible({ timeout: 8000 })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /^Main/ })).toContainText('picture')
  })

  test('toggling active off dims the thumbnail and updates the summary', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    const before = (await page.getByRole('button', { name: /^Main/ }).textContent()) ?? ''

    const checkbox = page.locator('label:has-text("Active") input[type="checkbox"]').first()
    await checkbox.uncheck()

    await expect(page.locator('li.opacity-40')).toHaveCount(1)

    await page.reload()
    await page.waitForLoadState('networkidle')
    const after = (await page.getByRole('button', { name: /^Main/ }).textContent()) ?? ''
    expect(after).not.toBe(before)

    // Restore it active, so the next test (and the introduced-id cleanup
    // above, which only deletes — it does not know how to re-toggle) leaves
    // main in the state other specs expect.
    await checkbox.check()
  })

  test('removes a picture', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.waitForLoadState('networkidle')

    const countBefore = await page.locator('li.rounded-lg.overflow-hidden').count()
    await page.getByRole('button', { name: 'Remove' }).first().click()

    await expect(page.locator('li.rounded-lg.overflow-hidden')).toHaveCount(countBefore - 1)
  })
})
```

- [ ] **Step 2: Run the admin spec**

```bash
cd app && pnpm test:e2e -- hero-images.spec.ts
```

Expected: PASS. If it fails on a machine-flake signature (`ECONNRESET`, OOM, GPU launch failure — see root `CLAUDE.md`'s E2E triage section), re-run before treating it as a real failure.

- [ ] **Step 3: Add the public inactive-picture case**

In `app/e2e/tests/public/hero-backdrop.spec.ts`, add these imports at the top (below the existing ones):

```ts
import { readFileSync } from 'node:fs'
```

Then append a new top-level block after the existing `test.describe('Public hero backdrop', ...)` block closes, mirroring the seed-and-rebuild pattern already used in `app/e2e/tests/public/article-press.spec.ts`:

```ts
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

/** A 1×1 transparent PNG — small enough to embed, real enough for Laravel's `image` rule. */
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

/**
 * storageState replays cookies only, and e2e/.auth/admin.json holds none — an
 * API context built from it is anonymous. Path is relative to the Playwright
 * cwd (app/): these spec files are ESM, so __dirname does not exist.
 */
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed hero images')
  return entry.value
}

async function authedFetch(request: import('@playwright/test').APIRequestContext, method: 'post' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { multipart: data as Record<string, string | { name: string; mimeType: string; buffer: Buffer }> } : {}),
  })
  return res
}

/**
 * `web` bakes the site once at container start; a hero image created via the
 * API never appears until something rebuilds it. Triggers the same rebuild
 * the admin's manual button uses and polls its status rather than sleeping a
 * fixed duration.
 */
async function rebuildAndWait(request: import('@playwright/test').APIRequestContext, since: number) {
  const deadline = Date.now() + 180_000

  while (Date.now() < deadline) {
    const trigger = await request.post(`${API}/api/admin/site/rebuild`, {
      headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    })
    if (!trigger.ok() && trigger.status() !== 409) {
      throw new Error(`POST /api/admin/site/rebuild → ${trigger.status()}`)
    }

    while (Date.now() < deadline) {
      const res = await request.get(`${API}/api/admin/site/rebuild/status`, {
        headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
      })
      const body = await res.json()
      if (body.status === 'error') throw new Error('Public site rebuild failed')
      if (body.status === 'done') {
        if ((body.startedAt ?? 0) >= since) return
        break // stale build finished before our seed — trigger another
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('Public site rebuild timed out')
}

// Serial: this spec seeds hero_images.contact via the admin API and rebuilds
// the public site, the same reason article-press.spec.ts's block is serial —
// a concurrent worker rebuilding at the same time races this one's `since` check.
test.describe.serial('Public hero backdrop — active filter', () => {
  let activeId: number | undefined
  let inactiveId: number | undefined

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000)

    const uploaded = await authedFetch(request, 'post', '/api/admin/hero-images/contact', {
      'files[]': { name: 'active.png', mimeType: 'image/png', buffer: Buffer.from(TEST_PNG_BASE64, 'base64') },
    })
    const activeBody = await uploaded.json()
    activeId = activeBody.data.contact.at(-1).id

    const uploadedOff = await authedFetch(request, 'post', '/api/admin/hero-images/contact', {
      'files[]': { name: 'inactive.png', mimeType: 'image/png', buffer: Buffer.from(TEST_PNG_BASE64, 'base64') },
    })
    const offBody = await uploadedOff.json()
    inactiveId = offBody.data.contact.at(-1).id

    await request.patch(`${API}/api/admin/hero-images/${inactiveId}`, {
      headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
      data: { active: false },
    })

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    if (activeId) await authedFetch(request, 'delete', `/api/admin/hero-images/${activeId}`)
    if (inactiveId) await authedFetch(request, 'delete', `/api/admin/hero-images/${inactiveId}`)
  })

  test('an inactive picture never reaches the public candidate list', async ({ request, page }) => {
    test.skip(!(await pageIsUp(request, '/en/contact')), `${WEB}/en/contact unavailable`)

    await page.goto(`${WEB}/en/contact`)

    const backdrop = page.locator('.hero-backdrop[data-hero-urls]').first()
    await expect(backdrop).toHaveCount(1)

    const raw = await backdrop.getAttribute('data-hero-urls')
    const candidates: string[] = JSON.parse(raw ?? '[]')

    expect(candidates.some((url) => url.includes('active.png'))).toBe(true)
    expect(candidates.some((url) => url.includes('inactive.png'))).toBe(false)
  })
})
```

- [ ] **Step 4: Run the public hero-backdrop spec**

```bash
cd app && pnpm test:e2e -- hero-backdrop.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

```bash
bash scripts/test-all.sh
```

Expected: exit code `0`. Per root `CLAUDE.md`'s E2E triage rules, if it fails, check for a machine-failure signature (`ECONNRESET`, OOM, GPU) before assuming the change is at fault.

- [ ] **Step 6: Commit**

```bash
git add app/e2e/tests/admin/hero-images.spec.ts app/e2e/tests/public/hero-backdrop.spec.ts
git commit -m "test(e2e): cover direct upload/toggle/reorder/remove and the public active filter"
```

---

## Final step: rebuild and open a PR

- [ ] Run `bash rebuild.sh` (full rebuild — `app/Dockerfile` and `docker-compose.yml` are unaffected by this change, but a full rebuild is the documented default and confirms the built images serve the new code).
- [ ] Run `/code-review` on the branch before opening the PR, per root `CLAUDE.md`'s workflow rule — a shipping skill's own review step does not run for this diff's PHP-only tasks (1–8), and a manual pass is required regardless of which shipping skill was used.
- [ ] Open the PR (`gh pr create` or `make ship`) referencing `docs/superpowers/specs/2026-09-09-hero-images-standalone-design.md`.
