# News Content Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace a news post's fixed-order body (`posts.content` plus five entity pivots) with an ordered, typed block list the editor controls.

**Architecture:** A `post_blocks` child table holds `position`, `type` and a JSON `payload`. Four types — `text`, `image`, `embed`, `ref`. Presentation order becomes data; `PostDetail.astro` stops deciding sequence and becomes a dispatcher. Provider detection and entity resolution live server-side so the admin preview and the public renderer cannot disagree.

**Tech Stack:** Laravel 11 / PHP 8.4 / MySQL 8.4 (Pest) · Vue 3 + TypeScript (Vitest, Playwright) · Astro SSG (Vitest)

**Spec:** `docs/superpowers/specs/2026-09-07-news-content-blocks-design.md`

---

## Global Constraints

These apply to every task. They are project rules from `CLAUDE.md`, not preferences.

- **Branch:** `feature/news-content-blocks`. Never commit to `main`.
- **Backend tests do NOT run via `docker exec bandms_backend php artisan test`.** The running image is built `--no-dev`; Pest is absent. Use the test stage:
  ```bash
  docker build --target test -t bandms_test ./api
  APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
  docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockTest
  ```
  It runs SQLite in-memory and needs neither MySQL nor a running stack.
- **Test file naming is not interchangeable.** `app/` → `*.spec.ts` (its vitest `include` is `src/**/*.spec.ts`; a `.test.ts` there is silently collected as nothing and the suite goes green). `web/` → `*.test.ts`.
- **Unit-testable frontend logic goes in `app/src/utils/`, never a composable.** The admin's vitest environment is `node` and `useAuth` reads `localStorage` at module load, so importing any composable that pulls it in dies with `localStorage.getItem is not a function`.
- **`web/src` may not contain a raw colour, font, or radius.** `pnpm build` runs `scripts/check-tokens.mjs`, which fails on `text-zinc-400`, `#121212`, `rounded-xl`, `'Anton'`. Use semantic tokens from `web/src/styles/tokens.css`. An **undefined** token (`bg-surface-3`) also fails.
- **Never build an admin URL by hand.** Use `adminUrl()` from `@/config/admin`.
- **Module gates use `!== false`, never `=== true`.** `getSiteConfig` fails open to `{}` when the API is unreachable mid-build.
- **Verifying `web/` requires a rebuild, not a restart.** `web` has no bind mount: `docker compose restart web` rebuilds the *baked* source, so you can verify code you did not write. Always `docker compose build web && docker compose up -d web`, and confirm the asset hash changed.
- **Type-check `web/` with `npx tsc --noEmit -p tsconfig.json`**, never `astro check` (it prompts to install and hangs). Two errors are pre-existing: `themes/skanking-storks/slots.ts` `.astro` imports, and `types/shop.ts` `ShopItem`/`ShopItemSummary` variance. Filter those two.
- **Commit after every task.** Message ends with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ
  ```

---

## File Structure

**Backend — create**

| File | Responsibility |
|---|---|
| `api/app/Support/PostBlockType.php` | The `type` and `ref` entity vocabularies, as consts |
| `api/app/Support/EmbedProvider.php` | URL → provider, URL → embed id. Pure |
| `api/app/Support/PostBlockBackfill.php` | Old shape → block rows. `blocksFor()` is pure; `run()` does DB |
| `api/app/Support/PostBlockResolver.php` | Batch-resolves `ref` blocks; missing entity → `null` |
| `api/app/Support/PostBlockSync.php` | Writes a post's blocks; owns orphan-image cleanup |
| `api/app/Models/PostBlock.php` | Eloquent model |
| `api/app/Http/Resources/PostBlockResource.php` | One block → JSON |
| `api/app/Http/Requests/StorePostRequest.php` | Create validation |
| `api/app/Http/Requests/UpdatePostRequest.php` | Update validation |
| `api/app/Http/Requests/Concerns/PostRules.php` | The shared rule array |
| `api/database/migrations/2026_09_08_000001_create_post_blocks_table.php` | Create + backfill |
| `api/database/migrations/2026_09_08_000002_drop_legacy_post_content_and_pivots.php` | Drop |
| `api/database/factories/PostBlockFactory.php` | Test fixture |

**Backend — modify**

| File | Change |
|---|---|
| `api/app/Models/Post.php` | `blocks()` relation; drop 5 pivot relations + `links()`; `deleting` hook |
| `api/app/Http/Controllers/PostController.php` | Form Requests, `PostBlockSync`, `SiteRebuild`, constrained index eager-load, upload action |
| `api/app/Http/Resources/PostResource.php` | `blocks`; drop `content` and 5 relations |
| `api/app/Http/Resources/PostSummaryResource.php` | `excerpt` from first text block |
| `api/routes/api.php` | `POST /api/posts/blocks/image` |
| `api/database/factories/PostFactory.php` | Drop `content` |

**Admin (`app/`) — create**

| File | Responsibility |
|---|---|
| `app/src/utils/postBlocks.ts` | `defaultPayload`, `move`, `providerLabel` — pure |
| `app/src/utils/postBlocks.spec.ts` | Its tests |
| `app/src/api/postBlocks.ts` | `uploadPostBlockImage()` |
| `app/src/components/admin/forms/PostBlockEditor.vue` | The ordered list: add, remove, drag |
| `app/src/components/admin/forms/blocks/TextBlockEditor.vue` | EN/PL textareas |
| `app/src/components/admin/forms/blocks/ImageBlockEditor.vue` | Upload + alt/caption |
| `app/src/components/admin/forms/blocks/EmbedBlockEditor.vue` | URL + provider badge |
| `app/src/components/admin/forms/blocks/RefBlockEditor.vue` | Entity + item pickers |

**Admin — modify:** `app/src/types/post.ts` · `app/src/components/admin/forms/PostForm.vue` · `app/src/views/admin/PostsAdminView.vue` · `app/e2e/tests/admin/posts.spec.ts`

**Public (`web/`) — create**

| File | Responsibility |
|---|---|
| `web/src/lib/refHref.ts` | Entity + slug map + module map → href or `null` |
| `web/src/lib/refHref.test.ts` | Its tests |
| `web/src/components/blocks/PostBlocks.astro` | Dispatcher; owns the four structural rules |
| `web/src/components/blocks/TextBlock.astro` | `.art-prose` |
| `web/src/components/blocks/ImageBlock.astro` | `<figure>` |
| `web/src/components/blocks/EmbedBlock.astro` | Provider → iframe |
| `web/src/components/blocks/RefBlock.astro` | Entity → link row |
| `app/e2e/tests/public/post-blocks.spec.ts` | Public half |

**Public — modify:** `web/src/types/post.ts` · `web/src/components/detail/PostDetail.astro` · `web/src/pages/posts/[id].astro` · `app/e2e/tests/public/article-press.spec.ts`

---

### Task 1: `PostBlockType` and `EmbedProvider`

**Files:**
- Create: `api/app/Support/PostBlockType.php`
- Create: `api/app/Support/EmbedProvider.php`
- Test: `api/tests/Feature/EmbedProviderTest.php`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `PostBlockType::TEXT|IMAGE|EMBED|REF` (string consts), `PostBlockType::ALL` (string[]), `PostBlockType::REF_ENTITIES` (string[])
  - `EmbedProvider::detect(string $url): string` — one of `youtube|vimeo|instagram|tiktok|link`
  - `EmbedProvider::embedId(string $url): ?string`
  - `EmbedProvider::PROVIDERS` (string[])

- [ ] **Step 1: Write the failing test**

Create `api/tests/Feature/EmbedProviderTest.php`:

```php
<?php

use App\Support\EmbedProvider;

