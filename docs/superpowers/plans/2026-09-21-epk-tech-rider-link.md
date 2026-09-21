# EPK Tech Rider Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the EPK's two file-upload fields (tech rider PDF, stage plot image) with a selector that links the press kit to a published tech rider from the tech-rider module.

**Architecture:** `band_profiles.epk_tech_rider_id` is a nullable FK to `tech_riders`, mirroring `epk_release_id`. `BandProfileResource` and `EpkSnapshotBuilder` derive `tech_rider_url` as `/rider/{public_token}` — the rider's own permanent token, which always serves its latest published version. The admin gets one `<select>` of published riders; the public site keeps one "Tech rider & stage plot" row on the Contact page and drops the rider/stage-plot cards from About.

**Tech Stack:** Laravel 11 / Pest (SQLite in-memory in the `--target test` Docker stage), Vue 3 + TanStack Query (admin SPA), Astro + `@bandms/site-copy` (public site), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-09-21-epk-tech-rider-link-design.md`

## Global Constraints

- Branch: `feature/epk-tech-rider-link` (already created; the spec is its first commit). Never commit to `main`.
- Backend tests run in Docker, not on the host: `docker build --target test -t bandms_test ./api` then `docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter <Name>`. `make` is not available on this Windows box.
- Admin type-check is `cd app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build`. Never `vue-tsc --noEmit -p tsconfig.json` — it checks nothing.
- Public site type-check is `cd web && npx tsc --noEmit -p tsconfig.json` (two pre-existing errors in `themes/skanking-storks/slots.ts` and `types/shop.ts` are not yours). `pnpm build` in `web/` runs the token lint plus `astro build`; the build needs a live API at `API_BASE`.
- Never build an admin URL by hand: `adminUrl('tech-rider')` from `@/config/admin`.
- Public-site links to a module page gate on `siteConfig.modules[slug] !== false`, never on data.
- `tech_rider_url` keeps its name on every API surface. `stage_plot_url` is removed everywhere.
- Copy keys are permanent once shipped; the retired keys are `about`: `rider`, `riderSub`, `stagePlot`, `stagePlotSub`, `download` and `contact`: `epkStagePlot`, `epkStagePlotMeta`.
- E2E specs that write to the dev DB restore it, and public specs that seed data trigger the rebuild webhook and poll it (`rebuildAndWait` pattern from `app/e2e/tests/public/clips-surfaces.spec.ts`).
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## File map

| File | Change |
|---|---|
| `api/database/migrations/2026_09_21_000001_link_epk_to_tech_rider.php` | **create** — add FK, delete files, drop two columns |
| `api/app/Models/BandProfile.php` | `epkTechRider()` relation; `$fillable` |
| `api/app/Http/Controllers/BandProfileController.php` | validation rule; delete four upload methods and `Storage` import |
| `api/routes/api.php:283-286` | delete four routes |
| `api/app/Http/Resources/BandProfileResource.php:49-50` | `tech_rider_url` from token; `epk_tech_rider_id`; `epk_tech_rider`; drop `stage_plot_url` |
| `api/app/Services/EpkSnapshotBuilder.php:67-68` | same derivation; drop `stage_plot_url` |
| `api/tests/Feature/BandProfileTest.php` | delete lines 319–609 (four upload describe blocks); add `epk_tech_rider_id` block |
| `api/tests/Feature/EpkVersionTest.php` | add snapshot assertions |
| `app/src/api/bandProfile.ts` | delete four upload/delete functions |
| `app/src/composables/useBandProfile.ts` | delete four mutations |
| `app/src/types/bandProfile.ts` | drop `stage_plot_url`; add `epk_tech_rider_id`, `epk_tech_rider`; payload field |
| `app/src/views/admin/BandProfileAdminView.vue` | replace upload blocks with the select; delete handlers, refs, CSS |
| `app/e2e/tests/admin/band-profile.spec.ts` | EPK-tab rider selector tests |
| `packages/site-copy/src/modules/about.ts` | retire five keys |
| `packages/site-copy/src/modules/contact.ts` | retire two keys; change three defaults |
| `packages/site-copy/src/resolve.spec.ts` | pin the change |
| `web/src/types/bandProfile.ts:29` | drop `stage_plot_url` |
| `web/src/components/sections/AboutSection.astro` | drop two cards and `isFile` |
| `web/src/components/sections/ContactSection.astro` | drop stage-plot row; rider row/card become gated pages |
| `app/e2e/tests/public/epk-modal.spec.ts` | rider row assertions |
| `app/e2e/tests/public/about.spec.ts` | no rider card |
| `CLAUDE.md`, `CHANGELOG.md` | docs |

---

### Task 1: Migration and model relation

**Files:**
- Create: `api/database/migrations/2026_09_21_000001_link_epk_to_tech_rider.php`
- Modify: `api/app/Models/BandProfile.php:18-30, 100-108`
- Test: `api/tests/Feature/BandProfileTest.php`

**Interfaces:**
- Produces: `BandProfile::epkTechRider(): BelongsTo` (to `TechRider`, key `epk_tech_rider_id`); column `band_profiles.epk_tech_rider_id` nullable, `nullOnDelete`; columns `tech_rider_path` / `stage_plot_path` gone.

- [ ] **Step 1: Write the failing tests**

Append to the end of `api/tests/Feature/BandProfileTest.php` (after the last `});`). The upload describe blocks are still present at this point; they are removed in Task 2.

```php
describe('epk_tech_rider_id schema', function () {
    beforeEach(fn () => $this->createProfile());

    it('has the FK column and no file columns', function () {
        expect(Schema::hasColumn('band_profiles', 'epk_tech_rider_id'))->toBeTrue()
            ->and(Schema::hasColumn('band_profiles', 'tech_rider_path'))->toBeFalse()
            ->and(Schema::hasColumn('band_profiles', 'stage_plot_path'))->toBeFalse();
    });

    it('resolves the linked rider through epkTechRider()', function () {
        $rider = TechRider::create(['profile_id' => 1, 'name' => 'Club show', 'is_active' => false]);
        BandProfile::findOrFail(1)->update(['epk_tech_rider_id' => $rider->id]);

        expect(BandProfile::findOrFail(1)->epkTechRider->id)->toBe($rider->id);
    });

    it('nulls the link when the rider is deleted', function () {
        $rider = TechRider::create(['profile_id' => 1, 'name' => 'Club show', 'is_active' => false]);
        BandProfile::findOrFail(1)->update(['epk_tech_rider_id' => $rider->id]);

        $rider->delete();

        expect(BandProfile::findOrFail(1)->epk_tech_rider_id)->toBeNull();
    });
});
```

Add to the `use` block at the top of the file:

```php
use App\Models\TechRider;
use Illuminate\Support\Facades\Schema;
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /c/Projects/bandms
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter 'epk_tech_rider_id schema'
```

Expected: 3 failures — `hasColumn('epk_tech_rider_id')` is false; `epkTechRider` is an undefined relationship.

- [ ] **Step 3: Write the migration**

Create `api/database/migrations/2026_09_21_000001_link_epk_to_tech_rider.php`:

```php
<?php

