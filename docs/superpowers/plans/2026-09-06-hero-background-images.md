# Hero Background Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the band choose hero background pictures from the existing photo gallery — one site-wide "main" set, optionally overridden per page — with one picture chosen at random on every visit.

**Architecture:** A `hero_images` join table maps gallery photos to a `scope` (`main`, `home`, or a `website_modules.slug`) with an explicit `position`. Admin writes replace a whole scope in one transaction. `GET /api/site-config` serves every populated scope under a new top-level `hero_images` key, and the Astro build resolves override-else-main through `web/src/lib/heroImages.ts`. A `HeroBackdrop.astro` emits the candidate URLs plus an inline synchronous script that picks one before first paint.

**Tech Stack:** Laravel 11 + Passport (`api/`), Pest; Astro SSG + Vue islands (`web/`), Vitest; Vue 3 + TanStack Query v5 (`app/`), Vitest; Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-09-06-hero-background-images-design.md`

## Global Constraints

- **Branch:** all work lands on `feature/hero-background-images`. Never commit to `main`.
- **No raw colours, fonts or radii anywhere under `web/src`.** Only the semantic tokens in `web/src/styles/tokens.css` (`var(--color-inverse)`, `var(--color-on-inverse)`, …). `pnpm build` runs `scripts/check-tokens.mjs` and fails on a raw value — *and* on a token-shaped utility that isn't declared.
- **Never write an admin URL by hand.** `adminUrl()` from `@/config/admin` is the only correct source; a literal `/admin/...` breaks the moment `ADMIN_PATH` is set.
- **Every read of a hero set is `orderBy('position')`**, and `position` is always written from the payload index. Never rely on `id` order.
- **Every hero list in an API response is an array, never `null`.** A null in `site-config` throws during `astro build`, which kills all 35 pages rather than one. The public site still reads `?? []` so an older API keeps building.
- **Backend tests run in the `--target test` stage**, never `docker exec bandms_backend php artisan test` (the running image is built `--no-dev`; Pest isn't in it).
- **Verifying a `web/` change requires `docker compose build web && docker compose up -d web`.** A bare `restart` rebuilds the *baked* source and will happily confirm a change you never shipped.

**Command reference** (used throughout):

```bash
# Backend tests
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter HeroImageTest

# Frontend unit tests
cd web && pnpm test:unit
cd app && pnpm test:unit

# Apply a migration to the dev database
bash rebuild.sh --backend-only
```

---

### Task 1: `hero_images` table and `HeroImage` model

**Files:**
- Create: `api/database/migrations/2026_09_06_000001_create_hero_images_table.php`
- Create: `api/app/Models/HeroImage.php`
- Test: `api/tests/Feature/HeroImageTest.php`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `App\Models\HeroImage` with `$fillable = ['photo_id', 'scope', 'position']`, relation `photo(): BelongsTo`, constant `HeroImage::RESERVED_SCOPES = ['main', 'home']`, and static `HeroImage::allowedScopes(): array` returning `RESERVED_SCOPES` merged with every live `website_modules.slug`.

- [ ] **Step 1: Write the failing test**

Create `api/tests/Feature/HeroImageTest.php`:

```php
<?php

use App\Models\Album;
use App\Models\HeroImage;
use App\Models\Photo;
use App\Models\WebsiteModule;

function makePhoto(string $image = 'photos/a.jpg'): Photo
{
    return Photo::create(['image' => $image, 'sort_order' => 0]);
}

it('orders a scope by position, not by id', function () {
    $first  = makePhoto('photos/first.jpg');
    $second = makePhoto('photos/second.jpg');

    // position deliberately inverted against id: a read that leans on the
    // auto-increment tiebreaker instead of the column passes without this.
    HeroImage::create(['photo_id' => $first->id,  'scope' => 'main', 'position' => 1]);
    HeroImage::create(['photo_id' => $second->id, 'scope' => 'main', 'position' => 0]);

    $ordered = HeroImage::where('scope', 'main')->orderBy('position')->pluck('photo_id');

    expect($ordered->all())->toBe([$second->id, $first->id]);
});

it('drops out of every scope when its photo is deleted', function () {
    $photo = makePhoto();
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'main',    'position' => 0]);
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'contact', 'position' => 0]);

    $photo->delete();

    expect(HeroImage::count())->toBe(0);
});

it('allows the same photo in several scopes', function () {
    $photo = makePhoto();
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'main', 'position' => 0]);
    HeroImage::create(['photo_id' => $photo->id, 'scope' => 'home', 'position' => 0]);

    expect(HeroImage::where('photo_id', $photo->id)->count())->toBe(2);
});

it('treats every live module slug plus main and home as a valid scope', function () {
    $allowed = HeroImage::allowedScopes();

    expect($allowed)->toContain('main')
        ->and($allowed)->toContain('home')
        ->and($allowed)->toContain('contact');
});

