# Clips Library — PR 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A library of video clips (YouTube / Vimeo / Instagram / TikTok / Facebook / link) that can be attached to concerts and embedded in news posts, with an admin screen, a quick-add on the concert form, a `ref: clip` post block, and a clips section on the public concert page.

**Architecture:** One `clips` table plus a polymorphic `clippables` pivot (`morphToMany`), a `HasClips` trait on owner models, a `ClipController` with CRUD + attach/detach, `ClipResource` for JSON, a `clip` arm in `PostBlockResolver`. The admin reuses `EmbedBlockEditor` for URL entry and `EntityRelationsPanel` for attachments; the public site reuses `EmbedBlock.astro` for rendering. Facebook is added to `EmbedProvider` first, since both embeds and clips use it.

**Tech Stack:** Laravel 11 + Pest (api/), Vue 3 + TanStack Query v5 + Vitest (app/), Astro + Vue islands (web/), Playwright (app/e2e/), `@bandms/site-copy` registry.

**Spec:** `docs/superpowers/specs/2026-09-17-clips-library-design.md` — this plan covers **PR 1** only (library, Facebook, `/admin/clips`, concert quick-add, news ref, concert page). PR 2 (release, merch, EPK surfaces) is a separate plan.

## Global Constraints

- Branch: `feature/clips-library` (already created, spec committed). Never commit to `main`.
- Locale literals `'en'`/`'pl'` only where the codebase already accepts them (`{en, pl}` bags in payloads/tests); UI code uses `LOCALES`/`DEFAULT_LOCALE` from `@/locales`.
- Public-site components use only semantic tokens from `web/src/styles/tokens.css` (`var(--color-*)`, `var(--font-*)`); no raw colours/fonts. `pnpm build` in `web/` runs the token lint.
- `app/` unit tests are `*.spec.ts`; `web/` unit tests are `*.test.ts`. `vue-tsc` must be run as `pnpm build` (the `-b` form), never `-p tsconfig.json`.
- Every write that changes baked content calls `SiteRebuild::markDirty('<area>')` with one of the 14 existing area keys (`concerts`, `posts`, `releases`, `shop`, `band-profile`, …).
- Clip **ids must stay stable**: no write path may delete-and-recreate a clip row.
- Backend tests run in the test image: `docker build --target test -t bandms_test ./api` then `docker run --rm -e APP_ENV=testing -e APP_KEY="$(grep '^APP_KEY=' .env | cut -d= -f2-)" bandms_test --filter <Name>`. Use `bash rebuild.sh --backend-only` after PHP changes to refresh the running stack.
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Spec deviation, deliberate: clip copy strings live in the existing `site` and `concerts` copy modules rather than a new `clips` module row. Category labels are cross-page (`site`, like the FAQ block); the concert page heading is `concerts`. This avoids a seeded module row, `NON_PAGE_MODULES`/`ALWAYS_ON_MODULES` edits and a migration, with no loss of function.

---

## File structure

**api/**
- `database/migrations/2026_09_17_000001_create_clips_table.php` — `clips` + `clippables`
- `app/Models/Clip.php` — model, translatable `title`, inverse morph relations, `owners()`
- `app/Models/Concerns/HasClips.php` — `clips()` morphToMany
- `app/Models/Concert.php`, `Release.php`, `ShopItem.php`, `Album.php` — `use HasClips`
- `app/Providers/AppServiceProvider.php` — `Relation::enforceMorphMap`
- `app/Support/ClipCategory.php` — preset list
- `app/Support/ClipOwners.php` — morph alias → model class map + dirty-area map
- `app/Support/EmbedProvider.php` — Facebook
- `app/Http/Requests/ClipRequest.php` — validation, provider stamping
- `app/Http/Resources/ClipResource.php`
- `app/Http/Controllers/ClipController.php` — index/store/update/destroy/attach/detach
- `app/Http/Controllers/ConcertController.php`, `Resources/ConcertResource.php` — load + emit `clips`
- `app/Support/PostBlockType.php`, `PostBlockResolver.php` — `clip` entity
- `routes/api.php`
- `database/factories/ClipFactory.php`
- `tests/Feature/EmbedProviderTest.php`, `ClipTest.php`, `ConcertTest.php`, `PostBlockResolverTest.php`

**packages/site-copy/**
- `src/modules/site.ts` — `Clips` group: category labels
- `src/modules/concerts.ts` — `clipsTitle`

**web/**
- `src/types/clip.ts`, `src/types/post.ts`, `src/types/concert.ts`
- `src/lib/cms.ts` — `getConcert(id, lang)`
- `src/lib/clipCategory.ts` — preset label lookup (+ `.test.ts`)
- `src/components/blocks/EmbedBlock.astro` — Facebook arm, accepts `EmbedLike`
- `src/components/ClipsGrid.astro`
- `src/components/detail/ConcertDetail.astro` — clips section
- `src/components/blocks/RefBlock.astro` — `clip` arm

**app/**
- `src/types/clip.ts`, `src/types/post.ts`, `src/types/concert.ts`
- `src/utils/clipCategories.ts` (+ `.spec.ts`), `src/utils/postBlocks.ts` (+ `.spec.ts`)
- `src/api/clips.ts`, `src/composables/useClips.ts`
- `src/components/admin/forms/ClipForm.vue`, `src/components/admin/forms/ClipCategoryPicker.vue`
- `src/components/admin/forms/AttachedClipsField.vue`
- `src/components/admin/forms/blocks/RefBlockEditor.vue`, `EmbedBlockEditor.vue`
- `src/components/admin/forms/PostForm.vue`, `ConcertForm.vue`
- `src/components/admin/EntityRelationsPanel.vue` — `shopItems`
- `src/views/admin/ClipsAdminView.vue`, `src/router/index.ts`, `src/components/admin/AdminLayout.vue`
- `e2e/tests/admin/clips.spec.ts`, `e2e/tests/admin/post-clip-block.spec.ts`
- `e2e/tests/public/concert-clips.spec.ts`

---

### Task 1: Facebook joins `EmbedProvider` (API, admin mirror, public renderer)

**Files:**
- Modify: `api/app/Support/EmbedProvider.php`
- Modify: `api/tests/Feature/EmbedProviderTest.php`
- Modify: `app/src/utils/postBlocks.ts`, `app/src/utils/postBlocks.spec.ts`
- Modify: `app/src/types/post.ts:5`, `web/src/types/post.ts:4` (`EmbedProviderName`)
- Modify: `web/src/components/blocks/EmbedBlock.astro`

**Interfaces:**
- Produces: `EmbedProvider::PROVIDERS` includes `'facebook'`; `EmbedProvider::embedId()` returns the **full URL** for a Facebook video URL (the player takes `?href=`), `null` for a Facebook page URL.

- [ ] **Step 1: Replace the "facebook is deliberately NOT a provider" test with Facebook cases**

In `api/tests/Feature/EmbedProviderTest.php`, replace the `it('falls back to link for any other host, facebook included', …)` block with:

```php
    it('detects facebook from facebook.com and fb.watch', function () {
        expect(EmbedProvider::detect('https://www.facebook.com/band/videos/1234567890/'))->toBe('facebook');
        expect(EmbedProvider::detect('https://fb.watch/abcDEF123/'))->toBe('facebook');
    });

    it('falls back to link for any other host', function () {
        expect(EmbedProvider::detect('https://example.com/news'))->toBe('link');
    });
```

Inside `describe('EmbedProvider::embedId', …)` add:

```php
    // Facebook's player takes the whole video URL as ?href=, not an id — so
    // the "id" is the URL itself, and a page URL (no video) yields null.
    it('returns the full url as the facebook embed id, null for a page', function () {
        $video = 'https://www.facebook.com/band/videos/1234567890/';
        expect(EmbedProvider::embedId($video))->toBe($video);
        expect(EmbedProvider::embedId('https://www.facebook.com/watch/?v=1234567890'))->toBe('https://www.facebook.com/watch/?v=1234567890');
        expect(EmbedProvider::embedId('https://www.facebook.com/reel/1234567890'))->toBe('https://www.facebook.com/reel/1234567890');
        expect(EmbedProvider::embedId('https://fb.watch/abcDEF123/'))->toBe('https://fb.watch/abcDEF123/');
        expect(EmbedProvider::embedId('https://www.facebook.com/band/posts/123'))->toBeNull();
    });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /c/Projects/bandms && docker build --target test -t bandms_test ./api && docker run --rm -e APP_ENV=testing -e APP_KEY="$(grep '^APP_KEY=' .env | cut -d= -f2-)" bandms_test --filter EmbedProviderTest
```
Expected: FAIL — `detect()` returns `'link'` for facebook.

- [ ] **Step 3: Implement Facebook in `EmbedProvider`**

```php
    public const PROVIDERS = ['youtube', 'vimeo', 'instagram', 'tiktok', 'facebook', 'link'];

    private const HOSTS = [
        'youtube.com'   => 'youtube',
        'youtu.be'      => 'youtube',
        'vimeo.com'     => 'vimeo',
        'instagram.com' => 'instagram',
        'tiktok.com'    => 'tiktok',
        'facebook.com'  => 'facebook',
        'fb.watch'      => 'facebook',
    ];
```

In `embedId()`'s match add, before `default`:

```php
            // Facebook's player is plugins/video.php?href=<url>: the whole URL
            // is the id. Only URLs that name a single video qualify.
            'facebook'  => preg_match('~(?:facebook\.com/(?:[^/]+/videos/\d+|watch/?\?v=\d+|reel/\d+)|fb\.watch/[A-Za-z0-9_-]+)~', $url) === 1 ? $url : null,
```

Update the class docblock's last sentence to: `Adding a provider is one entry in HOSTS plus one arm in embedId() — and one arm in web/src/components/blocks/EmbedBlock.astro and one in app/src/utils/postBlocks.ts.`

- [ ] **Step 4: Run the test to verify it passes**

Same command as Step 2. Expected: PASS. Also run `--filter PostBlock` to confirm nothing else regressed (the backfill test may reference facebook staying `link` — if `PostBlockBackfillTest` asserts a facebook URL detects as `link`, change that assertion to `'facebook'`; the stored `provider` on old rows is unchanged either way because it is stored, not recomputed).

- [ ] **Step 5: Mirror in the admin util + type, with a spec**

`app/src/types/post.ts` and `web/src/types/post.ts`:

```ts
export type EmbedProviderName = 'youtube' | 'vimeo' | 'instagram' | 'tiktok' | 'facebook' | 'link'
```

`app/src/utils/postBlocks.ts`:

```ts
const PROVIDER_LABELS: Record<EmbedProviderName, string> = {
  youtube: 'YouTube', vimeo: 'Vimeo', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', link: 'Link',
}

const PROVIDER_HOSTS: Record<string, EmbedProviderName> = {
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'vimeo.com': 'vimeo',
  'instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
  'facebook.com': 'facebook',
  'fb.watch': 'facebook',
}
```

Append to `app/src/utils/postBlocks.spec.ts`:

```ts
describe('detectProvider — facebook', () => {
  it('detects facebook.com and fb.watch', () => {
    expect(detectProvider('https://www.facebook.com/band/videos/123/')).toBe('facebook')
    expect(detectProvider('https://fb.watch/abc123/')).toBe('facebook')
  })
  it('labels it Facebook', () => {
    expect(providerLabel('facebook')).toBe('Facebook')
  })
})
```

(Check the file's existing imports include `describe`, `it`, `expect` from `vitest` and `detectProvider`, `providerLabel` from `./postBlocks`; add if missing.)

Run: `cd app && pnpm vitest run src/utils/postBlocks.spec.ts` → PASS.

Also update the placeholder in `app/src/components/admin/forms/blocks/EmbedBlockEditor.vue` to `"Paste a YouTube, Vimeo, Instagram, TikTok or Facebook URL"`.

- [ ] **Step 6: Public renderer arm**

In `web/src/components/blocks/EmbedBlock.astro` `SRC` map add:

```ts
  facebook:  id => `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(id)}&show_text=false`,
```

- [ ] **Step 7: Type-check both frontends and commit**

```bash
cd /c/Projects/bandms/app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build
cd /c/Projects/bandms/web && npx tsc --noEmit -p tsconfig.json   # only the 2 documented pre-existing errors
cd /c/Projects/bandms && git add -A api/app/Support/EmbedProvider.php api/tests/Feature/EmbedProviderTest.php app/src/utils/postBlocks.ts app/src/utils/postBlocks.spec.ts app/src/types/post.ts web/src/types/post.ts web/src/components/blocks/EmbedBlock.astro app/src/components/admin/forms/blocks/EmbedBlockEditor.vue
git commit -m "Add Facebook as an embed provider

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `clips` + `clippables` tables, `Clip` model, `HasClips` trait, morph map, factory

**Files:**
- Create: `api/database/migrations/2026_09_17_000001_create_clips_table.php`
- Create: `api/app/Models/Clip.php`, `api/app/Models/Concerns/HasClips.php`
- Create: `api/app/Support/ClipOwners.php`, `api/app/Support/ClipCategory.php`
- Create: `api/database/factories/ClipFactory.php`
- Modify: `api/app/Models/Concert.php`, `Release.php`, `ShopItem.php`, `Album.php`
- Modify: `api/app/Providers/AppServiceProvider.php`
- Test: `api/tests/Feature/ClipModelTest.php`

**Interfaces:**
- Produces: `Clip` (`provider, url, title, category, recorded_on, show_in_epk`), `$concert->clips()` ordered by pivot `position`, `$clip->concerts()` etc., `Clip::owners(): array`, `ClipOwners::MAP` (`alias => class`), `ClipOwners::dirtyArea(string $alias): ?string`, `ClipCategory::PRESETS`.

- [ ] **Step 1: Write the failing model test**

`api/tests/Feature/ClipModelTest.php`:

```php
<?php

use App\Models\Clip;
use App\Models\Concert;
use App\Models\Release;

it('attaches a clip to a concert and reads it back in pivot order', function () {
    $concert = Concert::factory()->create();
    $a = Clip::factory()->create(['title' => ['en' => 'A']]);
    $b = Clip::factory()->create(['title' => ['en' => 'B']]);

    $concert->clips()->attach([$b->id => ['position' => 0], $a->id => ['position' => 1]]);

    expect($concert->fresh()->clips->pluck('id')->all())->toBe([$b->id, $a->id]);
});

it('lets one clip belong to owners of different kinds', function () {
    $clip    = Clip::factory()->create();
    $concert = Concert::factory()->create();
    $release = Release::factory()->create();

    $clip->concerts()->attach($concert->id, ['position' => 0]);
    $clip->releases()->attach($release->id, ['position' => 0]);

    $owners = $clip->fresh()->load(['concerts.venue', 'releases', 'shopItems', 'albums'])->ownersList();

    expect(collect($owners)->pluck('type')->sort()->values()->all())->toBe(['concert', 'release']);
    expect(collect($owners)->firstWhere('type', 'concert')['id'])->toBe($concert->id);
});

it('stores the morph alias, not the class name', function () {
    $clip    = Clip::factory()->create();
    $concert = Concert::factory()->create();
    $clip->concerts()->attach($concert->id, ['position' => 0]);

    $this->assertDatabaseHas('clippables', ['clip_id' => $clip->id, 'clippable_type' => 'concert', 'clippable_id' => $concert->id]);
});

it('removes pivot rows but not the clip when the owner is deleted', function () {
    $clip    = Clip::factory()->create();
    $concert = Concert::factory()->create();
    $clip->concerts()->attach($concert->id, ['position' => 0]);

    $concert->delete();

    $this->assertDatabaseMissing('clippables', ['clip_id' => $clip->id]);
    $this->assertDatabaseHas('clips', ['id' => $clip->id]);
});

it('cascades pivot rows when the clip is deleted', function () {
    $clip    = Clip::factory()->create();
    $concert = Concert::factory()->create();
    $clip->concerts()->attach($concert->id, ['position' => 0]);

    $clip->delete();

    $this->assertDatabaseMissing('clippables', ['clippable_id' => $concert->id, 'clippable_type' => 'concert']);
});
```

- [ ] **Step 2: Run to verify it fails**

`… bandms_test --filter ClipModelTest` → FAIL: `Class "App\Models\Clip" not found`.

- [ ] **Step 3: Migration**

`api/database/migrations/2026_09_17_000001_create_clips_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A library of video clips (live, studio, backstage…) attached to whatever
 * they document. `clippables` is a polymorphic many-to-many: one clip can sit
 * on a concert *and* the release it promotes. Posts are not owners — they
 * reference a clip through a `ref` block, which also decides where in the
 * article it sits.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clips', function (Blueprint $table) {
            $table->id();
            // Stamped by EmbedProvider::detect() on write and stored, so a
            // later change to detection cannot silently re-point old rows.
            $table->string('provider', 20);
            $table->string('url', 2048);
            $table->json('title')->nullable();
            $table->string('category', 64)->default('live');
            $table->date('recorded_on')->nullable();
            $table->boolean('show_in_epk')->default(false);
            $table->timestamps();
        });

        Schema::create('clippables', function (Blueprint $table) {
            $table->foreignId('clip_id')->constrained()->cascadeOnDelete();
            $table->string('clippable_type', 32);
            $table->unsignedBigInteger('clippable_id');
            $table->unsignedSmallInteger('position')->default(0);

            $table->unique(['clip_id', 'clippable_type', 'clippable_id']);
            $table->index(['clippable_type', 'clippable_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clippables');
        Schema::dropIfExists('clips');
    }
};
```

Owner deletion is not a DB cascade (polymorphic columns cannot carry an FK); the trait handles it in Step 5.

- [ ] **Step 4: Support classes**

`api/app/Support/ClipOwners.php`:

```php
<?php

namespace App\Support;

use App\Models\Album;
use App\Models\Concert;
use App\Models\Release;
use App\Models\ShopItem;

/**
 * Which models a clip can be attached to, by morph alias.
 *
 * The alias is what `clippables.clippable_type` stores, so it is part of the
 * data: never rename one. `album` is in the map (the model is ready) but the
 * admin does not offer it — albums have no public page to show clips on.
 */