describe('EmbedProvider::detect', function () {
    it('detects youtube from both hosts', function () {
        expect(EmbedProvider::detect('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))->toBe('youtube');
        expect(EmbedProvider::detect('https://youtu.be/dQw4w9WgXcQ'))->toBe('youtube');
    });

    it('detects vimeo, instagram and tiktok', function () {
        expect(EmbedProvider::detect('https://vimeo.com/76979871'))->toBe('vimeo');
        expect(EmbedProvider::detect('https://www.instagram.com/p/CxYzAbC1234/'))->toBe('instagram');
        expect(EmbedProvider::detect('https://www.tiktok.com/@band/video/7234567890123456789'))->toBe('tiktok');
    });

    // facebook is deliberately NOT a provider: the old post_links.type column
    // carried it, and the backfill re-detects rather than mapping that column.
    it('falls back to link for any other host, facebook included', function () {
        expect(EmbedProvider::detect('https://www.facebook.com/band/posts/123'))->toBe('link');
        expect(EmbedProvider::detect('https://example.com/news'))->toBe('link');
    });

    it('falls back to link rather than throwing on an unparseable url', function () {
        expect(EmbedProvider::detect('not a url at all'))->toBe('link');
        expect(EmbedProvider::detect(''))->toBe('link');
    });
});

describe('EmbedProvider::embedId', function () {
    it('extracts a youtube id from watch, short and embed forms', function () {
        expect(EmbedProvider::embedId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))->toBe('dQw4w9WgXcQ');
        expect(EmbedProvider::embedId('https://youtu.be/dQw4w9WgXcQ'))->toBe('dQw4w9WgXcQ');
        expect(EmbedProvider::embedId('https://www.youtube.com/embed/dQw4w9WgXcQ'))->toBe('dQw4w9WgXcQ');
    });

    it('extracts vimeo, instagram and tiktok ids', function () {
        expect(EmbedProvider::embedId('https://vimeo.com/76979871'))->toBe('76979871');
        expect(EmbedProvider::embedId('https://www.instagram.com/p/CxYzAbC1234/'))->toBe('CxYzAbC1234');
        expect(EmbedProvider::embedId('https://www.tiktok.com/@band/video/7234567890123456789'))
            ->toBe('7234567890123456789');
    });

    it('extracts an instagram reel id as well as a post id', function () {
        expect(EmbedProvider::embedId('https://www.instagram.com/reel/CxYzAbC1234/'))->toBe('CxYzAbC1234');
    });

    // A provider with a null id must render as a link row, never as an iframe
    // with a broken src — so returning null here is load-bearing.
    it('returns null for a link and for an unparseable provider url', function () {
        expect(EmbedProvider::embedId('https://example.com/news'))->toBeNull();
        expect(EmbedProvider::embedId('https://vimeo.com/channels/staffpicks'))->toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter EmbedProviderTest
```
Expected: FAIL — `Class "App\Support\EmbedProvider" not found`

- [ ] **Step 3: Write the implementation**

Create `api/app/Support/PostBlockType.php`:

```php
<?php

namespace App\Support;

/**
 * The block vocabularies, in one place.
 *
 * `tour` is deliberately absent from REF_ENTITIES: tours have no public page of
 * any kind, so a tour reference could only ever link somewhere it isn't.
 */
final class PostBlockType
{
    public const TEXT  = 'text';
    public const IMAGE = 'image';
    public const EMBED = 'embed';
    public const REF   = 'ref';

    public const ALL = [self::TEXT, self::IMAGE, self::EMBED, self::REF];

    public const REF_ENTITIES = [
        'concert', 'album', 'release', 'music_video', 'press_release', 'shop_item',
    ];
}
```

Create `api/app/Support/EmbedProvider.php`:

```php
<?php

namespace App\Support;

/**
 * Maps a pasted URL to an embed provider and its id.
 *
 * Detection lives server-side, and the resolved provider is *stored* on the
 * block, so a later change to these rules cannot silently re-point existing
 * content. Extraction lives here too so the admin preview and the public
 * renderer cannot disagree about which video a block points at.
 *
 * Adding a provider is one entry in HOSTS plus one arm in embedId() — and one
 * arm in web/src/components/blocks/EmbedBlock.astro.
 */
final class EmbedProvider
{
    public const PROVIDERS = ['youtube', 'vimeo', 'instagram', 'tiktok', 'link'];

    /** Host suffix => provider. Checked longest-first is unnecessary; suffixes are disjoint. */
    private const HOSTS = [
        'youtube.com'   => 'youtube',
        'youtu.be'      => 'youtube',
        'vimeo.com'     => 'vimeo',
        'instagram.com' => 'instagram',
        'tiktok.com'    => 'tiktok',
    ];

    public static function detect(string $url): string
    {
        $host = parse_url($url, PHP_URL_HOST);

        if (! is_string($host) || $host === '') {
            return 'link';
        }

        $host = strtolower(preg_replace('/^www\./', '', $host));

        foreach (self::HOSTS as $suffix => $provider) {
            if ($host === $suffix || str_ends_with($host, '.' . $suffix)) {
                return $provider;
            }
        }

        return 'link';
    }

    /**
     * The provider-specific id, or null when the URL carries none.
     *
     * Null is meaningful: the renderer falls back to a plain link row rather
     * than emitting an iframe with a broken src. A Vimeo *channel* URL is the
     * everyday case — it is on vimeo.com but names no single video.
     */
    public static function embedId(string $url): ?string
    {
        return match (self::detect($url)) {
            'youtube'   => self::match('~(?:youtu\.be/|youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/))([A-Za-z0-9_-]{11})~', $url),
            'vimeo'     => self::match('~vimeo\.com/(?:video/)?(\d+)~', $url),
            'instagram' => self::match('~instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)~', $url),
            'tiktok'    => self::match('~tiktok\.com/@[^/]+/video/(\d+)~', $url),
            default     => null,
        };
    }

    private static function match(string $pattern, string $url): ?string
    {
        return preg_match($pattern, $url, $m) === 1 ? $m[1] : null;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter EmbedProviderTest
```
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add api/app/Support/PostBlockType.php api/app/Support/EmbedProvider.php api/tests/Feature/EmbedProviderTest.php
git commit -m "feat(api): add embed provider detection for post blocks

Detection is server-side and the result is stored on the block, so changing
these rules later cannot re-point existing content. embedId returns null for a
URL that names no single item — a Vimeo channel, say — so the renderer falls
back to a link row rather than an iframe with a broken src.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 2: `post_blocks` table, model and relation

**Files:**
- Create: `api/database/migrations/2026_09_08_000001_create_post_blocks_table.php`
- Create: `api/app/Models/PostBlock.php`
- Create: `api/database/factories/PostBlockFactory.php`
- Modify: `api/app/Models/Post.php`
- Test: `api/tests/Feature/PostBlockModelTest.php`

**Interfaces:**
- Consumes: `PostBlockType` (Task 1)
- Produces:
  - `App\Models\PostBlock` — `$fillable = ['post_id','position','type','payload']`, `payload` cast to `array`, `position` to `integer`, `post(): BelongsTo`
  - `Post::blocks(): HasMany` — ordered by `position` then `id`
  - `PostBlockFactory` with states `->text(string $en)`, `->ref(string $entity, int $id)`, `->embed(string $url)`

> The backfill body is **not** in this migration yet — Task 3 writes and tests it, Task 4 wires it in. Creating the table first keeps this task independently reviewable.

- [ ] **Step 1: Write the failing test**

Create `api/tests/Feature/PostBlockModelTest.php`:

```php
<?php

use App\Models\Post;
use App\Models\PostBlock;

it('casts payload to an array', function () {
    $post  = Post::factory()->create();
    $block = PostBlock::create([
        'post_id'  => $post->id,
        'position' => 0,
        'type'     => 'text',
        'payload'  => ['body' => ['en' => 'Hello', 'pl' => 'Cześć']],
    ]);

    expect($block->fresh()->payload)->toBe(['body' => ['en' => 'Hello', 'pl' => 'Cześć']]);
});

// Ordering is explicit, not incidental. post_links used to work by accident
// because delete-and-recreate made auto-increment id match array order; the
// moment anything stops recreating from scratch that breaks silently.
it('orders blocks by position, not by id', function () {
    $post = Post::factory()->create();

    $second = PostBlock::create(['post_id' => $post->id, 'position' => 1, 'type' => 'text', 'payload' => ['body' => ['en' => 'B']]]);
    $first  = PostBlock::create(['post_id' => $post->id, 'position' => 0, 'type' => 'text', 'payload' => ['body' => ['en' => 'A']]]);

    expect($second->id)->toBeLessThan($first->id);
    expect($post->blocks()->pluck('id')->all())->toBe([$first->id, $second->id]);
});

it('cascades on post delete', function () {
    $post = Post::factory()->create();
    PostBlock::create(['post_id' => $post->id, 'position' => 0, 'type' => 'text', 'payload' => ['body' => ['en' => 'A']]]);

    $post->delete();

    expect(PostBlock::count())->toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockModelTest
```
Expected: FAIL — `Class "App\Models\PostBlock" not found`

- [ ] **Step 3: Write the implementation**

Create `api/database/migrations/2026_09_08_000001_create_post_blocks_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('post_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('type'); // text | image | embed | ref
            $table->json('payload');
            $table->timestamps();

            $table->index(['post_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_blocks');
    }
};
```

Create `api/app/Models/PostBlock.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostBlock extends Model
{
    use HasFactory;

    protected $fillable = ['post_id', 'position', 'type', 'payload'];

    protected function casts(): array
    {
        return [
            'payload'  => 'array',
            'position' => 'integer',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }
}
```

Create `api/database/factories/PostBlockFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Post;
use Illuminate\Database\Eloquent\Factories\Factory;

class PostBlockFactory extends Factory
{
    public function definition(): array
    {
        return [
            'post_id'  => Post::factory(),
            'position' => 0,
            'type'     => 'text',
            'payload'  => ['body' => ['en' => fake()->paragraph(), 'pl' => null]],
        ];
    }

    public function text(string $en, ?string $pl = null): static
    {
        return $this->state(['type' => 'text', 'payload' => ['body' => ['en' => $en, 'pl' => $pl]]]);
    }

    public function ref(string $entity, int $id): static
    {
        return $this->state(['type' => 'ref', 'payload' => ['entity' => $entity, 'id' => $id]]);
    }

    public function embed(string $url, string $provider = 'link', ?string $label = null): static
    {
        return $this->state([
            'type'    => 'embed',
            'payload' => ['provider' => $provider, 'url' => $url, 'label' => $label],
        ]);
    }

    public function image(string $path): static
    {
        return $this->state([
            'type'    => 'image',
            'payload' => ['path' => $path, 'alt' => ['en' => null, 'pl' => null], 'caption' => ['en' => null, 'pl' => null]],
        ]);
    }

    public function at(int $position): static
    {
        return $this->state(['position' => $position]);
    }
}
```

In `api/app/Models/Post.php`, add the relation immediately after `tags()`:

```php
    public function blocks(): HasMany
    {
        return $this->hasMany(PostBlock::class)->orderBy('position')->orderBy('id');
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockModelTest
```
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add api/database/migrations/2026_09_08_000001_create_post_blocks_table.php api/app/Models/PostBlock.php api/database/factories/PostBlockFactory.php api/app/Models/Post.php api/tests/Feature/PostBlockModelTest.php
git commit -m "feat(api): add post_blocks table, model and relation

Ordered by position then id, and a test pins that order against inverted
insertion — post_links used to order correctly only by accident of
auto-increment.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 3: `PostBlockBackfill::blocksFor()` — the pure half

**Files:**
- Create: `api/app/Support/PostBlockBackfill.php`
- Test: `api/tests/Feature/PostBlockBackfillTest.php`

**Interfaces:**
- Consumes: `EmbedProvider::detect` (Task 1)
- Produces:
  - `PostBlockBackfill::blocksFor(array $source): array` — pure, returns `list<array{position:int,type:string,payload:array}>`
  - `PostBlockBackfill::run(): void` — added in Task 4

> **Why the split.** The test stage applies **every** migration during setup, so a test running after the drop migration would find `posts.content` and the pivots already gone — nothing left to assert against. Testing the pure function lets the test hand it the *old* shape directly.

- [ ] **Step 1: Write the failing test**

Create `api/tests/Feature/PostBlockBackfillTest.php`:

```php
<?php

use App\Support\PostBlockBackfill;

/** The old-shape row a post looked like before this feature. */
function oldPost(array $overrides = []): array
{
    return array_merge([
        'content'           => null,
        'press_release_ids' => [],
        'release_ids'       => [],
        'music_video_ids'   => [],
        'concert_ids'       => [],
        'album_ids'         => [],
        'links'             => [],
    ], $overrides);
}

it('emits content as a text block at position 0, preserving translations', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost([
        'content' => '{"en":"<p>Hello</p>","pl":"<p>Cześć</p>"}',
    ]));

    expect($blocks)->toHaveCount(1);
    expect($blocks[0]['position'])->toBe(0);
    expect($blocks[0]['type'])->toBe('text');
    expect($blocks[0]['payload']['body']['en'])->toBe('<p>Hello</p>');
    expect($blocks[0]['payload']['body']['pl'])->toBe('<p>Cześć</p>');
});

// Rows predating 2026_06_14_000001_make_posts_fields_translatable hold a bare
// string, not JSON. Wrapping it as English loses nothing; dropping it loses the
// whole article body.
it('treats a non-JSON legacy content value as English', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost(['content' => 'Plain old body']));

    expect($blocks[0]['payload']['body'])->toBe(['en' => 'Plain old body', 'pl' => null]);
});

it('emits no text block when content is null or empty', function () {
    expect(PostBlockBackfill::blocksFor(oldPost(['content' => null])))->toBe([]);
    expect(PostBlockBackfill::blocksFor(oldPost(['content' => '{"en":"","pl":""}'])))->toBe([]);
});

// The order reproduces what PostDetail.astro renders today:
// content -> press pull-quote -> Related -> In the press -> links.
it('orders content, then press, then related, then links', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost([
        'content'           => '{"en":"Body"}',
        'press_release_ids' => [90],
        'release_ids'       => [10],
        'music_video_ids'   => [20],
        'concert_ids'       => [30],
        'album_ids'         => [40],
        'links'             => [['type' => 'normal', 'url' => 'https://example.com', 'label' => 'Read']],
    ]));

    expect(array_column($blocks, 'position'))->toBe([0, 1, 2, 3, 4, 5, 6]);
    expect(array_column($blocks, 'type'))->toBe(['text', 'ref', 'ref', 'ref', 'ref', 'ref', 'embed']);
    expect(array_column(array_column($blocks, 'payload'), 'entity'))
        ->toBe([null, 'press_release', 'release', 'music_video', 'concert', 'album', null]);
});

it('keeps link labels rather than discarding them', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost([
        'links' => [['type' => 'normal', 'url' => 'https://example.com', 'label' => 'Read more']],
    ]));

    expect($blocks[0]['payload']['label'])->toBe('Read more');
});

// The old type column carries `facebook`, which is not a provider in the new
// taxonomy. Mapping it straight across would store a value nothing renders.
it('re-detects the provider from the url instead of mapping the old type column', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost([
        'links' => [
            ['type' => 'facebook', 'url' => 'https://facebook.com/band/posts/1', 'label' => null],
            ['type' => 'normal',   'url' => 'https://youtu.be/dQw4w9WgXcQ',      'label' => null],
        ],
    ]));

    expect($blocks[0]['payload']['provider'])->toBe('link');
    expect($blocks[1]['payload']['provider'])->toBe('youtube');
});

it('preserves the incoming link order', function () {
    $blocks = PostBlockBackfill::blocksFor(oldPost([
        'links' => [
            ['type' => 'normal', 'url' => 'https://one.example', 'label' => null],
            ['type' => 'normal', 'url' => 'https://two.example', 'label' => null],
        ],
    ]));

    expect(array_column(array_column($blocks, 'payload'), 'url'))
        ->toBe(['https://one.example', 'https://two.example']);
});

it('emits nothing at all for an empty post', function () {
    expect(PostBlockBackfill::blocksFor(oldPost()))->toBe([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockBackfillTest
```
Expected: FAIL — `Class "App\Support\PostBlockBackfill" not found`

- [ ] **Step 3: Write the implementation**

Create `api/app/Support/PostBlockBackfill.php` (the `run()` half comes in Task 4):

```php
<?php

namespace App\Support;

/**
 * Converts a post's pre-blocks shape into ordered block rows.
 *
 * blocksFor() is deliberately pure — no DB, no models. The test stage applies
 * every migration at setup, so a test running after the drop migration would
 * find posts.content and the pivots already gone. Handing this function the old
 * shape directly is the only way to assert on the conversion at all.
 */
final class PostBlockBackfill
{
    /** Emitted in the order PostDetail.astro renders today. */
    private const REF_ORDER = [
        'press_release_ids' => 'press_release',
        'release_ids'       => 'release',
        'music_video_ids'   => 'music_video',
        'concert_ids'       => 'concert',
        'album_ids'         => 'album',
    ];

    /**
     * @param  array{content: ?string, press_release_ids: int[], release_ids: int[],
     *               music_video_ids: int[], concert_ids: int[], album_ids: int[],
     *               links: list<array{type: string, url: string, label: ?string}>}  $source
     * @return list<array{position: int, type: string, payload: array}>
     */
    public static function blocksFor(array $source): array
    {
        $blocks   = [];
        $position = 0;

        $body = self::decodeContent($source['content'] ?? null);
        if ($body !== null) {
            $blocks[] = ['position' => $position++, 'type' => PostBlockType::TEXT, 'payload' => ['body' => $body]];
        }

        foreach (self::REF_ORDER as $key => $entity) {
            foreach ($source[$key] ?? [] as $id) {
                $blocks[] = [
                    'position' => $position++,
                    'type'     => PostBlockType::REF,
                    'payload'  => ['entity' => $entity, 'id' => (int) $id],
                ];
            }
        }

        foreach ($source['links'] ?? [] as $link) {
            $blocks[] = [
                'position' => $position++,
                'type'     => PostBlockType::EMBED,
                'payload'  => [
                    // Re-detected, never mapped from the old `type` column: that
                    // column carries `facebook`, which is not a provider here.
                    'provider' => EmbedProvider::detect($link['url']),
                    'url'      => $link['url'],
                    'label'    => $link['label'] ?? null,
                ],
            ];
        }

        return $blocks;
    }

    /**
     * The translations bag, or null when there is nothing worth a block.
     *
     * A bare string predates the translatable migration; wrapping it as English
     * loses nothing, while dropping it loses the whole article body.
     *
     * @return array{en: ?string, pl: ?string}|null
     */
    private static function decodeContent(?string $raw): ?array
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }

        $decoded = json_decode($raw, true);
        $bag = is_array($decoded) ? $decoded : ['en' => $raw];

        $en = trim((string) ($bag['en'] ?? '')) !== '' ? $bag['en'] : null;
        $pl = trim((string) ($bag['pl'] ?? '')) !== '' ? $bag['pl'] : null;

        return ($en === null && $pl === null) ? null : ['en' => $en, 'pl' => $pl];
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockBackfillTest
```
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add api/app/Support/PostBlockBackfill.php api/tests/Feature/PostBlockBackfillTest.php
git commit -m "feat(api): add post block backfill conversion

blocksFor is pure so it can be tested at all: the test stage applies every
migration at setup, so a test running after the drop would find the source
columns already gone.

Re-detects the embed provider from the URL rather than mapping post_links.type,
which carries \`facebook\` — not a provider in the new taxonomy. Keeps labels,
and treats a pre-translatable bare string as English rather than dropping it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 4: Wire the backfill, then drop the legacy columns

**Files:**
- Modify: `api/app/Support/PostBlockBackfill.php` (add `run()`)
- Modify: `api/database/migrations/2026_09_08_000001_create_post_blocks_table.php` (call `run()`)
- Create: `api/database/migrations/2026_09_08_000002_drop_legacy_post_content_and_pivots.php`
- Modify: `api/app/Models/Post.php` (drop 5 relations + `links()`)
- Modify: `api/database/factories/PostFactory.php` (drop `content`)
- Delete: `api/app/Models/PostLink.php`, `api/app/Http/Resources/PostLinkResource.php`

**Interfaces:**
- Consumes: `PostBlockBackfill::blocksFor` (Task 3)
- Produces: `PostBlockBackfill::run(): void`; `posts.content` and 5 pivot tables gone

> `post_tours` is **NOT** dropped. With `tour` removed as a ref target there is nowhere to backfill it to, and dropping it destroys the only record of each association. `Post::tours()` goes; the table stays.

- [ ] **Step 1: Add `run()` to `PostBlockBackfill`**

Add to the class, above `decodeContent`:

```php
    /**
     * Read every post's old shape and insert its blocks.
     *
     * Uses the DB facade, not Eloquent: by the time anyone reads this, the
     * models will have moved on and Post will no longer declare these relations.
     */
    public static function run(): void
    {
        DB::table('posts')->orderBy('id')->chunkById(100, function ($posts) {
            $rows = [];
            $now  = now();

            foreach ($posts as $post) {
                $blocks = self::blocksFor([
                    'content'           => $post->content,
                    'press_release_ids' => self::pivotIds('press_release_posts', 'press_release_id', $post->id),
                    'release_ids'       => self::pivotIds('post_releases', 'release_id', $post->id),
                    'music_video_ids'   => self::pivotIds('post_music_videos', 'music_video_id', $post->id),
                    'concert_ids'       => self::pivotIds('post_concerts', 'concert_id', $post->id),
                    'album_ids'         => self::pivotIds('post_albums', 'album_id', $post->id),
                    'links'             => DB::table('post_links')
                        ->where('post_id', $post->id)
                        ->orderBy('sort_order')->orderBy('id')
                        ->get(['type', 'url', 'label'])
                        ->map(fn ($l) => (array) $l)->all(),
                ]);

                foreach ($blocks as $block) {
                    $rows[] = [
                        'post_id'    => $post->id,
                        'position'   => $block['position'],
                        'type'       => $block['type'],
                        'payload'    => json_encode($block['payload'], JSON_UNESCAPED_UNICODE),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }
            }

            if ($rows !== []) {
                DB::table('post_blocks')->insert($rows);
            }
        });
    }

    /** @return int[] */
    private static function pivotIds(string $table, string $column, int $postId): array
    {
        return DB::table($table)->where('post_id', $postId)->orderBy($column)->pluck($column)->all();
    }
```

Add `use Illuminate\Support\Facades\DB;` to the file's imports.

- [ ] **Step 2: Call it from the create migration**

In `2026_09_08_000001_create_post_blocks_table.php`, add `use App\Support\PostBlockBackfill;` and append to `up()` after `Schema::create`:

```php
        PostBlockBackfill::run();
```

- [ ] **Step 3: Write the drop migration**

Create `api/database/migrations/2026_09_08_000002_drop_legacy_post_content_and_pivots.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Separate from the create-and-backfill migration on purpose: this half is the
 * irreversible one, so it can be held back or reverted on its own if the
 * backfill turns out wrong.
 *
 * post_tours is deliberately NOT dropped. With `tour` removed as a ref target
 * there is nowhere to backfill it to, so dropping the table would destroy the
 * only record of each post-tour association. Nothing renders those rows today;
 * removing the table is a separate, explicit decision.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('post_links');
        Schema::dropIfExists('post_concerts');
        Schema::dropIfExists('post_albums');
        Schema::dropIfExists('post_releases');
        Schema::dropIfExists('post_music_videos');

        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('content');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->longText('content')->nullable()->after('slug_pl');
        });

        foreach ([
            'post_concerts'     => ['concert_id', 'concerts'],
            'post_albums'       => ['album_id', 'albums'],
            'post_releases'     => ['release_id', 'releases'],
            'post_music_videos' => ['music_video_id', 'music_videos'],
        ] as $name => [$column, $target]) {
            Schema::create($name, function (Blueprint $table) use ($column, $target) {
                $table->id();
                $table->foreignId('post_id')->constrained()->cascadeOnDelete();
                $table->foreignId($column)->constrained($target)->cascadeOnDelete();
                $table->timestamps();
            });
        }

        Schema::create('post_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->string('url');
            $table->string('label')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['post_id', 'sort_order']);
        });
    }
};
```

- [ ] **Step 4: Strip the dead relations**

In `api/app/Models/Post.php` delete the methods `links()`, `concerts()`, `albums()`, `releases()`, `tours()`, `musicVideos()`, and remove the now-unused `use App\Models\MusicVideo;` import. **Keep** `tags()`, `photos()`, `pressReleases()` and the new `blocks()`. Drop `'content'` from `$fillable` and from `$translatable`.

In `api/database/factories/PostFactory.php` delete the `'content' => fake()->paragraphs(3, true),` line.

Delete the two dead files:

```bash
git rm api/app/Models/PostLink.php api/app/Http/Resources/PostLinkResource.php
```

- [ ] **Step 5: Run the whole backend suite**

```bash
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test
```
Expected: FAIL, and only in `PostTest.php` — the `content` search filter test and any `PostResource` assertion naming `content`, `links` or the dropped relations. Those are fixed in Task 7, which rewrites the controller. Record the failing test names; do not fix them here.

- [ ] **Step 6: Commit**

```bash
git add -A api/
git commit -m "feat(api)!: backfill post blocks and drop content plus four pivots