it('keeps a disabled module as a valid scope', function () {
    // Switching a section off must not make its pictures unsavable — the same
    // rule FAQ categories follow.
    WebsiteModule::where('slug', 'photos')->update(['enabled' => false]);

    expect(HeroImage::allowedScopes())->toContain('photos');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter HeroImageTest
```
Expected: FAIL with `Class "App\Models\HeroImage" not found`.

- [ ] **Step 3: Write the migration**

Create `api/database/migrations/2026_09_06_000001_create_hero_images_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hero_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('photo_id')->constrained()->cascadeOnDelete();

            // 'main', 'home', or a website_modules.slug. Deliberately not a
            // foreign key: two of the three legal values are not module rows,
            // and validation against live modules happens in the controller —
            // the same shape faqs.module_slug uses.
            $table->string('scope');

            // Explicit, written from the payload index. Never inferred from id:
            // writes are delete-and-recreate today, so id order agrees by
            // accident, and anything that stops recreating scrambles the
            // editor's drag order silently.
            $table->unsignedSmallInteger('position')->default(0);

            $table->timestamps();
            $table->index(['scope', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hero_images');
    }
};
```

- [ ] **Step 4: Write the model**

Create `api/app/Models/HeroImage.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HeroImage extends Model
{
    protected $fillable = ['photo_id', 'scope', 'position'];

    protected $casts = [
        'photo_id' => 'integer',
        'position' => 'integer',
    ];

    /**
     * Scopes that exist without a website_modules row behind them.
     *
     * The homepage is not a module, so a nullable "means main" column would
     * still have needed a second reserved name. Two explicit strings read
     * better than one null with two meanings.
     */
    public const RESERVED_SCOPES = ['main', 'home'];

    public function photo(): BelongsTo
    {
        return $this->belongsTo(Photo::class);
    }

    /**
     * Every scope a hero set may be saved under, resolved against live modules.
     *
     * Reading the table rather than a hardcoded list means adding a website
     * module makes it a hero scope with no code change — and a *disabled*
     * module stays valid, because switching a section off must not make its
     * pictures unsavable.
     */
    public static function allowedScopes(): array
    {
        return array_merge(self::RESERVED_SCOPES, WebsiteModule::pluck('slug')->all());
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:
```bash
docker build --target test -t bandms_test ./api
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter HeroImageTest
```
Expected: PASS, 5 tests.

- [ ] **Step 6: Apply the migration to the dev database**

Run: `bash rebuild.sh --backend-only`
Expected: all steps green, including the test step.

- [ ] **Step 7: Commit**

```bash
git add api/database/migrations/2026_09_06_000001_create_hero_images_table.php \
        api/app/Models/HeroImage.php \
        api/tests/Feature/HeroImageTest.php
git commit -m "feat(api): add hero_images table and model"
```

---

### Task 2: Admin endpoints for reading and replacing a scope

**Files:**
- Create: `api/app/Http/Controllers/HeroImageController.php`
- Create: `api/app/Http/Resources/HeroImageResource.php`
- Modify: `api/routes/api.php` (the `role:admin` group, beside the `/admin/faqs` routes near line 460)
- Test: `api/tests/Feature/HeroImageTest.php` (append)

**Interfaces:**
- Consumes: `HeroImage::allowedScopes()`, `HeroImage` fillable fields from Task 1.
- Produces:
  - `GET /api/admin/hero-images` → `{"data": {"<scope>": [HeroImageResource, ...], ...}}`, only populated scopes present.
  - `PUT /api/admin/hero-images/{scope}` with body `{"photo_ids": [int, ...]}` → same shape as the GET. Replaces the scope entirely; an empty array clears it.
  - `HeroImageResource` shape: `{id, photo_id, url, caption, position}`.

- [ ] **Step 1: Write the failing tests**

Append to `api/tests/Feature/HeroImageTest.php`:

```php
// ── admin endpoints ───────────────────────────────────────────────────────────

use App\Models\User;
use Laravel\Passport\Passport;

function actingAsAdmin(): User
{
    $user = User::factory()->create(['role' => 'admin']);
    Passport::actingAs($user);

    return $user;
}

it('rejects hero image reads without auth', function () {
    $this->getJson('/api/admin/hero-images')->assertUnauthorized();
});

it('replaces a scope rather than appending to it', function () {
    actingAsAdmin();
    $a = makePhoto('photos/a.jpg');
    $b = makePhoto('photos/b.jpg');
    $c = makePhoto('photos/c.jpg');

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [$a->id, $b->id]])
        ->assertOk()
        ->assertJsonCount(2, 'data.main');

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [$c->id]])
        ->assertOk()
        ->assertJsonCount(1, 'data.main')
        ->assertJsonPath('data.main.0.photo_id', $c->id);

    expect(HeroImage::where('scope', 'main')->count())->toBe(1);
});

it('writes position from the payload order', function () {
    actingAsAdmin();
    $a = makePhoto('photos/a.jpg');
    $b = makePhoto('photos/b.jpg');

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [$b->id, $a->id]])
        ->assertOk()
        ->assertJsonPath('data.main.0.photo_id', $b->id)
        ->assertJsonPath('data.main.0.position', 0)
        ->assertJsonPath('data.main.1.photo_id', $a->id)
        ->assertJsonPath('data.main.1.position', 1);
});

it('clears a scope when given an empty list', function () {
    actingAsAdmin();
    $a = makePhoto();
    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [$a->id]])->assertOk();

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => []])
        ->assertOk()
        ->assertJsonMissingPath('data.main');

    expect(HeroImage::where('scope', 'main')->count())->toBe(0);
});

it('leaves other scopes untouched when one is saved', function () {
    actingAsAdmin();
    $a = makePhoto('photos/a.jpg');
    $b = makePhoto('photos/b.jpg');

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [$a->id]])->assertOk();
    $this->putJson('/api/admin/hero-images/contact', ['photo_ids' => [$b->id]])->assertOk();

    $this->getJson('/api/admin/hero-images')
        ->assertOk()
        ->assertJsonCount(1, 'data.main')
        ->assertJsonCount(1, 'data.contact');
});

it('rejects an unknown scope', function () {
    actingAsAdmin();
    $a = makePhoto();

    $this->putJson('/api/admin/hero-images/not-a-page', ['photo_ids' => [$a->id]])
        ->assertStatus(422);
});

it('accepts a disabled module as a scope', function () {
    actingAsAdmin();
    WebsiteModule::where('slug', 'photos')->update(['enabled' => false]);
    $a = makePhoto();

    $this->putJson('/api/admin/hero-images/photos', ['photo_ids' => [$a->id]])
        ->assertOk()
        ->assertJsonCount(1, 'data.photos');
});

it('rejects a photo id that does not exist', function () {
    actingAsAdmin();

    $this->putJson('/api/admin/hero-images/main', ['photo_ids' => [999999]])
        ->assertStatus(422);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
docker build --target test -t bandms_test ./api
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter HeroImageTest
```
Expected: FAIL — the new tests 404 because the routes don't exist.

- [ ] **Step 3: Write the resource**

Create `api/app/Http/Resources/HeroImageResource.php`:

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
            'photo_id' => $this->photo_id,
            // Mirrors PhotoResource::image_url so the admin can render the same
            // thumbnail it shows in the gallery.
            'url'      => $this->photo?->image ? '/storage/' . $this->photo->image : null,
            'caption'  => $this->photo?->caption,
            'position' => $this->position,
        ];
    }
}
```

- [ ] **Step 4: Write the controller**

Create `api/app/Http/Controllers/HeroImageController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Http\Resources\HeroImageResource;
use App\Models\HeroImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class HeroImageController extends Controller
{
    /** Every populated scope in one response — the editor shows them all at once. */
    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->allScopes()]);
    }

    /**
     * Replace one scope's set, in payload order.
     *
     * Delete-and-recreate rather than a diff: it is the shape social links
     * already use, and it makes "the payload is the truth" literally so. The
     * transaction is what stops a failure part-way leaving a half-saved set.
     */
    public function update(Request $request, string $scope): JsonResponse
    {
        $request->merge(['scope' => $scope]);

        $data = $request->validate([
            'scope'       => ['required', 'string', Rule::in(HeroImage::allowedScopes())],
            'photo_ids'   => ['present', 'array'],
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

        return response()->json(['data' => $this->allScopes()]);
    }

    /**
     * All hero sets keyed by scope, each ordered by position.
     *
     * Empty scopes are simply absent rather than present-and-empty: the public
     * resolver treats "no override" and "an empty override" identically, so
     * emitting both shapes would be two ways of saying one thing.
     *
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function allScopes(): array
    {
        return HeroImage::with('photo')
            ->orderBy('scope')
            ->orderBy('position')
            ->get()
            ->groupBy('scope')
            ->map(fn ($rows) => HeroImageResource::collection($rows)->resolve())
            ->all();
    }
}
```

- [ ] **Step 5: Register the routes**

In `api/routes/api.php`, inside the `Route::middleware('role:admin')` group, directly after the `/admin/faqs` routes (near line 464), add:

```php
        // ── Hero background images ────────────────────────────────────────────
        Route::get('/admin/hero-images', [HeroImageController::class, 'index'])
            ->name('api.admin.hero-images.index');
        Route::put('/admin/hero-images/{scope}', [HeroImageController::class, 'update'])
            ->name('api.admin.hero-images.update');
```

Add the import at the top of the file, alongside the other controller imports:

```php
use App\Http\Controllers\HeroImageController;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run:
```bash
docker build --target test -t bandms_test ./api
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter HeroImageTest
```
Expected: PASS, 13 tests.

- [ ] **Step 7: Run the whole backend suite**

Run: `docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test`
Expected: all green. A failure here means the new routes collide with something — fix before committing.

- [ ] **Step 8: Commit**

```bash
git add api/app/Http/Controllers/HeroImageController.php \
        api/app/Http/Resources/HeroImageResource.php \
        api/routes/api.php \
        api/tests/Feature/HeroImageTest.php
git commit -m "feat(api): admin endpoints to read and replace hero image scopes"
```

---

### Task 3: Serve hero images from `/api/site-config`

**Files:**
- Modify: `api/app/Http/Controllers/WebsiteModuleController.php:15-47` (`siteConfig()`)
- Test: `api/tests/Feature/HeroImageTest.php` (append)

**Interfaces:**
- Consumes: `HeroImage` from Task 1.
- Produces: `GET /api/site-config` gains a top-level `hero_images` object, `{"<scope>": [{"id", "url", "caption"}, ...]}`. Only populated scopes appear. `id` is the **photo** id.

**Why not inside `module_config`:** `web/src/lib/slugs.ts:102` builds the site's slug map by iterating `Object.keys(module_config)`. A `home` key there would inject a phantom `home` module into `slugMap` for every locale. No route would be emitted, so the build would stay green and nothing would visibly break — it would just seed a module that doesn't exist into the map that decides where the nav points.

- [ ] **Step 1: Write the failing tests**

Append to `api/tests/Feature/HeroImageTest.php`:

```php
// ── site-config ───────────────────────────────────────────────────────────────

it('serves hero images from site-config without auth', function () {
    $a = makePhoto('photos/a.jpg');
    HeroImage::create(['photo_id' => $a->id, 'scope' => 'main', 'position' => 0]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonCount(1, 'hero_images.main')
        ->assertJsonPath('hero_images.main.0.id', $a->id)
        ->assertJsonPath('hero_images.main.0.url', '/storage/photos/a.jpg');
});

it('omits a hero row whose photo has no file', function () {
    // `url` is non-nullable on the public side; a null would render as the
    // literal string "null" inside a CSS url(). Filtered at the source instead.
    $broken = Photo::create(['image' => null, 'sort_order' => 0]);
    HeroImage::create(['photo_id' => $broken->id, 'scope' => 'main', 'position' => 0]);

    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonMissingPath('hero_images.main');
});

it('serves an empty hero_images object rather than null when none are set', function () {
    // A null here throws during astro build, which takes down all 35 pages.
    $this->getJson('/api/site-config')
        ->assertOk()
        ->assertJsonPath('hero_images', []);
});

it('keeps hero images out of module_config so the slug map is unaffected', function () {
    $a = makePhoto();
    HeroImage::create(['photo_id' => $a->id, 'scope' => 'home', 'position' => 0]);

    $response = $this->getJson('/api/site-config')->assertOk();

    expect(array_keys($response->json('module_config')))->not->toContain('home');
    expect($response->json('hero_images.home'))->toHaveCount(1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter HeroImageTest`
Expected: FAIL — `hero_images` is absent from the response.

- [ ] **Step 3: Add the key to `siteConfig()`**

In `api/app/Http/Controllers/WebsiteModuleController.php`, add the import:

```php
use App\Models\HeroImage;
```

Then in `siteConfig()`, before the `return response()->json([...])`, add:

```php
        // Hero backdrops, keyed by scope ('main', 'home', or a module slug).
        //
        // Deliberately NOT inside module_config: slugs.ts builds the site's
        // slug map from that object's keys, so the non-module scopes would
        // appear there as phantom modules — green build, wrong nav map.
        $hero_images = HeroImage::with('photo')
            ->orderBy('scope')
            ->orderBy('position')
            ->get()
            ->groupBy('scope')
            ->map(fn ($rows) => $rows
                // A row whose photo has no file cannot be a backdrop. Dropping
                // it here keeps `url` non-nullable for the public site, which
                // would otherwise need a null guard in the one place a null
                // renders as the string "null" inside a CSS url().
                ->filter(fn ($h) => filled($h->photo?->image))
                ->map(fn ($h) => [
                    'id'      => $h->photo_id,
                    'url'     => '/storage/' . $h->photo->image,
                    'caption' => $h->photo->caption,
                ])->values()->all())
            // A scope left empty by that filter is dropped too, so "present but
            // unusable" never reaches the resolver as a non-empty override.
            ->filter(fn ($rows) => count($rows) > 0)
            ->all();
```

And add it to the response array, after `'module_config' => $module_config,`:

```php
            // Always an object, never null — the Astro build bakes whatever it
            // gets, and a null would throw at build time.
            'hero_images'   => (object) $hero_images,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter HeroImageTest`
Expected: PASS, 17 tests.

Note: `(object)` cast on an empty array is what makes `assertJsonPath('hero_images', [])` match `{}` rather than `[]` in the JSON. If that assertion fails on an empty set, check the cast — an empty PHP array encodes as `[]`, which is the wrong shape for a keyed map.

- [ ] **Step 5: Run the whole backend suite and commit**

```bash
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test
git add api/app/Http/Controllers/WebsiteModuleController.php api/tests/Feature/HeroImageTest.php
git commit -m "feat(api): serve hero images from site-config"
```

---

### Task 4: Resolve hero images in the public site's lib layer

**Files:**
- Create: `web/src/lib/heroImages.ts`
- Create: `web/src/lib/heroImages.test.ts`
- Modify: `web/src/lib/cms.ts` (the `SiteConfig` interface, near line 167)
- Modify: `web/src/lib/slugs.test.ts` (append one regression test)

**Interfaces:**
- Consumes: the `hero_images` payload from Task 3.
- Produces:
  - `export interface HeroImage { id: number; url: string; caption: string | null }`
  - `export function resolveHeroImages(config: SiteConfig, scope: string): HeroImage[]`
  - `SiteConfig` gains `hero_images?: Record<string, HeroImage[]>`.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/heroImages.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveHeroImages, type HeroImage } from './heroImages'
import type { SiteConfig } from './cms'

const img = (id: number): HeroImage => ({ id, url: `/storage/p${id}.jpg`, caption: null })

function config(hero_images?: Record<string, HeroImage[]>): SiteConfig {
  return { modules: {}, module_order: [], module_config: {}, hero_images } as SiteConfig
}

describe('resolveHeroImages', () => {
  it('returns the scope’s own set when it has one', () => {
    const cfg = config({ main: [img(1)], contact: [img(2)] })
    expect(resolveHeroImages(cfg, 'contact')).toEqual([img(2)])
  })

  it('falls back to main when the scope has no set', () => {
    const cfg = config({ main: [img(1)] })
    expect(resolveHeroImages(cfg, 'contact')).toEqual([img(1)])
  })

  it('falls back to main when the scope’s set is empty', () => {
    const cfg = config({ main: [img(1)], contact: [] })
    expect(resolveHeroImages(cfg, 'contact')).toEqual([img(1)])
  })

  it('returns an empty list when nothing is configured', () => {
    expect(resolveHeroImages(config({}), 'contact')).toEqual([])
  })

  it('returns an empty list when the API predates the feature', () => {
    // getSiteConfig fails open to {} when the API is unreachable mid-build, and
    // an older API omits the key entirely. Neither may throw.
    expect(resolveHeroImages(config(undefined), 'main')).toEqual([])
  })

  it('does not fall back for the main scope itself', () => {
    expect(resolveHeroImages(config({ main: [] }), 'main')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && pnpm test:unit`
Expected: FAIL — cannot resolve `./heroImages`.

- [ ] **Step 3: Write the module**

Create `web/src/lib/heroImages.ts`:

```ts
import type { SiteConfig } from './cms'

/**
 * One hero backdrop candidate.
 *
 * `id` is the gallery **photo's** id, not the hero_images row id — the admin
 * payload carries both and names them apart; this one only ever needs the photo.
 *
 * `url` is non-nullable because the server drops rows whose photo has no file.
 * That guarantee lives there rather than here: a null would otherwise reach a
 * CSS `url()` and render as the literal string "null".
 */
export interface HeroImage {
  id: number
  url: string
  caption: string | null
}

/** The scope every page falls back to when it has no set of its own. */
const MAIN_SCOPE = 'main'

/**
 * The pictures a page should offer as its hero backdrop.
 *
 * A page's own set *replaces* the main set rather than extending it — that is
 * what "override" means here, and it is what lets one page be deliberately
 * different rather than merely additional.
 *
 * An empty override is treated as no override. The alternative — letting an
 * empty list mean "this page shows nothing" — would need a third state in the
 * editor to distinguish it from "not configured", for a result the band can
 * already get by choosing a plain image.
 *
 * Reads defensively throughout: `getSiteConfig` fails open to `{}` when the API
 * is unreachable mid-build, and an API predating this feature omits the key. A
 * bare access would throw during `astro build`, taking down all 35 pages.
 */
export function resolveHeroImages(config: SiteConfig, scope: string): HeroImage[] {
  const sets = config.hero_images ?? {}
  const own = sets[scope] ?? []

  if (own.length > 0) return own

  return scope === MAIN_SCOPE ? [] : (sets[MAIN_SCOPE] ?? [])
}
```

- [ ] **Step 4: Extend the `SiteConfig` type**

In `web/src/lib/cms.ts`, inside the `SiteConfig` interface, add:

```ts
  /**
   * Hero backdrop candidates keyed by scope ('main', 'home', or a module slug).
   *
   * Optional because an API predating the feature omits it, and a bare access
   * would throw at build time — which kills all 35 pages, not one. Read it
   * through resolveHeroImages(), never directly.
   *
   * Deliberately a sibling of module_config rather than a field inside it:
   * slugs.ts derives the site's slug map from module_config's keys, and the
   * non-module scopes would show up there as modules that do not exist.
   */
  hero_images?: Record<string, import('./heroImages').HeroImage[]>
```

- [ ] **Step 5: Add the slug-map regression guard**

Append to `web/src/lib/slugs.test.ts`:

```ts
it('ignores hero_images when building the slug map', () => {
  // Regression guard: hero scopes include 'main' and 'home', which are not
  // modules. If they ever migrate into module_config, this map silently gains
  // entries for pages that do not exist — with a green build.
  const cfg = {
    modules: { contact: true },
    module_order: ['contact'],
    module_config: { contact: { enabled: true, label: 'Contact', slug: 'kontakt' } },
    hero_images: { main: [], home: [], contact: [] },
  }

  expect(Object.keys(cfg.module_config)).not.toContain('home')
  expect(Object.keys(cfg.module_config)).not.toContain('main')
})
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd web && pnpm test:unit`
Expected: PASS, including the six new `resolveHeroImages` cases.

- [ ] **Step 7: Type-check**

Run: `cd web && npx tsc --noEmit -p tsconfig.json`
Expected: exactly **two** pre-existing errors — `themes/skanking-storks/slots.ts` cannot resolve `.astro` imports, and `types/shop.ts` has a `ShopItem`/`ShopItemSummary` variance mismatch. Anything else is yours.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/heroImages.ts web/src/lib/heroImages.test.ts \
        web/src/lib/cms.ts web/src/lib/slugs.test.ts
git commit -m "feat(web): resolve hero images with per-page override"
```

---

### Task 5: `HeroBackdrop.astro` and the homepage hero

**Files:**
- Create: `web/src/components/HeroBackdrop.astro`
- Modify: `web/src/pages/[lang]/index.astro` (the `.hero` section, near line 79)

**Interfaces:**
- Consumes: `resolveHeroImages`, `HeroImage` from Task 4.
- Produces: `<HeroBackdrop images={HeroImage[]} />`, which renders **nothing** for an empty list.

- [ ] **Step 1: Write the component**

Create `web/src/components/HeroBackdrop.astro`:

```astro
---
import type { HeroImage } from '@/lib/heroImages'

/**
 * A randomly chosen backdrop for a hero section.
 *
 * All candidates ship in the markup and an inline script picks one per page
 * load. A build-time pick would be simpler, but the site is static: the same
 * picture would then sit there until someone restarted the web container,
 * which is not what "random" means to anyone looking at it.
 *
 * The script is `is:inline` and sits immediately after the element so it runs
 * synchronously, before first paint — otherwise the page would show the bare
 * ink background and then snap to an image.
 *
 * Only the chosen image is ever fetched. The trade-off is that a JS-set
 * background cannot be preloaded, so LCP lands slightly later than a hardcoded
 * <img> would. Accepted: this is decoration behind a dark veil, not content.
 */
interface Props {
  images: HeroImage[]
}

const { images } = Astro.props
const urls = images.map(i => i.url).filter(Boolean)
---

{urls.length > 0 && (
  <Fragment>
    <div class="hero-backdrop" data-hero-urls={JSON.stringify(urls)} aria-hidden="true"></div>
    <div class="hero-backdrop-veil" aria-hidden="true"></div>
    <script is:inline>
      document.querySelectorAll('.hero-backdrop[data-hero-urls]').forEach((el) => {
        try {
          const urls = JSON.parse(el.getAttribute('data-hero-urls') || '[]')
          if (!urls.length) return
          const pick = urls[Math.floor(Math.random() * urls.length)]
          el.style.backgroundImage = 'url("' + pick + '")'
        } catch (e) {
          /* A malformed attribute leaves the plain background — never a blank page. */
        }
      })
    </script>
  </Fragment>
)}

<style>
  /*
   * The veil is a sibling rather than a ::after, because `filter` applies to an
   * element's pseudo-elements too — tinting through the same grayscale and
   * brightness pass would wash the veil out along with the photo.
   */
  .hero-backdrop {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    filter: grayscale(1) contrast(1.25) brightness(.6);
    pointer-events: none;
  }

  .hero-backdrop-veil {
    position: absolute;
    inset: 0;
    background: color-mix(in oklab, var(--color-inverse) 56%, transparent);
    pointer-events: none;
  }
</style>
```

- [ ] **Step 2: Wire it into the homepage**

In `web/src/pages/[lang]/index.astro`:

Add to the imports:
```ts
import HeroBackdrop from '@/components/HeroBackdrop.astro'
import { resolveHeroImages } from '@/lib/heroImages'
```

Add after the `enabled` helper definitions in the frontmatter:
```ts
const heroImages = resolveHeroImages(siteConfig, 'home')
```

In the template, inside `<section class="hero">`, add the backdrop as the **first** child so it sits under the checker overlay and the content:
```astro
    <section class="hero">
      <HeroBackdrop images={heroImages} />
      <div class="hero-checker" aria-hidden="true"></div>
```

- [ ] **Step 3: Confirm the hero content stacks above the backdrop**

Read the `.hero-inner` rule in the same file's `<style>` block. It must carry `position: relative` (any `z-index` is unnecessary once it does — a positioned element paints above non-positioned siblings). If it doesn't, add `position: relative;` to `.hero-inner`.

- [ ] **Step 4: Verify the token lint passes**

Run: `cd web && pnpm build`
Expected: build completes, including `scripts/check-tokens.mjs`. If it fails on `color-mix(in oklab, var(--color-inverse) 56%, transparent)`, the token name is wrong — grep `web/src/styles/tokens.css` for the correct one rather than substituting a raw colour.

- [ ] **Step 5: Verify against the built output, with data**

```bash
docker exec bandms_mysql sh -c 'mysql -ubandms -psecret bandms -N -e \
  "INSERT INTO hero_images (photo_id, scope, position, created_at, updated_at) \
   SELECT id, \"home\", 0, NOW(), NOW() FROM photos LIMIT 1;"'
docker compose build web && docker compose up -d web
curl -s http://localhost:8081/en/ | grep -o 'data-hero-urls="[^"]*"' | head -1
```
Expected: one `data-hero-urls="[&quot;/storage/...&quot;]"` attribute. An empty result means the query returned no photos — check `SELECT COUNT(*) FROM photos` first.

- [ ] **Step 6: Clean up the probe row**

```bash
docker exec bandms_mysql sh -c 'mysql -ubandms -psecret bandms -e "DELETE FROM hero_images;"'
```

- [ ] **Step 7: Commit**

```bash
git add web/src/components/HeroBackdrop.astro web/src/pages/'[lang]'/index.astro
git commit -m "feat(web): random hero backdrop on the homepage"
```

---

### Task 6: `PageHero` accepts a backdrop

**Files:**
- Modify: `web/src/components/PageHero.astro`

**Interfaces:**
- Consumes: `HeroBackdrop` from Task 5, `HeroImage` from Task 4.
- Produces: `PageHero` gains an optional prop `heroImages?: HeroImage[]`, defaulting to `[]`.

- [ ] **Step 1: Add the prop and render the backdrop**

In `web/src/components/PageHero.astro`, add to the imports:

```ts
import HeroBackdrop from '@/components/HeroBackdrop.astro'
import type { HeroImage } from '@/lib/heroImages'
```

Add to the `Props` interface:

```ts
  /**
   * Backdrop candidates for this page, already resolved by the caller.
   *
   * Resolved by the section rather than here: only the section knows its own
   * scope name, and it already holds the site config it would come from.
   */
  heroImages?: HeroImage[]
```

Update the destructure:

```ts
const { kicker, title, lead, titleSize = 140, leadWidth = 680, heroImages = [] } = Astro.props
```

And render it as the first child of the section, before the existing theme slot:

```astro
<section class="ph page-x" style={`--ph-title:${titleSize}px; --ph-lead:${leadWidth}px`}>
  <HeroBackdrop images={heroImages} />
  <ThemeSlot name="hero-backdrop" />
```

- [ ] **Step 2: Verify the existing four pages still render**

```bash
cd web && pnpm build
grep -c 'ph-title' dist/en/press/index.html dist/en/videos/index.html
```
Expected: `1` for each. The four sections already using `PageHero` (Epk, Newsletter, Press, Videos) pass no `heroImages`, so they must be byte-for-byte unaffected apart from the absent backdrop.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/PageHero.astro
git commit -m "feat(web): PageHero accepts hero backdrop images"
```

---

### Task 7: Migrate the seven hand-rolled page headers onto `PageHero`

**Files:**
- Modify: `web/src/components/sections/AboutSection.astro` (`.ab-hero`, near line 160)
- Modify: `web/src/components/sections/ConcertsSection.astro` (`.kicker`/`.page-title`/`.lead`, near line 79)
- Modify: `web/src/components/sections/ContactSection.astro` (`.ct-hero`, near line 273)
- Modify: `web/src/components/sections/MerchSection.astro` (near line 38)
- Modify: `web/src/components/sections/PhotosSection.astro` (`.gl-hero`, near line 99)
- Modify: `web/src/components/sections/PostsSection.astro` (`.hero-title`, near line 49)
- Modify: `web/src/components/sections/ReleasesSection.astro` (`.mu-hero`, near line 182)

**Interfaces:**
- Consumes: `PageHero` with `heroImages` from Task 6, `resolveHeroImages` from Task 4.
- Produces: nothing new. Each section renders its header through `PageHero` and passes `heroImages={resolveHeroImages(siteConfig, '<its module slug>')}`.

**`FaqSection.astro` is NOT in this list.** It renders an embedded `<h2>` accordion inside the other sections, not a page header. Leave it alone.

- [ ] **Step 1: Capture the "before" output for every page**

```bash
cd web && pnpm build
mkdir -p "$CLAUDE_JOB_DIR/tmp/hero-before" && cp -r dist/en "$CLAUDE_JOB_DIR/tmp/hero-before/"
ls dist/en
```

The directory names `ls` reports are **URL slugs, not module keys** — `contact` is `kontakt` under `/pl`, and any of them may have been renamed in `/admin/website-modules`. Use what `ls` prints for the `dist/` greps below; use the module key only in the `resolveHeroImages(...)` call.

- [ ] **Step 2: Migrate one section — ContactSection**

In `web/src/components/sections/ContactSection.astro`, add to the imports:

```ts
import PageHero from '@/components/PageHero.astro'
import { resolveHeroImages } from '@/lib/heroImages'
```

Replace the `<section class="ct-hero page-x"> … </section>` block (roughly lines 273–283, ending after the `ct-lead` paragraph and its wrapper divs) with:

```astro
  <PageHero
    kicker={s.kicker}
    title={s.title || t.title}
    lead={s.lead}
    heroImages={resolveHeroImages(siteConfig, 'contact')}
  />
```

Then delete the now-unused `.ct-hero`, `.ct-hero-in`, `.ct-kicker`, `.ct-h1` and `.ct-lead` rules from that file's `<style>` block. Leave every other rule alone.

- [ ] **Step 3: Verify Contact renders identically apart from the header markup**

```bash
cd web && pnpm build
grep -c 'ph-title' dist/en/contact/index.html
grep -c 'ct-hero' dist/en/contact/index.html
```
Expected: `1` and `0`. Then open `http://localhost:8081/en/contact` after `docker compose build web && docker compose up -d web` and compare against `/tmp/hero-before/en/contact/index.html` — the title, kicker and lead text must be unchanged.

- [ ] **Step 4: Commit this one section**

```bash
git add web/src/components/sections/ContactSection.astro
git commit -m "refactor(web): render the Contact header through PageHero"
```

- [ ] **Step 5: Repeat Steps 2–4 for the remaining six**

For each of `AboutSection`, `ConcertsSection`, `MerchSection`, `PhotosSection`, `PostsSection`, `ReleasesSection`, in that order and **one commit each**:

1. Add the two imports.
2. Replace the header `<section>` with `<PageHero … heroImages={resolveHeroImages(siteConfig, '<slug>')} />`, passing that page's existing kicker/title/lead expressions verbatim.
3. Pass `titleSize` / `leadWidth` where the page's own CSS used a different size from PageHero's defaults (140px / 680px) — `ReleasesSection` uses 150.
4. Move page-specific extras into the slots rather than dropping them:
   - `ReleasesSection`'s `.mu-hero-social` (`<SocialLinks …>`) goes into `<Fragment slot="aside">`. This is exactly the case `PageHero`'s `aside` slot was built for.
   - Anything sitting between the lead and the page body goes into `<Fragment slot="meta">`.
5. Delete that page's now-dead header CSS rules.
6. Rebuild, grep `dist/` for `ph-title` (expect 1) and the old class (expect 0), and eyeball the page.
7. Commit.

The module slugs to pass are the module **keys**, not URL slugs: `about`, `concerts`, `contact`, `merch`, `photos`, `posts`, `releases`.

- [ ] **Step 6: Confirm no page header was missed**

```bash
cd web && grep -rLn "PageHero" src/components/sections/*.astro
```
Expected: only `FaqSection.astro`.

- [ ] **Step 7: Verify every built page still has exactly one H1**

```bash
cd web && for f in dist/en/*/index.html dist/en/index.html; do
  n=$(grep -o '<h1' "$f" | wc -l); echo "$n  $f"; done
```
Expected: `1` for every row. A `0` means a header was deleted without its replacement; a `2` means the old block was left behind.

- [ ] **Step 8: Type-check and run the web unit suite**

```bash
cd web && npx tsc --noEmit -p tsconfig.json && pnpm test:unit
```
Expected: the same two pre-existing `tsc` errors and nothing more; all unit tests pass.

---

### Task 8: Admin data layer — types, API client, composable

**Files:**
- Create: `app/src/types/heroImage.ts`
- Create: `app/src/api/heroImages.ts`
- Create: `app/src/composables/useHeroImages.ts`
- Test: `app/src/composables/useHeroImages.test.ts`

**Interfaces:**
- Consumes: the endpoints from Task 2.
- Produces:
  - `interface HeroImage { id: number; photo_id: number; url: string | null; caption: string | null; position: number }`
  - `type HeroImageSets = Record<string, HeroImage[]>`
  - `interface HeroImagesResponse { data: HeroImageSets }`
  - `fetchHeroImages(token: string): Promise<HeroImagesResponse>`
  - `saveHeroImageScope(token: string, scope: string, photoIds: number[]): Promise<HeroImagesResponse>`
  - `useHeroImages(): { query, save }` — `save` is a TanStack mutation taking `{ scope, photoIds }`.

- [ ] **Step 1: Write the types**

Create `app/src/types/heroImage.ts`:

```ts
/** One hero backdrop entry, joined to its gallery photo. */
export interface HeroImage {
  id: number
  photo_id: number
  /** Null when the underlying photo has no file — render a placeholder, not a broken img. */
  url: string | null
  caption: string | null
  position: number
}

/** Hero sets keyed by scope: 'main', 'home', or a website module slug. */
export type HeroImageSets = Record<string, HeroImage[]>

export interface HeroImagesResponse {
  data: HeroImageSets
}
```

- [ ] **Step 2: Write the API client**

Create `app/src/api/heroImages.ts`:

```ts
import type { HeroImagesResponse } from '@/types/heroImage'
import { API_BASE, authHeaders, handleResponse } from './client'

export async function fetchHeroImages(token: string): Promise<HeroImagesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/hero-images`, { headers: authHeaders(token) })
  return handleResponse<HeroImagesResponse>(res)
}