final class ClipOwners
{
    public const MAP = [
        'concert'   => Concert::class,
        'release'   => Release::class,
        'shop_item' => ShopItem::class,
        'album'     => Album::class,
    ];

    /** SiteRebuild area whose baked pages show this owner's clips. */
    private const DIRTY = [
        'concert'   => 'concerts',
        'release'   => 'releases',
        'shop_item' => 'shop',
        'album'     => 'photos',
    ];

    /** @return string[] */
    public static function aliases(): array
    {
        return array_keys(self::MAP);
    }

    public static function table(string $alias): string
    {
        return (new (self::MAP[$alias]))->getTable();
    }

    public static function dirtyArea(string $alias): ?string
    {
        return self::DIRTY[$alias] ?? null;
    }
}
```

`api/app/Support/ClipCategory.php`:

```php
<?php

namespace App\Support;

/**
 * Suggested clip categories. The column is free text — a band can type its
 * own — so this list drives the admin's chips and the public label lookup,
 * not validation. Mirrored by app/src/utils/clipCategories.ts.
 */
final class ClipCategory
{
    public const PRESETS = ['live', 'studio', 'backstage', 'interview', 'other'];
}
```

- [ ] **Step 5: Model, trait, morph map, owner models**

`api/app/Models/Concerns/HasClips.php`:

```php
<?php

namespace App\Models\Concerns;

use App\Models\Clip;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

/**
 * An owner of clips. Adds `clips()` and detaches them when the owner is
 * deleted — the pivot's owner side is polymorphic, so the database cannot
 * cascade it.
 */
trait HasClips
{
    public static function bootHasClips(): void
    {
        static::deleting(fn ($model) => $model->clips()->detach());
    }

    public function clips(): MorphToMany
    {
        return $this->morphToMany(Clip::class, 'clippable')
            ->withPivot('position')
            ->orderByPivot('position')
            ->orderBy('clips.id');
    }
}
```

`api/app/Models/Clip.php`:

```php
<?php

namespace App\Models;

use App\Support\ClipOwners;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Spatie\Translatable\HasTranslations;

class Clip extends Model
{
    use HasFactory, HasTranslations;

    public array $translatable = ['title'];

    protected $fillable = ['provider', 'url', 'title', 'category', 'recorded_on', 'show_in_epk'];

    protected function casts(): array
    {
        return [
            'recorded_on' => 'date:Y-m-d',
            'show_in_epk' => 'boolean',
        ];
    }

    public function concerts(): MorphToMany
    {
        return $this->owners(Concert::class);
    }

    public function releases(): MorphToMany
    {
        return $this->owners(Release::class);
    }

    public function shopItems(): MorphToMany
    {
        return $this->owners(ShopItem::class);
    }

    public function albums(): MorphToMany
    {
        return $this->owners(Album::class);
    }

    /** The relation for a morph alias — `concerts()` for 'concert', etc. */
    public function ownerRelation(string $alias): MorphToMany
    {
        return $this->owners(ClipOwners::MAP[$alias]);
    }

    private function owners(string $class): MorphToMany
    {
        return $this->morphedByMany($class, 'clippable')->withPivot('position');
    }

    /**
     * Every owner, flattened for the resource: {type, id, label, slug_en?, date?}.
     * Relies on the four owner relations being eager-loaded by the caller.
     *
     * @return array<int, array<string, mixed>>
     */
    public function ownersList(): array
    {
        $out = [];

        foreach ($this->concerts as $c) {
            $out[] = ['type' => 'concert', 'id' => $c->id, 'slug_en' => $c->slug_en, 'date' => $c->date?->format('Y-m-d'),
                      'label' => trim(($c->date?->format('Y-m-d') ?? '') . ' — ' . ($c->venue?->name ?? $c->getTranslation('name', 'en') ?? ''), ' —')];
        }
        foreach ($this->releases as $r) {
            $out[] = ['type' => 'release', 'id' => $r->id, 'label' => $r->title];
        }
        foreach ($this->shopItems as $s) {
            $out[] = ['type' => 'shop_item', 'id' => $s->id, 'slug_en' => $s->slug_en, 'label' => $s->name];
        }
        foreach ($this->albums as $a) {
            $out[] = ['type' => 'album', 'id' => $a->id, 'label' => $a->title];
        }

        return $out;
    }
}
```

`api/app/Providers/AppServiceProvider.php` — add imports `use App\Support\ClipOwners; use Illuminate\Database\Eloquent\Relations\Relation;` and in `boot()` before `configureRateLimiting()`:

```php
        // Short aliases in clippables.clippable_type — renaming a model class
        // must not orphan pivot rows. Clips are the only polymorphic relation.
        Relation::enforceMorphMap(ClipOwners::MAP);
```

Add `use App\Models\Concerns\HasClips;` and `use HasFactory, HasSlug, HasTranslations, HasClips;` (append `HasClips` to the existing `use` line) in `Concert.php`, `Release.php`, `ShopItem.php`, `Album.php`.

`api/database/factories/ClipFactory.php`:

```php
<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class ClipFactory extends Factory
{
    public function definition(): array
    {
        return [
            'provider'    => 'youtube',
            'url'         => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'title'       => ['en' => fake()->sentence(3), 'pl' => null],
            'category'    => 'live',
            'recorded_on' => fake()->optional()->date(),
            'show_in_epk' => false,
        ];
    }
}
```

- [ ] **Step 6: Run the model test**

`… --filter ClipModelTest` → PASS (5 tests). Also run the full backend suite once: `bash rebuild.sh --backend-only` (runs migrations against the dev DB and the suite).

- [ ] **Step 7: Commit**

```bash
git add api/database/migrations/2026_09_17_000001_create_clips_table.php api/app/Models/Clip.php api/app/Models/Concerns/HasClips.php api/app/Support/ClipOwners.php api/app/Support/ClipCategory.php api/database/factories/ClipFactory.php api/app/Models/Concert.php api/app/Models/Release.php api/app/Models/ShopItem.php api/app/Models/Album.php api/app/Providers/AppServiceProvider.php api/tests/Feature/ClipModelTest.php
git commit -m "Add the clips table and a polymorphic clippables pivot

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Clip API — resource, request, controller, routes, dirty areas

**Files:**
- Create: `api/app/Http/Resources/ClipResource.php`, `api/app/Http/Requests/ClipRequest.php`, `api/app/Http/Controllers/ClipController.php`
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/ClipTest.php`

**Interfaces:**
- Produces: `GET /api/clips` (public), `POST /api/clips`, `PUT /api/clips/{clip}`, `DELETE /api/clips/{clip}`, `POST /api/clips/{clip}/attach {type,id}`, `DELETE /api/clips/{clip}/attach {type,id}` (admin). Payload: `{url, title?: {en,pl}, category?, recorded_on?, show_in_epk?, attach?: [{type, id}]}`. Response `data`: `{id, provider, url, embed_id, title, category, recorded_on, show_in_epk, translations: {title}, owners: [...]}`.

- [ ] **Step 1: Write the failing feature test**

`api/tests/Feature/ClipTest.php`:

```php
<?php

use App\Models\Clip;
use App\Models\Concert;
use App\Models\Release;
use App\Models\SiteDirtyArea;
use App\Models\User;
use Laravel\Passport\Passport;

describe('GET /api/clips', function () {
    it('is public and lists clips with owners', function () {
        $concert = Concert::factory()->create();
        $clip = Clip::factory()->create(['title' => ['en' => 'Encore', 'pl' => 'Bis']]);
        $clip->concerts()->attach($concert->id, ['position' => 0]);

        $this->getJson('/api/clips')
            ->assertSuccessful()
            ->assertJsonPath('data.0.title', 'Encore')
            ->assertJsonPath('data.0.embed_id', 'dQw4w9WgXcQ')
            ->assertJsonPath('data.0.owners.0.type', 'concert')
            ->assertJsonPath('data.0.owners.0.id', $concert->id);
    });

    it('resolves the title for ?lang=pl', function () {
        Clip::factory()->create(['title' => ['en' => 'Encore', 'pl' => 'Bis']]);

        $this->getJson('/api/clips?lang=pl')->assertJsonPath('data.0.title', 'Bis');
    });
});

describe('POST /api/clips', function () {
    it('returns 401 without authentication', function () {
        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/76979871'])->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));
        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/76979871'])->assertForbidden();
    });

    it('creates a clip, stamps the provider and attaches owners', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();

        $this->postJson('/api/clips', [
            'url'      => 'https://vimeo.com/76979871',
            'title'    => ['en' => 'Soundcheck', 'pl' => null],
            'category' => 'backstage',
            'attach'   => [['type' => 'concert', 'id' => $concert->id]],
        ])->assertCreated()
          ->assertJsonPath('data.provider', 'vimeo')
          ->assertJsonPath('data.embed_id', '76979871')
          ->assertJsonPath('data.category', 'backstage')
          ->assertJsonPath('data.owners.0.type', 'concert');

        $this->assertDatabaseHas('clippables', ['clippable_type' => 'concert', 'clippable_id' => $concert->id]);
    });

    it('defaults the category to live and accepts a custom one', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/1'])->assertCreated()->assertJsonPath('data.category', 'live');
        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/2', 'category' => 'charity gig'])
            ->assertCreated()->assertJsonPath('data.category', 'charity gig');
    });

    it('validates the url and the owner', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/clips', ['url' => 'not a url'])->assertUnprocessable()->assertJsonValidationErrors('url');
        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/1', 'attach' => [['type' => 'tour', 'id' => 1]]])
            ->assertUnprocessable()->assertJsonValidationErrors('attach.0.type');
        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/1', 'attach' => [['type' => 'concert', 'id' => 999999]]])
            ->assertUnprocessable()->assertJsonValidationErrors('attach.0.id');
    });

    it('marks the owner area and posts dirty', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();

        $this->postJson('/api/clips', ['url' => 'https://vimeo.com/1', 'attach' => [['type' => 'concert', 'id' => $concert->id]]])->assertCreated();

        expect(SiteDirtyArea::pluck('area')->all())->toContain('concerts', 'posts');
    });
});