post_tours is kept: with tour removed as a ref target there is nowhere to
backfill it to, and dropping it would destroy the only record of each
association. Nothing renders those rows today, so keeping them costs nothing
and the removal stays a separate decision.

PostTest still fails on content/links assertions; the controller rewrite in the
next commit fixes them.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 5: `PostBlockResolver`

**Files:**
- Create: `api/app/Support/PostBlockResolver.php`
- Test: `api/tests/Feature/PostBlockResolverTest.php`

**Interfaces:**
- Consumes: `PostBlock` (Task 2), `PostBlockType::REF_ENTITIES` (Task 1)
- Produces: `PostBlockResolver::resolve(Collection $blocks): array` — map of block id → `array|null`

- [ ] **Step 1: Write the failing test**

Create `api/tests/Feature/PostBlockResolverTest.php`:

```php
<?php

use App\Models\Concert;
use App\Models\Post;
use App\Models\PostBlock;
use App\Models\PressRelease;
use App\Models\Release;
use App\Support\PostBlockResolver;

it('resolves a concert ref to its identity fields', function () {
    $concert = Concert::factory()->create(['slug_en' => 'gig-at-the-club']);
    $post    = Post::factory()->create();
    $block   = PostBlock::factory()->for($post)->ref('concert', $concert->id)->create();

    $resolved = PostBlockResolver::resolve(collect([$block]));

    expect($resolved[$block->id]['id'])->toBe($concert->id);
    expect($resolved[$block->id]['slug_en'])->toBe('gig-at-the-club');
});

// A dangling ref must resolve, not explode. The Astro build is all-or-nothing:
// one page that throws aborts all 35 and the web container crash-loops.
it('resolves a deleted entity to null instead of throwing', function () {
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('release', 999999)->create();

    expect(PostBlockResolver::resolve(collect([$block]))[$block->id])->toBeNull();
});

it('resolves an unknown entity name to null', function () {
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('tour', 1)->create();

    expect(PostBlockResolver::resolve(collect([$block]))[$block->id])->toBeNull();
});

it('ignores non-ref blocks', function () {
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->text('Hello')->create();

    expect(PostBlockResolver::resolve(collect([$block])))->toBe([]);
});

// One query per entity type, not one per block. PostDetail.astro walks every
// page of the post index on every article page, so an N+1 here multiplies
// across the whole static build.
it('issues one query per entity type regardless of block count', function () {
    $post     = Post::factory()->create();
    $releases = Release::factory()->count(5)->create();
    $blocks   = $releases->map(fn ($r) => PostBlock::factory()->for($post)->ref('release', $r->id)->create());

    DB::enableQueryLog();
    PostBlockResolver::resolve(collect($blocks));
    $count = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($count)->toBe(1);
});

// "a quote with no source reads as the band quoting itself" — article-press.spec.ts
// asserts the attribution is never blank.
it('falls back to the url host when a press release has no og_site_name', function () {
    $pr    = PressRelease::factory()->create(['url' => 'https://pitchfork.com/x', 'og_site_name' => null]);
    $post  = Post::factory()->create();
    $block = PostBlock::factory()->for($post)->ref('press_release', $pr->id)->create();

    expect(PostBlockResolver::resolve(collect([$block]))[$block->id]['site'])->toBe('pitchfork.com');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockResolverTest
```
Expected: FAIL — `Class "App\Support\PostBlockResolver" not found`

- [ ] **Step 3: Write the implementation**

Create `api/app/Support/PostBlockResolver.php`:

```php
<?php

namespace App\Support;

use App\Models\Album;
use App\Models\Concert;
use App\Models\MusicVideo;
use App\Models\PressRelease;
use App\Models\Release;
use App\Models\ShopItem;
use Illuminate\Support\Collection;

/**
 * Hydrates `ref` blocks in batch.
 *
 * Two things this owes the rest of the system:
 *
 *  - **One query per entity type, never one per block.** PostDetail.astro walks
 *    every page of the post index on every article page, so an N+1 here is
 *    multiplied across the entire static build.
 *  - **A missing entity resolves to null, never an exception.** The Astro build
 *    is all-or-nothing — one page that throws aborts all 35 and leaves the web
 *    container crash-looping. Returning null lets the renderer skip the block.
 */
final class PostBlockResolver
{
    /**
     * @param  Collection<int, \App\Models\PostBlock>  $blocks
     * @return array<int, array|null>  block id => identity fields, or null
     */
    public static function resolve(Collection $blocks): array
    {
        $refs = $blocks->filter(fn ($b) => $b->type === PostBlockType::REF);

        if ($refs->isEmpty()) {
            return [];
        }

        $byEntity = $refs->groupBy(fn ($b) => $b->payload['entity'] ?? '');
        $loaded   = [];

        foreach ($byEntity as $entity => $group) {
            $ids = $group->pluck('payload.id')->filter()->map(fn ($i) => (int) $i)->unique()->all();
            $loaded[$entity] = self::load($entity, $ids);
        }

        $out = [];
        foreach ($refs as $block) {
            $entity = $block->payload['entity'] ?? '';
            $id     = (int) ($block->payload['id'] ?? 0);
            $out[$block->id] = $loaded[$entity][$id] ?? null;
        }

        return $out;
    }

    /** @return array<int, array> keyed by entity id */
    private static function load(string $entity, array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        return match ($entity) {
            'concert' => Concert::with('venue')->whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($c) => [
                    'id'      => $c->id,
                    'slug_en' => $c->slug_en,
                    'date'    => $c->date?->format('Y-m-d'),
                    'venue'   => $c->venue ? ['id' => $c->venue->id, 'name' => $c->venue->name] : null,
                ])->all(),

            'release' => Release::whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($r) => ['id' => $r->id, 'title' => $r->title, 'type' => $r->type])->all(),

            'album' => Album::whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($a) => ['id' => $a->id, 'title' => $a->title])->all(),

            // ShopItem's column is `name`, not `title`.
            'shop_item' => ShopItem::whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'slug_en' => $s->slug_en])->all(),

            'music_video' => MusicVideo::whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($v) => [
                    'id' => $v->id, 'title' => $v->og_title ?? $v->title, 'video_url' => $v->video_url,
                ])->all(),

            'press_release' => PressRelease::whereIn('id', $ids)->get()
                ->keyBy('id')->map(fn ($p) => [
                    'id'    => $p->id,
                    'title' => $p->og_title ?? $p->url,
                    'url'   => $p->url,
                    // Never blank: a quote with no source reads as the band
                    // quoting itself, and article-press.spec.ts asserts it.
                    'site'  => $p->og_site_name ?: (parse_url($p->url, PHP_URL_HOST) ?: null),
                ])->all(),

            default => [],
        };
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockResolverTest
```
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add api/app/Support/PostBlockResolver.php api/tests/Feature/PostBlockResolverTest.php
git commit -m "feat(api): add batching resolver for post ref blocks

One query per entity type, and a missing entity resolves to null rather than
throwing — the Astro build is all-or-nothing, so a dangling ref that raised
would take down all 35 pages and crash-loop the web container.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 6: `PostBlockResource` and the two post resources

**Files:**
- Create: `api/app/Http/Resources/PostBlockResource.php`
- Modify: `api/app/Http/Resources/PostResource.php`
- Modify: `api/app/Http/Resources/PostSummaryResource.php`
- Test: `api/tests/Feature/PostBlockResourceTest.php`

**Interfaces:**
- Consumes: `PostBlockResolver::resolve` (Task 5), `EmbedProvider::embedId` (Task 1)
- Produces: `PostBlockResource::collection($blocks)`; `PostResource` emits `blocks`; `PostSummaryResource.excerpt` from the first text block

- [ ] **Step 1: Write the failing test**

Create `api/tests/Feature/PostBlockResourceTest.php`:

```php
<?php

use App\Models\Post;
use App\Models\PostBlock;
use App\Models\Release;

it('serialises a text block with the resolved locale and all translations', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->text('English body', 'Polski tekst')->create();

    $this->getJson("/api/posts/{$post->id}?lang=pl")
        ->assertSuccessful()
        ->assertJsonPath('data.blocks.0.type', 'text')
        ->assertJsonPath('data.blocks.0.body', 'Polski tekst')
        ->assertJsonPath('data.blocks.0.translations.body.en', 'English body');
});

it('serialises an embed block with its provider and extracted id', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->embed('https://vimeo.com/76979871', 'vimeo')->create();

    $this->getJson("/api/posts/{$post->id}")
        ->assertJsonPath('data.blocks.0.provider', 'vimeo')
        ->assertJsonPath('data.blocks.0.embed_id', '76979871');
});

it('serialises an image block as an absolute storage url', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->image('post-blocks/ab12cd.webp')->create();

    $this->getJson("/api/posts/{$post->id}")
        ->assertJsonPath('data.blocks.0.type', 'image')
        ->assertJsonPath('data.blocks.0.url', '/storage/post-blocks/ab12cd.webp');
});

it('serialises a resolved ref block', function () {
    $release = Release::factory()->create(['title' => 'Second Album']);
    $post    = Post::factory()->create();
    PostBlock::factory()->for($post)->ref('release', $release->id)->create();

    $this->getJson("/api/posts/{$post->id}")
        ->assertJsonPath('data.blocks.0.entity', 'release')
        ->assertJsonPath('data.blocks.0.data.title', 'Second Album');
});

// Emitted, not omitted: the public renderer skips it, but the admin needs to
// see it to offer "missing item — remove?".
it('emits a dangling ref with null data rather than omitting the block', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->ref('release', 999999)->create();

    $this->getJson("/api/posts/{$post->id}")
        ->assertJsonCount(1, 'data.blocks')
        ->assertJsonPath('data.blocks.0.data', null);
});

it('returns blocks in position order', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->at(1)->text('Second')->create();
    PostBlock::factory()->for($post)->at(0)->text('First')->create();

    $this->getJson("/api/posts/{$post->id}")
        ->assertJsonPath('data.blocks.0.body', 'First')
        ->assertJsonPath('data.blocks.1.body', 'Second');
});

describe('PostSummaryResource excerpt', function () {
    it('derives the excerpt from the first text block', function () {
        $post = Post::factory()->create(['intro' => null]);
        PostBlock::factory()->for($post)->at(0)->ref('release', 1)->create();
        PostBlock::factory()->for($post)->at(1)->text('The body of the article')->create();

        $this->getJson('/api/posts')->assertJsonPath('data.0.excerpt', 'The body of the article');
    });

    it('falls back to intro when there is no text block', function () {
        $post = Post::factory()->create(['intro' => 'Just an intro']);
        PostBlock::factory()->for($post)->image('post-blocks/x.webp')->create();

        $this->getJson('/api/posts')->assertJsonPath('data.0.excerpt', 'Just an intro');
    });

    // The listing has no use for block payloads, and web/ fetches it page by
    // page on every article page to build prev/next.
    it('does not serialise blocks in the listing', function () {
        $post = Post::factory()->create();
        PostBlock::factory()->for($post)->text('Body')->create();

        $this->getJson('/api/posts')->assertJsonMissingPath('data.0.blocks');
    });

    it('issues a constant number of queries regardless of post count', function () {
        Post::factory()->count(3)->create()->each(
            fn ($p) => PostBlock::factory()->for($p)->text('Body')->create()
        );

        DB::enableQueryLog();
        $this->getJson('/api/posts')->assertSuccessful();
        $few = count(DB::getQueryLog());
        DB::flushQueryLog();

        Post::factory()->count(9)->create()->each(
            fn ($p) => PostBlock::factory()->for($p)->text('Body')->create()
        );

        $this->getJson('/api/posts')->assertSuccessful();
        $many = count(DB::getQueryLog());
        DB::disableQueryLog();

        expect($many)->toBe($few);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockResourceTest
```
Expected: FAIL — `data.blocks` missing from the response

- [ ] **Step 3: Write `PostBlockResource`**

Create `api/app/Http/Resources/PostBlockResource.php`:

```php
<?php

namespace App\Http\Resources;

use App\Support\EmbedProvider;
use App\Support\PostBlockType;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * One block, shaped for its type.
 *
 * `ref` blocks need their entity resolved, which must happen in batch — so the
 * caller passes a pre-built map from PostBlockResolver via `withResolved()`
 * rather than each resource fetching its own entity.
 */
class PostBlockResource extends JsonResource
{
    /** @var array<int, array|null> */
    private array $resolved = [];

    /** @param array<int, array|null> $resolved */
    public function withResolved(array $resolved): static
    {
        $this->resolved = $resolved;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $locale  = app()->getLocale();
        $payload = $this->payload ?? [];

        $base = ['id' => $this->id, 'type' => $this->type, 'position' => $this->position];

        return match ($this->type) {
            PostBlockType::TEXT => $base + [
                'body'         => $this->translated($payload['body'] ?? [], $locale),
                'translations' => ['body' => $payload['body'] ?? ['en' => null, 'pl' => null]],
            ],

            PostBlockType::IMAGE => $base + [
                'path'         => $payload['path'] ?? null,
                'url'          => isset($payload['path']) ? Storage::url($payload['path']) : null,
                'alt'          => $this->translated($payload['alt'] ?? [], $locale),
                'caption'      => $this->translated($payload['caption'] ?? [], $locale),
                'translations' => [
                    'alt'     => $payload['alt'] ?? ['en' => null, 'pl' => null],
                    'caption' => $payload['caption'] ?? ['en' => null, 'pl' => null],
                ],
            ],

            PostBlockType::EMBED => $base + [
                'provider' => $payload['provider'] ?? 'link',
                'url'      => $payload['url'] ?? null,
                'label'    => $payload['label'] ?? null,
                'embed_id' => isset($payload['url']) ? EmbedProvider::embedId($payload['url']) : null,
            ],

            PostBlockType::REF => $base + [
                'entity' => $payload['entity'] ?? null,
                // null means the entity was deleted. Emitted rather than
                // omitted so the admin can show "missing item — remove?"; the
                // public dispatcher skips it.
                'data'   => $this->resolved[$this->id] ?? null,
            ],

            default => $base + ['payload' => $payload],
        };
    }

    /** Resolve a {en, pl} bag for the request locale, falling back to the other. */
    private function translated(array $bag, string $locale): ?string
    {
        foreach (\App\Support\Locales::chain($locale) as $code) {
            if (filled($bag[$code] ?? null)) {
                return $bag[$code];
            }
        }

        return null;
    }
}
```