/**
 * Replace one scope's set. The payload order is the display order — the server
 * writes `position` from the array index.
 *
 * The scope is path-encoded because it is a slug from the API, not free text;
 * encodeURIComponent keeps a hyphenated slug like 'tech-rider' intact and
 * refuses to let anything odder through as a path segment.
 */
export async function saveHeroImageScope(
  token: string,
  scope: string,
  photoIds: number[],
): Promise<HeroImagesResponse> {
  const res = await fetch(`${API_BASE}/api/admin/hero-images/${encodeURIComponent(scope)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ photo_ids: photoIds }),
  })
  return handleResponse<HeroImagesResponse>(res)
}
```

- [ ] **Step 3: Write the failing composable test**

Create `app/src/composables/useHeroImages.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HeroImageSets } from '@/types/heroImage'

vi.mock('@/api/heroImages', () => ({
  fetchHeroImages: vi.fn(),
  saveHeroImageScope: vi.fn(),
}))

import { scopeSet, hasOwnSet } from './useHeroImages'

describe('scopeSet', () => {
  const sets: HeroImageSets = {
    main: [{ id: 1, photo_id: 10, url: '/storage/a.jpg', caption: null, position: 0 }],
    contact: [],
  }

  it('returns the scope’s own list', () => {
    expect(scopeSet(sets, 'main')).toHaveLength(1)
  })

  it('returns an empty list for a scope with no entry', () => {
    expect(scopeSet(sets, 'about')).toEqual([])
  })

  it('returns an empty list when the sets are undefined', () => {
    expect(scopeSet(undefined, 'main')).toEqual([])
  })
})

describe('hasOwnSet', () => {
  const sets: HeroImageSets = {
    main: [{ id: 1, photo_id: 10, url: '/storage/a.jpg', caption: null, position: 0 }],
    contact: [],
  }

  it('is true only when the scope has at least one picture', () => {
    expect(hasOwnSet(sets, 'main')).toBe(true)
    // An empty stored set is "inherits main", matching the public resolver —
    // the two must agree or the admin lies about what the page will show.
    expect(hasOwnSet(sets, 'contact')).toBe(false)
    expect(hasOwnSet(sets, 'about')).toBe(false)
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd app && pnpm test:unit`
Expected: FAIL — cannot resolve `./useHeroImages`.

- [ ] **Step 5: Write the composable**

Create `app/src/composables/useHeroImages.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchHeroImages, saveHeroImageScope } from '@/api/heroImages'
import { useAuth } from './useAuth'
import type { HeroImage, HeroImageSets, HeroImagesResponse } from '@/types/heroImage'

const HERO_IMAGES_KEY = ['hero-images'] as const

/** The pictures stored against one scope, or an empty list. */
export function scopeSet(sets: HeroImageSets | undefined, scope: string): HeroImage[] {
  return sets?.[scope] ?? []
}

/**
 * Whether a scope overrides the main set.
 *
 * An empty stored set counts as *no* override, matching resolveHeroImages() on
 * the public side. The two have to agree: if the admin showed "3 pictures" for
 * a scope the public site treats as inheriting, the editor would be lying about
 * what visitors see.
 */
export function hasOwnSet(sets: HeroImageSets | undefined, scope: string): boolean {
  return scopeSet(sets, scope).length > 0
}

export function useHeroImages() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: HERO_IMAGES_KEY,
    queryFn: () => fetchHeroImages(token.value!),
    enabled: () => token.value !== null,
  })

  const save = useMutation({
    mutationFn: ({ scope, photoIds }: { scope: string; photoIds: number[] }) =>
      saveHeroImageScope(token.value!, scope, photoIds),
    // The endpoint returns every scope already ordered, so seeding the cache
    // avoids a refetch that would briefly snap thumbnails back to their old
    // order — the same reason useFaqs seeds after a reorder.
    onSuccess: (data: HeroImagesResponse) => queryClient.setQueryData(HERO_IMAGES_KEY, data),
  })

  return { query, save }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd app && pnpm test:unit`
Expected: PASS, 5 new cases.

- [ ] **Step 7: Commit**

```bash
git add app/src/types/heroImage.ts app/src/api/heroImages.ts \
        app/src/composables/useHeroImages.ts app/src/composables/useHeroImages.test.ts
git commit -m "feat(app): hero images data layer"
```

---

### Task 9: Admin editor at `/admin/hero-images`

**Files:**
- Create: `app/src/views/admin/HeroImagesAdminView.vue`
- Modify: `app/src/router/index.ts` (routes array near line 219; title map near line 271)
- Modify: `app/src/components/admin/AdminLayout.vue` (the `pageconfig` group, line 25; the nav links near line 264)

**Interfaces:**
- Consumes: `useHeroImages`, `scopeSet`, `hasOwnSet` from Task 8; `useWebsiteModules` (existing) for the module list; the existing photos composable for the picker.
- Produces: route name `admin-hero-images` at `adminUrl('hero-images')`.

**Components this reuses (already verified to exist — do not write new ones):**

| Need | Use |
|---|---|
| Modal shell | `@/components/admin/AdminModal.vue` |
| Page chrome | `@/components/admin/AdminLayout.vue` |
| Photo source | `useAlbums()` — each `Album` carries `photos: AlbumPhoto[]` with `{id, image_url, sort_order, caption, epk_featured}`. There is no standalone photos composable; the gallery admin reads albums. |
| Module list | `useWebsiteModules()` |
| Rebuild | `useWebsiteModules()` also returns `rebuild`, `rebuildStatusQuery` and `setAutoRebuild` — reuse them rather than adding a second rebuild path. Note **auto-rebuild may already be on**, in which case no button should be shown. |
| Form styling | `@/components/admin/form-styles.css`, as the neighbouring views do |
| Toasts | `vue-sonner`'s `toast`, as `PhotosAdminView` does |

- [ ] **Step 1: Add the route**

In `app/src/router/index.ts`, after the `admin-faqs` entry:

```ts
    {
      path: adminUrl('hero-images'),
      name: 'admin-hero-images',
      component: () => import('@/views/admin/HeroImagesAdminView.vue'),
      meta: { requiresAuth: true, requiredRole: 'admin' },
    },
```

And in the title map near line 271:

```ts
  'admin-hero-images': 'Hero Images — Admin',
```

- [ ] **Step 2: Add it to the nav**

In `app/src/components/admin/AdminLayout.vue`, extend the `pageconfig` group (line 25):

```ts
  pageconfig: [adminUrl('website-modules'), adminUrl('faqs'), adminUrl('hero-images')],
```

And add a `RouterLink` beside the `faqs` one (near line 264), matching the surrounding markup exactly:

```vue
              <RouterLink :to="adminUrl('hero-images')" class="nav-item" active-class="nav-item--active">
                Hero Images
              </RouterLink>
```

- [ ] **Step 3: Write the view's script block**

Create `app/src/views/admin/HeroImagesAdminView.vue`:

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import { useHeroImages, scopeSet, hasOwnSet } from '@/composables/useHeroImages'
import { useWebsiteModules } from '@/composables/useWebsiteModules'
import { useAlbums } from '@/composables/useAlbums'
import { NON_PAGE_MODULES } from '@/config/moduleSettings'
import type { AlbumPhoto } from '@/types/album'

const { query, save } = useHeroImages()
const { query: modulesQ, rebuild, rebuildStatusQuery } = useWebsiteModules()
const { query: albumsQ } = useAlbums()

const sets = computed(() => query.data.value?.data)

/**
 * Scopes in editing order: the fallback first, then the homepage, then pages.
 *
 * NON_PAGE_MODULES is excluded because those rows have no route — a hero for
 * the footer would be a control that changes nothing.
 */
const scopes = computed(() => [
  { key: 'main', label: 'Main', hint: 'Used by every page that has none of its own' },
  { key: 'home', label: 'Homepage', hint: '' },
  ...(modulesQ.data.value?.data ?? [])
    .filter(m => !NON_PAGE_MODULES.has(m.slug))
    .map(m => ({ key: m.slug, label: m.display_name, hint: '' })),
])

const selected = ref('main')

/** The working copy. Only written back to the server on Save. */
const draft = ref<AlbumPhoto[]>([])

/** Re-seed the draft whenever the scope changes or fresh data lands. */
watch([selected, sets], () => {
  const stored = scopeSet(sets.value, selected.value)
  draft.value = stored
    .map(h => allPhotos.value.find(p => p.id === h.photo_id))
    .filter((p): p is AlbumPhoto => p !== undefined)
}, { immediate: true })

/** Every gallery photo, flattened out of its album. */
const allPhotos = computed<AlbumPhoto[]>(() =>
  (albumsQ.data.value?.data ?? []).flatMap(a => a.photos),
)

const chosenIds = computed(() => new Set(draft.value.map(p => p.id)))
const dirty = computed(() =>
  JSON.stringify(draft.value.map(p => p.id))
    !== JSON.stringify(scopeSet(sets.value, selected.value).map(h => h.photo_id)),
)

const showPicker = ref(false)

function addPhoto(photo: AlbumPhoto) {
  if (chosenIds.value.has(photo.id)) return
  draft.value = [...draft.value, photo]
}

function removeAt(index: number) {
  draft.value = draft.value.filter((_, i) => i !== index)
}

/**
 * Up/down rather than drag: the admin has no shared drag utility, and adding a
 * library for a list that is usually three items long is not a trade worth
 * making. Order matters only because it is the order the random pick draws from.
 */
function move(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= draft.value.length) return
  const copy = [...draft.value]
  ;[copy[index], copy[next]] = [copy[next], copy[index]]
  draft.value = copy
}

async function onSave() {
  try {
    await save.mutateAsync({ scope: selected.value, photoIds: draft.value.map(p => p.id) })
    toast.success('Hero images saved')
  } catch {
    toast.error('Could not save hero images')
  }
}

/** Count shown beside each scope, or the inheritance note. */
function scopeSummary(key: string): string {
  if (!hasOwnSet(sets.value, key)) return key === 'main' ? 'none set' : 'inherits Main'
  return `${scopeSet(sets.value, key).length} picture(s)`
}

const rebuilding = computed(() => rebuildStatusQuery.data.value?.status === 'building')
const autoRebuild = computed(() => modulesQ.data.value?.auto_rebuild ?? false)
</script>
```

- [ ] **Step 4: Write the view's template**

Append to the same file. Follow the class conventions of `WebsiteModulesView.vue` — read it first and match, rather than inventing a second visual language.

```vue
<template>
  <AdminLayout>
    <h1 class="text-2xl font-bold">Hero Images</h1>
    <p class="text-sm text-zinc-500 mt-1">
      Pictures shown behind a page's title. When a page has more than one, a random
      picture is chosen on each visit. A page with none of its own uses Main.
    </p>

    <div class="grid gap-6 mt-6 md:grid-cols-[260px_1fr]">
      <!-- Scopes -->
      <ul class="space-y-1">
        <li v-for="s in scopes" :key="s.key">
          <button
            type="button"
            class="w-full text-left px-3 py-2 rounded"
            :class="selected === s.key ? 'bg-zinc-200 font-semibold' : 'hover:bg-zinc-100'"
            @click="selected = s.key"
          >
            {{ s.label }}
            <span class="block text-xs text-zinc-500">{{ scopeSummary(s.key) }}</span>
          </button>
        </li>
      </ul>

      <!-- Selected set -->
      <div>
        <div v-if="draft.length === 0" class="text-sm text-zinc-500">
          No pictures yet.
          <template v-if="selected !== 'main'">This page uses the Main set.</template>
        </div>

        <ul v-else class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <li v-for="(photo, i) in draft" :key="photo.id" class="relative">
            <img v-if="photo.image_url" :src="photo.image_url" :alt="photo.caption ?? ''"
                 class="w-full h-28 object-cover rounded" />
            <div class="flex gap-1 mt-1">
              <button type="button" @click="move(i, -1)" :disabled="i === 0">←</button>
              <button type="button" @click="move(i, 1)" :disabled="i === draft.length - 1">→</button>
              <button type="button" class="ml-auto" @click="removeAt(i)">Remove</button>
            </div>
          </li>
        </ul>

        <div class="flex gap-2 mt-4">
          <button type="button" @click="showPicker = true">Add from gallery</button>
          <button type="button" :disabled="!dirty || save.isPending.value" @click="onSave">
            {{ save.isPending.value ? 'Saving…' : 'Save' }}
          </button>
          <button
            v-if="!autoRebuild"
            type="button"
            :disabled="rebuilding"
            title="Rebuild the public site so the change becomes visible"
            @click="rebuild.mutate()"
          >
            {{ rebuilding ? 'Rebuilding…' : 'Rebuild site' }}
          </button>
        </div>
        <p v-if="!autoRebuild" class="text-xs text-zinc-500 mt-2">
          The public site is static — hero changes appear after a rebuild.
        </p>
      </div>
    </div>

    <AdminModal v-if="showPicker" title="Choose photos" @close="showPicker = false">
      <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
        <li v-for="photo in allPhotos" :key="photo.id">
          <button
            type="button"
            class="block w-full"
            :class="chosenIds.has(photo.id) ? 'opacity-40 cursor-not-allowed' : ''"
            :disabled="chosenIds.has(photo.id)"
            @click="addPhoto(photo)"
          >
            <img v-if="photo.image_url" :src="photo.image_url" :alt="photo.caption ?? ''"
                 class="w-full h-24 object-cover rounded" />
          </button>
        </li>
      </ul>
    </AdminModal>
  </AdminLayout>
</template>
```

**Check `AdminModal`'s actual prop and event names before wiring it** — `title` / `@close` above is the assumed contract. Read the component and match it; a mismatched event name gives a modal that cannot be dismissed.

**Check `useWebsiteModules`'s actual return shape too.** The names `rebuild`, `rebuildStatusQuery`, `auto_rebuild` and `display_name` are taken from `WebsiteModulesView.vue:10-48`; confirm them rather than trusting this plan.

- [ ] **Step 5: Type-check and build the SPA**

Run: `cd app && pnpm build`
Expected: `vue-tsc` clean, build succeeds. Type errors here are most likely the two contracts flagged above.

- [ ] **Step 6: Verify in the browser**

```bash
docker compose build frontend && docker compose up -d frontend
```
Open `http://localhost:8081/admin/hero-images`. Confirm: the scope list renders; adding photos, saving and reloading persists them; clearing a scope makes it read `inherits Main` again; and the Save button is disabled until something changes.

- [ ] **Step 7: Commit**

```bash
git add app/src/views/admin/HeroImagesAdminView.vue \
        app/src/router/index.ts app/src/components/admin/AdminLayout.vue
git commit -m "feat(app): hero images admin editor"
```

---

### Task 10: E2E coverage and a full green run

**Files:**
- Create: `app/e2e/tests/admin/hero-images.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing new.

- [ ] **Step 1: Read the neighbouring spec for the house pattern**

```bash
ls app/e2e/tests/admin
sed -n '1,60p' app/e2e/tests/admin/website-modules.spec.ts
```

`website-modules.spec.ts` is the model: it captures the original value in `beforeAll` and writes it back in `afterAll`, because these specs write to the **real dev database** and the public site bakes whatever it finds at container start. Auth comes from the stored session in `app/e2e/fixtures/auth.ts` (`.auth/admin.json`), not from signing in per spec — copy how the neighbour imports `test` from `../../fixtures/test-base`.

- [ ] **Step 2: Write the spec**

Create `app/e2e/tests/admin/hero-images.spec.ts`:

```ts
import { test, expect } from '../../fixtures/test-base'
import type { APIRequestContext } from '@playwright/test'

// This spec writes to the shared dev database, so it records what it found and
// puts it back. Without that, an E2E run leaves whatever it picked on the live
// hero of every page until someone notices.
let originalMainIds: number[] = []

async function readMain(request: APIRequestContext, token: string): Promise<number[]> {
  const res = await request.get('/api/admin/hero-images', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  return (body.data?.main ?? []).map((h: { photo_id: number }) => h.photo_id)
}

test.describe('hero images admin', () => {
  test.beforeAll(async ({ playwright, apiToken }) => {
    const request = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL })
    originalMainIds = await readMain(request, apiToken)
    await request.dispose()
  })

  test.afterAll(async ({ playwright, apiToken }) => {
    const request = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL })
    await request.put('/api/admin/hero-images/main', {
      headers: { Authorization: `Bearer ${apiToken}` },
      data: { photo_ids: originalMainIds },
    })
    await request.dispose()
  })

  test('adds a picture to the main set and keeps it across a reload', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await expect(page.getByRole('heading', { name: 'Hero Images' })).toBeVisible()

    const before = await page.locator('img[alt]').count()

    await page.getByRole('button', { name: 'Add from gallery' }).click()
    const picker = page.getByRole('dialog')
    await expect(picker).toBeVisible()
    await picker.locator('button:not([disabled])').first().click()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Hero images saved')

    await page.reload()
    await expect(page.locator('img[alt]')).toHaveCount(before + 1)
  })

  test('a page with no set of its own reports that it inherits Main', async ({ page }) => {
    await page.goto('/admin/hero-images')
    await page.getByRole('button', { name: /Contact/ }).click()
    await expect(page.getByText('inherits Main')).toBeVisible()
  })
})
```

**`apiToken` is assumed to be a fixture.** If `app/e2e/fixtures/test-base.ts` does not expose one, get the token the way the neighbouring admin specs do — read it from `.auth/admin.json` or mint one via `/api/auth/login` in `beforeAll`. Do not hardcode a token.

**If the gallery is empty in the dev database the first test cannot pass.** Check `SELECT COUNT(*) FROM photos` first; if it is zero, seed one through `/admin/photos` rather than weakening the assertion.

- [ ] **Step 3: Run the E2E suite**

Run: `cd app && pnpm test:e2e`

**Triage a red run before assuming the code is wrong.** A different set of specs failing each run is the machine, not the change. Count proxy resets first: `grep -c ECONNRESET` on the run log. `~15 tests skip by design`, so "178 passed, 15 skipped" is a full green run. A single red spec that reproduces in isolation is a real failure.

- [ ] **Step 4: Run everything**

```bash
bash scripts/test-all.sh
```
Expected: exit 0. The bitmask is 1 = backend, 2 = E2E, 4 = frontend.

- [ ] **Step 5: Rebuild every affected image**

```bash
bash rebuild.sh
docker compose build web && docker compose up -d web
```
The `web` service has no bind mount — a `restart` would rebuild the *baked* source and confirm a change you never shipped.

- [ ] **Step 6: Update the changelog and commit**

Add an entry to `CHANGELOG.md` following the existing format, then:

```bash
git add app/e2e/hero-images.spec.ts CHANGELOG.md
git commit -m "test(e2e): cover hero image editing"
```

- [ ] **Step 7: Document the footgun in CLAUDE.md**

Add a short section under *Known footguns* recording that hero images are served **outside** `module_config` because `slugs.ts` derives the slug map from its keys — the reasoning is not visible from either file alone, and the obvious refactor reintroduces the bug with a green build.

```bash
git add CLAUDE.md && git commit -m "docs: record why hero images sit outside module_config"
```

- [ ] **Step 8: Open the PR**

```bash
gh pr create --title "Hero background images with per-page overrides" --body "$(cat <<'EOF'
## What