use App\Models\BandProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * The EPK links a tech rider from the tech-rider module instead of carrying
 * an uploaded PDF and stage-plot image. The rider's public page already
 * renders both documents, so the two file columns go — and the files they
 * point at go with them, which is why down() cannot bring them back.
 * See docs/superpowers/specs/2026-09-21-epk-tech-rider-link-design.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (BandProfile::query()->get(['id', 'tech_rider_path', 'stage_plot_path']) as $profile) {
            foreach ([$profile->tech_rider_path, $profile->stage_plot_path] as $path) {
                if ($path) {
                    Storage::disk('public')->delete($path);
                }
            }
        }

        Schema::table('band_profiles', function (Blueprint $table) {
            $table->foreignId('epk_tech_rider_id')->nullable()->after('epk_album_id')
                  ->constrained('tech_riders')->nullOnDelete();
            $table->dropColumn(['tech_rider_path', 'stage_plot_path']);
        });
    }

    public function down(): void
    {
        Schema::table('band_profiles', function (Blueprint $table) {
            $table->dropForeign(['epk_tech_rider_id']);
            $table->dropColumn('epk_tech_rider_id');
            // The columns return; the files they held do not.
            $table->string('tech_rider_path')->nullable()->after('stat_facebook_followers');
            $table->string('stage_plot_path')->nullable()->after('tech_rider_path');
        });
    }
};
```

Note: `BandProfile::query()->get([...])` runs before the columns are dropped, and `$fillable` does not affect reads, so this works whichever order Task 1's model edit lands in. The test stage runs on SQLite; Laravel `^11.31` treats `foreign` in `Schema::table` as an alter command that rebuilds the table with the constraint (`SQLiteGrammar::$alterCommands`), and `foreign_key_constraints` is on by default, so the `nullOnDelete` test is real there — the same shape as `2026_06_08_213735_add_concert_id_to_tech_riders.php`.

- [ ] **Step 4: Update the model**

In `api/app/Models/BandProfile.php`, `$fillable`: replace the line

```php
        'tech_rider_path', 'stage_plot_path',
        'epk_release_id', 'epk_album_id',
```

with

```php
        'epk_release_id', 'epk_album_id', 'epk_tech_rider_id',