describe('PUT /api/clips/{clip}', function () {
    it('keeps the id and syncs attachments in array order', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create();
        [$a, $b] = Concert::factory()->count(2)->create();
        $release = Release::factory()->create();
        $clip->concerts()->attach($a->id, ['position' => 0]);

        $this->putJson("/api/clips/{$clip->id}", [
            'url'    => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'attach' => [['type' => 'release', 'id' => $release->id], ['type' => 'concert', 'id' => $b->id]],
        ])->assertSuccessful()->assertJsonPath('data.id', $clip->id);

        $this->assertDatabaseMissing('clippables', ['clip_id' => $clip->id, 'clippable_type' => 'concert', 'clippable_id' => $a->id]);
        $this->assertDatabaseHas('clippables', ['clip_id' => $clip->id, 'clippable_type' => 'concert', 'clippable_id' => $b->id, 'position' => 1]);
        $this->assertDatabaseHas('clippables', ['clip_id' => $clip->id, 'clippable_type' => 'release', 'clippable_id' => $release->id, 'position' => 0]);
    });

    it('leaves attachments alone when attach is omitted', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create();
        $concert = Concert::factory()->create();
        $clip->concerts()->attach($concert->id, ['position' => 0]);

        $this->putJson("/api/clips/{$clip->id}", ['url' => 'https://vimeo.com/9', 'title' => ['en' => 'Renamed']])->assertSuccessful();

        $this->assertDatabaseHas('clippables', ['clip_id' => $clip->id, 'clippable_id' => $concert->id]);
    });

    it('re-stamps the provider when the url changes', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create(['provider' => 'youtube']);

        $this->putJson("/api/clips/{$clip->id}", ['url' => 'https://www.tiktok.com/@band/video/7234567890123456789'])
            ->assertSuccessful()->assertJsonPath('data.provider', 'tiktok');
    });
});

describe('attach / detach', function () {
    it('attaches and detaches one owner without touching the others', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create();
        [$a, $b] = Concert::factory()->count(2)->create();
        $clip->concerts()->attach($a->id, ['position' => 0]);

        $this->postJson("/api/clips/{$clip->id}/attach", ['type' => 'concert', 'id' => $b->id])->assertSuccessful();
        expect($clip->fresh()->concerts()->count())->toBe(2);

        $this->deleteJson("/api/clips/{$clip->id}/attach", ['type' => 'concert', 'id' => $a->id])->assertSuccessful();
        expect($clip->fresh()->concerts()->pluck('concerts.id')->all())->toBe([$b->id]);
    });

    it('appends at the end of the owner list', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();
        $first = Clip::factory()->create();
        $first->concerts()->attach($concert->id, ['position' => 3]);
        $second = Clip::factory()->create();

        $this->postJson("/api/clips/{$second->id}/attach", ['type' => 'concert', 'id' => $concert->id])->assertSuccessful();

        $this->assertDatabaseHas('clippables', ['clip_id' => $second->id, 'clippable_id' => $concert->id, 'position' => 4]);
    });
});

describe('DELETE /api/clips/{clip}', function () {
    it('deletes the clip and its pivot rows', function () {
        $this->actingAsAdmin();
        $clip = Clip::factory()->create();
        $concert = Concert::factory()->create();
        $clip->concerts()->attach($concert->id, ['position' => 0]);

        $this->deleteJson("/api/clips/{$clip->id}")->assertNoContent();

        $this->assertDatabaseMissing('clips', ['id' => $clip->id]);
        $this->assertDatabaseMissing('clippables', ['clip_id' => $clip->id]);
    });
});
```

Check `SiteDirtyArea`'s column name first: `grep -n "fillable\|area" api/app/Models/SiteDirtyArea.php`. If the column is not `area`, adjust the `pluck`.

- [ ] **Step 2: Run to verify it fails**

`… --filter ClipTest` → FAIL with 404s (routes missing).

- [ ] **Step 3: Resource**

`api/app/Http/Resources/ClipResource.php`:

```php
<?php

namespace App\Http\Resources;

use App\Support\EmbedProvider;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One clip. `owners` is only populated when the four owner relations are
 * loaded — ClipController loads them; owners embedded on a concert response
 * do not need them and get an empty list.
 */
class ClipResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'provider'     => $this->provider,
            'url'          => $this->url,
            'embed_id'     => EmbedProvider::embedId($this->url),
            'title'        => $this->getTranslation('title', app()->getLocale(), true) ?: null,
            'category'     => $this->category,
            'recorded_on'  => $this->recorded_on?->format('Y-m-d'),
            'show_in_epk'  => (bool) $this->show_in_epk,
            'translations' => ['title' => $this->getTranslations('title')],
            'owners'       => $this->relationLoaded('concerts') ? $this->ownersList() : [],
        ];
    }
}
```

`getTranslation($key, $locale, true)` uses Spatie's fallback locale (configured in `config/translatable.php`; check it is `en` — `grep fallback_locale api/config/translatable.php`). If the project resolves fallbacks through `App\Support\Locales::chain()` elsewhere in resources, copy that loop instead (see `PostBlockResource::translated()`).

- [ ] **Step 4: Request**

`api/app/Http/Requests/ClipRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Support\ClipOwners;
use App\Support\EmbedProvider;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ClipRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:admin middleware guards the route
    }

    /** Stamp the detected provider from the URL, as PostRules does for embeds. */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('url'))) {
            $this->merge(['provider' => EmbedProvider::detect($this->input('url'))]);
        }
    }

    public function rules(): array
    {
        $create = $this->isMethod('post');

        return [
            'url'          => [$create ? 'required' : 'sometimes', 'string', 'url', 'max:2048'],
            'provider'     => ['nullable', Rule::in(EmbedProvider::PROVIDERS)],
            'title'        => 'nullable|array',
            'title.en'     => 'nullable|string|max:255',
            'title.pl'     => 'nullable|string|max:255',
            'category'     => 'nullable|string|max:64',
            'recorded_on'  => 'nullable|date_format:Y-m-d',
            'show_in_epk'  => 'nullable|boolean',
            'attach'       => 'sometimes|array',
            'attach.*.type' => ['required', Rule::in(ClipOwners::aliases())],
            'attach.*.id'   => ['required', 'integer', function (string $attribute, mixed $value, \Closure $fail) {
                // $attribute is "attach.3.id" — the sibling type decides the table.
                $index = explode('.', $attribute)[1];
                $type  = $this->input("attach.$index.type");
                if (! is_string($type) || ! array_key_exists($type, ClipOwners::MAP)) {
                    return; // attach.*.type already reports this
                }
                if (! ClipOwners::MAP[$type]::whereKey($value)->exists()) {
                    $fail("The selected {$type} does not exist.");
                }
            }],
        ];
    }
}
```

- [ ] **Step 5: Controller**

`api/app/Http/Controllers/ClipController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\ClipRequest;
use App\Http\Resources\ClipResource;
use App\Models\Clip;
use App\Support\ClipOwners;
use App\Support\SiteRebuild;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClipController extends Controller
{
    private const OWNER_RELATIONS = ['concerts.venue', 'releases', 'shopItems', 'albums'];

    public function index(): AnonymousResourceCollection
    {
        $clips = Clip::with(self::OWNER_RELATIONS)
            ->orderByDesc('recorded_on')
            ->orderByDesc('id')
            ->get();

        return ClipResource::collection($clips);
    }

    public function store(ClipRequest $request): JsonResponse
    {
        $data = $request->validated();

        $clip = DB::transaction(function () use ($data) {
            $clip = Clip::create($this->attributes($data) + ['category' => $data['category'] ?? 'live']);
            if (array_key_exists('attach', $data)) {
                $this->syncOwners($clip, $data['attach']);
            }

            return $clip;
        });

        $this->markDirty($clip);

        return (new ClipResource($clip->load(self::OWNER_RELATIONS)))->response()->setStatusCode(201);
    }

    public function update(ClipRequest $request, Clip $clip): ClipResource
    {
        $data = $request->validated();

        // Areas of owners being *removed* must rebuild too.
        $this->markDirty($clip->load(self::OWNER_RELATIONS));

        DB::transaction(function () use ($clip, $data) {
            $clip->update($this->attributes($data));
            if (array_key_exists('attach', $data)) {
                $this->syncOwners($clip, $data['attach']);
            }
        });

        $clip->unsetRelations();
        $this->markDirty($clip->load(self::OWNER_RELATIONS));

        return new ClipResource($clip);
    }

    public function destroy(Clip $clip): JsonResponse
    {
        $this->markDirty($clip->load(self::OWNER_RELATIONS));
        $clip->delete();

        return response()->json(null, 204);
    }

    public function attach(Request $request, Clip $clip): ClipResource
    {
        ['type' => $type, 'id' => $id] = $this->ownerInput($request);

        $relation = $clip->ownerRelation($type);
        $next = (int) DB::table('clippables')
            ->where('clippable_type', $type)->where('clippable_id', $id)->max('position') + 1;
        $relation->syncWithoutDetaching([$id => ['position' => $next]]);

        SiteRebuild::markDirty(ClipOwners::dirtyArea($type));
        SiteRebuild::markDirty('posts');

        return new ClipResource($clip->load(self::OWNER_RELATIONS));
    }

    public function detach(Request $request, Clip $clip): ClipResource
    {
        ['type' => $type, 'id' => $id] = $this->ownerInput($request);

        $clip->ownerRelation($type)->detach($id);

        SiteRebuild::markDirty(ClipOwners::dirtyArea($type));
        SiteRebuild::markDirty('posts');

        return new ClipResource($clip->load(self::OWNER_RELATIONS));
    }

    /** @return array{type: string, id: int} */
    private function ownerInput(Request $request): array
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(ClipOwners::aliases())],
            'id'   => ['required', 'integer'],
        ]);

        if (! ClipOwners::MAP[$data['type']]::whereKey($data['id'])->exists()) {
            abort(422, "The selected {$data['type']} does not exist.");
        }

        return ['type' => $data['type'], 'id' => (int) $data['id']];
    }

    /** Column attributes from a validated payload — never `attach`. */
    private function attributes(array $data): array
    {
        return array_intersect_key($data, array_flip(['provider', 'url', 'title', 'category', 'recorded_on', 'show_in_epk']));
    }

    /**
     * Replace the clip's owners with `attach`, positions from array index.
     * One sync() per owner type: an omitted type detaches everything of that
     * type, which is what "this is the full list" means.
     *
     * @param array<int, array{type: string, id: int}> $attach
     */
    private function syncOwners(Clip $clip, array $attach): void
    {
        $byType = array_fill_keys(ClipOwners::aliases(), []);
        foreach (array_values($attach) as $i => $row) {
            $byType[$row['type']][(int) $row['id']] = ['position' => $i];
        }
        foreach ($byType as $type => $rows) {
            $clip->ownerRelation($type)->sync($rows);
        }
    }

    /** Every area a clip can appear in: each owner's page, plus posts (ref blocks) and the EPK. */
    private function markDirty(Clip $clip): void
    {
        foreach ($clip->ownersList() as $owner) {
            if ($area = ClipOwners::dirtyArea($owner['type'])) {
                SiteRebuild::markDirty($area);
            }
        }
        SiteRebuild::markDirty('posts');
        if ($clip->show_in_epk || $clip->wasChanged('show_in_epk')) {
            SiteRebuild::markDirty('band-profile');
        }
    }
}
```

- [ ] **Step 6: Routes**

In `api/routes/api.php`, next to the public music-videos GET (line ~130):

```php
Route::get('/clips', [ClipController::class, 'index'])->name('api.clips.index');
```

Inside the `role:admin` group, after the music-videos block:

```php
        // Clips library. Attach/detach are the owner forms' quick paths, so a
        // concert form can add a clip without knowing the clip's other owners.
        Route::post('/clips', [ClipController::class, 'store'])->name('api.clips.store');
        Route::put('/clips/{clip}', [ClipController::class, 'update'])->name('api.clips.update');
        Route::delete('/clips/{clip}', [ClipController::class, 'destroy'])->name('api.clips.destroy');
        Route::post('/clips/{clip}/attach', [ClipController::class, 'attach'])->name('api.clips.attach');
        Route::delete('/clips/{clip}/attach', [ClipController::class, 'detach'])->name('api.clips.detach');
```

Add `use App\Http\Controllers\ClipController;` at the top.

- [ ] **Step 7: Run the test until green**

`… --filter ClipTest` → PASS (13 tests). Then `--filter ClipModelTest` still PASS.

- [ ] **Step 8: Commit**

```bash
git add api/app/Http/Resources/ClipResource.php api/app/Http/Requests/ClipRequest.php api/app/Http/Controllers/ClipController.php api/routes/api.php api/tests/Feature/ClipTest.php
git commit -m "Add the clips API: CRUD plus attach/detach to owners

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Concert responses carry `clips`

**Files:**
- Modify: `api/app/Http/Controllers/ConcertController.php` (every `->load([...])` / `with([...])` list), `api/app/Http/Resources/ConcertResource.php`
- Test: `api/tests/Feature/ConcertTest.php`

**Interfaces:**
- Produces: `GET /api/concerts/{id}` → `data.clips: ClipResource[]` in pivot order. The list endpoint (`GET /api/concerts`) does **not** load clips (the public build calls `getConcert(id)` per page; the list stays light).

- [ ] **Step 1: Failing test**

Append to `api/tests/Feature/ConcertTest.php` inside `describe('GET /api/concerts/{concert}', …)`:

```php
    it('carries the concert clips in pivot order', function () {
        $concert = Concert::factory()->create();
        $a = \App\Models\Clip::factory()->create(['title' => ['en' => 'A']]);
        $b = \App\Models\Clip::factory()->create(['title' => ['en' => 'B']]);
        $concert->clips()->attach([$b->id => ['position' => 0], $a->id => ['position' => 1]]);

        $this->getJson("/api/concerts/{$concert->id}")
            ->assertSuccessful()
            ->assertJsonPath('data.clips.0.title', 'B')
            ->assertJsonPath('data.clips.1.title', 'A')
            ->assertJsonPath('data.clips.0.embed_id', 'dQw4w9WgXcQ');
    });
```