- [ ] **Step 4: Update `PostResource`**

In `api/app/Http/Resources/PostResource.php`, delete the `content` key, the `translations.content` entry, and the `links`, `concerts`, `albums`, `releases`, `tours`, `music_videos` and `press_releases` keys. Add, after `translations`:

```php
            'blocks' => $this->whenLoaded('blocks', fn () => PostBlockResource::collection($this->blocks)
                ->each(fn ($r) => $r->withResolved(\App\Support\PostBlockResolver::resolve($this->blocks)))),
```

- [ ] **Step 5: Update `PostSummaryResource`**

Replace the `$content` line and the `excerpt` key:

```php
        // content is gone; the excerpt now comes from the first text block, and
        // falls back to intro. It feeds <meta description> and the JSON-LD on
        // both article routes, so it cannot simply be dropped.
        $firstText = $this->relationLoaded('blocks')
            ? $this->blocks->firstWhere('type', 'text')
            : null;

        $body = $firstText
            ? ($firstText->payload['body'][app()->getLocale()] ?? $firstText->payload['body']['en'] ?? '')
            : '';

        $excerpt = Str::limit(strip_tags($body) ?: (string) $this->intro, 280);
```

and use `'excerpt' => $excerpt,`.

- [ ] **Step 6: Constrain the index eager-load**

In `PostController::index`, add to the `->with([...])` call:

```php
            ->with(['tags', 'blocks' => fn ($q) => $q->where('type', 'text')->orderBy('position')->limit(1)])
```

and change the search `orWhere('content', ...)` clause to search blocks instead:

```php
                    ->orWhereHas('blocks', fn ($b) => $b
                        ->where('type', 'text')
                        ->where('payload', 'like', '%' . $request->search . '%'))
```

- [ ] **Step 7: Run test to verify it passes**

```bash
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockResourceTest
```
Expected: PASS — 10 tests

- [ ] **Step 8: Commit**

```bash
git add api/app/Http/Resources/ api/app/Http/Controllers/PostController.php api/tests/Feature/PostBlockResourceTest.php
git commit -m "feat(api): serialise post blocks and re-derive excerpt

A dangling ref emits data: null rather than being omitted, so the admin can
offer to remove it while the public renderer skips it.

The index eager-loads exactly one text block per post for the excerpt and does
not serialise block payloads: web/ walks every page of that endpoint on every
article page, so an N+1 there multiplies across the whole static build. A test
pins the query count against post count.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 7: Form Requests, block writes, `SiteRebuild`

**Files:**
- Create: `api/app/Http/Requests/Concerns/PostRules.php`
- Create: `api/app/Http/Requests/StorePostRequest.php`
- Create: `api/app/Http/Requests/UpdatePostRequest.php`
- Create: `api/app/Support/PostBlockSync.php`
- Modify: `api/app/Http/Controllers/PostController.php`
- Modify: `api/tests/Feature/PostTest.php` (fix the Task 4 failures)
- Test: `api/tests/Feature/PostBlockWriteTest.php`

**Interfaces:**
- Consumes: `PostBlockType` (1), `EmbedProvider` (1), `PostBlock` (2)
- Produces: `PostBlockSync::sync(Post $post, array $blocks): void`

- [ ] **Step 1: Write the failing test**

Create `api/tests/Feature/PostBlockWriteTest.php`:

```php
<?php

use App\Models\Post;
use App\Models\PostBlock;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Laravel\Passport\Passport;

beforeEach(function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));
    Http::fake();
});

it('creates a post with blocks in the submitted order', function () {
    $this->postJson('/api/posts', [
        'title'  => ['en' => 'Blocked post'],
        'blocks' => [
            ['type' => 'text',  'payload' => ['body' => ['en' => 'First']]],
            ['type' => 'embed', 'payload' => ['url' => 'https://youtu.be/dQw4w9WgXcQ']],
            ['type' => 'text',  'payload' => ['body' => ['en' => 'Third']]],
        ],
    ])->assertCreated()
      ->assertJsonPath('data.blocks.0.body', 'First')
      ->assertJsonPath('data.blocks.1.provider', 'youtube')
      ->assertJsonPath('data.blocks.2.body', 'Third');
});

// Position comes from the array index, never from insertion order. This is the
// trap post_links fell into: it ordered correctly only because delete-and-
// recreate happened to make auto-increment id match.
it('sets position from the array index', function () {
    $this->postJson('/api/posts', [
        'title'  => ['en' => 'Positions'],
        'blocks' => [
            ['type' => 'text', 'payload' => ['body' => ['en' => 'A']]],
            ['type' => 'text', 'payload' => ['body' => ['en' => 'B']]],
        ],
    ])->assertCreated();

    expect(PostBlock::orderBy('position')->pluck('position')->all())->toBe([0, 1]);
});

it('replaces blocks wholesale on update', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->text('Old')->create();

    $this->putJson("/api/posts/{$post->id}", [
        'title'  => ['en' => $post->title],
        'blocks' => [['type' => 'text', 'payload' => ['body' => ['en' => 'New']]]],
    ])->assertSuccessful();

    expect($post->blocks()->count())->toBe(1);
    expect($post->blocks()->first()->payload['body']['en'])->toBe('New');
});

it('leaves blocks alone when the key is absent from an update', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->text('Kept')->create();

    $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'Renamed']])->assertSuccessful();

    expect($post->blocks()->count())->toBe(1);
});

it('clears blocks when an empty array is sent', function () {
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->text('Gone')->create();

    $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'X'], 'blocks' => []])->assertSuccessful();

    expect($post->blocks()->count())->toBe(0);
});

it('detects and stores the embed provider server-side', function () {
    $this->postJson('/api/posts', [
        'title'  => ['en' => 'Embeds'],
        'blocks' => [['type' => 'embed', 'payload' => ['url' => 'https://vimeo.com/76979871']]],
    ])->assertCreated();

    expect(PostBlock::first()->payload['provider'])->toBe('vimeo');
});

describe('validation', function () {
    it('rejects an unknown block type', function () {
        $this->postJson('/api/posts', [
            'title'  => ['en' => 'X'],
            'blocks' => [['type' => 'carousel', 'payload' => []]],
        ])->assertStatus(422)->assertJsonValidationErrors('blocks.0.type');
    });

    it('rejects an embed block with no url', function () {
        $this->postJson('/api/posts', [
            'title'  => ['en' => 'X'],
            'blocks' => [['type' => 'embed', 'payload' => ['label' => 'nope']]],
        ])->assertStatus(422)->assertJsonValidationErrors('blocks.0.payload.url');
    });

    it('rejects a ref block naming an entity that is not a ref target', function () {
        $this->postJson('/api/posts', [
            'title'  => ['en' => 'X'],
            'blocks' => [['type' => 'ref', 'payload' => ['entity' => 'tour', 'id' => 1]]],
        ])->assertStatus(422)->assertJsonValidationErrors('blocks.0.payload.entity');
    });

    it('rejects an image block with no path', function () {
        $this->postJson('/api/posts', [
            'title'  => ['en' => 'X'],
            'blocks' => [['type' => 'image', 'payload' => ['alt' => ['en' => 'x']]]],
        ])->assertStatus(422)->assertJsonValidationErrors('blocks.0.payload.path');
    });
});

// A failure in the block loop must not leave a half-saved post behind.
it('rolls the post back when a block write fails', function () {
    $before = Post::count();

    $this->postJson('/api/posts', [
        'title'  => ['en' => 'Doomed'],
        'blocks' => [['type' => 'text', 'payload' => ['body' => ['en' => str_repeat('x', 70000)]]]],
    ]);

    expect(Post::count())->toBe($before);
})->skip(fn () => DB::connection()->getDriverName() === 'sqlite', 'SQLite does not enforce the length that trips this');