```

After `epkAlbum()` add:

```php
    /**
     * The rider the press kit links to — by the rider's own token, so the
     * link follows every republish without a new EPK version.
     */
    public function epkTechRider(): BelongsTo
    {
        return $this->belongsTo(TechRider::class, 'epk_tech_rider_id');
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Same commands as Step 2. Expected: 3 passed.

Also run the whole suite to see which of the *old* upload tests now break (they reference the dropped columns): `docker run … bandms_test --filter BandProfileTest`. Expect failures only inside the four upload/delete describe blocks — Task 2 removes them. If anything else fails, stop and investigate.

- [ ] **Step 6: Commit**

```bash
git add api/database/migrations/2026_09_21_000001_link_epk_to_tech_rider.php api/app/Models/BandProfile.php api/tests/Feature/BandProfileTest.php
git commit -m "$(cat <<'EOF'
EPK: link a tech rider by FK, drop the uploaded file columns

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Remove the four upload endpoints

**Files:**
- Modify: `api/app/Http/Controllers/BandProfileController.php:10, 86-137`
- Modify: `api/routes/api.php:283-286`
- Test: `api/tests/Feature/BandProfileTest.php:319-609`

**Interfaces:**
- Produces: nothing new. `POST|DELETE /api/band-profile/tech-rider` and `/stage-plot` no longer exist (404).

- [ ] **Step 1: Delete the four describe blocks from the test file**

Remove everything from `describe('POST /api/band-profile/tech-rider', …` through the closing `});` of `describe('DELETE /api/band-profile/stage-plot', …` (lines 319–609 before Task 1's append). Then drop the now-unused imports `use Illuminate\Http\UploadedFile;` and `use Illuminate\Support\Facades\Storage;` **only if** no remaining test in the file uses them — `grep -n "UploadedFile\|Storage::" api/tests/Feature/BandProfileTest.php` must return nothing before deleting.

Add a test that the routes are gone, inside the `epk_tech_rider_id schema` describe from Task 1:

```php
    it('no longer exposes the upload endpoints', function () {
        $this->actingAsAdmin();

        $this->postJson('/api/band-profile/tech-rider')->assertNotFound();
        $this->deleteJson('/api/band-profile/tech-rider')->assertNotFound();
        $this->postJson('/api/band-profile/stage-plot')->assertNotFound();
        $this->deleteJson('/api/band-profile/stage-plot')->assertNotFound();
    });
```

- [ ] **Step 2: Run to verify the new test fails**

```bash
docker build --target test -t bandms_test ./api && docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter 'no longer exposes the upload endpoints'
```

Expected: FAIL — the routes still answer (500 on the dropped column, or 422), not 404.

- [ ] **Step 3: Delete the routes and controller methods**

In `api/routes/api.php` delete these four lines:

```php
        Route::post('/band-profile/tech-rider', [BandProfileController::class, 'uploadTechRider'])->name('api.band-profile.tech-rider.upload');
        Route::delete('/band-profile/tech-rider', [BandProfileController::class, 'destroyTechRider'])->name('api.band-profile.tech-rider.destroy');
        Route::post('/band-profile/stage-plot', [BandProfileController::class, 'uploadStagePlot'])->name('api.band-profile.stage-plot.upload');
        Route::delete('/band-profile/stage-plot', [BandProfileController::class, 'destroyStagePlot'])->name('api.band-profile.stage-plot.destroy');
```

In `BandProfileController.php` delete the four methods `uploadTechRider`, `destroyTechRider`, `uploadStagePlot`, `destroyStagePlot` (everything between `update()`'s closing brace and `showEpk()`), and the line `use Illuminate\Support\Facades\Storage;`.

- [ ] **Step 4: Run the BandProfile suite**

```bash
docker build --target test -t bandms_test ./api && docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter BandProfileTest
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add api/app/Http/Controllers/BandProfileController.php api/routes/api.php api/tests/Feature/BandProfileTest.php
git commit -m "$(cat <<'EOF'
EPK: remove the tech rider / stage plot upload endpoints

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Validation and resource shape

**Files:**
- Modify: `api/app/Http/Controllers/BandProfileController.php` (`update()` rules; `show()`/`update()` eager loads)
- Modify: `api/app/Http/Resources/BandProfileResource.php:49-51`
- Test: `api/tests/Feature/BandProfileTest.php`

**Interfaces:**
- Consumes: `BandProfile::epkTechRider()` from Task 1; `TechRider::publishedVersion(): HasOne` (exists).
- Produces, on `GET/PUT /api/band-profile` → `data`:
  - `epk_tech_rider_id: int|null`
  - `tech_rider_url: string|null` — `"/rider/{public_token}"` when the linked rider has a published version, else `null`
  - `epk_tech_rider: {id: int, name: string, published_version: int|null} | null`
  - no `stage_plot_url` key
- Produces: `PUT` rejects `epk_tech_rider_id` with 422 and message `Only a rider with a published version can be linked to the EPK.` when the rider has no published version or does not exist.

- [ ] **Step 1: Write the failing tests**

Append to `api/tests/Feature/BandProfileTest.php`:

```php
describe('PUT /api/band-profile epk_tech_rider_id', function () {
    beforeEach(fn () => $this->createProfile());

    /** A rider with one published version, the way the module leaves it after Publish. */
    function publishedRider(string $name = 'Festival set'): TechRider
    {
        $rider = TechRider::create(['profile_id' => 1, 'name' => $name, 'is_active' => false]);
        $rider->versions()->create([
            'version_number' => 1,
            'snapshot'       => ['format' => 1],
            'status'         => 'published',
            'published_at'   => now(),
        ]);

        return $rider;
    }

    it('links a rider that has a published version', function () {
        $this->actingAsAdmin();
        $rider = publishedRider();

        $this->putJson('/api/band-profile', ['epk_tech_rider_id' => $rider->id])
            ->assertSuccessful()
            ->assertJsonPath('data.epk_tech_rider_id', $rider->id)
            ->assertJsonPath('data.tech_rider_url', "/rider/{$rider->public_token}")
            ->assertJsonPath('data.epk_tech_rider.name', 'Festival set')
            ->assertJsonPath('data.epk_tech_rider.published_version', 1);
    });

    it('rejects a rider that has never been published', function () {
        $this->actingAsAdmin();
        $rider = TechRider::create(['profile_id' => 1, 'name' => 'Draft', 'is_active' => false]);

        $this->putJson('/api/band-profile', ['epk_tech_rider_id' => $rider->id])
            ->assertUnprocessable()
            ->assertJsonPath('errors.epk_tech_rider_id.0', 'Only a rider with a published version can be linked to the EPK.');

        expect(BandProfile::findOrFail(1)->epk_tech_rider_id)->toBeNull();
    });

    it('rejects a rider whose only version is archived', function () {
        $this->actingAsAdmin();
        $rider = publishedRider();
        $rider->versions()->update(['status' => 'archived']);

        $this->putJson('/api/band-profile', ['epk_tech_rider_id' => $rider->id])
            ->assertUnprocessable();
    });

    it('rejects an id that names no rider', function () {
        $this->actingAsAdmin();

        $this->putJson('/api/band-profile', ['epk_tech_rider_id' => 999999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('epk_tech_rider_id');
    });

    it('clears the link with null', function () {
        $this->actingAsAdmin();
        BandProfile::findOrFail(1)->update(['epk_tech_rider_id' => publishedRider()->id]);

        $this->putJson('/api/band-profile', ['epk_tech_rider_id' => null])
            ->assertSuccessful()
            ->assertJsonPath('data.epk_tech_rider_id', null)
            ->assertJsonPath('data.tech_rider_url', null)
            ->assertJsonPath('data.epk_tech_rider', null);
    });

    it('serves tech_rider_url publicly and never a stage_plot_url', function () {
        $rider = publishedRider();
        BandProfile::findOrFail(1)->update(['epk_tech_rider_id' => $rider->id]);

        $this->getJson('/api/band-profile')
            ->assertSuccessful()
            ->assertJsonPath('data.tech_rider_url', "/rider/{$rider->public_token}")
            ->assertJsonMissingPath('data.stage_plot_url');
    });

    it('serves null tech_rider_url when the rider is deleted after linking', function () {
        $rider = publishedRider();
        BandProfile::findOrFail(1)->update(['epk_tech_rider_id' => $rider->id]);
        $rider->delete();

        $this->getJson('/api/band-profile')
            ->assertSuccessful()
            ->assertJsonPath('data.tech_rider_url', null)
            ->assertJsonPath('data.epk_tech_rider', null);
    });
});
```

Pest scopes a `function` declared inside a `describe` closure to the file, so `publishedRider` must not collide with another helper in this file — `grep -n "function publishedRider" api/tests` must be empty.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
docker build --target test -t bandms_test ./api && docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter 'epk_tech_rider_id'
```

Expected: the new block fails — `epk_tech_rider_id` is silently dropped by validation, `tech_rider_url` reads the dropped column and throws, `stage_plot_url` is present.

- [ ] **Step 3: Add the validation rule**

In `BandProfileController::update()`, after the `'epk_album_id'` rule add:

```php
            // Laravel's `exists` rule cannot express "has a published version",
            // and a never-published rider's public page 404s — so the press kit
            // must never be allowed to point at one.
            'epk_tech_rider_id'        => ['nullable', 'integer', function (string $attribute, mixed $value, \Closure $fail) {
                $published = TechRider::whereKey($value)->whereHas('publishedVersion')->exists();
                if (! $published) {
                    $fail('Only a rider with a published version can be linked to the EPK.');
                }
            }],
```

Add `use App\Models\TechRider;` to the imports.

Change both eager-load calls in `show()` and `update()` from

```php
->load(['members', 'socialLinks', 'logos', 'defaultLogo'])
```

to

```php
->load(['members', 'socialLinks', 'logos', 'defaultLogo', 'epkTechRider.publishedVersion'])
```

- [ ] **Step 4: Reshape the resource**

In `BandProfileResource::toArray()` replace

```php
            'tech_rider_url'           => $this->tech_rider_path ? '/storage/' . $this->tech_rider_path : null,
            'stage_plot_url'          => $this->stage_plot_path ? '/storage/' . $this->stage_plot_path : null,
```

with

```php
            // The rider's own token: it always serves the latest published
            // version, so a republish reaches every press-kit link at once.
            // Null until that rider has a published version — its page 404s
            // before then, and the public rows hide on null.
            'tech_rider_url'          => $this->epkTechRider?->publishedVersion
                ? '/rider/' . $this->epkTechRider->public_token
                : null,
            'epk_tech_rider_id'       => $this->epk_tech_rider_id,
            'epk_tech_rider'          => $this->epkTechRider ? [
                'id'                => $this->epkTechRider->id,
                'name'              => $this->epkTechRider->name,
                'published_version' => $this->epkTechRider->publishedVersion?->version_number,
            ] : null,
```

`$this->epkTechRider` is a lazy relation read; it is loaded in `show()`/`update()` and lazy-loads elsewhere (one profile row — no N+1 possible).

- [ ] **Step 5: Run the tests to verify they pass**

```bash
docker build --target test -t bandms_test ./api && docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter BandProfileTest
```

Expected: all pass, including the seven new cases.

- [ ] **Step 6: Commit**

```bash
git add api/app/Http/Controllers/BandProfileController.php api/app/Http/Resources/BandProfileResource.php api/tests/Feature/BandProfileTest.php
git commit -m "$(cat <<'EOF'
EPK: validate the linked rider is published; serve its token as tech_rider_url

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Snapshot builder

**Files:**
- Modify: `api/app/Services/EpkSnapshotBuilder.php:67-68`
- Test: `api/tests/Feature/EpkVersionTest.php`

**Interfaces:**
- Consumes: `BandProfile::epkTechRider()`.
- Produces: `EpkSnapshotBuilder::build()['tech_rider_url']` by the same rule as the resource; no `stage_plot_url` key.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/Feature/EpkVersionTest.php` (check the file's existing `use` block has `App\Models\BandProfile` and add `use App\Models\TechRider;` and `use App\Services\EpkSnapshotBuilder;` if absent):

```php
describe('EpkSnapshotBuilder tech rider', function () {
    beforeEach(fn () => $this->createProfile());

    it('freezes the linked rider as its own token and emits no stage_plot_url', function () {
        $rider = TechRider::create(['profile_id' => 1, 'name' => 'Festival set', 'is_active' => false]);
        $rider->versions()->create([
            'version_number' => 1, 'snapshot' => ['format' => 1], 'status' => 'published', 'published_at' => now(),
        ]);
        BandProfile::findOrFail(1)->update(['epk_tech_rider_id' => $rider->id]);

        $snapshot = EpkSnapshotBuilder::build();

        expect($snapshot['tech_rider_url'])->toBe("/rider/{$rider->public_token}")
            ->and($snapshot)->not->toHaveKey('stage_plot_url');
    });

    it('freezes null when no rider is linked', function () {
        expect(EpkSnapshotBuilder::build()['tech_rider_url'])->toBeNull();
    });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
docker build --target test -t bandms_test ./api && docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter 'EpkSnapshotBuilder tech rider'
```

Expected: FAIL — the builder reads `tech_rider_path` (undefined attribute → null) and emits `stage_plot_url`.

- [ ] **Step 3: Update the builder**

In `EpkSnapshotBuilder.php` replace

```php
            'tech_rider_url'           => $profile->tech_rider_path ? '/storage/' . $profile->tech_rider_path : null,
            'stage_plot_url'           => $profile->stage_plot_path ? '/storage/' . $profile->stage_plot_path : null,
```

with

```php
            // The rider's own token, not a version token: a rider republish
            // must reach the press kit without a new EPK version. Same rule
            // as BandProfileResource.
            'tech_rider_url'           => $profile->epkTechRider?->publishedVersion
                ? '/rider/' . $profile->epkTechRider->public_token
                : null,
```

- [ ] **Step 4: Run to verify it passes**

Same filter. Expected: 2 passed. Then run the full backend suite (`docker run … bandms_test` with no filter) — expected all green.

- [ ] **Step 5: Commit**

```bash
git add api/app/Services/EpkSnapshotBuilder.php api/tests/Feature/EpkVersionTest.php
git commit -m "$(cat <<'EOF'
EPK snapshot: freeze the rider token, drop stage_plot_url

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Admin — types, API layer, composable

**Files:**
- Modify: `app/src/types/bandProfile.ts:48-49, ~126, ~231-232`
- Modify: `app/src/api/bandProfile.ts:27-63`
- Modify: `app/src/composables/useBandProfile.ts`

**Interfaces:**
- Produces: `BandProfile.epk_tech_rider_id: number | null`, `BandProfile.epk_tech_rider: { id: number; name: string; published_version: number | null } | null`, `BandProfilePayload.epk_tech_rider_id?: number | null`; `useBandProfile()` returns `{ query, update, syncFb }`.

- [ ] **Step 1: Types**

In `app/src/types/bandProfile.ts`, in the `BandProfile` interface replace

```ts
  tech_rider_url: string | null
  stage_plot_url: string | null
```

with

```ts
  /** `/rider/{token}` of the linked rider, null until it has a published version. */
  tech_rider_url: string | null
  epk_tech_rider_id: number | null
  epk_tech_rider: EpkTechRiderRef | null
```

Add above the `BandProfile` interface:

```ts
/** What the admin shows for the rider linked to the press kit. */
export interface EpkTechRiderRef {
  id: number
  name: string
  published_version: number | null
}
```

In `BandProfilePayload`, after `epk_album_id?: number | null` add `epk_tech_rider_id?: number | null`.

In the `EpkData` interface (around line 231) delete the line `stage_plot_url: string | null`; keep `tech_rider_url`.

- [ ] **Step 2: API layer and composable**

In `app/src/api/bandProfile.ts` delete the four functions `uploadTechRider`, `deleteTechRider`, `uploadStagePlot`, `deleteStagePlot`.

Replace `app/src/composables/useBandProfile.ts` with:

```ts
import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchBandProfile, updateBandProfile, syncFacebookLikes } from '@/api/bandProfile'
import type { BandProfile, BandProfilePayload, FacebookSyncResult } from '@/types/bandProfile'
import { useAuth } from './useAuth'
import { useLang } from './useLang'

export function useBandProfile() {
  const { token } = useAuth()
  const { lang } = useLang()
  const queryClient = useQueryClient()
  const qk = computed(() => ['band-profile', lang.value])

  const query = useQuery<BandProfile>({ queryKey: qk, queryFn: () => fetchBandProfile(lang.value) })

  const update = useMutation({
    mutationFn: (payload: BandProfilePayload) => updateBandProfile(token.value!, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['band-profile'] }),
  })

  const syncFb = useMutation<FacebookSyncResult>({
    mutationFn: () => syncFacebookLikes(token.value!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['band-profile'] }),
  })

  return { query, update, syncFb }
}
```

- [ ] **Step 3: Type-check — expect the view to fail**

```bash
cd /c/Projects/bandms/app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build 2>&1 | tail -20
```

Expected: errors only in `BandProfileAdminView.vue` (`uploadRider` etc. not returned; `stage_plot_url` does not exist). Anything in another file means a consumer was missed — `grep -rn "stage_plot_url\|uploadRider\|deletePlot" src/` to find it.

- [ ] **Step 4: Commit (view still red — Task 6 fixes it)**

```bash
git add app/src/types/bandProfile.ts app/src/api/bandProfile.ts app/src/composables/useBandProfile.ts
git commit -m "$(cat <<'EOF'
Admin: drop the rider/stage-plot upload API layer, add epk_tech_rider types

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Admin — the rider selector in the EPK section

**Files:**
- Modify: `app/src/views/admin/BandProfileAdminView.vue`

**Interfaces:**
- Consumes: `useTechRiders().list` (`TechRiderSummary[]` with `published_version_number`), `adminUrl()` from `@/config/admin`, types from Task 5.
- Produces: `<select data-testid="epk-tech-rider">` in the EPK section whose options are the riders with `published_version_number != null`; a `<p class="field-error">` under it when the server rejects the value; `form.epk_tech_rider_id` in the save payload.

- [ ] **Step 1: Script changes**

Change the destructure at the top:

```ts
const { query, update, syncFb } = useBandProfile()
const { query: releasesQ } = useReleases()
const { list: ridersQ } = useTechRiders()
```

Add imports:

```ts
import { useTechRiders } from '@/composables/useTechRiders'
import { adminUrl } from '@/config/admin'
```

Add after `releasesQ`:

```ts
// Only a rider with a published version can be linked — its page 404s until
// then, and the API rejects anything else. Same rule as the server.
const publishableRiders = computed(() =>
  (ridersQ.data.value ?? []).filter(r => r.published_version_number != null),
)
const riderPageUrl = adminUrl('tech-rider')
```

In `form`, after `epk_release_id: null as number | null,` add `epk_tech_rider_id: null as number | null,`.

In the `watch` that fills the form, after `form.epk_release_id = val.epk_release_id ?? null` add `form.epk_tech_rider_id = val.epk_tech_rider_id ?? null`.

In `saveProfile()`'s payload, after `epk_release_id: form.epk_release_id,` add `epk_tech_rider_id: form.epk_tech_rider_id,`.

Delete `riderInput`, `plotInput`, `handleRiderUpload`, `handlePlotUpload`, `removeRider`, `removePlot`.

- [ ] **Step 2: Template changes**

Replace the two `<div>` blocks — from `<div>\n              <label class="field-label">Tech rider (PDF)</label>` through the closing `</div>` of the stage-plot block (the one ending with `PNG, JPG — max 4 MB</span>\n              </div>\n            </div>`) — with:

```vue
            <div>
              <label class="field-label" for="epk-tech-rider">Tech rider &amp; stage plot</label>
              <select id="epk-tech-rider" v-model="form.epk_tech_rider_id" class="field-input" data-testid="epk-tech-rider">
                <option :value="null">— None —</option>
                <option v-for="r in publishableRiders" :key="r.id" :value="r.id">
                  {{ r.name }} (v{{ r.published_version_number }})
                </option>
              </select>
              <p v-if="fieldErrors.epk_tech_rider_id" class="field-error">{{ fieldErrors.epk_tech_rider_id[0] }}</p>
              <p class="field-hint">
                Only riders with a published version are listed. The press kit links the rider's permanent page,
                which always shows its latest published version.
                <router-link :to="riderPageUrl" class="field-hint-link">Manage riders →</router-link>
              </p>
            </div>
```

Delete the CSS rules `.file-row`, `.file-link`, `.file-link:hover`, `.btn-remove-file` (all three), `.file-upload-row`, `.btn-upload-file` (all three), `.file-hint`, `.stage-thumb`. Add:

```css
.field-hint-link { color: #9ca3af; text-decoration: underline; margin-left: 0.25rem; }
.field-hint-link:hover { color: #d0d0d0; }
```

Confirm `.field-error` exists in `form-styles.css` (it does, line 59) so no new rule is needed for it.

- [ ] **Step 3: Type-check and unit tests**

```bash
cd /c/Projects/bandms/app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build 2>&1 | tail -5 && pnpm test:unit 2>&1 | tail -5
```

Expected: build succeeds; unit suite green (no count change — nothing under test here).

- [ ] **Step 4: Rebuild the frontend image and check by hand**

```bash
cd /c/Projects/bandms && bash rebuild.sh --skip-tests 2>&1 | tail -15
```

Open `http://localhost:8081/admin/band-profile` → EPK tab. The select lists only riders that have been published in `/admin/tech-rider`; pick one, *Save profile*, reload — it stays selected. `GET http://localhost:8081/api/band-profile` shows `tech_rider_url: "/rider/<32 chars>"`.

- [ ] **Step 5: Commit**

```bash
git add app/src/views/admin/BandProfileAdminView.vue
git commit -m "$(cat <<'EOF'
Admin: EPK links a published tech rider instead of uploading files

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Admin E2E — the selector

**Files:**
- Modify: `app/e2e/tests/admin/band-profile.spec.ts` (inside `test.describe('EPK tab', …)`)

**Interfaces:**
- Consumes: `data-testid="epk-tech-rider"` from Task 6; `POST /api/tech-riders`, `POST /api/tech-riders/{id}/versions`, `DELETE /api/tech-riders/{id}`, `GET/PUT /api/band-profile`.

- [ ] **Step 1: Add the helpers at the top of the file**

After `test.use({ storageState: 'e2e/.auth/admin.json' })`:

```ts
import { readFileSync } from 'node:fs'
import type { APIRequestContext } from '@playwright/test'

const API = process.env.E2E_API_URL ?? 'http://localhost:8081'

// storageState replays cookies only and e2e/.auth/admin.json holds none — an
// API context built from it is anonymous. Lift the token out and send it.
function adminToken(): string {
  const raw = JSON.parse(readFileSync('e2e/.auth/admin.json', 'utf-8'))
  const entry = raw.origins?.[0]?.localStorage?.find((e: { name: string }) => e.name === 'auth_token')
  if (!entry?.value) throw new Error('No auth_token in e2e/.auth/admin.json — cannot seed riders')
  return entry.value
}

async function api(request: APIRequestContext, method: 'get' | 'post' | 'put' | 'delete', path: string, data?: unknown) {
  const res = await request[method](`${API}${path}`, {
    headers: { Authorization: `Bearer ${adminToken()}`, Accept: 'application/json' },
    ...(data ? { data } : {}),
  })
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} → ${res.status()}: ${await res.text()}`)
  return res
}
```

(Move the `import` lines up with the other imports — ESM imports must be top-level.)

- [ ] **Step 2: Write the tests**

Inside `test.describe('EPK tab', …)`, after the two existing tests:

```ts
    // The selector offers only riders that have a published version — a
    // never-published rider's public page 404s, and the API refuses it.
    test.describe('tech rider selector', () => {
      const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const PUBLISHED_NAME = `E2E published rider ${STAMP}`
      const DRAFT_NAME = `E2E draft rider ${STAMP}`
      let publishedId = 0
      let draftId = 0
      let originalRiderId: number | null = null

      test.beforeAll(async ({ request }) => {
        const profile = await (await api(request, 'get', '/api/band-profile')).json()
        originalRiderId = profile.data.epk_tech_rider_id ?? null

        publishedId = (await (await api(request, 'post', '/api/tech-riders', { name: PUBLISHED_NAME, is_active: false })).json()).data.id
        await api(request, 'post', `/api/tech-riders/${publishedId}/versions`, { notes: 'E2E' })
        draftId = (await (await api(request, 'post', '/api/tech-riders', { name: DRAFT_NAME, is_active: false })).json()).data.id
      })

      test.afterAll(async ({ request }) => {
        // Restore first, then delete: the FK is nullOnDelete, so deleting a
        // rider the profile still points at would silently clear the link.
        const restore = await api(request, 'put', '/api/band-profile', { epk_tech_rider_id: originalRiderId })
        expect(restore.ok()).toBe(true)
        await api(request, 'delete', `/api/tech-riders/${publishedId}`)
        await api(request, 'delete', `/api/tech-riders/${draftId}`)
      })

      test('offers published riders and not drafts', async ({ page }) => {
        const select = page.getByTestId('epk-tech-rider')
        await expect(select.locator('option', { hasText: PUBLISHED_NAME })).toHaveCount(1)
        await expect(select.locator('option', { hasText: DRAFT_NAME })).toHaveCount(0)
      })

      test('selecting a rider persists across reload and links its token', async ({ page, request }) => {
        await page.getByTestId('epk-tech-rider').selectOption(String(publishedId))
        await page.locator('form button[type="submit"]').click()
        await expect(page.getByText('Profile saved')).toBeVisible()

        await page.reload()
        await page.waitForLoadState('networkidle')
        await page.getByRole('tab', { name: 'EPK' }).click()
        await expect(page.getByTestId('epk-tech-rider')).toHaveValue(String(publishedId))

        const profile = await (await api(request, 'get', '/api/band-profile')).json()
        expect(profile.data.tech_rider_url).toMatch(/^\/rider\/[A-Za-z0-9]{32}$/)
      })
    })
```

- [ ] **Step 3: Run the spec**

```bash
cd /c/Projects/bandms/app && pnpm test:e2e -- e2e/tests/admin/band-profile.spec.ts 2>&1 | tail -20
```

Expected: all pass, including the two new tests. If `Profile saved` is not found, check the `[vite] http proxy error … ECONNRESET` signature in the log before suspecting the code.

- [ ] **Step 4: Commit**

```bash
git add app/e2e/tests/admin/band-profile.spec.ts
git commit -m "$(cat <<'EOF'
E2E: EPK rider selector offers published riders and persists the choice

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Site copy — retire the file-era keys

**Files:**
- Modify: `packages/site-copy/src/modules/about.ts:126-149`
- Modify: `packages/site-copy/src/modules/contact.ts:219-221, 317-332`
- Test: `packages/site-copy/src/resolve.spec.ts`

**Interfaces:**
- Produces: `ABOUT_COPY` without `rider`, `riderSub`, `stagePlot`, `stagePlotSub`, `download`; `CONTACT_COPY` without `epkStagePlot`, `epkStagePlotMeta`; new defaults for `riderTitle`, `epkRider`, `epkRiderMeta`.

- [ ] **Step 1: Write the failing test**

Append inside `describe('the registry', …)` in `resolve.spec.ts`:

```ts
  it('retired the file-era rider keys when the EPK started linking the rider page', () => {
    // 2026-09-21: the press kit links /rider/{token}, which carries the stage
    // plot, so the separate stage-plot rows and the About press cards went.
    // See docs/superpowers/specs/2026-09-21-epk-tech-rider-link-design.md.
    const about = copyFieldsFor('about').map(f => f.key)
    for (const key of ['rider', 'riderSub', 'stagePlot', 'stagePlotSub', 'download']) {
      expect(about, key).not.toContain(key)
    }
    const contact = copyFieldsFor('contact').map(f => f.key)
    expect(contact).not.toContain('epkStagePlot')
    expect(contact).not.toContain('epkStagePlotMeta')
    expect(contact).toEqual(expect.arrayContaining(['riderTitle', 'riderSub', 'riderCta', 'epkRider', 'epkRiderMeta']))
    const epkRider = copyFieldsFor('contact').find(f => f.key === 'epkRider')!
    expect(defaultFor(epkRider, 'en')).toBe('Tech rider & stage plot')
    expect(defaultFor(epkRider, 'pl')).toBe('Rider techniczny i plan sceny')
  })
```

`defaultFor(field: CopyField, lang: string)` is already imported in this spec.

- [ ] **Step 2: Run to verify it fails**

```bash
cd /c/Projects/bandms/app && pnpm test:unit -- resolve 2>&1 | tail -15
```

Expected: FAIL — the retired keys are still present.

- [ ] **Step 3: Edit the registries**

In `about.ts` delete the five entries with keys `rider`, `riderSub`, `stagePlot`, `stagePlotSub`, `download`.

In `contact.ts`:

```ts
  {
    key: 'riderTitle', label: 'Tech rider: title', group: 'Promoters & press', maxLength: 60,
    defaults: { en: 'Tech rider & stage plot', pl: 'Rider techniczny i plan sceny' },
  },
```

```ts
  {
    key: 'epkRider', label: 'Rider row: title', group: 'Press kit modal', maxLength: 40,
    defaults: { en: 'Tech rider & stage plot', pl: 'Rider techniczny i plan sceny' },
  },
  {
    key: 'epkRiderMeta', label: 'Rider row: caption', group: 'Press kit modal', maxLength: 60,
    defaults: { en: 'Stage plan, input list & backline', pl: 'Plan sceny, lista wejść i backline' },
  },
```

and delete the `epkStagePlot` and `epkStagePlotMeta` entries.

- [ ] **Step 4: Run to verify it passes**

Same command. Expected: green. Then grep for stragglers — the admin's website-modules editor builds its form from the registry so it needs no change, but confirm nothing else names a retired key:

```bash
cd /c/Projects/bandms && grep -rn "stagePlotSub\|epkStagePlot\|t\.download\b\|t\.rider\b\|t\.stagePlot\b" app/src web/src packages --include=*.ts --include=*.vue --include=*.astro
```

Expected: only the two lines in `AboutSection.astro` and the two rows in `ContactSection.astro`, which Task 9 removes.

- [ ] **Step 5: Commit**

```bash
git add packages/site-copy
git commit -m "$(cat <<'EOF'
Site copy: one "Tech rider & stage plot" row, retire the stage-plot keys

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Public site — About and Contact

**Files:**
- Modify: `web/src/types/bandProfile.ts:29`
- Modify: `web/src/components/sections/AboutSection.astro:121-130, 250-268`
- Modify: `web/src/components/sections/ContactSection.astro:78-81, 127-159`

**Interfaces:**
- Consumes: `profile.tech_rider_url` (`/rider/{token}` or null), `siteConfig.modules['tech-rider']`, copy keys from Task 8.
- Produces: About has no rider/stage-plot card; Contact's press-kit modal has one rider row (`isFile: false`, module-gated) and no stage-plot row; the promo rider card is likewise gated.

- [ ] **Step 1: Types**

In `web/src/types/bandProfile.ts` delete `stage_plot_url: string | null`.

- [ ] **Step 2: About**

Replace the press-card block:

```ts
// Press cards, each present only when its target exists. Both are module
// routes and disappear with the module. The rider is not offered here: it
// lives in the Contact page's press kit, beside the booking channels.
const pressCards = [
  { icon: 'star', title: t.epk, sub: t.epkSub, href: href('epk'), cta: t.open, show: enabled('epk') },
  { icon: 'camera', title: t.photos, sub: t.photosSub, href: href('photos'), cta: t.open, show: enabled('photos') },
].filter(c => c.show)
```

In the template, the card anchor becomes:

```astro
              <a class="ab-press-card" href={card.href}>
                <Icon name={card.icon} size={30} color="var(--color-accent)" />
                <span class="ab-press-body">
                  <span class="ab-press-title">{card.title}</span>
                  <span class="ab-press-sub">{card.sub}</span>
                </span>
                <span class="ab-press-cta">
                  <Icon name="chevron" size={16} color="var(--color-accent)" />
                  {card.cta}
                </span>
              </a>
```

- [ ] **Step 3: Contact**

Update the press-kit comment (line ~78):

```ts
// Assembled from what the API actually holds, so a band with no rider linked
// has no rider row. Every field is read defensively: a published EPK version is
// a frozen snapshot that predates any field added later.
```

Replace the two rider/stage-plot entries in `epkAssets` with one:

```ts
  {
    icon: 'filter',
    title: t.epkRider,
    meta: t.epkRiderMeta,
    // The rider's own page — /rider/{token}, served by the tech-rider module.
    // A disabled module unbuilds it, so this gates on the module map like every
    // other route link; `isFile` is false because it is a page, not a download.
    href: profile.tech_rider_url ?? '',
    isFile: false,
    show: Boolean(profile.tech_rider_url) && enabled('tech-rider'),
  },
```

Replace the promo rider card and its three-line comment:

```ts
  // The rider page carries the stage plot too; gated on the module that
  // serves it, for the same reason the EPK and Photos cards are.
  { icon: 'filter',   title: t.riderTitle,  sub: t.riderSub,  cta: t.riderCta,  href: profile.tech_rider_url ?? '', show: Boolean(profile.tech_rider_url) && enabled('tech-rider'), isFile: false },
```

- [ ] **Step 4: Type-check, lint, build against the live API**

```bash
cd /c/Projects/bandms/web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "slots.ts\|types/shop.ts" | tail -5
cd /c/Projects/bandms/web && API_BASE=http://localhost:8081 pnpm build 2>&1 | tail -8
```

Expected: no new `tsc` errors; token lint and `astro build` green. Then verify in `dist/` (a rider must be linked in the admin — Task 6 Step 4 did that):

```bash
cd /c/Projects/bandms/web
grep -c 'ab-press-card' dist/en/about/index.html          # 2 or fewer, never a rider card
grep -o 'href="/rider/[A-Za-z0-9]*"' dist/en/contact/index.html | sort -u   # exactly one token
grep -c 'Stage plot' dist/en/contact/index.html            # 0
grep -rl undefined dist --include=*.html                    # empty
```

- [ ] **Step 5: Rebuild the web image**

```bash
cd /c/Projects/bandms && docker compose build web && docker compose up -d web
```

Confirm the served code is new: `curl -s http://localhost:4322/en/contact | grep -o 'href="/rider/[A-Za-z0-9]*"' | head -1` prints a token.

- [ ] **Step 6: Commit**

```bash
git add web/src/types/bandProfile.ts web/src/components/sections/AboutSection.astro web/src/components/sections/ContactSection.astro
git commit -m "$(cat <<'EOF'
Public site: press kit links the rider page; About drops the rider cards

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Public E2E

**Files:**
- Modify: `app/e2e/tests/public/epk-modal.spec.ts`
- Modify: `app/e2e/tests/public/about.spec.ts:133-147`

**Interfaces:**
- Consumes: `.ek-row` / `.ek-title` in the modal; `.ab-press-card` on About; `.preview-root` (RiderSheet's root) on `/rider/{token}`; the admin API for seeding; `POST /api/admin/site/rebuild` + `/status`.

- [ ] **Step 1: About — every press card is a route**

Replace the `press cards link to something real and files open in a new tab` test:

```ts
  // Since the EPK links the rider page (2026-09-21) every press card here is
  // an internal route; the rider and stage-plot cards are gone for good.
  test('press cards are internal routes, and none is the rider', async ({ page }) => {
    await page.goto(`${WEB}/en/about`)

    const cards = page.locator('.ab-press-card')
    test.skip((await cards.count()) === 0, 'No press assets on this instance')

    for (let i = 0; i < (await cards.count()); i++) {
      const href = await cards.nth(i).getAttribute('href')
      expect(href).toMatch(/^\/en\//)
      expect(await cards.nth(i).getAttribute('target')).toBeNull()
      await expect(cards.nth(i).locator('.ab-press-title')).not.toHaveText(/rider|stage plot/i)
    }
  })
```

- [ ] **Step 2: EPK modal — the rider row**

Add to the top of `epk-modal.spec.ts` the same `API`, `adminToken`, `api` and `rebuildAndWait` helpers as `clips-surfaces.spec.ts` lines 6–64 (copy them verbatim, including the `readFileSync` and `APIRequestContext` imports). Then add a serial describe at the end of the file:

```ts
// Seeds a published rider, links it, rebuilds, and asserts the modal's rider
// row opens the rider page. Serial and self-restoring: it writes the shared
// band_profiles row and the served site.
test.describe('Press kit modal — linked tech rider', () => {
  test.describe.configure({ mode: 'serial' })

  const STAMP = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  let riderId = 0
  let token = ''
  let originalRiderId: number | null = null

  test.beforeAll(async ({ request }) => {
    test.skip(!(await publicSiteIsUp(request)), `Astro site not reachable at ${WEB}`)

    const profile = await (await api(request, 'get', '/api/band-profile')).json()
    originalRiderId = profile.data.epk_tech_rider_id ?? null

    const rider = (await (await api(request, 'post', '/api/tech-riders', { name: `E2E epk rider ${STAMP}`, is_active: false })).json()).data
    riderId = rider.id
    token = rider.public_token
    await api(request, 'post', `/api/tech-riders/${riderId}/versions`, { notes: 'E2E' })
    await api(request, 'put', '/api/band-profile', { epk_tech_rider_id: riderId })
    await rebuildAndWait(request, Date.now())
  })

  test.afterAll(async ({ request }) => {
    if (!riderId) return
    const restore = await api(request, 'put', '/api/band-profile', { epk_tech_rider_id: originalRiderId })
    expect(restore.ok()).toBe(true)
    await api(request, 'delete', `/api/tech-riders/${riderId}`)
    // The served site still shows the seeded link until rebuilt.
    await rebuildAndWait(request, Date.now())
  })

  test('has one rider row, no stage-plot row, and it opens the rider sheet', async ({ page }) => {
    const dialog = await openKit(page)
    expect(dialog, 'press kit trigger present once a rider is linked').not.toBeNull()

    // `.ek-row` is the <a> itself (EpkModal.vue), so href sits on the row.
    const riderRow = dialog!.locator(`.ek-row[href="/rider/${token}"]`)
    await expect(riderRow).toBeVisible()
    await expect(dialog!.locator('.ek-row[href^="/rider/"]')).toHaveCount(1)
    await expect(dialog!.locator('.ek-title', { hasText: /^stage plot$/i })).toHaveCount(0)
    expect(await riderRow.getAttribute('target'), 'a page, not a download').toBeNull()

    await riderRow.click()
    await expect(page).toHaveURL(new RegExp(`/rider/${token}$`))
    await expect(page.locator('.preview-root')).toBeVisible({ timeout: 15000 })
  })
})
```

- [ ] **Step 3: Run both specs**

```bash
cd /c/Projects/bandms/app && pnpm test:e2e -- e2e/tests/public/epk-modal.spec.ts e2e/tests/public/about.spec.ts 2>&1 | tail -25
```

Expected: green. The rider describe takes ~1–2 minutes for two rebuilds.

- [ ] **Step 4: Commit**

```bash
git add app/e2e/tests/public/epk-modal.spec.ts app/e2e/tests/public/about.spec.ts
git commit -m "$(cat <<'EOF'
E2E: press kit's rider row opens the rider page; About has no rider card

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Docs, full suite, PR

**Files:**
- Modify: `CLAUDE.md` (section *Public rider link 404s until the rider is published*, ~line 270)
- Modify: `CHANGELOG.md` (new `[Unreleased]` block at the top)

- [ ] **Step 1: CLAUDE.md**

After the paragraph beginning `**Fix:** Open the rider in `/admin/tech-rider` and press **Publish**.` add:

```markdown
**The press kit links the rider by its own token.** Band profile → EPK has a
*Tech rider & stage plot* selector (`band_profiles.epk_tech_rider_id`) that
offers **only riders with a published version** — the API rejects any other
id with 422 — and `tech_rider_url` on `/api/band-profile` and in every EPK
snapshot is `/rider/{rider.public_token}`, never a version token. So a rider
republish reaches the Contact page's press kit without a new EPK version and
without a site rebuild (the string does not change). There is no uploaded
PDF or stage-plot image any more; the sheet *is* both documents. The rows
that link it gate on the `tech-rider` module, because a switched-off module
unbuilds `/rider/*`.
```

- [ ] **Step 2: CHANGELOG.md**

Insert above the first `## [Unreleased]` line:

```markdown
## [Unreleased] — 2026-09-21 (EPK links the tech rider)

### Changed
- **Band profile → EPK links a tech rider from the tech-rider module instead of taking a PDF and a stage-plot image.** The new *Tech rider & stage plot* selector offers riders that have a published version; the press kit on the Contact page then links the rider's permanent page, which carries the stage plot and always shows the latest published version — so republishing a rider updates the press kit with no new EPK version.
- The About page's press cards no longer list the rider or stage plot; the Contact page's press-kit modal has one *Tech rider & stage plot* row instead of two.

### Removed
- `POST|DELETE /api/band-profile/tech-rider` and `/stage-plot`, the `tech_rider_path` / `stage_plot_path` columns (their files are deleted by the migration) and `stage_plot_url` from the profile API and EPK snapshots. `tech_rider_url` keeps its name and now holds `/rider/{token}`.
- Copy keys `rider`, `riderSub`, `stagePlot`, `stagePlotSub`, `download` (About) and `epkStagePlot`, `epkStagePlotMeta` (Contact). Overrides saved under them are dropped.
```

- [ ] **Step 3: Full rebuild and the whole suite**

```bash
cd /c/Projects/bandms && bash rebuild.sh 2>&1 | tail -20
bash scripts/test-all.sh 2>&1 | tail -30
```

Expected: rebuild steps all green; `test-all` exit code 0 (frontend unit, backend unit, E2E). If E2E goes red, triage per CLAUDE.md — a different set of specs each run with `ECONNRESET` in the log is the machine, not the change.

- [ ] **Step 4: Commit and open the PR**

```bash
git add CLAUDE.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
Docs: EPK links the tech rider by token; changelog

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git status --short   # must be empty — no review scratch files, no stray full.diff
git push -u origin feature/epk-tech-rider-link
gh pr create --title "EPK links a published tech rider instead of uploaded files" --body "$(cat <<'EOF'
Band profile → EPK carried two upload fields (rider PDF, stage-plot image) that predate the tech-rider module. The module already renders both documents on one page with a permanent token, so the EPK now links a rider instead.

- `band_profiles.epk_tech_rider_id` (nullable FK, nullOnDelete); `tech_rider_path`/`stage_plot_path` dropped, their files deleted by the migration
- Only a rider with a published version can be linked (422 otherwise); `tech_rider_url` is `/rider/{rider.public_token}` on the profile API and in EPK snapshots, so a republish reaches the press kit without a new EPK version
- Admin: one selector in the EPK section, published riders only, link to the rider editor
- Public: Contact's press kit has one "Tech rider & stage plot" row gated on the `tech-rider` module; About drops the rider/stage-plot cards; seven copy keys retired
- Tests: Pest (`BandProfileTest`, `EpkVersionTest`), site-copy `resolve.spec`, admin E2E (`band-profile.spec`), public E2E (`epk-modal.spec`, `about.spec`)

Spec: `docs/superpowers/specs/2026-09-21-epk-tech-rider-link-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Code review before merge**

Run `/code-review` on the PR (CLAUDE.md: every PR gets an explicit pass; `/ship` and `git-feature-workflow` do not cover `api/`-only changes). Address findings, re-run the affected suites, then merge via GitHub.