- [ ] **Step 2: Run → FAIL** (`data.clips` missing).

- [ ] **Step 3: Implement**

`ConcertResource.php` — after `'links' => …,`:

```php
            'clips' => ClipResource::collection($this->whenLoaded('clips')),
```

`ConcertController.php` — in `show()`, `store()`, `update()`, `uploadPoster()`, `destroyPoster()` (lines 59, 64, 79, 107, 119) change `->load(['venue', 'bands', 'tags', 'links'])` to `->load(['venue', 'bands', 'tags', 'links', 'clips'])`. Leave `index()`'s `with([...])` alone.

- [ ] **Step 4: Run → PASS**, then `--filter ConcertTest` whole file PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/Http/Controllers/ConcertController.php api/app/Http/Resources/ConcertResource.php api/tests/Feature/ConcertTest.php
git commit -m "Carry a concert's clips on its API response

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `ref` block entity `clip`

**Files:**
- Modify: `api/app/Support/PostBlockType.php`, `api/app/Support/PostBlockResolver.php`
- Test: `api/tests/Feature/PostBlockResolverTest.php`

**Interfaces:**
- Produces: resolved `clip` data `{id, provider, url, embed_id, title, category, concert: {id, slug_en, date, venue: {id, name}} | null}`.

- [ ] **Step 1: Failing tests**

Append to `PostBlockResolverTest.php`:

```php
it('resolves a clip ref with its embed fields and first concert', function () {
    $concert = Concert::factory()->create(['slug_en' => 'clip-gig']);
    $clip    = \App\Models\Clip::factory()->create(['title' => ['en' => 'Encore'], 'category' => 'live']);
    $clip->concerts()->attach($concert->id, ['position' => 0]);
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('clip', $clip->id)->create();

    $data = PostBlockResolver::resolve(collect([$block]))[$block->id];

    expect($data['provider'])->toBe('youtube');
    expect($data['embed_id'])->toBe('dQw4w9WgXcQ');
    expect($data['title'])->toBe('Encore');
    expect($data['category'])->toBe('live');
    expect($data['concert']['slug_en'])->toBe('clip-gig');
    expect($data['concert']['venue']['name'])->toBe($concert->venue->name);
});

it('resolves a clip with no concert to a null concert, not a missing key', function () {
    $clip  = \App\Models\Clip::factory()->create();
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('clip', $clip->id)->create();

    $data = PostBlockResolver::resolve(collect([$block]))[$block->id];

    expect($data)->toHaveKey('concert');
    expect($data['concert'])->toBeNull();
});

it('resolves a deleted clip to null', function () {
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('clip', 999999)->create();

    expect(PostBlockResolver::resolve(collect([$block]))[$block->id])->toBeNull();
});
```

- [ ] **Step 2: Run → FAIL** (unknown entity → null).

- [ ] **Step 3: Implement**

`PostBlockType.php`:

```php
    public const REF_ENTITIES = [
        'concert', 'album', 'release', 'music_video', 'press_release', 'shop_item', 'clip',
    ];
```

`PostBlockResolver.php` — add `use App\Models\Clip;` and `use App\Support\EmbedProvider;`, and a match arm before `default`:

```php
            // A clip renders as its embed plus a "Live at … →" caption, so it
            // carries its first attached concert (or null) inline.
            'clip' => Clip::with('concerts.venue')->whereIn('id', $ids)->get()
                ->keyBy('id')->map(function ($c) {
                    $concert = $c->concerts->first();

                    return [
                        'id'       => $c->id,
                        'provider' => $c->provider,
                        'url'      => $c->url,
                        'embed_id' => EmbedProvider::embedId($c->url),
                        'title'    => $c->getTranslation('title', app()->getLocale(), true) ?: null,
                        'category' => $c->category,
                        'concert'  => $concert ? [
                            'id'      => $concert->id,
                            'slug_en' => $concert->slug_en,
                            'date'    => $concert->date?->format('Y-m-d'),
                            'venue'   => $concert->venue ? ['id' => $concert->venue->id, 'name' => $concert->venue->name] : null,
                        ] : null,
                    ];
                })->all(),
```

- [ ] **Step 4: Run → PASS**; run `--filter Post` to confirm `PostBlockWriteTest` accepts `entity: clip` (validation is `Rule::in(REF_ENTITIES)`, so it does).

- [ ] **Step 5: Commit**

```bash
git add api/app/Support/PostBlockType.php api/app/Support/PostBlockResolver.php api/tests/Feature/PostBlockResolverTest.php
git commit -m "Let a post reference a clip from the library

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Copy registry strings

**Files:**
- Modify: `packages/site-copy/src/modules/site.ts`, `packages/site-copy/src/modules/concerts.ts`
- Test: `packages/site-copy/src/resolve.spec.ts`

**Interfaces:**
- Produces: `SITE_COPY` keys `clipCategoryLive|Studio|Backstage|Interview|Other` (group `Clips`); `CONCERTS_COPY` key `clipsTitle` (group `Show page`).

- [ ] **Step 1: Failing test** — append to `resolve.spec.ts`:

```ts
import { SITE_COPY, CONCERTS_COPY, resolveCopy } from './index'

describe('clip copy', () => {
  it('has a label for every preset category on the site module', () => {
    const t = resolveCopy(SITE_COPY, 'pl')
    expect(t.clipCategoryLive).toBe('Na żywo')
    expect(t.clipCategoryStudio).toBe('Studio')
    expect(t.clipCategoryBackstage).toBe('Za kulisami')
    expect(t.clipCategoryInterview).toBe('Wywiad')
    expect(t.clipCategoryOther).toBe('Inne')
  })
  it('has the concert page clips heading', () => {
    expect(resolveCopy(CONCERTS_COPY, 'en').clipsTitle).toBe('Videos from this show')
  })
})
```

(Adapt the import line to how the existing spec imports; keep one `describe`.)

- [ ] **Step 2: Run** `cd app && pnpm vitest run ../packages/site-copy/src/resolve.spec.ts` → FAIL (TS: property does not exist).

- [ ] **Step 3: Add the fields**

`site.ts` — append to the array, after the 404 group:

```ts
  // ── Clips ── category labels shown wherever a clip renders (concert page,
  // news). A custom category typed in the admin prints as typed.
  {
    key: 'clipCategoryLive', label: '"Live" category', group: 'Clips', maxLength: 30,
    defaults: { en: 'Live', pl: 'Na żywo' },
  },
  {
    key: 'clipCategoryStudio', label: '"Studio" category', group: 'Clips', maxLength: 30,
    defaults: { en: 'Studio', pl: 'Studio' },
  },
  {
    key: 'clipCategoryBackstage', label: '"Backstage" category', group: 'Clips', maxLength: 30,
    defaults: { en: 'Backstage', pl: 'Za kulisami' },
  },
  {
    key: 'clipCategoryInterview', label: '"Interview" category', group: 'Clips', maxLength: 30,
    defaults: { en: 'Interview', pl: 'Wywiad' },
  },
  {
    key: 'clipCategoryOther', label: '"Other" category', group: 'Clips', maxLength: 30,
    defaults: { en: 'Other', pl: 'Inne' },
  },
```

`concerts.ts` — find the group used by `setlistPast` (`grep -n "setlistPast" -B2 -A3`), and add beside it:

```ts
  {
    key: 'clipsTitle', label: 'Clips heading', group: '<same group as setlistPast>', maxLength: 60,
    help: 'Heading of the videos section on a show page. Hidden when the show has no clips.',
    defaults: { en: 'Videos from this show', pl: 'Nagrania z koncertu' },
  },
```

- [ ] **Step 4: Run → PASS. Commit**

```bash
git add packages/site-copy/src/modules/site.ts packages/site-copy/src/modules/concerts.ts packages/site-copy/src/resolve.spec.ts
git commit -m "Add clip category labels and the show-page clips heading to the copy registry

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Public site — types, `ClipsGrid.astro`, concert page section, `RefBlock` clip arm

**Files:**
- Create: `web/src/types/clip.ts`, `web/src/lib/clipCategory.ts`, `web/src/lib/clipCategory.test.ts`, `web/src/components/ClipsGrid.astro`
- Modify: `web/src/types/concert.ts`, `web/src/types/post.ts`, `web/src/lib/cms.ts:118`, `web/src/components/blocks/EmbedBlock.astro`, `web/src/components/detail/ConcertDetail.astro`, `web/src/components/blocks/RefBlock.astro`

**Interfaces:**
- Consumes: `concert.clips` (Task 4), ref `data` shape (Task 5), copy keys (Task 6).
- Produces: `<ClipsGrid clips heading categoryLabel />`, `EmbedLike` type accepted by `EmbedBlock.astro`.

- [ ] **Step 1: Failing unit test for the category label lookup**

`web/src/lib/clipCategory.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { clipCategoryLabel } from './clipCategory'

const site = {
  clipCategoryLive: 'Na żywo', clipCategoryStudio: 'Studio', clipCategoryBackstage: 'Za kulisami',
  clipCategoryInterview: 'Wywiad', clipCategoryOther: 'Inne',
}

describe('clipCategoryLabel', () => {
  it('maps a preset to its copy label', () => {
    expect(clipCategoryLabel('live', site)).toBe('Na żywo')
    expect(clipCategoryLabel('backstage', site)).toBe('Za kulisami')
  })
  it('prints a custom category as typed', () => {
    expect(clipCategoryLabel('charity gig', site)).toBe('charity gig')
  })
})
```

Run `cd web && pnpm test:unit` → FAIL (module not found).

- [ ] **Step 2: Types and lib**

`web/src/types/clip.ts`:

```ts
import type { EmbedProviderName } from './post'

export interface Clip {
  id: number
  provider: EmbedProviderName
  url: string
  /** null when the URL names no single video — render a link, not an iframe. */
  embed_id: string | null
  title: string | null
  category: string
  recorded_on: string | null
  show_in_epk: boolean
}
```

`web/src/types/concert.ts` — add `import type { Clip } from './clip'` and `clips?: Clip[]` to `Concert` after `links?`.

`web/src/types/post.ts`:

```ts
export type RefEntity = 'concert' | 'album' | 'release' | 'music_video' | 'press_release' | 'shop_item' | 'clip'
```

`web/src/lib/clipCategory.ts`:

```ts
/**
 * Preset clip categories map to editable copy on the `site` module; anything
 * else the band typed prints as typed. Mirrors api/app/Support/ClipCategory.
 */
export interface ClipCategoryCopy {
  clipCategoryLive: string
  clipCategoryStudio: string
  clipCategoryBackstage: string
  clipCategoryInterview: string
  clipCategoryOther: string
}

const KEY: Record<string, keyof ClipCategoryCopy> = {
  live: 'clipCategoryLive',
  studio: 'clipCategoryStudio',
  backstage: 'clipCategoryBackstage',
  interview: 'clipCategoryInterview',
  other: 'clipCategoryOther',
}

export function clipCategoryLabel(category: string, copy: ClipCategoryCopy): string {
  const key = KEY[category]
  return key ? copy[key] : category
}
```

`web/src/lib/cms.ts:118`:

```ts
export const getConcert = (id: number, lang: Locale = 'en') =>
  get<Concert>(`/concerts/${id}`, { lang })
```

Run `pnpm test:unit` → PASS.

- [ ] **Step 3: `EmbedBlock.astro` accepts a looser shape**

Replace the import + Props:

```ts
import type { EmbedProviderName } from '@/types/post'

/** The fields an iframe needs — an embed block or a clip, either works. */
export interface EmbedLike {
  provider: EmbedProviderName
  url: string | null
  label: string | null
  embed_id: string | null
}

interface Props { block: EmbedLike }
```

(`EmbedBlock` from `types/post` is structurally an `EmbedLike`, so `PostBlocks.astro` needs no change.)

- [ ] **Step 4: `ClipsGrid.astro`**

```astro
---
import type { Clip } from '@/types/clip'
import type { ClipCategoryCopy } from '@/lib/clipCategory'
import { clipCategoryLabel } from '@/lib/clipCategory'
import EmbedBlock from '@/components/blocks/EmbedBlock.astro'

/**
 * A grid of clips — the same iframe an embed block renders, with a caption.
 * Renders nothing for an empty list: this is a content section, it links
 * nowhere, and an empty heading is worse than no section.
 */
interface Props {
  clips: Clip[]
  heading: string
  copy: ClipCategoryCopy
  /** Section class hook so a host page can space it like its siblings. */
  class?: string
}
const { clips, heading, copy, class: cls = '' } = Astro.props
---

{clips.length > 0 && (
  <section class={`clips-grid ${cls}`} data-testid="clips-grid">
    <h2 class="clips-title">{heading}</h2>
    <ul class="clips-list">
      {clips.map(clip => (
        <li class="clips-item" data-provider={clip.provider}>
          <EmbedBlock block={{ provider: clip.provider, url: clip.url, label: clip.title, embed_id: clip.embed_id }} />
          <div class="clips-caption">
            <span class="clips-cat">{clipCategoryLabel(clip.category, copy)}</span>
            {clip.title && <span class="clips-name">{clip.title}</span>}
            {clip.recorded_on && <time class="clips-date" datetime={clip.recorded_on}>{clip.recorded_on}</time>}
          </div>
        </li>
      ))}
    </ul>
  </section>
)}

<style>
  .clips-title {
    font-family: var(--font-display); font-weight: var(--display-weight);
    font-size: 30px; line-height: 1.02; letter-spacing: var(--display-tracking);
    text-transform: var(--display-transform); margin: 0 0 18px; color: var(--color-ink);
  }
  .clips-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 22px; grid-template-columns: 1fr; }
  @media (min-width: 720px) { .clips-list { grid-template-columns: 1fr 1fr; } }
  .clips-item :global(.pb-embed) { margin-bottom: 10px; }
  .clips-caption { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; font: 500 14px/1.4 var(--font-body); color: var(--color-body); }
  .clips-cat {
    font: 800 11px/1 var(--font-body); letter-spacing: .14em; text-transform: uppercase;
    color: var(--color-accent);
  }
  .clips-date { color: var(--color-muted); font-size: 13px; }
</style>
```