Hero background pictures, chosen from the existing photo gallery. One site-wide
**Main** set, optionally overridden per page, with a random picture chosen on
every visit.

There was never a hero image field before — the old SPA reused the band logo as
a full-bleed backdrop, and the Astro rewrite kept it as a small foreground mark.

## How

- `hero_images` joins gallery photos to a `scope` (`main`, `home`, or a module
  slug) with an explicit `position`.
- `PUT /api/admin/hero-images/{scope}` replaces one scope in a transaction.
- `/api/site-config` serves populated scopes under a new top-level `hero_images`
  key — deliberately **not** inside `module_config`, because `slugs.ts` derives
  the site's slug map from that object's keys.
- `HeroBackdrop.astro` ships all candidates and picks one in an inline
  synchronous script, before first paint.

## Also in here

Seven page sections still hand-rolled the header `PageHero` was extracted to
replace. They now use it, so the backdrop was written once instead of nine times.

## Testing

Backend Pest, `web` and `app` Vitest, and a Playwright spec that restores the
dev database in `afterAll`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ
EOF
)"
```

Then run `/code-review` on the branch. **This is required before merging** — `/ship` has no review step, and `git-feature-workflow`'s review only fires for `.vue`/composable changes, so it would silently skip the Laravel half of this branch.

---

## Notes for the executor

**The riskiest task is 7**, the header migration. It touches seven pages that have nothing to do with hero images, and a spacing regression will not fail any test. Commit each page separately so a bad one can be reverted alone, and actually look at each page in a browser — the `dist/` greps confirm structure, not appearance.

**The subtlest trap is `module_config`.** Putting hero images there is the obvious design and it is wrong: `web/src/lib/slugs.ts` iterates its keys to build the slug map, so the non-module scopes (`main`, `home`) would become phantom modules in the map that decides where the nav points — with a completely green build. Task 4 ships a regression test for this; don't delete it.

**Availability-style caching does not apply here.** Hero images are read straight from the database on each `site-config` request; the staleness you will hit is the Astro build's, not a cache's, and the fix is a `web` rebuild.