describe('SiteRebuild', function () {
    beforeEach(fn () => \App\Models\SiteSetting::set('auto_rebuild', 'true'));

    it('requests a rebuild on create, update and delete', function () {
        $this->postJson('/api/posts', ['title' => ['en' => 'A']])->assertCreated();
        $post = Post::first();
        $this->putJson("/api/posts/{$post->id}", ['title' => ['en' => 'B']])->assertSuccessful();
        $this->deleteJson("/api/posts/{$post->id}")->assertNoContent();

        Http::assertSentCount(3);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockWriteTest
```
Expected: FAIL — blocks are ignored by the controller

- [ ] **Step 3: Write the shared rules trait**

Create `api/app/Http/Requests/Concerns/PostRules.php`:

```php
<?php

namespace App\Http\Requests\Concerns;

use App\Support\EmbedProvider;
use App\Support\PostBlockType;
use Illuminate\Validation\Rule;

trait PostRules
{
    /** Everything except the slug uniqueness rule, which differs per verb. */
    protected function sharedRules(): array
    {
        return [
            'title.en'      => 'nullable|string|max:255',
            'title.pl'      => 'nullable|string|max:255',
            'intro'         => 'nullable',
            'intro.en'      => 'nullable|string|max:1000',
            'intro.pl'      => 'nullable|string|max:1000',
            'image'         => ['nullable', 'string', 'regex:/^data:image\/(jpeg|jpg|png|gif|webp);base64,/'],
            'published_at'  => 'nullable|date',
            'event_date'    => 'nullable|date',
            'tag_ids'       => 'nullable|array',
            'tag_ids.*'     => 'integer|exists:tags,id',

            'blocks'                    => 'nullable|array',
            'blocks.*.type'             => ['required', Rule::in(PostBlockType::ALL)],
            'blocks.*.payload'          => 'required|array',
            'blocks.*.payload.body.en'  => 'nullable|string',
            'blocks.*.payload.body.pl'  => 'nullable|string',
            'blocks.*.payload.alt.en'   => 'nullable|string|max:255',
            'blocks.*.payload.alt.pl'   => 'nullable|string|max:255',
            'blocks.*.payload.caption.en' => 'nullable|string|max:500',
            'blocks.*.payload.caption.pl' => 'nullable|string|max:500',
            'blocks.*.payload.label'    => 'nullable|string|max:255',
        ];
    }

    /**
     * Per-type payload rules, which Laravel's flat `blocks.*` syntax cannot
     * express — the required fields depend on each row's own `type`.
     */
    protected function blockPayloadRules(array $blocks): array
    {
        $rules = [];

        foreach ($blocks as $i => $block) {
            $rules += match ($block['type'] ?? null) {
                PostBlockType::IMAGE => ["blocks.{$i}.payload.path" => 'required|string|max:2048'],
                PostBlockType::EMBED => ["blocks.{$i}.payload.url"  => 'required|string|url|max:2048'],
                PostBlockType::REF   => [
                    "blocks.{$i}.payload.entity" => ['required', Rule::in(PostBlockType::REF_ENTITIES)],
                    "blocks.{$i}.payload.id"     => 'required|integer|min:1',
                ],
                PostBlockType::TEXT  => ["blocks.{$i}.payload.body" => 'required|array'],
                default              => [],
            };
        }

        return $rules;
    }

    /** Stamp the detected provider onto every embed block before validation. */
    protected function normaliseBlocks(array $blocks): array
    {
        foreach ($blocks as $i => $block) {
            if (($block['type'] ?? null) === PostBlockType::EMBED && isset($block['payload']['url'])) {
                $blocks[$i]['payload']['provider'] = EmbedProvider::detect($block['payload']['url']);
            }
        }

        return $blocks;
    }
}
```

- [ ] **Step 4: Write the two Form Requests**

Create `api/app/Http/Requests/StorePostRequest.php`:

```php
<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\PostRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePostRequest extends FormRequest
{
    use PostRules;

    public function authorize(): bool
    {
        return true; // route is behind auth:api
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('blocks')) {
            $this->merge(['blocks' => $this->normaliseBlocks($this->input('blocks', []))]);
        }
    }

    public function rules(): array
    {
        return $this->sharedRules() + $this->blockPayloadRules($this->input('blocks', [])) + [
            'title'   => 'required',
            'slug_en' => ['nullable', 'string', 'max:255', Rule::unique('posts', 'slug_en')],
            'slug_pl' => ['nullable', 'string', 'max:255', Rule::unique('posts', 'slug_pl')],
        ];
    }
}
```

Create `api/app/Http/Requests/UpdatePostRequest.php` — identical, but:

```php
    public function rules(): array
    {
        return $this->sharedRules() + $this->blockPayloadRules($this->input('blocks', [])) + [
            'title'   => 'sometimes|required',
            'slug_en' => ['nullable', 'string', 'max:255', Rule::unique('posts', 'slug_en')->ignore($this->route('post')->id)],
            'slug_pl' => ['nullable', 'string', 'max:255', Rule::unique('posts', 'slug_pl')->ignore($this->route('post')->id)],
        ];
    }
```

- [ ] **Step 5: Write `PostBlockSync`**

Create `api/app/Support/PostBlockSync.php`:

```php
<?php

namespace App\Support;

use App\Models\Post;
use Illuminate\Support\Facades\Storage;

/**
 * Replaces a post's blocks and cleans up the images that fall out of use.
 *
 * Delete-and-recreate, matching what post_links did — but `position` is set
 * explicitly from the array index rather than left to auto-increment id order.
 * The old arrangement only worked by accident, and scrambles the editor's drag
 * order the moment anything stops recreating from scratch.
 */
final class PostBlockSync
{
    /** @param list<array{type: string, payload: array}> $blocks */
    public static function sync(Post $post, array $blocks): void
    {
        $oldPaths = self::imagePaths($post->blocks()->get()->all());

        $post->blocks()->delete();

        foreach ($blocks as $i => $block) {
            $post->blocks()->create([
                'position' => $i,
                'type'     => $block['type'],
                'payload'  => $block['payload'],
            ]);
        }

        $newPaths = array_column(
            array_filter($blocks, fn ($b) => $b['type'] === PostBlockType::IMAGE),
            'payload'
        );
        $newPaths = array_filter(array_column($newPaths, 'path'));

        foreach (array_diff($oldPaths, $newPaths) as $orphan) {
            Storage::disk('public')->delete($orphan);
        }
    }

    /** Every image path a post's blocks reference. Used on delete, too. */
    public static function imagePaths(array $blocks): array
    {
        return array_values(array_filter(array_map(
            fn ($b) => $b->type === PostBlockType::IMAGE ? ($b->payload['path'] ?? null) : null,
            $blocks
        )));
    }
}
```

- [ ] **Step 6: Rewrite the controller's write path**

In `api/app/Http/Controllers/PostController.php`: replace `Request $request` with the Form Requests in `store`/`update`, delete every `*_ids` sync except `tags`, wrap in a transaction, and fire `SiteRebuild`. `store` becomes:

```php
    public function store(StorePostRequest $request): PostResource
    {
        $data = $request->validated();

        $post = DB::transaction(function () use ($data) {
            $titleEn = is_array($data['title']) ? ($data['title']['en'] ?? reset($data['title']) ?? 'post') : $data['title'];
            $titlePl = is_array($data['title']) ? ($data['title']['pl'] ?? null) : null;

            $post = Post::create([
                'title'        => $data['title'],
                'slug_en'      => ($data['slug_en'] ?? null) ?: Post::generateSlug($titleEn, null, 'slug_en'),
                'slug_pl'      => ($data['slug_pl'] ?? null) ?: ($titlePl ? Post::generateSlug($titlePl, null, 'slug_pl') : null),
                'intro'        => $data['intro'] ?? null,
                'image'        => $data['image'] ?? null,
                'published_at' => $data['published_at'] ?? null,
                'event_date'   => $data['event_date'] ?? null,
            ]);

            if (! empty($data['tag_ids'])) {
                $post->tags()->sync($data['tag_ids']);
            }

            PostBlockSync::sync($post, $data['blocks'] ?? []);

            return $post;
        });

        // Posts are baked into the static site. PostController never called this
        // — with auto-rebuild on, the admin hides its manual button, so a save
        // had no way at all to reach the public site.
        SiteRebuild::requestIfAuto();

        return new PostResource($post->load(['tags', 'blocks']));
    }
```

`update` mirrors it, guarding the block write on presence:

```php
            if (array_key_exists('blocks', $data)) {
                PostBlockSync::sync($post, $data['blocks'] ?? []);
            }
```

`destroy` gains, before `$post->delete()`:

```php
        foreach (PostBlockSync::imagePaths($post->blocks()->get()->all()) as $path) {
            Storage::disk('public')->delete($path);
        }
```

and `SiteRebuild::requestIfAuto();` after.

Add the imports: `StorePostRequest`, `UpdatePostRequest`, `PostBlockSync`, `SiteRebuild`, `DB`, `Storage`.

- [ ] **Step 7: Fix the pre-existing `PostTest` failures**

In `api/tests/Feature/PostTest.php`: delete the `filters by search term in content` test's `'content' => ...` factory args and replace the assertion with a block-based one:

```php
    it('filters by search term in a text block', function () {
        $a = Post::factory()->create(['title' => 'Post A']);
        PostBlock::factory()->for($a)->text('We talked about amplifiers')->create();
        Post::factory()->create(['title' => 'Post B']);

        $this->getJson('/api/posts?search=amplifiers')
            ->assertSuccessful()
            ->assertJsonCount(1, 'data');
    });
```

Add `use App\Models\PostBlock;`. Delete any remaining assertion naming `content`, `links`, `concerts`, `albums`, `releases`, `tours` or `music_videos` on a post payload — those relations no longer exist.

- [ ] **Step 8: Run the full backend suite**

```bash
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test
```
Expected: PASS — all green, including `PressReleaseTest` and `ShopTest`, whose pivots were deliberately left intact.

- [ ] **Step 9: Commit**

```bash
git add api/ && git commit -m "feat(api): write post blocks through form requests

Position is set from the array index rather than left to auto-increment order,
and the post-plus-blocks write is one transaction so a failure mid-loop cannot
leave a half-saved post.

Adds the SiteRebuild call PostController has never had: posts are baked, and
with auto-rebuild on the admin hides its manual button, so a save previously
had no route to the public site at all.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 8: Image upload endpoint

**Files:**
- Modify: `api/app/Http/Controllers/PostController.php` (add `uploadBlockImage`)
- Modify: `api/routes/api.php`
- Test: `api/tests/Feature/PostBlockUploadTest.php`

**Interfaces:**
- Consumes: nothing new
- Produces: `POST /api/posts/blocks/image` → `201 {path, url}`

> Standalone, not per-post: a picture block can be added to a post that does not exist yet, so `ConcertController::uploadPoster` (which needs an existing `Concert`) cannot be copied.

- [ ] **Step 1: Write the failing test**

Create `api/tests/Feature/PostBlockUploadTest.php`:

```php
<?php

use App\Models\Post;
use App\Models\PostBlock;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Passport\Passport;

beforeEach(function () {
    Storage::fake('public');
    Http::fake();
});

it('rejects an anonymous upload', function () {
    $this->postJson('/api/posts/blocks/image', ['image' => UploadedFile::fake()->image('x.jpg')])
        ->assertUnauthorized();
});

it('stores an uploaded image and returns its path and url', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $res = $this->postJson('/api/posts/blocks/image', ['image' => UploadedFile::fake()->image('shot.jpg')])
        ->assertCreated();

    $path = $res->json('path');
    expect($path)->toStartWith('post-blocks/');
    expect($res->json('url'))->toBe('/storage/' . $path);
    Storage::disk('public')->assertExists($path);
});

it('rejects a non-image and an oversized file', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $this->postJson('/api/posts/blocks/image', ['image' => UploadedFile::fake()->create('doc.pdf', 10)])
        ->assertStatus(422);

    $this->postJson('/api/posts/blocks/image', ['image' => UploadedFile::fake()->image('big.jpg')->size(5000)])
        ->assertStatus(422);
});

it('deletes an image file that an update drops from the blocks', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $path = UploadedFile::fake()->image('a.jpg')->store('post-blocks', 'public');
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->image($path)->create();

    $this->putJson("/api/posts/{$post->id}", [
        'title'  => ['en' => 'X'],
        'blocks' => [['type' => 'text', 'payload' => ['body' => ['en' => 'no image now']]]],
    ])->assertSuccessful();

    Storage::disk('public')->assertMissing($path);
});

it('keeps an image file that survives an update', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $path = UploadedFile::fake()->image('a.jpg')->store('post-blocks', 'public');
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->image($path)->create();

    $this->putJson("/api/posts/{$post->id}", [
        'title'  => ['en' => 'X'],
        'blocks' => [['type' => 'image', 'payload' => ['path' => $path]]],
    ])->assertSuccessful();

    Storage::disk('public')->assertExists($path);
});

it('deletes every block image when the post is deleted', function () {
    Passport::actingAs(User::factory()->create(['role' => 'admin']));

    $path = UploadedFile::fake()->image('a.jpg')->store('post-blocks', 'public');
    $post = Post::factory()->create();
    PostBlock::factory()->for($post)->image($path)->create();

    $this->deleteJson("/api/posts/{$post->id}")->assertNoContent();

    Storage::disk('public')->assertMissing($path);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockUploadTest
```
Expected: FAIL — 404, the route does not exist

- [ ] **Step 3: Add the controller action**

In `PostController`:

```php
    /**
     * Standalone rather than per-post: a picture block can be added to a post
     * that does not exist yet, so the upload has to happen before there is an
     * id to hang it on.
     */
    public function uploadBlockImage(Request $request): JsonResponse
    {
        $request->validate(['image' => 'required|image|max:4096']);

        $path = $request->file('image')->store('post-blocks', 'public');

        return response()->json(['path' => $path, 'url' => Storage::url($path)], 201);
    }
```

- [ ] **Step 4: Add the route**

In `api/routes/api.php`, inside the same publisher+admin group as the other post routes, **above** `Route::put('/posts/{post}', ...)` so the literal segment is not captured as a `{post}`:

```php
    Route::post('/posts/blocks/image', [PostController::class, 'uploadBlockImage'])
        ->name('api.posts.blocks.image');
```

- [ ] **Step 5: Run test to verify it passes**

```bash
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter PostBlockUploadTest
```
Expected: PASS — 6 tests

- [ ] **Step 6: Commit**

```bash
git add api/ && git commit -m "feat(api): add post block image upload with orphan cleanup

Standalone rather than per-post, because a picture block can be added before
the post exists. Update diffs outgoing against incoming paths and deletes what
falls out of use; delete clears the rest.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 9: Admin types, pure helpers, upload client

**Files:**
- Modify: `app/src/types/post.ts`
- Create: `app/src/utils/postBlocks.ts`
- Create: `app/src/utils/postBlocks.spec.ts`
- Create: `app/src/api/postBlocks.ts`

**Interfaces:**
- Consumes: the API shapes from Tasks 6 and 8
- Produces:
  - `PostBlock` (discriminated union on `type`), `PostBlockDraft`, `PostBlockType`, `EmbedProviderName`, `RefEntity`
  - `defaultPayload(type: PostBlockType): PostBlockDraft['payload']`
  - `move<T>(list: T[], from: number, to: number): T[]`
  - `providerLabel(p: EmbedProviderName): string`
  - `uploadPostBlockImage(token: string, file: File): Promise<{ path: string; url: string }>`

> `move` and `defaultPayload` live in `utils/`, not a composable: the admin's vitest environment is `node` and any composable importing `useAuth` dies on `localStorage` at module load. The test file is `.spec.ts` — `app/vitest.config.ts` includes only `src/**/*.spec.ts`, so a `.test.ts` here would be collected as nothing and pass vacuously.

- [ ] **Step 1: Write the failing test**

Create `app/src/utils/postBlocks.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { defaultPayload, move, providerLabel } from './postBlocks'

describe('move', () => {
  it('moves an item down', () => {
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('moves an item up', () => {
    expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('returns an equal list when from === to', () => {
    expect(move(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c']
    move(input, 0, 2)
    expect(input).toEqual(['a', 'b', 'c'])
  })

  // A drag that lands outside the list must be a no-op, not a hole in the array.
  it('ignores an out-of-range index', () => {
    expect(move(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
    expect(move(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(move(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
  })
})

describe('defaultPayload', () => {
  it('gives a text block an empty translation bag', () => {
    expect(defaultPayload('text')).toEqual({ body: { en: '', pl: '' } })
  })

  it('gives an image block empty alt and caption bags', () => {
    expect(defaultPayload('image')).toEqual({
      path: '', alt: { en: '', pl: '' }, caption: { en: '', pl: '' },
    })
  })

  it('gives an embed block a url and a null label', () => {
    expect(defaultPayload('embed')).toEqual({ url: '', label: null })
  })

  it('defaults a ref block to a concert with no id', () => {
    expect(defaultPayload('ref')).toEqual({ entity: 'concert', id: 0 })
  })
})

describe('providerLabel', () => {
  it('labels each provider for the badge', () => {
    expect(providerLabel('youtube')).toBe('YouTube')
    expect(providerLabel('vimeo')).toBe('Vimeo')
    expect(providerLabel('instagram')).toBe('Instagram')
    expect(providerLabel('tiktok')).toBe('TikTok')
    expect(providerLabel('link')).toBe('Link')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd app && pnpm vitest run src/utils/postBlocks.spec.ts
```
Expected: FAIL — cannot resolve `./postBlocks`

- [ ] **Step 3: Write the types**

In `app/src/types/post.ts`, delete `PostLinkType` and `PostLink`, delete `content` and `links` from `Post`, and add:

```ts
export type PostBlockType     = 'text' | 'image' | 'embed' | 'ref'
export type EmbedProviderName = 'youtube' | 'vimeo' | 'instagram' | 'tiktok' | 'link'
export type RefEntity = 'concert' | 'album' | 'release' | 'music_video' | 'press_release' | 'shop_item'

interface BlockBase { id: number; position: number }
type Bag = { en?: string | null; pl?: string | null }

export interface TextBlock extends BlockBase {
  type: 'text'
  body: string | null
  translations: { body: Bag }
}

export interface ImageBlock extends BlockBase {
  type: 'image'
  path: string | null
  url: string | null
  alt: string | null
  caption: string | null
  translations: { alt: Bag; caption: Bag }
}

export interface EmbedBlock extends BlockBase {
  type: 'embed'
  provider: EmbedProviderName
  url: string | null
  label: string | null
  /** null when the URL names no single item — render as a link, not an iframe. */
  embed_id: string | null
}

export interface RefBlock extends BlockBase {
  type: 'ref'
  entity: RefEntity
  /** null when the referenced record was deleted. */
  data: Record<string, unknown> | null
}

export type PostBlock = TextBlock | ImageBlock | EmbedBlock | RefBlock

/** What the editor holds and submits — no id, no server-derived fields. */
export interface PostBlockDraft {
  type: PostBlockType
  payload: Record<string, unknown>
}
```

Add `blocks: PostBlock[]` to `Post`, and `blocks?: PostBlockDraft[]` to `PostPayload` (removing `links` and the five `*_ids` arrays).

- [ ] **Step 4: Write the helpers**

Create `app/src/utils/postBlocks.ts`:

```ts
import type { PostBlockType, EmbedProviderName, PostBlockDraft } from '@/types/post'

/**
 * Lives in utils/, not a composable, so vitest can import it: the admin's test
 * environment is `node`, and any composable that reaches useAuth dies reading
 * localStorage at module load.
 */
export function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return [...list]
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list]

  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function defaultPayload(type: PostBlockType): PostBlockDraft['payload'] {
  switch (type) {
    case 'text':  return { body: { en: '', pl: '' } }
    case 'image': return { path: '', alt: { en: '', pl: '' }, caption: { en: '', pl: '' } }
    case 'embed': return { url: '', label: null }
    case 'ref':   return { entity: 'concert', id: 0 }
  }
}

const PROVIDER_LABELS: Record<EmbedProviderName, string> = {
  youtube: 'YouTube', vimeo: 'Vimeo', instagram: 'Instagram', tiktok: 'TikTok', link: 'Link',
}

export function providerLabel(p: EmbedProviderName): string {
  return PROVIDER_LABELS[p] ?? 'Link'
}
```

- [ ] **Step 5: Write the upload client**

Create `app/src/api/postBlocks.ts`:

```ts
import { API_BASE, handleResponse } from './client'

export interface UploadedBlockImage { path: string; url: string }

/** Multipart, so no Content-Type header — the browser sets the boundary. */
export async function uploadPostBlockImage(token: string, file: File): Promise<UploadedBlockImage> {
  const body = new FormData()
  body.append('image', file)

  const res = await fetch(`${API_BASE}/api/posts/blocks/image`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    body,
  })
  return handleResponse<UploadedBlockImage>(res)
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd app && pnpm vitest run src/utils/postBlocks.spec.ts
```
Expected: PASS — 13 tests. **Confirm the count went up** rather than only that the run was green; a misnamed file collects nothing and still reports success.

- [ ] **Step 7: Commit**

```bash
git add app/src/types/post.ts app/src/utils/postBlocks.ts app/src/utils/postBlocks.spec.ts app/src/api/postBlocks.ts
git commit -m "feat(app): add post block types, pure helpers and upload client

Helpers live in utils/ rather than a composable so vitest can import them at
all — the admin's node environment dies on useAuth reading localStorage at
module load. Named .spec.ts because app/vitest.config.ts includes only that
pattern.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 10: The block editor components

**Files:**
- Create: `app/src/components/admin/forms/blocks/TextBlockEditor.vue`
- Create: `app/src/components/admin/forms/blocks/ImageBlockEditor.vue`
- Create: `app/src/components/admin/forms/blocks/EmbedBlockEditor.vue`
- Create: `app/src/components/admin/forms/blocks/RefBlockEditor.vue`
- Create: `app/src/components/admin/forms/PostBlockEditor.vue`
- Modify: `app/src/components/admin/forms/PostForm.vue`
- Modify: `app/src/views/admin/PostsAdminView.vue`

**Interfaces:**
- Consumes: `defaultPayload`, `move`, `providerLabel`, `uploadPostBlockImage` (Task 9)
- Produces: `<PostBlockEditor v-model="blocks" :entities="…" />` where `blocks: PostBlockDraft[]` and `entities: RefEntityLists`

Each per-type editor takes `v-model:payload` (a `Record<string, unknown>`) and emits `update:payload`. `PostBlockEditor` owns add/remove/reorder; the leaf editors only edit their own payload.

- [ ] **Step 1: Write `TextBlockEditor.vue`**

```vue
<script setup lang="ts">
const props = defineProps<{ payload: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const body = () => (props.payload.body ?? {}) as { en?: string; pl?: string }

function set(locale: 'en' | 'pl', value: string) {
  emit('update:payload', { ...props.payload, body: { ...body(), [locale]: value } })
}
</script>

<template>
  <div class="trans-group">
    <div class="trans-row trans-row--top">
      <span class="lang-badge">EN</span>
      <textarea
        :value="body().en ?? ''"
        @input="set('en', ($event.target as HTMLTextAreaElement).value)"
        class="field-input flex-1" rows="5" placeholder="Paragraph text…"
      />
    </div>
    <div class="trans-row trans-row--top">
      <span class="lang-badge lang-badge--pl">PL</span>
      <textarea
        :value="body().pl ?? ''"
        @input="set('pl', ($event.target as HTMLTextAreaElement).value)"
        class="field-input flex-1" rows="5" placeholder="Treść akapitu…"
      />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Write `EmbedBlockEditor.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { providerLabel } from '@/utils/postBlocks'
import type { EmbedProviderName } from '@/types/post'

const props = defineProps<{ payload: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const url = computed(() => (props.payload.url as string) ?? '')

/**
 * Preview only. The server detects and stores the provider on save — this
 * mirrors the same host list so the editor sees what it will get, and the two
 * cannot disagree about the stored value because the client never sends one.
 */
const detected = computed<EmbedProviderName>(() => {
  const u = url.value.toLowerCase()
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('vimeo.com')) return 'vimeo'
  if (u.includes('instagram.com')) return 'instagram'
  if (u.includes('tiktok.com')) return 'tiktok'
  return 'link'
})

function set(key: string, value: unknown) {
  emit('update:payload', { ...props.payload, [key]: value })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <input
        :value="url" @input="set('url', ($event.target as HTMLInputElement).value)"
        class="field-input flex-1" placeholder="Paste a YouTube, Vimeo, Instagram or TikTok URL" required
      />
      <span v-if="url" class="provider-badge">{{ providerLabel(detected) }}</span>
    </div>
    <input
      v-if="detected === 'link'"
      :value="(payload.label as string) ?? ''"
      @input="set('label', ($event.target as HTMLInputElement).value || null)"
      class="field-input" placeholder="Link text (optional)"
    />
  </div>
</template>

<style scoped src="../../form-styles.css" />
<style scoped>
.provider-badge {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em;
  padding: 0.25rem 0.5rem; border-radius: 0.25rem; flex-shrink: 0;
  background: #1e3a5f; color: #60a5fa; text-transform: uppercase;
}
</style>
```

- [ ] **Step 3: Write `ImageBlockEditor.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { uploadPostBlockImage } from '@/api/postBlocks'
import { useAuth } from '@/composables/useAuth'

const props = defineProps<{ payload: Record<string, unknown> }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

const { token } = useAuth()
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const bag = (key: 'alt' | 'caption') => (props.payload[key] ?? {}) as { en?: string; pl?: string }

function set(key: string, value: unknown) {
  emit('update:payload', { ...props.payload, [key]: value })
}

async function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const { path, url } = await uploadPostBlockImage(token.value!, file)
    // `url` is kept alongside `path` purely so the editor can show a preview
    // before the post is saved; only `path` is submitted.
    emit('update:payload', { ...props.payload, path, url })
  } catch {
    toast.error('Image upload failed')
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="payload.url || payload.path" class="img-preview">
      <img :src="(payload.url as string) ?? `/storage/${payload.path}`" alt="" class="img-preview-el" />
      <button type="button" class="btn-remove" @click="set('path', '')" title="Remove image">✕</button>
    </div>
    <div v-else class="siu-drop" @click="fileInput?.click()">
      <span class="siu-label">{{ uploading ? 'Uploading…' : 'Click to upload an image' }}</span>
      <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFile" />
    </div>

    <div class="trans-group">
      <div class="trans-row">
        <span class="lang-badge">EN</span>
        <input :value="bag('alt').en ?? ''" @input="set('alt', { ...bag('alt'), en: ($event.target as HTMLInputElement).value })"
               class="field-input flex-1" placeholder="Alt text (describes the image)" />
      </div>
      <div class="trans-row">
        <span class="lang-badge lang-badge--pl">PL</span>
        <input :value="bag('alt').pl ?? ''" @input="set('alt', { ...bag('alt'), pl: ($event.target as HTMLInputElement).value })"
               class="field-input flex-1" placeholder="Tekst alternatywny" />
      </div>
      <div class="trans-row">
        <span class="lang-badge">EN</span>
        <input :value="bag('caption').en ?? ''" @input="set('caption', { ...bag('caption'), en: ($event.target as HTMLInputElement).value })"
               class="field-input flex-1" placeholder="Caption (optional)" />
      </div>
      <div class="trans-row">
        <span class="lang-badge lang-badge--pl">PL</span>
        <input :value="bag('caption').pl ?? ''" @input="set('caption', { ...bag('caption'), pl: ($event.target as HTMLInputElement).value })"
               class="field-input flex-1" placeholder="Podpis" />
      </div>
    </div>
  </div>
</template>

<style scoped src="../../form-styles.css" />
<style scoped>
.img-preview { position: relative; display: inline-block; }
.img-preview-el { max-height: 10rem; border-radius: 0.375rem; display: block; }
.siu-drop {
  border: 2px dashed #3f3f46; border-radius: 0.375rem; padding: 1.25rem;
  text-align: center; cursor: pointer; color: #a1a1aa;
}
</style>
```

- [ ] **Step 4: Write `RefBlockEditor.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { RefEntity } from '@/types/post'

export interface RefEntityLists {
  concert:       { id: number; label: string }[]
  album:         { id: number; label: string }[]
  release:       { id: number; label: string }[]
  music_video:   { id: number; label: string }[]
  press_release: { id: number; label: string }[]
  shop_item:     { id: number; label: string }[]
}

const props = defineProps<{ payload: Record<string, unknown>; entities: RefEntityLists }>()
const emit = defineEmits<{ 'update:payload': [Record<string, unknown>] }>()

// `tour` is absent on purpose: tours have no public page, so a tour reference
// could only link somewhere that isn't built.
const ENTITY_LABELS: Record<RefEntity, string> = {
  concert: 'Concert', album: 'Photo album', release: 'Release',
  music_video: 'Music video', press_release: 'Press coverage', shop_item: 'Shop item',
}

const entity = computed(() => (props.payload.entity as RefEntity) ?? 'concert')
const items  = computed(() => props.entities[entity.value] ?? [])

function setEntity(value: RefEntity) {
  // Reset the id: an id from the previous list means nothing in the new one.
  emit('update:payload', { ...props.payload, entity: value, id: 0 })
}
</script>

<template>
  <div class="flex gap-2">
    <select :value="entity" @change="setEntity(($event.target as HTMLSelectElement).value as RefEntity)"
            class="field-input" style="width:11rem; flex-shrink:0;">
      <option v-for="(label, key) in ENTITY_LABELS" :key="key" :value="key">{{ label }}</option>
    </select>
    <select :value="payload.id ?? 0"
            @change="emit('update:payload', { ...payload, id: Number(($event.target as HTMLSelectElement).value) })"
            class="field-input flex-1" required>
      <option :value="0" disabled>Choose an item…</option>
      <option v-for="i in items" :key="i.id" :value="i.id">{{ i.label }}</option>
    </select>
  </div>
</template>

<style scoped src="../../form-styles.css" />
```

- [ ] **Step 5: Write `PostBlockEditor.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { defaultPayload, move } from '@/utils/postBlocks'
import type { PostBlockDraft, PostBlockType } from '@/types/post'
import TextBlockEditor  from './blocks/TextBlockEditor.vue'
import ImageBlockEditor from './blocks/ImageBlockEditor.vue'
import EmbedBlockEditor from './blocks/EmbedBlockEditor.vue'
import RefBlockEditor   from './blocks/RefBlockEditor.vue'
import type { RefEntityLists } from './blocks/RefBlockEditor.vue'

const props = defineProps<{ modelValue: PostBlockDraft[]; entities: RefEntityLists }>()
const emit = defineEmits<{ 'update:modelValue': [PostBlockDraft[]] }>()

const TYPE_LABELS: Record<PostBlockType, string> = {
  text: 'Text', image: 'Image', embed: 'Embed / link', ref: 'Reference',
}

function add(type: PostBlockType) {
  emit('update:modelValue', [...props.modelValue, { type, payload: defaultPayload(type) }])
}

function remove(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}

function setPayload(i: number, payload: Record<string, unknown>) {
  emit('update:modelValue', props.modelValue.map((b, idx) => (idx === i ? { ...b, payload } : b)))
}

// Native HTML5 drag, matching SocialLinksEditor — no library.
let dragFrom = -1
const dragOverIndex = ref(-1)

function onDrop(to: number) {
  if (dragFrom >= 0) emit('update:modelValue', move(props.modelValue, dragFrom, to))
  dragFrom = -1
  dragOverIndex.value = -1
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-2">
      <label class="field-label mb-0">Content blocks</label>
      <div class="flex gap-1">
        <button v-for="(label, type) in TYPE_LABELS" :key="type" type="button"
                class="btn-add" @click="add(type as PostBlockType)">+ {{ label }}</button>
      </div>
    </div>

    <p v-if="modelValue.length === 0" class="empty-hint">
      No blocks yet. Add text, an image, an embed or a reference — they render in this order.
    </p>

    <div class="flex flex-col gap-2">
      <div v-for="(block, i) in modelValue" :key="i"
           class="block-row" :class="{ 'block-row--over': dragOverIndex === i }"
           draggable="true"
           @dragstart="dragFrom = i"
           @dragover.prevent="dragOverIndex = i"
           @dragleave="dragOverIndex = -1"
           @drop.prevent="onDrop(i)">
        <div class="block-head">
          <span class="block-grip" aria-hidden="true">⠿</span>
          <span class="block-type">{{ TYPE_LABELS[block.type] }}</span>
          <span class="block-pos">{{ i + 1 }}</span>
          <button type="button" class="btn-remove" @click="remove(i)" title="Remove block">✕</button>
        </div>

        <TextBlockEditor  v-if="block.type === 'text'"  :payload="block.payload" @update:payload="setPayload(i, $event)" />
        <ImageBlockEditor v-else-if="block.type === 'image'" :payload="block.payload" @update:payload="setPayload(i, $event)" />
        <EmbedBlockEditor v-else-if="block.type === 'embed'" :payload="block.payload" @update:payload="setPayload(i, $event)" />
        <RefBlockEditor   v-else :payload="block.payload" :entities="entities" @update:payload="setPayload(i, $event)" />
      </div>
    </div>
  </div>
</template>

<style scoped src="../form-styles.css" />
<style scoped>
.block-row { border: 1px solid #3f3f46; border-radius: 0.5rem; padding: 0.75rem; background: #18181b; }
.block-row--over { border-color: #60a5fa; }
.block-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.block-grip { cursor: grab; color: #71717a; }
.block-type { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #a1a1aa; }
.block-pos { margin-left: auto; font-size: 0.7rem; color: #71717a; }
.empty-hint { font-size: 0.8rem; color: #71717a; padding: 0.75rem 0; }
</style>
```

- [ ] **Step 6: Rewire `PostForm.vue`**

Remove the `EntityRelationsPanel` import and usage, the `links` state and `addLink`/`removeLink`/`linkTypes`, the `content_en`/`content_pl` fields and their textarea block, and the five `*_ids` fields. Add `blocks: [] as PostBlockDraft[]`, hydrate it in the `watch`, and render `<PostBlockEditor v-model="form.blocks" :entities="entityLists" />` where the panel used to be. Keep the tags control by rendering `EntityRelationsPanel` with only its tag props, or lift the existing tag multiselect out — either is fine as long as tags remain editable.

`entityLists` is a `computed` mapping the props to `{ id, label }`:

```ts
const entityLists = computed<RefEntityLists>(() => ({
  concert:       props.concerts.map(c => ({ id: c.id, label: `${c.date} — ${c.venue?.name ?? 'TBA'}` })),
  album:         props.albums.map(a => ({ id: a.id, label: a.title })),
  release:       props.releases.map(r => ({ id: r.id, label: r.title })),
  music_video:   props.musicVideos.map(v => ({ id: v.id, label: v.og_title ?? v.title })),
  press_release: props.pressReleases.map(p => ({ id: p.id, label: p.og_title ?? p.url })),
  shop_item:     props.shopItems.map(s => ({ id: s.id, label: s.name })),
}))
```

Hydration in the `watch`, converting server blocks back to drafts:

```ts
  form.blocks = (val?.blocks ?? []).map(b => {
    if (b.type === 'text')  return { type: 'text',  payload: { body: b.translations.body } }
    if (b.type === 'image') return { type: 'image', payload: { path: b.path, url: b.url, alt: b.translations.alt, caption: b.translations.caption } }
    if (b.type === 'embed') return { type: 'embed', payload: { url: b.url, label: b.label } }
    return { type: 'ref', payload: { entity: b.entity, id: (b.data?.id as number) ?? 0 } }
  })
```

and in `submit()`, replace the `links` and `*_ids` keys with:

```ts
    // `url` is a preview-only field on image drafts; strip it before sending.
    blocks: form.blocks.map(b => ({
      type: b.type,
      payload: b.type === 'image' ? { ...b.payload, url: undefined } : b.payload,
    })),
```

- [ ] **Step 7: Add `shopItems` to the view**

In `app/src/views/admin/PostsAdminView.vue`, add `import { useShopItems } from '@/composables/useShop'`, `const { query: shopItemsQ } = useShopItems()`, and pass `:shop-items="shopItemsQ.data.value ?? []"` to `<PostForm>`. Remove `useTours` and the `:tours` prop.

- [ ] **Step 8: Type-check and build**

```bash
cd app && pnpm build
```
Expected: PASS — no type errors. Fix any the compiler reports before continuing.

- [ ] **Step 9: Commit**

```bash
git add app/src && git commit -m "feat(app): rebuild the post editor around ordered content blocks

PostForm decomposes into a block list plus four per-type editors, each owning
only its own payload. Drag-and-drop uses native HTML5 events, matching
SocialLinksEditor rather than pulling in a library.

Tours are gone from the picker: with no public tour page a tour reference could
only link somewhere that is never built.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 11: Admin E2E

**Files:**
- Modify: `app/e2e/tests/admin/posts.spec.ts`

**Interfaces:**
- Consumes: the editor from Task 10
- Produces: nothing downstream

- [ ] **Step 1: Add the block specs**

Append inside the existing `test.describe.serial('Admin Posts', …)`, after the create test:

```ts
  test('adds one block of each type and saves them in order', async ({ page }) => {
    await searchTable(page, postTitle)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    await page.getByRole('button', { name: '+ Text' }).click()
    await page.locator('.block-row').nth(0).locator('textarea').first().fill('First paragraph')

    await page.getByRole('button', { name: '+ Embed / link' }).click()
    await page.locator('.block-row').nth(1).locator('input').first().fill('https://vimeo.com/76979871')
    await expect(page.locator('.block-row').nth(1).locator('.provider-badge')).toHaveText('Vimeo')

    await page.getByRole('button', { name: '+ Reference' }).click()
    await page.locator('.block-row').nth(2).locator('select').first().selectOption('release')

    await expect(page.locator('.block-row')).toHaveCount(3)

    await page.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Post updated')
  })

  test('blocks survive a reload in the order they were saved', async ({ page }) => {
    await searchTable(page, postTitle)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    // Order is the whole feature — assert position, not just presence.
    await expect(page.locator('.block-row').nth(0).locator('.block-type')).toHaveText('Text')
    await expect(page.locator('.block-row').nth(1).locator('.block-type')).toHaveText('Embed / link')
    await expect(page.locator('.block-row').nth(0).locator('textarea').first()).toHaveValue('First paragraph')
  })

  test('removing a block persists the shorter list', async ({ page }) => {
    await searchTable(page, postTitle)
    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.modal-overlay')).toBeVisible()

    const before = await page.locator('.block-row').count()
    await page.locator('.block-row').last().getByTitle('Remove block').click()
    await expect(page.locator('.block-row')).toHaveCount(before - 1)

    await page.getByRole('button', { name: 'Update' }).click()
    await expectToast(page, 'Post updated')

    await page.locator('tbody tr').first().getByRole('button', { name: 'Edit' }).click()
    await expect(page.locator('.block-row')).toHaveCount(before - 1)
  })
```

Delete any existing test that fills a `Content` textarea or interacts with the old Links rows.

- [ ] **Step 2: Run the spec**

```bash
cd app && pnpm test:e2e --grep "Admin Posts"
```
Expected: PASS. If it fails, triage first: `grep -c ECONNRESET` on the output. A different set of specs failing each run, or ECONNRESET clusters, is the machine — not the code. Re-run before investigating.

- [ ] **Step 3: Commit**

```bash
git add app/e2e && git commit -m "test(e2e): cover post block add, persist and remove

Asserts block position, not just presence: order is the entire point of the
feature, and a presence-only check passes against a list rendered by id.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 12: `refHref` — the public href resolver

**Files:**
- Modify: `web/src/types/post.ts`
- Create: `web/src/lib/refHref.ts`
- Create: `web/src/lib/refHref.test.ts`

**Interfaces:**
- Consumes: `getSlugMap()` shape from `web/src/lib/slugs.ts`
- Produces: `refHref(entity, data, lang, slugMap, modules): { href: string; external: boolean } | null`

> `web/` uses `*.test.ts` — the opposite of `app/`. Vitest here uses its default include.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/refHref.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { refHref } from './refHref'
import type { SlugMap } from './slugs'

const slugMap = {
  en: { concerts: 'concerts', releases: 'releases', merch: 'shop', photos: 'gallery' },
  pl: { concerts: 'koncerty', releases: 'wydawnictwa', merch: 'sklep', photos: 'galeria' },
} as unknown as SlugMap

const allOn: Record<string, boolean> = {}

describe('refHref', () => {
  it('builds a concert href from the locale section slug', () => {
    expect(refHref('concert', { slug_en: 'gig-1' }, 'pl', slugMap, allOn))
      .toEqual({ href: '/pl/koncerty/gig-1', external: false })
  })

  it('builds a release href from the id', () => {
    expect(refHref('release', { id: 7 }, 'en', slugMap, allOn))
      .toEqual({ href: '/en/releases/7', external: false })
  })

  // The shop's section key is `merch`; /{lang}/shop/... is never built.
  it('builds a shop item href under the merch section', () => {
    expect(refHref('shop_item', { slug_en: 'tee' }, 'en', slugMap, allOn))
      .toEqual({ href: '/en/shop/tee', external: false })
  })

  // Only concerts, releases, posts and merch have detail routes. An album has
  // no page of its own, so it links to the photos listing.
  it('links an album to the photos listing, not a per-album page', () => {
    expect(refHref('album', { id: 3 }, 'en', slugMap, allOn))
      .toEqual({ href: '/en/gallery', external: false })
  })

  it('returns external hrefs for music videos and press releases', () => {
    expect(refHref('music_video', { video_url: 'https://youtu.be/x' }, 'en', slugMap, allOn))
      .toEqual({ href: 'https://youtu.be/x', external: true })
    expect(refHref('press_release', { url: 'https://pitchfork.com/x' }, 'en', slugMap, allOn))
      .toEqual({ href: 'https://pitchfork.com/x', external: true })
  })

  // A disabled module unbuilds its routes, so the link would 404.
  it('returns null when the target module is switched off', () => {
    expect(refHref('concert', { slug_en: 'gig-1' }, 'en', slugMap, { concerts: false })).toBeNull()
  })

  // getSiteConfig fails open to {} when the API is unreachable mid-build, so an
  // absent key must mean enabled — otherwise one blip strips every reference.
  it('treats an absent module key as enabled', () => {
    expect(refHref('concert', { slug_en: 'gig-1' }, 'en', slugMap, {})).not.toBeNull()
  })

  it('is unaffected by module state for external targets', () => {
    expect(refHref('press_release', { url: 'https://x.example' }, 'en', slugMap, { press: false }))
      .toEqual({ href: 'https://x.example', external: true })
  })

  it('returns null when the identifying field is missing', () => {
    expect(refHref('concert', {}, 'en', slugMap, allOn)).toBeNull()
    expect(refHref('press_release', {}, 'en', slugMap, allOn)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && pnpm vitest run src/lib/refHref.test.ts
```
Expected: FAIL — cannot resolve `./refHref`

- [ ] **Step 3: Write the types**

In `web/src/types/post.ts`, delete `PostLinkType`, `PostLink`, and `content`/`links`/`concerts`/`releases`/`music_videos`/`press_releases` from `Post`. Add the same `PostBlock` union as Task 9 (public side has no `translations`, since the API resolves the locale):

```ts
export type RefEntity = 'concert' | 'album' | 'release' | 'music_video' | 'press_release' | 'shop_item'
export type EmbedProviderName = 'youtube' | 'vimeo' | 'instagram' | 'tiktok' | 'link'

interface BlockBase { id: number; position: number }

export interface TextBlock  extends BlockBase { type: 'text';  body: string | null }
export interface ImageBlock extends BlockBase { type: 'image'; url: string | null; alt: string | null; caption: string | null }
export interface EmbedBlock extends BlockBase { type: 'embed'; provider: EmbedProviderName; url: string | null; label: string | null; embed_id: string | null }
export interface RefBlock   extends BlockBase { type: 'ref';   entity: RefEntity; data: Record<string, any> | null }

export type PostBlock = TextBlock | ImageBlock | EmbedBlock | RefBlock
```

and `blocks: PostBlock[]` on `Post`.

- [ ] **Step 4: Write `refHref.ts`**

```ts
import type { Locale } from '@/types/shared'
import type { SlugMap } from './slugs'
import type { RefEntity } from '@/types/post'

/** Which website module has to be enabled for each entity's page to exist. */
const MODULE_FOR: Partial<Record<RefEntity, string>> = {
  concert: 'concerts', release: 'releases', shop_item: 'merch', album: 'photos',
}

export interface RefLink { href: string; external: boolean }

/**
 * The href for a resolved ref block, or null when it cannot safely be linked.
 *
 * Null has two causes and both matter:
 *  - the target module is switched off, which *unbuilds its routes* — the link
 *    would 404 on a page that builds perfectly green;
 *  - the identifying field is missing from a frozen or partial payload.
 *
 * Only four sections have detail routes (concerts, releases, posts, merch), so
 * an album links to the photos listing — there is no per-album page.
 */
export function refHref(
  entity: RefEntity,
  data: Record<string, any>,
  lang: Locale,
  slugMap: SlugMap,
  modules: Record<string, boolean>,
): RefLink | null {
  if (entity === 'music_video') {
    return data.video_url ? { href: String(data.video_url), external: true } : null
  }
  if (entity === 'press_release') {
    return data.url ? { href: String(data.url), external: true } : null
  }

  const moduleKey = MODULE_FOR[entity]
  // `!== false`, never `=== true`: getSiteConfig fails open to {} when the API
  // is unreachable mid-build, so an absent key has to mean enabled.
  if (moduleKey && modules[moduleKey] === false) return null

  const section = (key: string) => slugMap[lang]?.[key] ?? key

  switch (entity) {
    case 'concert':
      return data.slug_en ? { href: `/${lang}/${section('concerts')}/${data.slug_en}`, external: false } : null
    case 'release':
      return data.id ? { href: `/${lang}/${section('releases')}/${data.id}`, external: false } : null
    case 'shop_item':
      return data.slug_en ? { href: `/${lang}/${section('merch')}/${data.slug_en}`, external: false } : null
    case 'album':
      return { href: `/${lang}/${section('photos')}`, external: false }
    default:
      return null
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd web && pnpm vitest run src/lib/refHref.test.ts
```
Expected: PASS — 9 tests

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/refHref.ts web/src/lib/refHref.test.ts web/src/types/post.ts
git commit -m "feat(web): resolve post ref hrefs with a module gate

Three independent ways a reference can be dead — the entity deleted, the module
switched off, or the route never built — so the resolver returns null rather
than a plausible-looking 404. Gated on !== false so a mid-build API blip cannot
strip every reference from an article.

Corrects two hrefs the design had wrong: the shop section key is merch, and an
album has no detail route so it links to the photos listing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 13: The public block components

**Files:**
- Create: `web/src/components/blocks/TextBlock.astro`
- Create: `web/src/components/blocks/ImageBlock.astro`
- Create: `web/src/components/blocks/EmbedBlock.astro`
- Create: `web/src/components/blocks/RefBlock.astro`
- Create: `web/src/components/blocks/PostBlocks.astro`

**Interfaces:**
- Consumes: `refHref` (Task 12), `PostBlock` types (Task 12)
- Produces: `<PostBlocks blocks={post.blocks} lang={lang} slugMap={slugMap} modules={cfg.modules} />`

> Every style here uses semantic tokens. `scripts/check-tokens.mjs` runs in `pnpm build` and fails on a raw colour, an undeclared token, or a literal font name. Reuse the existing `.art-*` classes from `PostDetail.astro` where the markup matches.

- [ ] **Step 1: Write the leaf components**

`TextBlock.astro`:

```astro
---
import type { TextBlock } from '@/types/post'
interface Props { block: TextBlock }
const { block } = Astro.props
---
{block.body && <div class="art-prose" set:html={block.body} />}
```

`ImageBlock.astro`:

```astro
---
import type { ImageBlock } from '@/types/post'
interface Props { block: ImageBlock }
const { block } = Astro.props
---
{block.url && (
  <figure class="pb-figure">
    <img src={block.url} alt={block.alt ?? ''} loading="lazy" class="pb-img" />
    {block.caption && <figcaption class="pb-caption">{block.caption}</figcaption>}
  </figure>
)}

<style>
  .pb-figure { margin: 0 0 28px; }
  .pb-img { width: 100%; height: auto; display: block; }
  .pb-caption {
    margin-top: 8px;
    font: 500 13px/1.5 var(--font-body);
    color: var(--color-muted);
  }
</style>
```

`EmbedBlock.astro`:

```astro
---
import type { EmbedBlock } from '@/types/post'

interface Props { block: EmbedBlock }
const { block } = Astro.props

/**
 * Every provider is an iframe — no third-party JavaScript anywhere.
 * Instagram and TikTok also publish blockquote-plus-script embeds, but the
 * public specs run failOnPageError(), so a third-party script that throws
 * would fail specs that have nothing to do with this page.
 */
const SRC: Record<string, (id: string) => string> = {
  youtube:   id => `https://www.youtube-nocookie.com/embed/${id}`,
  vimeo:     id => `https://player.vimeo.com/video/${id}`,
  instagram: id => `https://www.instagram.com/p/${id}/embed`,
  tiktok:    id => `https://www.tiktok.com/embed/v2/${id}`,
}

// A provider with no extractable id falls back to a link row rather than an
// iframe with a broken src.
const src = block.embed_id && SRC[block.provider] ? SRC[block.provider](block.embed_id) : null
---

{src ? (
  <div class="pb-embed">
    <iframe src={src} title={block.label ?? 'Embedded media'} loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
            allowfullscreen frameborder="0"></iframe>
  </div>
) : block.url ? (
  <a href={block.url} target="_blank" rel="noopener noreferrer" class="art-ext-link">
    <span>{block.label ?? block.url}</span>
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)"
         stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M14 4h6v6"/><path d="M20 4l-9 9"/>
      <path d="M19 14v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>
    </svg>
  </a>
) : null}

<style>
  .pb-embed { position: relative; padding-top: 56.25%; margin: 0 0 28px; }
  .pb-embed iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .art-ext-link {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    background: var(--color-ink); color: var(--color-on-inverse);
    padding: 16px 20px; text-decoration: none;
    font: 600 15px/1.4 var(--font-body); margin-bottom: 10px;
  }
  .art-ext-link:hover { background: var(--color-body); }
</style>
```

`RefBlock.astro`:

```astro
---
import type { RefBlock } from '@/types/post'
import type { Locale } from '@/types/shared'
import type { SlugMap } from '@/lib/slugs'
import { refHref } from '@/lib/refHref'

interface Props {
  block: RefBlock
  lang: Locale
  slugMap: SlugMap
  modules: Record<string, boolean>
  /** Press coverage renders as the pull quote when it is the first one. */
  isFirstPress?: boolean
}
const { block, lang, slugMap, modules, isFirstPress = false } = Astro.props

// data is never null here — PostBlocks filters those out before rendering.
const data = block.data!
const link = refHref(block.entity, data, lang, slugMap, modules)

const label =
  block.entity === 'concert'  ? (data.venue?.name ?? data.date ?? 'Concert')
: block.entity === 'shop_item' ? data.name
: block.entity === 'album'      ? data.title
: data.title
---

{block.entity === 'press_release' && isFirstPress ? (
  <blockquote class="art-pull">
    <svg width="34" height="34" viewBox="0 0 24 24" fill="var(--color-accent)" aria-hidden="true">
      <path d="M9 7H5v5h3v-1c0 1.5-.6 2.4-2 3l.6 1.2C9 14.3 10 12.7 10 10V8a1 1 0 0 0-1-1zm9 0h-4v5h3v-1c0 1.5-.6 2.4-2 3l.6 1.2c2.4-1 3.4-2.6 3.4-5.4V8a1 1 0 0 0-1-1z" />
    </svg>
    <p class="art-pull-quote">{data.title}</p>
    {data.site && <cite class="art-pull-cite">— {data.site}</cite>}
  </blockquote>
) : block.entity === 'press_release' ? (
  <a class="art-press" href={data.url} target="_blank" rel="noopener">
    <span>
      {data.site && <span class="art-press-site">{data.site}</span>}
      <span class="art-press-title">{data.title}</span>
    </span>
  </a>
) : link ? (
  <a href={link.href} class="art-rel-link"
     {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
    {label}
  </a>
) : (
  // The module is off or the route was never built — the label still belongs
  // on the page, just not as a link that 404s.
  <span class="art-rel-link art-rel-link--dead">{label}</span>
)}

<style>
  .art-rel-link {
    display: inline-flex; align-items: center; gap: 8px;
    border: 3px solid var(--color-ink); padding: 11px 15px;
    font: 700 14px/1 var(--font-body); text-transform: uppercase; letter-spacing: .04em;
    color: var(--color-ink); text-decoration: none;
    background: var(--color-surface); margin: 0 8px 10px 0;
    transition: background .12s, color .12s;
  }
  .art-rel-link:hover { background: var(--color-ink); color: var(--color-page); }
  .art-rel-link--dead { opacity: .6; cursor: default; }
  .art-rel-link--dead:hover { background: var(--color-surface); color: var(--color-ink); }

  .art-pull { margin: 12px 0 30px; border-left: 6px solid var(--color-accent); padding-left: 26px; }
  .art-pull-quote {
    margin: 8px 0 12px;
    font-family: var(--font-display); font-weight: var(--display-weight);
    font-size: 30px; line-height: 1.12;
    letter-spacing: var(--display-tracking); text-transform: var(--display-transform);
    color: var(--color-body);
  }
  .art-pull-cite {
    font: 800 12px/1 var(--font-body); letter-spacing: .14em; text-transform: uppercase;
    color: var(--color-accent); font-style: normal;
  }

  .art-press {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    background: var(--color-inverse); color: var(--color-on-inverse);
    padding: 16px 20px; text-decoration: none; margin-bottom: 10px;
  }
  .art-press-site {
    display: block; font: 800 10px/1 var(--font-body);
    letter-spacing: .14em; text-transform: uppercase; color: var(--color-accent);
  }
  .art-press-title { display: block; margin-top: 7px; font: 600 16px/1.4 var(--font-body); }

  @media (max-width: 700px) {
    .art-pull-quote { font-size: 22px; }
    .art-pull { padding-left: 16px; }
  }
</style>
```

- [ ] **Step 2: Write the dispatcher**

`PostBlocks.astro`:

```astro
---
import type { PostBlock } from '@/types/post'
import type { Locale } from '@/types/shared'
import type { SlugMap } from '@/lib/slugs'
import TextBlock  from './TextBlock.astro'
import ImageBlock from './ImageBlock.astro'
import EmbedBlock from './EmbedBlock.astro'
import RefBlock   from './RefBlock.astro'

interface Props {
  blocks: PostBlock[]
  lang: Locale
  slugMap: SlugMap
  modules: Record<string, boolean>
}
const { blocks, lang, slugMap, modules } = Astro.props

const KNOWN = new Set(['text', 'image', 'embed', 'ref'])

/**
 * Two filters, deliberately here rather than in each block component, so no
 * per-type component can forget them:
 *
 *  - a ref whose entity was deleted (data === null) is dropped. The Astro build
 *    is all-or-nothing: one page that throws aborts all 35 and leaves the web
 *    container crash-looping. This has happened twice, once undetected for two
 *    months at RestartCount 103.
 *  - an unknown type is dropped rather than thrown on. Stored content can
 *    predate a renderer.
 */
const renderable = (blocks ?? []).filter(
  b => KNOWN.has(b.type) && !(b.type === 'ref' && b.data === null),
)

// The first press reference doubles as the article's pull quote — the design
// shows press as context inside a story, never as an index.
const firstPressId = renderable.find(b => b.type === 'ref' && b.entity === 'press_release')?.id
---

{renderable.map(block => (
  block.type === 'text'  ? <TextBlock  block={block} />
: block.type === 'image' ? <ImageBlock block={block} />
: block.type === 'embed' ? <EmbedBlock block={block} />
: <RefBlock block={block} lang={lang} slugMap={slugMap} modules={modules}
            isFirstPress={block.id === firstPressId} />
))}
```

- [ ] **Step 3: Type-check**

```bash
cd web && npx tsc --noEmit -p tsconfig.json
```
Expected: exactly the two pre-existing errors (`themes/skanking-storks/slots.ts`, `types/shop.ts`). Anything else is yours.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/blocks && git commit -m "feat(web): render post content blocks

The dispatcher owns dangling-ref and unknown-type filtering rather than each
component, so neither can be forgotten: the Astro build is all-or-nothing and a
single unreachable record takes down every page.

Every embed is an iframe. Instagram and TikTok also publish script-based
embeds, but the public specs capture pageerror and a third-party throw would
fail unrelated specs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 14: Wire the two article routes

**Files:**
- Modify: `web/src/components/detail/PostDetail.astro`
- Modify: `web/src/pages/posts/[id].astro`

**Interfaces:**
- Consumes: `<PostBlocks>` (Task 13)
- Produces: articles rendered from blocks

- [ ] **Step 1: Rewrite the body of `PostDetail.astro`**

Add to the frontmatter:

```astro
import PostBlocks from '@/components/blocks/PostBlocks.astro'
import { getSiteConfig } from '@/lib/cms'

const siteConfig = await getSiteConfig(lang)
```

Delete `const press = post.press_releases ?? []` and the `releasesSection`/`concertsSection` consts (`refHref` owns those now). Replace the entire `<article class="ar-col art-body">` element, the Related `<section>`, the In-the-press `<section>` and the links `<section>` with:

```astro
    <article class="ar-col art-body">
      <PostBlocks
        blocks={post.blocks ?? []}
        lang={lang}
        slugMap={slugMap}
        modules={siteConfig.modules ?? {}}
      />
    </article>
```

Update `description={post.intro ?? post.excerpt}` — unchanged, `excerpt` still exists. Keep the hero, share button, back link, prev/next and "more from the blog" exactly as they are. Remove the now-unused `copy.related` / `copy.inPress` entries from `COPY` but keep `copy.more`.

- [ ] **Step 2: Update the legacy route**

In `web/src/pages/posts/[id].astro`, replace the `post.releases` and `post.concerts` sections with the same `<PostBlocks>` call, importing `getSlugMap` and `getSiteConfig` and passing `lang="en"` (this route is unlocalised by design).

- [ ] **Step 3: Verify against a real build**

```bash
cd web && API_BASE=http://localhost:8081 pnpm build
```
Expected: all pages build. Then confirm no internal href is dead:

```bash
cd web && for h in $(grep -oh 'href="/en/[a-z0-9/-]*"' dist/en/news/*/index.html | sed 's/href="//;s/"//' | sort -u); do
  p="dist${h%/}/index.html"; [ -f "$p" ] && echo "OK   $h" || echo "DEAD $h"
done
```
Expected: no `DEAD` lines.

- [ ] **Step 4: Prove the dangling-ref guard actually works**

The suites structurally cannot test this — it is a build-time crash, not a red test. Point a ref block at a non-existent record and confirm the build still completes:

```bash
# with the stack up and an admin token in $TOKEN
curl -s -X PUT http://localhost:8081/api/posts/1 \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":{"en":"Dangling"},"blocks":[{"type":"ref","payload":{"entity":"release","id":999999}}]}'
cd web && API_BASE=http://localhost:8081 pnpm build
```
Expected: build completes; `/en/news/1` exists and contains no reference markup.

- [ ] **Step 5: Rebuild the container and confirm it is serving new code**

```bash
docker compose build web && docker compose up -d web
curl -s http://localhost:4322/en/news/ | grep -o 'PostBlocks[^"]*\|_astro/[^"]*\.js' | head -3
```
A `restart` would rebuild the **baked** source and show you stale code — the asset hash must differ from before the change.

- [ ] **Step 6: Commit**

```bash
git add web/src && git commit -m "feat(web): render articles from content blocks

PostDetail keeps its hero, share, prev/next and more-from-the-blog; the prose,
Related, In-the-press and links sections collapse into one PostBlocks call, so
sequence comes from the data rather than the template.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 15: Public E2E and the press reseed

**Files:**
- Create: `app/e2e/tests/public/post-blocks.spec.ts`
- Modify: `app/e2e/tests/public/article-press.spec.ts`

**Interfaces:**
- Consumes: everything above
- Produces: nothing downstream

> **Two E2E traps this task must avoid.** A Playwright `storageState` replays **cookies only** in `request.newContext`, and `e2e/.auth/admin.json` holds none — an API context built that way is anonymous and every admin call 401s. Read `auth_token` from the storage-state file and send an explicit Bearer header. And the capture must **throw** on failure: a `beforeAll` that records "there was nothing there" turns the `afterAll` restore into a destructive write.

- [ ] **Step 1: Write the public spec**

Create `app/e2e/tests/public/post-blocks.spec.ts`:

```ts
import { test, expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { failOnPageError } from '../../fixtures/page-errors'

const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4322'
const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

test.use({ storageState: { cookies: [], origins: [] } })

/**
 * storageState replays cookies only, and e2e/.auth/admin.json holds none — an
 * API context built from it is anonymous. The token has to be lifted out and
 * sent explicitly. Path is relative to the Playwright cwd (app/): these spec
 * files are ESM, so __dirname does not exist.
 */
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed post blocks')
  return entry.value
}

async function api(request: APIRequestContext, method: 'post' | 'put' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}`)
  return res
}

test.describe.serial('Public article — content blocks', () => {
  failOnPageError()

  let postId: number

  test.beforeAll(async ({ request }) => {
    const res = await api(request, 'post', '/api/posts', {
      title: { en: `E2E Blocks ${Date.now()}` },
      published_at: new Date().toISOString(),
      blocks: [
        { type: 'text',  payload: { body: { en: '<p>Block zero prose.</p>' } } },
        { type: 'embed', payload: { url: 'https://vimeo.com/76979871' } },
        { type: 'text',  payload: { body: { en: '<p>Block two prose.</p>' } } },
        { type: 'ref',   payload: { entity: 'release', id: 999999 } },
      ],
    })
    postId = (await res.json()).data.id
  })

  test.afterAll(async ({ request }) => {
    if (postId) await api(request, 'delete', `/api/posts/${postId}`)
  })

  test('renders blocks in the stored order', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${postId}`)

    // Order is the feature. Presence alone passes against a list sorted by id.
    const prose = page.locator('.art-body .art-prose')
    await expect(prose.nth(0)).toContainText('Block zero prose.')
    await expect(prose.nth(1)).toContainText('Block two prose.')

    const embed = page.locator('.art-body .pb-embed iframe')
    await expect(embed).toHaveAttribute('src', /player\.vimeo\.com\/video\/76979871/)
  })

  test('the embed sits between the two paragraphs, not after them', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${postId}`)

    const kinds = await page.locator('.art-body > *').evaluateAll(els =>
      els.map(el => (el.querySelector('iframe') ? 'embed' : el.className.includes('art-prose') ? 'text' : 'other')),
    )
    expect(kinds.filter(k => k !== 'other')).toEqual(['text', 'embed', 'text'])
  })

  test('a ref pointing at a deleted record renders nothing at all', async ({ page }) => {
    await page.goto(`${WEB}/en/news/${postId}`)

    await expect(page.locator('.art-rel-link')).toHaveCount(0)
    await expect(page.locator('.art-body')).not.toContainText('999999')
  })
})
```

- [ ] **Step 2: Reseed `article-press.spec.ts`**

Replace `findPostWithPress` — which walked the API looking for `press_releases` — with a `beforeAll` that creates a post carrying two `press_release` ref blocks, using the same `adminToken()`/`api()` helpers as above, and an `afterAll` that deletes it. Leave every `expect` untouched: `.art-pull-quote`, `.art-pull-cite`, `.art-press`, `.art-press-site`, `.art-press-title` and the translated-heading assertions all still hold, because `RefBlock.astro` reuses those exact classes.

The "press blocks are absent from a post with no coverage" test seeds a second post with a single text block instead of searching for one.

- [ ] **Step 3: Rebuild web so the seeded post is baked, then run both specs**

```bash
docker compose restart web       # content-only refresh: the source has not changed
cd app && pnpm test:e2e --grep "content blocks|press coverage"
```
Expected: PASS. Triage a red run with the signature list first — `grep -c ECONNRESET` on the output, and check whether a *different* set of specs fails each run.

- [ ] **Step 4: Run the full suite**

```bash
bash scripts/test-all.sh
```
Expected: all green. Exit code is a bitmask — 1 backend, 2 E2E, 4 frontend. ~15 tests skip by design.

- [ ] **Step 5: Commit**

```bash
git add app/e2e && git commit -m "test(e2e): cover the public block renderer and reseed the press spec

Asserts the embed sits *between* the two paragraphs rather than merely being
present — a renderer that sorted by id would pass a presence-only check while
losing the entire feature.

The seed reads auth_token out of the storage-state file and throws when it is
missing: request.newContext replays cookies only, so a storageState-built API
context is anonymous, and a capture that silently returns nothing turns the
cleanup into a destructive write.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
```

---

### Task 16: Migration rehearsal against real data and CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: everything
- Produces: a merge-ready branch

> The seeders do not reproduce the dev database's posts — real content, real links, real pivot rows. The backfill has only ever run against fixtures until this step.

- [ ] **Step 1: Snapshot the current row counts**

```bash
docker exec bandms_mysql sh -c 'mysql -ubandms -psecret bandms -N -e \
  "SELECT \"posts\", COUNT(*) FROM posts UNION ALL \
   SELECT \"post_links\", COUNT(*) FROM post_links UNION ALL \
   SELECT \"post_concerts\", COUNT(*) FROM post_concerts UNION ALL \
   SELECT \"press_release_posts\", COUNT(*) FROM press_release_posts;"'
```
Record the numbers.

- [ ] **Step 2: Run the migration**

```bash
bash rebuild.sh --backend-only
```

- [ ] **Step 3: Verify the backfill landed**

```bash
docker exec bandms_mysql sh -c 'mysql -ubandms -psecret bandms -N -e \
  "SELECT type, COUNT(*) FROM post_blocks GROUP BY type; \
   SELECT COUNT(*) FROM post_blocks WHERE payload IS NULL OR payload = \"[]\"; \
   SELECT COUNT(*) FROM post_tours;"'
```
Expected: `text` count ≈ posts that had content; `embed` count = the old `post_links` count; `ref` count = the sum of the four pivots plus `press_release_posts`; zero empty payloads; `post_tours` unchanged from Step 1.

- [ ] **Step 4: Rebuild the public site and eyeball an article**

```bash
docker compose build web && docker compose up -d web
```
Open `http://localhost:8081/en/news` and click into a post that had content, links and related items before. It should read as it did, in the same order.

- [ ] **Step 5: Update `CHANGELOG.md`**

Add under the current unreleased heading:

```markdown
### Changed
- **News posts are now composed from ordered content blocks.** A post's body is
  a sequence of text, image, embed and reference blocks that the editor
  arranges; the article page renders them in that order instead of a fixed
  template order. Existing posts were migrated: content became the first text
  block, links became embeds, and related items became references, all in the
  order the page previously rendered them.
- Post saves now trigger a public-site rebuild. They never did, so with
  auto-rebuild enabled a published post could not reach the public site at all.

### Removed
- The post editor's "Link to…" panel, replaced by reference blocks. Tours are
  no longer linkable from a post — they have no public page. The `post_tours`
  table is retained.
```

- [ ] **Step 6: Full suite, then open the PR**

```bash
bash scripts/test-all.sh
git add CHANGELOG.md && git commit -m "docs: changelog for news content blocks

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Bhu4nNWGPndkt6PJAPBLWQ"
git push -u origin feature/news-content-blocks
gh pr create --title "Rebuild news around ordered content blocks" --body "..."
```

- [ ] **Step 7: Run `/code-review` before merging**

CLAUDE.md is explicit that every PR gets an explicit `/code-review` pass, and that no shipping skill covers it: `/ship` has no review step, and `git-feature-workflow` only runs `vue3-review`, only for `.vue`/composable changes — it would skip this branch's substantial Laravel half entirely.

---

## Self-Review

**Spec coverage.** Every section maps to a task: data model → 2; migration + backfill → 3, 4, 16; excerpt → 6; Form Requests → 7; `EmbedProvider` → 1; `PostBlockResolver` → 5; writes/position/transaction → 7; `SiteRebuild` → 7; upload + orphan cleanup → 8; resource shape → 6; admin decomposition → 9, 10; `utils/` + `.spec.ts` constraints → 9; public components → 13; four dispatcher rules → 13 (rules 2–4) and 12 + 13 (rule 1, the module gate, split across `refHref` and `RefBlock`); iframe embeds → 13; theming → 13; every test-table row → its own task; the three verification items → 14 (steps 3–5) and 16.

**Corrections made while writing.** Three, all recorded in the tasks rather than left as surprises:
- `ShopItem` exposes `name`, not `title` (Task 5, and the spec was amended).
- The upload route must be declared **above** `PUT /posts/{post}` or `blocks` is captured as a `{post}` binding (Task 8, step 4).
- `PostController::index`'s search clause referenced `content`; it now searches text-block payloads (Task 6, step 6). The spec named the eager-load but not the search filter.

**Type consistency.** `PostBlockDraft` is the admin's submit shape in Tasks 9 and 10; `PostBlock` is the read shape in both 9 and 12 (public omits `translations`, deliberately). `refHref(entity, data, lang, slugMap, modules)` has the same five-parameter signature in its test (12), its implementation (12) and its one caller (13). `PostBlockSync::sync`/`imagePaths` are used in 7 and 8 with matching signatures. `withResolved()` is defined and called in Task 6 only.