Confirm each token used exists in `web/src/styles/tokens.css` (`grep -c -- "--color-ink\|--color-body\|--color-accent\|--color-muted\|--display-weight\|--display-tracking\|--display-transform" web/src/styles/tokens.css`); substitute the declared names if any differ (e.g. `--color-text-muted`). The token lint in `pnpm build` is the final arbiter.

- [ ] **Step 5: Concert page section**

`ConcertDetail.astro` — change `getConcert(itemId)` to `getConcert(itemId, lang)`; import `ClipsGrid from '@/components/ClipsGrid.astro'`. After the SETLIST section's closing `)}` and before `<!-- ── VENUE & GETTING THERE`:

```astro
    <!-- ── CLIPS ───────────────────────────────────────────── -->
    <ClipsGrid class="sec clips-sec" clips={concert.clips ?? []} heading={t.clipsTitle} copy={site} />
```

`site` is already `siteCopy(siteConfig, lang)` in this file and carries the `clipCategory*` keys (its `ResolvedCopy<typeof SITE_COPY>` type is a superset of `ClipCategoryCopy`).

- [ ] **Step 6: `RefBlock.astro` clip arm**

Add imports:

```ts
import EmbedBlock from './EmbedBlock.astro'
```

Change the label expression to handle clips, and add the branch. Replace the `const label = …` block with:

```ts
const label =
  block.entity === 'concert'  ? (data.venue?.name ?? data.date ?? 'Concert')
: block.entity === 'shop_item' ? data.name
: block.entity === 'album'      ? data.title
: block.entity === 'clip'       ? (data.title ?? '')
: data.title

// A clip's caption links to the show it was filmed at, when it has one.
const clipConcert = block.entity === 'clip' && data.concert
  ? refHref('concert', data.concert, lang, slugMap, modules)
  : null
const clipConcertLabel = block.entity === 'clip' && data.concert
  ? [data.concert.venue?.name, data.concert.date].filter(Boolean).join(' · ')
  : ''
```

Insert as the first branch of the template ternary:

```astro
{block.entity === 'clip' ? (
  <figure class="art-clip">
    <EmbedBlock block={{ provider: data.provider, url: data.url, label: data.title ?? null, embed_id: data.embed_id ?? null }} />
    {(label || clipConcertLabel) && (
      <figcaption class="art-clip-cap">
        {label && <span class="art-clip-title">{label}</span>}
        {clipConcertLabel && (clipConcert ? (
          <a href={clipConcert.href} class="art-clip-show">{clipConcertLabel} →</a>
        ) : (
          <span class="art-clip-show art-clip-show--dead">{clipConcertLabel}</span>
        ))}
      </figcaption>
    )}
  </figure>
) : block.entity === 'press_release' && isFirstPress ? (
```

Styles, appended inside `<style>`:

```css
  .art-clip { margin: 0 0 28px; }
  .art-clip :global(.pb-embed) { margin-bottom: 10px; }
  .art-clip-cap { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline; font: 500 14px/1.4 var(--font-body); color: var(--color-body); }
  .art-clip-title { font-weight: 700; }
  .art-clip-show { color: var(--color-accent); text-decoration: none; font-weight: 700; }
  .art-clip-show:hover { text-decoration: underline; }
  .art-clip-show--dead { color: var(--color-muted); }
```

- [ ] **Step 7: Build against the live API and verify in `dist/`**

```bash
cd /c/Projects/bandms/web && API_BASE=http://localhost:8081 pnpm build
npx tsc --noEmit -p tsconfig.json    # only the two documented pre-existing errors
grep -rl "undefined" dist --include=*.html | head   # must be empty
```

Then seed one clip against the dev stack to see it render (token from `app/e2e/.auth/admin.json` or a fresh login):

```bash
CID=$(curl -s localhost:8081/api/concerts | python -c "import sys,json;print(json.load(sys.stdin)['data'][0]['id'])")
curl -s -X POST localhost:8081/api/clips -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"url\":\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\",\"category\":\"live\",\"attach\":[{\"type\":\"concert\",\"id\":$CID}]}"
API_BASE=http://localhost:8081 pnpm build && grep -l 'clips-grid' dist/en/concerts/*/index.html | head -1
```

Expected: one concert page contains `data-testid="clips-grid"` and `youtube-nocookie.com/embed/dQw4w9WgXcQ`. Delete the seeded clip afterwards (`curl -X DELETE …/api/clips/<id>`), or keep it for the E2E task and delete there.

- [ ] **Step 8: Commit**

```bash
git add web/src/types/clip.ts web/src/types/concert.ts web/src/types/post.ts web/src/lib/cms.ts web/src/lib/clipCategory.ts web/src/lib/clipCategory.test.ts web/src/components/ClipsGrid.astro web/src/components/blocks/EmbedBlock.astro web/src/components/detail/ConcertDetail.astro web/src/components/blocks/RefBlock.astro
git commit -m "Render clips on the concert page and as a news block

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Admin — types, API fetchers, composable, category util, `/admin/clips` screen

**Files:**
- Create: `app/src/types/clip.ts`, `app/src/api/clips.ts`, `app/src/composables/useClips.ts`, `app/src/utils/clipCategories.ts`, `app/src/utils/clipCategories.spec.ts`, `app/src/components/admin/forms/ClipCategoryPicker.vue`, `app/src/components/admin/forms/ClipForm.vue`, `app/src/views/admin/ClipsAdminView.vue`
- Modify: `app/src/components/admin/EntityRelationsPanel.vue`, `app/src/router/index.ts`, `app/src/components/admin/AdminLayout.vue`

**Interfaces:**
- Consumes: Task 3 API.
- Produces: `useClips()` → `{ query, create, update, remove, attach, detach }`; `ClipPayload`; `CLIP_CATEGORY_PRESETS`, `isPresetCategory()`; `<ClipCategoryPicker v-model />`.

- [ ] **Step 1: Category util with spec (failing first)**

`app/src/utils/clipCategories.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CLIP_CATEGORY_PRESETS, isPresetCategory, presetLabel } from './clipCategories'

describe('clipCategories', () => {
  it('lists the five presets in order', () => {
    expect(CLIP_CATEGORY_PRESETS).toEqual(['live', 'studio', 'backstage', 'interview', 'other'])
  })
  it('tells a preset from a custom category', () => {
    expect(isPresetCategory('studio')).toBe(true)
    expect(isPresetCategory('charity gig')).toBe(false)
  })
  it('labels presets for the admin and echoes custom text', () => {
    expect(presetLabel('backstage')).toBe('Backstage')
    expect(presetLabel('charity gig')).toBe('charity gig')
  })
})
```

Run `cd app && pnpm vitest run src/utils/clipCategories.spec.ts` → FAIL.

`app/src/utils/clipCategories.ts`:

```ts
/**
 * Suggested clip categories. Mirrors api/app/Support/ClipCategory::PRESETS —
 * the column is free text, so these drive the chips, not validation.
 * Lives in utils/ so vitest can import it (no composable dependencies).
 */
export const CLIP_CATEGORY_PRESETS = ['live', 'studio', 'backstage', 'interview', 'other'] as const
export type ClipCategoryPreset = (typeof CLIP_CATEGORY_PRESETS)[number]

const LABELS: Record<ClipCategoryPreset, string> = {
  live: 'Live', studio: 'Studio', backstage: 'Backstage', interview: 'Interview', other: 'Other',
}

export function isPresetCategory(value: string): value is ClipCategoryPreset {
  return (CLIP_CATEGORY_PRESETS as readonly string[]).includes(value)
}

/** Admin-facing label; the public site has its own bilingual copy for these. */
export function presetLabel(value: string): string {
  return isPresetCategory(value) ? LABELS[value] : value
}
```

Run → PASS.

- [ ] **Step 2: Types, API, composable**

`app/src/types/clip.ts`:

```ts
import type { EmbedProviderName } from './post'
import type { TranslationMap } from './shared'

export type ClipOwnerType = 'concert' | 'release' | 'shop_item' | 'album'

export interface ClipOwner {
  type: ClipOwnerType
  id: number
  label: string
  slug_en?: string
  date?: string | null
}

export interface Clip {
  id: number
  provider: EmbedProviderName
  url: string
  embed_id: string | null
  /** Resolved for the request locale — display only. */
  title: string | null
  category: string
  recorded_on: string | null
  show_in_epk: boolean
  translations: { title: TranslationMap }
  owners: ClipOwner[]
}

export interface ClipAttach { type: ClipOwnerType; id: number }

export interface ClipPayload {
  url: string
  title?: TranslationMap
  category?: string
  recorded_on?: string | null
  show_in_epk?: boolean
  /** Full owner list — omitted means "leave attachments alone". */
  attach?: ClipAttach[]
}
```

`app/src/api/clips.ts`:

```ts
import type { Clip, ClipAttach, ClipPayload } from '@/types/clip'
import { API_BASE, assertSafeId, authHeaders, handleResponse, jsonHeaders } from './client'

interface ClipListResponse { data: Clip[] }
interface ClipResponse { data: Clip }

export async function fetchClips(): Promise<Clip[]> {
  const res = await fetch(`${API_BASE}/api/clips`, { headers: jsonHeaders })
  return handleResponse<ClipListResponse>(res).then(r => r.data)
}

export async function createClip(token: string, payload: ClipPayload): Promise<Clip> {
  const res = await fetch(`${API_BASE}/api/clips`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(payload) })
  return handleResponse<ClipResponse>(res).then(r => r.data)
}

export async function updateClip(token: string, id: number, payload: ClipPayload): Promise<Clip> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/clips/${id}`, { method: 'PUT', headers: authHeaders(token), body: JSON.stringify(payload) })
  return handleResponse<ClipResponse>(res).then(r => r.data)
}

export async function deleteClip(token: string, id: number): Promise<void> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/clips/${id}`, { method: 'DELETE', headers: authHeaders(token) })
  await handleResponse<void>(res)
}

export async function attachClip(token: string, id: number, owner: ClipAttach): Promise<Clip> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/clips/${id}/attach`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(owner) })
  return handleResponse<ClipResponse>(res).then(r => r.data)
}

export async function detachClip(token: string, id: number, owner: ClipAttach): Promise<Clip> {
  assertSafeId(id)
  const res = await fetch(`${API_BASE}/api/clips/${id}/attach`, { method: 'DELETE', headers: authHeaders(token), body: JSON.stringify(owner) })
  return handleResponse<ClipResponse>(res).then(r => r.data)
}
```

Check `handleResponse` handles a 204 (`grep -n "204\|status" app/src/api/client.ts`); if it tries to parse JSON on 204, use the pattern `deleteTag` uses in `app/src/api/tags.ts`.

`app/src/composables/useClips.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { attachClip, createClip, deleteClip, detachClip, fetchClips, updateClip } from '@/api/clips'
import type { Clip, ClipAttach, ClipPayload } from '@/types/clip'
import { useAuth } from './useAuth'

export const CLIPS_QKEY = ['clips'] as const

export function useClips() {
  const { token } = useAuth()
  const qc = useQueryClient()

  const query = useQuery<Clip[]>({ queryKey: CLIPS_QKEY, queryFn: fetchClips })

  // A clip change also changes every owner that carries it — the concert
  // editor reads clips off the concert response, so invalidate those too.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: CLIPS_QKEY })
    qc.invalidateQueries({ queryKey: ['concerts'] })
  }

  const create = useMutation({
    mutationFn: (payload: ClipPayload) => createClip(token.value!, payload),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ClipPayload }) => updateClip(token.value!, id, payload),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteClip(token.value!, id),
    onSuccess: invalidate,
  })
  const attach = useMutation({
    mutationFn: ({ id, owner }: { id: number; owner: ClipAttach }) => attachClip(token.value!, id, owner),
    onSuccess: invalidate,
  })
  const detach = useMutation({
    mutationFn: ({ id, owner }: { id: number; owner: ClipAttach }) => detachClip(token.value!, id, owner),
    onSuccess: invalidate,
  })

  return { query, create, update, remove, attach, detach }
}
```

- [ ] **Step 3: `ClipCategoryPicker.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { CLIP_CATEGORY_PRESETS, isPresetCategory, presetLabel } from '@/utils/clipCategories'

/**
 * Five preset chips plus a free-text input. A chip fills the input; typing
 * something that is not a preset clears the active chip. One value either way.
 */
const model = defineModel<string>({ default: 'live' })

const custom = computed(() => (isPresetCategory(model.value) ? '' : model.value))
</script>

<template>
  <div class="cat-picker">
    <div class="link-presets">
      <button v-for="p in CLIP_CATEGORY_PRESETS" :key="p" type="button" class="preset-chip"
              :class="{ active: model === p }" @click="model = p">{{ presetLabel(p) }}</button>
    </div>
    <input :value="custom" class="field-input" placeholder="…or type your own category"
           maxlength="64" data-testid="clip-category-custom"
           @input="model = ($event.target as HTMLInputElement).value.trim() || 'live'" />
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.cat-picker { display: flex; flex-direction: column; gap: 0.5rem; }
.link-presets { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.preset-chip {
  padding: 0.2rem 0.625rem; border-radius: 999px; border: 1px solid #2a2a2a;
  background: #141414; color: #94a3b8; font-size: 0.75rem; cursor: pointer;
  transition: border-color 100ms, color 100ms, background 100ms;
}
.preset-chip:hover, .preset-chip.active { border-color: #888888; color: #d0d0d0; background: #1a1a1a; }
</style>
```

- [ ] **Step 4: `EntityRelationsPanel.vue` gains `shopItems`**

Add `import type { ShopItemSummary } from '@/types/shop'`, prop `shopItems?: ShopItemSummary[]`, model `const shopItemIds = defineModel<number[]>('shopItemIds', { default: () => [] })`, `shopItems: false` in `expanded`, and a section after `releases` mirroring its markup:

```vue
    <div v-if="shopItems?.length" class="assoc-section">
      <button type="button" class="assoc-toggle" @click="expanded.shopItems = !expanded.shopItems">
        <span>{{ label('Shop items', shopItemIds.length) }}</span>
        <span class="assoc-chevron" :class="{ 'assoc-chevron--open': expanded.shopItems }">›</span>
      </button>
      <div v-if="expanded.shopItems" class="assoc-body checkbox-list">
        <label v-for="s in shopItems" :key="s.id" class="checkbox-item">
          <input type="checkbox" :checked="shopItemIds.includes(s.id)" @change="toggle(shopItemIds, v => shopItemIds = v, s.id)" />
          <span>{{ s.name }}</span>
        </label>
      </div>
    </div>
```

- [ ] **Step 5: `ClipForm.vue`**

```vue
<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import EmbedBlockEditor from '@/components/admin/forms/blocks/EmbedBlockEditor.vue'
import ClipCategoryPicker from '@/components/admin/forms/ClipCategoryPicker.vue'
import EntityRelationsPanel from '@/components/admin/EntityRelationsPanel.vue'
import { LOCALES, DEFAULT_LOCALE, emptyBag } from '@/locales'
import type { Clip, ClipAttach, ClipPayload } from '@/types/clip'
import type { Concert } from '@/types/concert'
import type { ReleaseSummary } from '@/types/release'
import type { ShopItemSummary } from '@/types/shop'

const props = defineProps<{
  initial?: Clip | null
  concerts: Concert[]
  releases: ReleaseSummary[]
  shopItems: ShopItemSummary[]
  loading?: boolean
  errors?: Record<string, string[]>
}>()

const emit = defineEmits<{ submit: [ClipPayload]; cancel: [] }>()

const form = reactive({
  url: '',
  title: emptyBag(),
  category: 'live',
  recorded_on: '',
  show_in_epk: false,
  concertIds: [] as number[],
  releaseIds: [] as number[],
  shopItemIds: [] as number[],
})

watch(() => props.initial, (val) => {
  form.url = val?.url ?? ''
  for (const l of LOCALES) form.title[l] = val?.translations?.title?.[l] ?? ''
  form.category = val?.category ?? 'live'
  form.recorded_on = val?.recorded_on ?? ''
  form.show_in_epk = val?.show_in_epk ?? false
  form.concertIds  = val?.owners.filter(o => o.type === 'concert').map(o => o.id) ?? []
  form.releaseIds  = val?.owners.filter(o => o.type === 'release').map(o => o.id) ?? []
  form.shopItemIds = val?.owners.filter(o => o.type === 'shop_item').map(o => o.id) ?? []
}, { immediate: true })

// EmbedBlockEditor speaks payload objects; only `url` matters here — the clip
// has its own title, so the editor's link-label inputs are hidden via a prop.
const embedPayload = computed(() => ({ url: form.url }))

function submit() {
  const attach: ClipAttach[] = [
    ...form.concertIds.map(id => ({ type: 'concert' as const, id })),
    ...form.releaseIds.map(id => ({ type: 'release' as const, id })),
    ...form.shopItemIds.map(id => ({ type: 'shop_item' as const, id })),
  ]
  emit('submit', {
    url: form.url.trim(),
    title: Object.fromEntries(LOCALES.map(l => [l, form.title[l].trim() || null])),
    category: form.category,
    recorded_on: form.recorded_on || null,
    show_in_epk: form.show_in_epk,
    attach,
  })
}
</script>

<template>
  <form @submit.prevent="submit" class="flex flex-col gap-4" data-testid="clip-form">
    <div>
      <label class="field-label">Video URL <span style="color:#f87171;">*</span></label>
      <EmbedBlockEditor :payload="embedPayload" hide-label @update:payload="form.url = String($event.url ?? '')" />
      <p v-if="errors?.url" class="field-error">{{ errors.url[0] }}</p>
    </div>

    <div>
      <label class="field-label">Title</label>
      <div class="trans-group">
        <div v-for="l in LOCALES" :key="l" class="trans-row">
          <span class="lang-badge" :class="{ 'lang-badge--pl': l !== DEFAULT_LOCALE }">{{ l.toUpperCase() }}</span>
          <input v-model="form.title[l]" class="field-input flex-1" :placeholder="l === DEFAULT_LOCALE ? 'Clip title' : 'Tytuł klipu'" :data-testid="`clip-title-${l}`" />
        </div>
      </div>
    </div>

    <div>
      <label class="field-label">Category</label>
      <ClipCategoryPicker v-model="form.category" />
      <p v-if="errors?.category" class="field-error">{{ errors.category[0] }}</p>
    </div>

    <div class="flex gap-4 items-end">
      <div>
        <label class="field-label">Recorded on</label>
        <input v-model="form.recorded_on" type="date" class="field-input" />
      </div>
      <label class="flex items-center gap-2 pb-2" style="color:#d0d0d0; font-size:0.85rem;">
        <input v-model="form.show_in_epk" type="checkbox" /> Show in EPK
      </label>
    </div>

    <EntityRelationsPanel
      :concerts="concerts" :releases="releases" :shop-items="shopItems"
      v-model:concert-ids="form.concertIds" v-model:release-ids="form.releaseIds" v-model:shop-item-ids="form.shopItemIds"
    />

    <div class="flex gap-2 justify-end pt-1">
      <button type="button" @click="$emit('cancel')" class="btn-ghost">Cancel</button>
      <button type="submit" :disabled="loading" class="btn-primary">
        {{ loading ? 'Saving…' : (initial ? 'Update' : 'Create') }}
      </button>
    </div>
  </form>
</template>

<style scoped src="../form-styles.css" />
```

`EmbedBlockEditor.vue` needs the `hideLabel` prop: change `defineProps<{ payload: Record<string, unknown> }>()` to `defineProps<{ payload: Record<string, unknown>; hideLabel?: boolean }>()` and the label group's condition to `v-if="detected === 'link' && !hideLabel"`.

- [ ] **Step 6: `ClipsAdminView.vue`**

Copy `TagsAdminView.vue`'s structure with these substitutions:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import AdminLayout from '@/components/admin/AdminLayout.vue'
import AdminModal from '@/components/admin/AdminModal.vue'
import ConfirmDialog from '@/components/admin/ConfirmDialog.vue'
import ClipForm from '@/components/admin/forms/ClipForm.vue'
import TableToolbar from '@/components/admin/TableToolbar.vue'
import SortHeader from '@/components/admin/SortHeader.vue'
import Pagination from '@/components/admin/Pagination.vue'
import { useClips } from '@/composables/useClips'
import { useConcerts } from '@/composables/useConcerts'
import { useReleases } from '@/composables/useReleases'
import { useShop } from '@/composables/useShop'
import { useTableControls } from '@/composables/useTableControls'
import { providerLabel } from '@/utils/postBlocks'
import { presetLabel } from '@/utils/clipCategories'
import { reportSaveError } from '@/utils/formErrors'
import type { Clip, ClipPayload } from '@/types/clip'

const { query, create, update, remove } = useClips()
const { query: concertsQ } = useConcerts()
const { query: releasesQ } = useReleases()
const { query: shopQ }     = useShop()

const showModal = ref(false)
const editing = ref<Clip | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const confirmId = ref<number | null>(null)

const tc = useTableControls<Clip>({
  data: query.data,
  searchFn: (c, q) => (c.title ?? '').toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.url.toLowerCase().includes(q),
  defaultSort: 'recorded_on',
  defaultDir: 'desc',
})

function openCreate() { editing.value = null; fieldErrors.value = {}; showModal.value = true }
function openEdit(c: Clip) { editing.value = c; fieldErrors.value = {}; showModal.value = true }
function closeModal() { showModal.value = false }

async function handleSubmit(payload: ClipPayload) {
  fieldErrors.value = {}
  try {
    if (editing.value) { await update.mutateAsync({ id: editing.value.id, payload }); toast.success('Clip updated') }
    else { await create.mutateAsync(payload); toast.success('Clip created') }
    closeModal()
  } catch (e) { reportSaveError(e, 'Something went wrong', fieldErrors) }
}

async function confirmDelete() {
  if (confirmId.value == null) return
  try { await remove.mutateAsync(confirmId.value); toast.success('Clip deleted'); confirmId.value = null }
  catch (e) { reportSaveError(e, 'Failed to delete') }
}
</script>
```

Check `useTableControls`' option names (`grep -n "defaultDir\|defaultSort" app/src/composables/useTableControls.ts`); drop `defaultDir` if it does not exist. Template: heading `Clips`, button `+ Add clip`, empty state `No clips yet.`, columns **Title** (`clip.title ?? clip.url`), **Category** (`presetLabel(clip.category)`), **Provider** (`providerLabel(clip.provider)`), **Attached to** (`clip.owners.length`), **Recorded** (`clip.recorded_on ?? '—'`), Actions (Edit / Delete). Modal title `editing ? 'Edit clip' : 'New clip'`, `maxWidth="48rem"`, form props `:concerts="concertsQ.data.value ?? []" :releases="releasesQ.data.value ?? []" :shop-items="shopQ.data.value ?? []"`.

- [ ] **Step 7: Route and nav**

`app/src/router/index.ts` — after the `admin-music-videos` route:

```ts
    {
      path: adminUrl('clips'),
      name: 'admin-clips',
      component: () => import('@/views/admin/ClipsAdminView.vue'),
      meta: { requiresAuth: true },
    },
```

`AdminLayout.vue` — add `adminUrl('clips')` to the nav-group list on line ~21 beside `adminUrl('music-videos')`, and after the Music Videos `RouterLink`:

```vue
              <RouterLink :to="adminUrl('clips')" class="nav-item" active-class="nav-item--active">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>
                Clips
              </RouterLink>
```

- [ ] **Step 8: Type-check, run unit suite, smoke in the browser, commit**

```bash
cd /c/Projects/bandms/app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build && pnpm vitest run
```

Rebuild the frontend image so `localhost:8081/admin/clips` serves it: `cd /c/Projects/bandms && docker compose build frontend && docker compose up -d frontend`. Open `/admin/clips`, create a clip with a custom category and a concert attached, edit, delete.

```bash
git add app/src/types/clip.ts app/src/api/clips.ts app/src/composables/useClips.ts app/src/utils/clipCategories.ts app/src/utils/clipCategories.spec.ts app/src/components/admin/forms/ClipCategoryPicker.vue app/src/components/admin/forms/ClipForm.vue app/src/components/admin/forms/blocks/EmbedBlockEditor.vue app/src/views/admin/ClipsAdminView.vue app/src/components/admin/EntityRelationsPanel.vue app/src/router/index.ts app/src/components/admin/AdminLayout.vue
git commit -m "Add the Clips admin screen

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `AttachedClipsField.vue` on the concert form

**Files:**
- Create: `app/src/components/admin/forms/AttachedClipsField.vue`
- Modify: `app/src/components/admin/forms/ConcertForm.vue`, `app/src/types/concert.ts`

**Interfaces:**
- Consumes: `useClips().create/detach`, `Concert.clips`.
- Produces: `<AttachedClipsField owner-type="concert" :owner-id :clips />`.

- [ ] **Step 1: Concert type**

`app/src/types/concert.ts` — add `import type { Clip } from './clip'` and `clips?: Clip[]` on `Concert`.

- [ ] **Step 2: Component**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import ClipCategoryPicker from '@/components/admin/forms/ClipCategoryPicker.vue'
import { useClips } from '@/composables/useClips'
import { detectProvider, providerLabel } from '@/utils/postBlocks'
import { presetLabel } from '@/utils/clipCategories'
import { reportSaveError } from '@/utils/formErrors'
import type { Clip, ClipOwnerType } from '@/types/clip'

/**
 * The owner side of the clips library: what is attached to this record, a
 * quick-add that creates a clip already attached, and detach. Saves happen
 * immediately through the clips API rather than with the host form, because a
 * clip has a stable id other records (post blocks) may already point at.
 */
const props = defineProps<{
  ownerType: ClipOwnerType
  /** null on a create form — the owner has no id to attach to yet. */
  ownerId: number | null
  clips: Clip[]
}>()

const { create, detach } = useClips()

const url = ref('')
const category = ref('live')

async function add() {
  if (!props.ownerId || !url.value.trim()) return
  try {
    await create.mutateAsync({ url: url.value.trim(), category: category.value, attach: [{ type: props.ownerType, id: props.ownerId }] })
    url.value = ''
    toast.success('Clip added')
  } catch (e) { reportSaveError(e, 'Failed to add clip') }
}

async function remove(clip: Clip) {
  if (!props.ownerId) return
  try {
    await detach.mutateAsync({ id: clip.id, owner: { type: props.ownerType, id: props.ownerId } })
    toast.success('Clip detached')
  } catch (e) { reportSaveError(e, 'Failed to detach clip') }
}
</script>

<template>
  <div data-testid="attached-clips">
    <label class="field-label">Clips</label>

    <p v-if="!ownerId" class="text-xs" style="color:#475569;">Save first to add clips.</p>
    <template v-else>
      <div v-if="clips.length" class="links-list">
        <div v-for="clip in clips" :key="clip.id" class="link-row" data-testid="attached-clip">
          <span class="link-label">{{ presetLabel(clip.category) }} · {{ providerLabel(clip.provider) }}</span>
          <a :href="clip.url" target="_blank" rel="noopener" class="link-url">{{ clip.title ?? clip.url }}</a>
          <button type="button" class="remove-btn" :disabled="detach.isPending.value" @click="remove(clip)" title="Detach clip">×</button>
        </div>
      </div>

      <ClipCategoryPicker v-model="category" />
      <div class="link-add-row mt-2">
        <input v-model="url" type="url" class="field-input link-url-input" placeholder="Paste a video URL…"
               data-testid="attached-clip-url" @keydown.enter.prevent="add" />
        <span v-if="url" class="provider-badge">{{ providerLabel(detectProvider(url)) }}</span>
        <button type="button" class="btn-add-link" :disabled="create.isPending.value || !url.trim()" @click="add">Add clip</button>
      </div>
    </template>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.links-list { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.5rem; }
.link-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; border-radius: 0.375rem; background: #141414; border: 1px solid #252525; font-size: 0.8125rem; }
.link-label { flex-shrink: 0; min-width: 7rem; color: #d0d0d0; font-weight: 500; }
.link-url { flex: 1; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; font-size: 0.75rem; }
.link-add-row { display: flex; gap: 0.5rem; align-items: center; }
.link-url-input { flex: 1; }
.btn-add-link { flex-shrink: 0; padding: 0.4rem 0.875rem; border-radius: 0.375rem; border: 1px solid #555555; background: #2a2a2a; color: #d0d0d0; font-size: 0.8125rem; cursor: pointer; }
.btn-add-link:disabled { opacity: .5; cursor: default; }
.provider-badge { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.25rem 0.5rem; border-radius: 0.25rem; flex-shrink: 0; background: #1e3a5f; color: #60a5fa; text-transform: uppercase; }
</style>
```

Check that `.remove-btn` exists in `form-styles.css` (`grep -n "remove-btn" app/src/components/admin/form-styles.css`); if it is local to `ConcertForm.vue`, copy its rule into this component's scoped style.

- [ ] **Step 3: Mount it in `ConcertForm.vue`**

Import `AttachedClipsField from '@/components/admin/forms/AttachedClipsField.vue'` and, directly after the `<!-- Links -->` `<div>…</div>` block (before `<!-- Concert poster -->`):

```vue
    <!-- Clips (saved immediately via the clips API, not with this form) -->
    <AttachedClipsField owner-type="concert" :owner-id="initial?.id ?? null" :clips="initial?.clips ?? []" />
```

The `useClips` invalidation of `['concerts']` refreshes `initial` through `ConcertsAdminView`'s query, so the list updates after add/detach without closing the modal — verify `editing` is derived from the query's data rather than a snapshot (`grep -n "editing" app/src/views/admin/ConcertsAdminView.vue`). If `editing` is a copied object, change `openEdit` to store the id and derive `editing` with `computed(() => query.data.value?.find(c => c.id === editingId.value) ?? null)`.

- [ ] **Step 4: Type-check, smoke, commit**

```bash
cd /c/Projects/bandms/app && pnpm build && cd .. && docker compose build frontend && docker compose up -d frontend
```
Open a concert in `/admin/concerts`, add a clip via the field, see it appear in the list and in `/admin/clips` with the concert as owner; detach.

```bash
git add app/src/components/admin/forms/AttachedClipsField.vue app/src/components/admin/forms/ConcertForm.vue app/src/types/concert.ts
git commit -m "Quick-add and detach clips from the concert form

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `RefBlockEditor` — the Clip entity, pick or add new

**Files:**
- Modify: `app/src/components/admin/forms/blocks/RefBlockEditor.vue`, `app/src/components/admin/forms/PostForm.vue`, `app/src/views/admin/PostsAdminView.vue`, `app/src/types/post.ts`

**Interfaces:**
- Consumes: `useClips().query/create`, `RefEntityLists.concert`.
- Produces: `RefEntityLists.clip: { id, label }[]`; ref payload `{ entity: 'clip', id }`.

- [ ] **Step 1: Types and lists**

`app/src/types/post.ts`:

```ts
export type RefEntity = 'concert' | 'album' | 'release' | 'music_video' | 'press_release' | 'shop_item' | 'clip'
```

`RefBlockEditor.vue` — `RefEntityLists` gains `clip: { id: number; label: string }[]`; `ENTITY_LABELS` gains `clip: 'Clip'`.

`PostForm.vue` — prop `clips: Clip[]` (import `type { Clip } from '@/types/clip'`), and in `entityLists`:

```ts
  clip: props.clips.map(c => ({
    id: c.id,
    label: [c.title ?? c.url, c.category, c.owners[0]?.label].filter(Boolean).join(' · '),
  })),
```

`PostsAdminView.vue` — `import { useClips } from '@/composables/useClips'`, `const { query: clipsQ } = useClips()`, and pass `:clips="clipsQ.data.value ?? []"` to `<PostForm>`.

- [ ] **Step 2: The add-new mode in `RefBlockEditor.vue`**

Add to the script:

```ts
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useClips } from '@/composables/useClips'
import ClipCategoryPicker from '@/components/admin/forms/ClipCategoryPicker.vue'
import { detectProvider, providerLabel } from '@/utils/postBlocks'
import { reportSaveError } from '@/utils/formErrors'

// "Add a new clip…" creates the clip in the library first (POST /api/clips),
// then points this block at it. The clip stays in the library even if the
// post is never saved — it was explicitly created, and the library is the
// source of truth.
const { create: createClip } = useClips()
const addingClip = ref(false)
const newClipUrl = ref('')
const newClipCategory = ref('live')
const newClipConcert = ref<number | ''>('')

async function attachNewClip() {
  const url = newClipUrl.value.trim()
  if (!url) return
  try {
    const clip = await createClip.mutateAsync({
      url, category: newClipCategory.value,
      attach: newClipConcert.value ? [{ type: 'concert', id: Number(newClipConcert.value) }] : [],
    })
    emit('update:payload', { ...props.payload, entity: 'clip', id: clip.id })
    addingClip.value = false
    newClipUrl.value = ''
    toast.success('Clip added to the library')
  } catch (e) { reportSaveError(e, 'Failed to add clip') }
}

function onClipSelect(value: string) {
  if (value === '__new__') { addingClip.value = true; return }
  addingClip.value = false
  emit('update:payload', { ...props.payload, id: Number(value) || 0 })
}
```

Template — wrap the existing two selects so the item select is replaced for clips:

```vue
<template>
  <div class="flex flex-col gap-2">
    <div class="flex gap-2">
      <select :value="entity" @change="setEntity(($event.target as HTMLSelectElement).value as RefEntity)"
              class="field-input" style="width:11rem; flex-shrink:0;">
        <option v-for="(label, key) in ENTITY_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>

      <select v-if="entity !== 'clip'" :value="(payload.id as number) ? String(payload.id) : ''"
              @change="emit('update:payload', { ...payload, id: Number(($event.target as HTMLSelectElement).value) || 0 })"
              class="field-input flex-1" required>
        <option value="" disabled>Choose an item…</option>
        <option v-for="i in items" :key="i.id" :value="i.id">{{ i.label }}</option>
      </select>

      <select v-else :value="addingClip ? '__new__' : ((payload.id as number) ? String(payload.id) : '')"
              @change="onClipSelect(($event.target as HTMLSelectElement).value)"
              class="field-input flex-1" :required="!addingClip" data-testid="clip-select">
        <option value="" disabled>Choose a clip…</option>
        <option value="__new__">＋ Add a new clip…</option>
        <option v-for="i in items" :key="i.id" :value="i.id">{{ i.label }}</option>
      </select>
    </div>

    <div v-if="entity === 'clip' && addingClip" class="new-clip" data-testid="new-clip">
      <div class="flex items-center gap-2">
        <input v-model="newClipUrl" type="url" class="field-input flex-1" placeholder="Paste a video URL…" data-testid="new-clip-url" />
        <span v-if="newClipUrl" class="provider-badge">{{ providerLabel(detectProvider(newClipUrl)) }}</span>
      </div>
      <ClipCategoryPicker v-model="newClipCategory" />
      <div class="flex gap-2 items-center">
        <select v-model="newClipConcert" class="field-input flex-1" data-testid="new-clip-concert">
          <option value="">No concert</option>
          <option v-for="c in entities.concert" :key="c.id" :value="c.id">{{ c.label }}</option>
        </select>
        <button type="button" class="btn-add" :disabled="createClip.isPending.value || !newClipUrl.trim()" @click="attachNewClip">Attach</button>
      </div>
    </div>
  </div>
</template>
```

Keep the existing placeholder-option comment above the non-clip select. Scoped style additions:

```css
.new-clip { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.6rem; border: 1px dashed #3f3f46; border-radius: 0.5rem; }
.provider-badge { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em; padding: 0.25rem 0.5rem; border-radius: 0.25rem; flex-shrink: 0; background: #1e3a5f; color: #60a5fa; text-transform: uppercase; }
```

`.btn-add` is used by `PostBlockEditor` — confirm it lives in `form-styles.css`; otherwise reuse `.btn-add-link` styling from Task 9.

Note: the `required` attribute is dropped while `addingClip` is true so the *Attach* button can be clicked without the browser demanding a selection; once attached, `payload.id` is set and the select shows it.

- [ ] **Step 3: Type-check, smoke, commit**

```bash
cd /c/Projects/bandms/app && pnpm build && cd .. && docker compose build frontend && docker compose up -d frontend
```
In `/admin/posts` edit a post → `+ Reference` → *Clip* → *Add a new clip…* → URL + concert → *Attach* → the select now shows the new clip; save the post; the clip appears in `/admin/clips` and on the concert.

```bash
git add app/src/components/admin/forms/blocks/RefBlockEditor.vue app/src/components/admin/forms/PostForm.vue app/src/views/admin/PostsAdminView.vue app/src/types/post.ts
git commit -m "Reference a clip from a post block, or create one on the spot

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Admin E2E specs

**Files:**
- Create: `app/e2e/tests/admin/clips.spec.ts`, `app/e2e/tests/admin/post-clip-block.spec.ts`

- [ ] **Step 1: `clips.spec.ts`**

```ts
import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.use({ storageState: 'e2e/.auth/admin.json' })

const API = process.env.E2E_API_URL ?? 'http://localhost:8081'
const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const TITLE = `E2E clip ${STAMP}`
const EDITED = `${TITLE} edited`

function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json')
  return entry.value
}

async function api(request: APIRequestContext, method: 'get' | 'post' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}`)
  return res
}

test.describe.serial('Clips admin', () => {
  let concertId: number
  let createdClipId: number | null = null

  test.beforeAll(async ({ request }) => {
    const concerts = (await (await api(request, 'get', '/api/concerts')).json()).data as { id: number }[]
    test.skip(concerts.length === 0, 'No concert to attach to')
    concertId = concerts[0].id
  })

  test.afterAll(async ({ request }) => {
    // Find anything this run created by title, in case a step failed midway.
    const clips = (await (await api(request, 'get', '/api/clips')).json()).data as { id: number; title: string | null }[]
    for (const c of clips.filter(c => c.title?.startsWith(TITLE))) await api(request, 'delete', `/api/clips/${c.id}`)
  })

  test('creates a clip with a custom category and a concert owner', async ({ page }) => {
    await page.goto('/admin/clips')
    await page.getByRole('button', { name: '+ Add clip' }).click()
    const form = page.getByTestId('clip-form')

    await form.locator('input').first().fill('https://vimeo.com/76979871')
    await expect(form.locator('.provider-badge')).toHaveText('Vimeo')
    await form.getByTestId('clip-title-en').fill(TITLE)
    await form.getByTestId('clip-category-custom').fill('charity gig')

    await form.getByRole('button', { name: /Concerts/ }).click()
    await form.locator('.checkbox-item').first().locator('input').check()

    await form.getByRole('button', { name: 'Create' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Clip created', { timeout: 8000 })

    const row = page.locator('tbody tr', { hasText: TITLE })
    await expect(row).toBeVisible()
    await expect(row).toContainText('charity gig')
    await expect(row).toContainText('Vimeo')
  })

  test('edits the title and switches to a preset category', async ({ page }) => {
    await page.goto('/admin/clips')
    await page.locator('tbody tr', { hasText: TITLE }).getByRole('button', { name: 'Edit' }).click()
    const form = page.getByTestId('clip-form')

    await form.getByTestId('clip-title-en').fill(EDITED)
    await form.getByRole('button', { name: 'Backstage', exact: true }).click()
    await form.getByRole('button', { name: 'Update' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Clip updated', { timeout: 8000 })

    const row = page.locator('tbody tr', { hasText: EDITED })
    await expect(row).toContainText('Backstage')
  })

  test('the concert form lists the clip and can detach it', async ({ page, request }) => {
    const clips = (await (await api(request, 'get', '/api/clips')).json()).data as { id: number; title: string | null }[]
    createdClipId = clips.find(c => c.title === EDITED)?.id ?? null
    expect(createdClipId).not.toBeNull()

    await page.goto('/admin/concerts')
    const concert = (await (await api(request, 'get', `/api/concerts/${concertId}`)).json()).data as { date: string }
    await page.locator('tbody tr', { hasText: concert.date }).first().getByRole('button', { name: 'Edit' }).click()

    const field = page.getByTestId('attached-clips')
    await expect(field.getByTestId('attached-clip', { hasText: EDITED })).toBeVisible()
    await field.getByTestId('attached-clip', { hasText: EDITED }).getByTitle('Detach clip').click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Clip detached', { timeout: 8000 })
    await expect(field.getByTestId('attached-clip', { hasText: EDITED })).toHaveCount(0)
  })

  test('quick-adds a clip from the concert form', async ({ page, request }) => {
    await page.goto('/admin/concerts')
    const concert = (await (await api(request, 'get', `/api/concerts/${concertId}`)).json()).data as { date: string }
    await page.locator('tbody tr', { hasText: concert.date }).first().getByRole('button', { name: 'Edit' }).click()

    const field = page.getByTestId('attached-clips')
    await field.getByTestId('attached-clip-url').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await field.getByRole('button', { name: 'Add clip' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Clip added', { timeout: 8000 })
    await expect(field.getByTestId('attached-clip', { hasText: 'YouTube' })).toBeVisible()

    // Tidy: the quick-added clip has no title, so find it by owner + url.
    const clips = (await (await api(request, 'get', '/api/clips')).json()).data as { id: number; url: string; owners: { type: string; id: number }[] }[]
    for (const c of clips.filter(c => c.url.includes('dQw4w9WgXcQ') && c.owners.some(o => o.type === 'concert' && o.id === concertId))) {
      await api(request, 'delete', `/api/clips/${c.id}`)
    }
  })

  test('deletes the clip', async ({ page }) => {
    await page.goto('/admin/clips')
    await page.locator('tbody tr', { hasText: EDITED }).getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('button', { name: /confirm|delete/i }).last().click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Clip deleted', { timeout: 8000 })
    await expect(page.locator('tbody tr', { hasText: EDITED })).toHaveCount(0)
  })
})
```

Check how `ConfirmDialog` names its confirm button (`grep -n "button" app/src/components/admin/ConfirmDialog.vue`) and how `concerts.spec.ts` locates a row to edit; adjust the two selectors accordingly. The chip button in the edit test is the `ClipCategoryPicker`'s `Backstage` chip — `exact: true` keeps it from matching the panel's "Concerts (1)" toggle.

- [ ] **Step 2: `post-clip-block.spec.ts`**

```ts
import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'

test.use({ storageState: 'e2e/.auth/admin.json' })

const API = process.env.E2E_API_URL ?? 'http://localhost:8081'
const TITLE = `E2E clip-block ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const CLIP_URL = 'https://www.tiktok.com/@band/video/7234567890123456789'

function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json')
  return entry.value
}
async function api(request: APIRequestContext, method: 'get' | 'post' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' }, ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}`)
  return res
}

test.describe.serial('Post block — clip', () => {
  let postId: number

  test.beforeAll(async ({ request }) => {
    const res = await api(request, 'post', '/api/posts', { title: { en: TITLE }, blocks: [] })
    postId = (await res.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    if (postId) await api(request, 'delete', `/api/posts/${postId}`)
    const clips = (await (await api(request, 'get', '/api/clips')).json()).data as { id: number; url: string }[]
    for (const c of clips.filter(c => c.url === CLIP_URL)) await api(request, 'delete', `/api/clips/${c.id}`)
  })

  test('adds a new clip from the block editor and saves the reference', async ({ page, request }) => {
    await page.goto('/admin/posts')
    await page.locator('input[aria-label="Search"]').fill(TITLE)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    await page.getByRole('button', { name: '+ Reference' }).click()
    const block = page.locator('.block-row').last()
    await block.locator('select').first().selectOption('clip')
    await block.getByTestId('clip-select').selectOption('__new__')

    const panel = block.getByTestId('new-clip')
    await panel.getByTestId('new-clip-url').fill(CLIP_URL)
    await expect(panel.locator('.provider-badge')).toHaveText('TikTok')
    await panel.getByRole('button', { name: 'Live', exact: true }).click()
    await panel.getByTestId('new-clip-concert').selectOption({ index: 1 })
    await panel.getByRole('button', { name: 'Attach' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Clip added to the library', { timeout: 8000 })

    // The select now shows the new clip and the add panel is gone.
    await expect(block.getByTestId('new-clip')).toHaveCount(0)
    const chosen = await block.getByTestId('clip-select').inputValue()
    expect(Number(chosen)).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Update' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Post updated', { timeout: 8000 })

    const post = (await (await api(request, 'get', `/api/admin/posts/${postId}`)).json()).data
    const ref = post.blocks.find((b: { type: string }) => b.type === 'ref')
    expect(ref.entity).toBe('clip')
    expect(ref.data.provider).toBe('tiktok')
    expect(ref.data.concert).not.toBeNull()
  })

  test('the clip now shows in the library with the concert as owner', async ({ page }) => {
    await page.goto('/admin/clips')
    const row = page.locator('tbody tr', { hasText: 'TikTok' }).first()
    await expect(row).toBeVisible()
    await expect(row.locator('td').nth(3)).toHaveText(/[1-9]/)   // "Attached to" count
  })
})
```

The `selectOption({ index: 1 })` for the concert relies on at least one concert existing; the posts spec makes the same assumption for releases.

- [ ] **Step 3: Run the two specs**

```bash
cd /c/Projects/bandms/app && pnpm test:e2e -- e2e/tests/admin/clips.spec.ts e2e/tests/admin/post-clip-block.spec.ts
```
Expected: all green. If `ECONNRESET` appears in the log, re-run (see CLAUDE.md's triage order).

- [ ] **Step 4: Commit**

```bash
git add app/e2e/tests/admin/clips.spec.ts app/e2e/tests/admin/post-clip-block.spec.ts
git commit -m "E2E: clips admin, concert quick-add, clip post block

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Public E2E — concert page clips and the news clip block

**Files:**
- Create: `app/e2e/tests/public/concert-clips.spec.ts`

- [ ] **Step 1: Spec** (copy `adminToken`, `api`, `rebuildAndWait` verbatim from `post-blocks.spec.ts`)

```ts
import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

// … adminToken(), api(), rebuildAndWait() exactly as in post-blocks.spec.ts …

/**
 * The public half of the clips library: a clip attached to a concert renders
 * on that concert's page, and a post's clip block renders the same iframe with
 * a caption linking back to the show.
 */
test.describe.serial('Public clips', () => {
  failOnPageError()

  let concertId: number
  let concertSlug: string
  let clipId: number
  let postId: number
  let postSlug: string

  test.beforeAll(async ({ request }) => {
    test.setTimeout(180_000)

    const concerts = (await (await api(request, 'get', '/api/concerts')).json()).data as { id: number; slug_en: string }[]
    test.skip(concerts.length === 0, 'No concert to attach to')
    concertId = concerts[0].id
    concertSlug = concerts[0].slug_en

    const clip = (await (await api(request, 'post', '/api/clips', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: { en: `E2E public clip ${Date.now()}` },
      category: 'backstage',
      attach: [{ type: 'concert', id: concertId }],
    })).json()).data
    clipId = clip.id

    const post = (await (await api(request, 'post', '/api/posts', {
      title: { en: `E2E clip post ${Date.now()}` },
      published_at: new Date().toISOString(),
      blocks: [{ type: 'ref', payload: { entity: 'clip', id: clipId } }],
    })).json()).data
    postId = post.id
    postSlug = post.slug_en

    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    if (postId) await api(request, 'delete', `/api/posts/${postId}`)
    if (clipId) await api(request, 'delete', `/api/clips/${clipId}`)
  })

  test('the concert page lists the clip with its category label', async ({ page }) => {
    await page.goto(`${WEB}/en/concerts/${concertSlug}`)

    const grid = page.getByTestId('clips-grid')
    await expect(grid).toBeVisible()
    await expect(grid.locator('iframe').first()).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/)
    await expect(grid.locator('.clips-cat').first()).toHaveText('Backstage')
  })

  test('the Polish page uses the Polish category label', async ({ page }) => {
    await page.goto(`${WEB}/pl/koncerty/${concertSlug}`).catch(() => {})
    // The PL section slug may be customised; fall back to the concerts slug map via the EN page's hreflang.
    if (!(await page.getByTestId('clips-grid').isVisible().catch(() => false))) {
      await page.goto(`${WEB}/en/concerts/${concertSlug}`)
      const pl = await page.locator('link[hreflang="pl"]').getAttribute('href')
      test.skip(!pl, 'No Polish alternate for this concert')
      await page.goto(pl!)
    }
    await expect(page.getByTestId('clips-grid').locator('.clips-cat').first()).toHaveText('Za kulisami')
  })

  test('a post clip block renders the iframe and links to the show', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${postSlug}`)

    const fig = page.locator('.art-body .art-clip')
    await expect(fig.locator('iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/)
    await expect(fig.locator('a.art-clip-show')).toHaveAttribute('href', new RegExp(`/en/concerts/${concertSlug}/?$`))
  })
})
```

- [ ] **Step 2: Run**

```bash
cd /c/Projects/bandms/app && pnpm test:e2e -- e2e/tests/public/concert-clips.spec.ts
```
Expected: 3 passed (or 2 passed + 1 skipped if no PL alternate).

- [ ] **Step 3: Commit**

```bash
git add app/e2e/tests/public/concert-clips.spec.ts
git commit -m "E2E: clips on the public concert page and in a news article

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Docs, full suite, ship

**Files:**
- Modify: `CLAUDE.md` (a short *Clips library* section), `CHANGELOG.md`, `TODO.md` (PR 2 entry)

- [ ] **Step 1: `CLAUDE.md`** — add after *Rider rendering is shared*:

```markdown
## Clips are a library, attached polymorphically — posts reference, never own

`clips` holds every live/studio/backstage video; `clippables` is a
`morphToMany` pivot (`clippable_type` stores the **alias** from
`App\Support\ClipOwners::MAP`, enforced through `Relation::enforceMorphMap` —
never rename an alias, it is data). Owners get `->clips()` from the `HasClips`
trait, which also detaches on delete because a polymorphic column cannot carry
an FK. `Album` has the trait but the admin does not offer it: albums have no
public page.

**Posts are not owners.** A post embeds a clip with a `ref` block
(`entity: clip`); the block decides where in the article it sits. A clip
created from the block editor's *Add a new clip…* is a real library row and
outlives the post.

**Clip ids are referenced by post blocks, so no write path may
delete-and-recreate them.** `PUT /api/clips/{id}` updates in place and
`sync()`s owners; the concert form's quick-add goes through `POST /api/clips`
and `DELETE /api/clips/{id}/attach`, never through the concert PUT.

Category is free text with five presets (`ClipCategory::PRESETS`,
`app/src/utils/clipCategories.ts`). Public labels for the presets are copy on
the `site` module (`clipCategory*`); a custom category prints as typed. The
concert page heading is `CONCERTS_COPY.clipsTitle`. Rendering is
`ClipsGrid.astro` → `EmbedBlock.astro`, the same iframe a post embed uses.

A clip write marks **every owner's area** dirty plus `posts` (see
`ClipController::markDirty()`), and `band-profile` when `show_in_epk` is
involved. Release, merch and EPK surfaces are PR 2.
```

- [ ] **Step 2: `CHANGELOG.md`** — under the unreleased heading, following the file's existing format:

```markdown
### Added
- **Clips library** — attach YouTube/Vimeo/Instagram/TikTok/Facebook videos to concerts from `/admin/clips` or straight from the concert form; embed any clip in a news post (or create one from the post editor); the public show page lists its clips. Facebook is now an embed provider everywhere.
```

`TODO.md` — add an entry: *Clips PR 2: release + merch pages and EPK snapshot surfaces (spec `docs/superpowers/specs/2026-09-17-clips-library-design.md` §6).*

- [ ] **Step 3: Full rebuild and full suite**

```bash
cd /c/Projects/bandms && bash rebuild.sh            # backend + frontend + web, runs backend tests
bash scripts/test-all.sh                            # frontend unit → backend unit → E2E
```
Expected: exit code 0; E2E "N passed, ~15 skipped, 0 failed". Triage any red per CLAUDE.md before touching code.

- [ ] **Step 4: Commit docs, push, PR, review**

```bash
git add CLAUDE.md CHANGELOG.md TODO.md
git commit -m "Document the clips library

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin feature/clips-library
gh pr create --title "Clips library: video attached to concerts, embeddable in news (PR 1)" --body-file - <<'EOF'
## Summary
- New `clips` + polymorphic `clippables`; `HasClips` on Concert/Release/ShopItem/Album
- `ClipController`: CRUD + attach/detach; `GET /api/concerts/{id}` carries `clips`
- `ref: clip` post block, resolved with the clip's first concert
- Facebook embed provider (API, admin, public)
- `/admin/clips` screen; quick-add/detach on the concert form; "Add a new clip…" in the post block editor
- Public: `ClipsGrid.astro` on the show page; clip block in articles with a "Live at …" link
- Copy: `site.clipCategory*`, `concerts.clipsTitle`

PR 2 (release, merch, EPK surfaces) follows. Spec: `docs/superpowers/specs/2026-09-17-clips-library-design.md`.

## Test plan
- [x] Pest: EmbedProviderTest, ClipModelTest, ClipTest, ConcertTest, PostBlockResolverTest
- [x] Vitest: postBlocks, clipCategories, site-copy resolve, web clipCategory
- [x] Playwright admin: clips.spec, post-clip-block.spec
- [x] Playwright public: concert-clips.spec
- [x] `bash scripts/test-all.sh` green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Then run `/code-review` on the PR before merging (CLAUDE.md requires an explicit pass; `/ship` and `git-feature-workflow` do not cover `api/` changes). Check `git status` for stray review scratch files (`full.diff`) before any follow-up commit.

---

## Self-review against the spec (PR 1 scope)

| Spec item | Task |
|---|---|
| `clips` + `clippables`, morph map, `HasClips` on 4 models | 2 |
| `ClipCategory::PRESETS` + admin mirror | 2, 8 |
| Facebook provider (API, admin util, `EmbedBlock.astro`) | 1 |
| `GET /api/clips`; POST/PUT/DELETE; attach/detach; `ClipRequest` stamping; `exists` on owner | 3 |
| Dirty areas per owner + posts + band-profile | 3 |
| `ClipResource` shape incl. `owners` | 3 |
| Concert responses carry `clips` | 4 |
| `REF_ENTITIES` + resolver `clip` arm with first concert | 5 |
| Copy strings (deviation: `site` + `concerts`, not a `clips` row) | 6 |
| `ClipsGrid.astro`, concert page section, `RefBlock` clip arm, `EmbedLike` | 7 |
| `/admin/clips` screen, `ClipForm`, category chips + custom, `EntityRelationsPanel.shopItems` | 8 |
| `AttachedClipsField` on ConcertForm (Release/Shop forms → PR 2) | 9 |
| `RefBlockEditor` clip pick / add-new | 10 |
| Pest / Vitest / Playwright admin / Playwright public | 1–3, 5–8, 11, 12 |
| Release, merch, EPK surfaces, `EpkSnapshotBuilder` | **PR 2 — not here** |

Type/name consistency checked: `ownersList()` (model) ↔ `ClipResource`/`ClipController`; `ownerRelation(alias)`; `CLIPS_QKEY`; `ClipAttach {type,id}` ↔ API `attach[]`/`/attach` body; `data-testid`s `clip-form`, `clip-title-en`, `clip-category-custom`, `attached-clips`, `attached-clip`, `attached-clip-url`, `clip-select`, `new-clip`, `new-clip-url`, `new-clip-concert`, `clips-grid` used identically in components and specs.
