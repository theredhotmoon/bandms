# Hero images: standalone storage + active toggle

**Date:** 2026-09-09
**Status:** approved
**Supersedes:** the *Data model*, *API*, and *Admin UI* sections of
[2026-09-06-hero-background-images-design.md](2026-09-06-hero-background-images-design.md).
Everything under that doc's *Public rendering* and *Consolidating the page
headers* sections (`HeroBackdrop.astro`, `PageHero.astro`, the darkening
treatment) is unaffected and stays as built.

## Problem

The hero images feature shipped three days ago (#78) with `hero_images` as a
join table pointing at gallery `photos` (`photo_id`, `scope`, `position`), and
the admin's "Add from gallery" picker pulling from the same albums the public
photo gallery uses.

That coupling is a mistake, caught before it had real data in it:

- Deleting a gallery photo silently empties every hero set it belonged to
  (`cascadeOnDelete`) — a band member cleaning up old gallery photos can break
  hero backdrops with no warning and nothing in the gallery UI to suggest the
  connection.
- Hero pictures and gallery pictures are different assets serving different
  purposes (backdrop decoration vs. content people browse) that happen to share
  a table by accident of implementation convenience, not by design.
- There's no way to temporarily hide a hero picture without deleting it —
  deleting loses the caption/position and means re-uploading (in the old
  gallery-picker model, re-adding) if wanted back later.

## Goals

- Hero images are their own asset, uploaded directly in the Hero Images admin
  screen, stored in their own place on disk, with **no relationship to the
  gallery/album system at all**.
- Each hero picture (per scope) can be marked **active or inactive**
  independently, without deleting it. Inactive pictures never reach the public
  site but stay in the admin for later reactivation.
- No loss of existing capability: per-scope override behaviour, random pick
  when a scope holds more than one *active* picture, drag/arrow reordering,
  rebuild-on-save.

## Non-goals

- Scheduled hide (e.g. "hide until date X"). "Sometimes I don't want to delete
  it, but I want to hide it for some time" is a manual toggle, not a scheduler
  — a `paused_until` timestamp is a clean follow-up if it's ever actually
  wanted, not built speculatively now.
- Any change to `HeroBackdrop.astro`, `PageHero.astro`, or the darkening
  treatment — the public rendering contract (`{id, url, caption}` arrays,
  random pick, override-replaces-main) is unchanged.
- Data migration from the old `photo_id`-linked rows. Confirmed with the band:
  nothing real is set yet, so the table is reset rather than migrated.

## Design

### Data model

Redesign the existing `hero_images` table in place (new migration — the
original migration may already have run via CI on a deploy, so it is not
edited):

```php
Schema::table('hero_images', function (Blueprint $table) {
    $table->dropForeign(['photo_id']);
});

DB::table('hero_images')->truncate(); // confirmed: nothing real is set yet

Schema::table('hero_images', function (Blueprint $table) {
    $table->dropColumn('photo_id');
    $table->string('image')->after('scope');
    $table->string('caption')->nullable()->after('image');
    $table->boolean('active')->default(true)->after('position');
});
```

Resulting shape:

| column | notes |
|---|---|
| `id` | |
| `scope` | unchanged — `'main'`, `'home'`, or a live `website_modules.slug` |
| `image` | storage path, own upload — see *Storage* below |
| `caption` | nullable, free text |
| `position` | unchanged — explicit, written from payload/request order, never inferred from `id` |
| `active` | boolean, default `true` |

`HeroImage` model: drop the `photo()` relation entirely. `fillable` becomes
`['scope', 'image', 'caption', 'position', 'active']`; add `'active' =>
'boolean'` to `$casts`. `RESERVED_SCOPES` and `allowedScopes()` are unchanged
— scope validation was never coupled to the photo link.

### Storage

`hero-images/` is a new folder on the `public` disk, separate from `photos/`
— physical separation reinforces the table-level separation, and it means a
`Storage::disk('public')->delete($path)` bug in one feature can't touch the
other's files by directory-listing accident.

### Admin API

The old single `PUT /admin/hero-images/{scope}` (`{photo_ids: [...]}`,
delete-and-recreate) can't express "upload a file," "toggle one row," or "edit
a caption." Replaced with a set of endpoints mirroring how
`AlbumController` already manages photos within an album — this repo's
existing precedent for "a list of images with add/remove/reorder,"
minus the album grouping:

| Route | Behaviour | Response |
|---|---|---|
| `GET /admin/hero-images` | unchanged shape: every scope at once, ordered by `position`. **Now includes inactive rows** — the admin needs to see and re-enable them, unlike the public payload. | `{data: {scope: [HeroImageResource...]}}` |
| `POST /admin/hero-images/{scope}` | multipart upload — `files[]` (required, `image`, `max:20480`, same bound as `AlbumController::addPhotos`), optional parallel `captions[]`. Appended after the current max position in that scope. | `{data: {...}}`, same full map as `GET` |
| `PATCH /admin/hero-images/{id}` | partial update — `caption` and/or `active`. | `{data: {...}}`, same full map as `GET` |
| `PUT /admin/hero-images/{scope}/order` | `{order: [ids...]}` — every id must already belong to that scope; sets `position` from array index, same shape as `AlbumController::reorderPhotos`. | `{data: {...}}`, same full map as `GET` |
| `DELETE /admin/hero-images/{id}` | deletes the file (`Storage::disk('public')->delete`) then the row. | `204 No Content` |

Every mutating endpoint that changes what's returned keeps the existing
`SiteRebuild::requestIfAuto()` call — unchanged from the current controller,
since any of these change what the static build bakes. Every response other
than `DELETE`'s returns the **full map**, not just the affected scope or row,
so the composable can always seed the whole query cache from one response
(the same reasoning the current `HeroImageController::update()` already
follows: "the endpoint returns every scope already ordered, so seeding the
cache avoids a refetch"). `DELETE`'s `204` means its caller invalidates and
refetches instead — matching `removeAlbumPhoto`'s existing handling in
`PhotosAdminView.vue`.

`HeroImageResource`: `{id, url, caption, position, active}` — `url` built from
`image` the same way (`'/storage/' . $this->image`), no more `photo_id` or
joined `photo` fields.

### Public `/api/site-config`

`WebsiteModuleController@index`'s hero assembly changes from joining `photo`
to reading the row directly, and adds an `active` filter:

```php
$hero_images = HeroImage::where('active', true)
    ->orderBy('scope')->orderBy('position')->get()
    ->groupBy('scope')
    ->map(fn ($rows) => $rows->map(fn ($h) => [
        'id'      => $h->id,
        'url'     => '/storage/' . $h->image,
        'caption' => $h->caption,
    ])->values()->all())
    ->all();
```

The `filled($h->photo?->image)` guard is dropped — `image` is a required,
validated column now, not a nullable join through a row that might have lost
its file. The response shape (`{scope: [{id, url, caption}]}`) and the "empty
scope is absent, never present-and-empty" rule are unchanged, so
`web/src/lib/heroImages.ts#resolveHeroImages()` needs no logic change — only
its doc comment, since `id` is no longer "the gallery photo's id" but the
hero_images row's own id.

### Frontend — types, API, composable

`app/src/types/heroImage.ts`:

```ts
export interface HeroImage {
  id: number
  image: string | null
  url: string | null
  caption: string | null
  position: number
  active: boolean
}
```

`photo_id` is gone. `app/src/api/heroImages.ts` gains:

- `uploadHeroImages(token, scope, files: File[], captions?: string[])` —
  multipart `POST`, mirrors `batchCreateAlbum`'s `FormData` construction.
- `updateHeroImage(token, id, {caption?, active?})` — `PATCH`.
- `reorderHeroImages(token, scope, order: number[])` — `PUT .../order`.
- `deleteHeroImage(token, id)` — `DELETE`.

`saveHeroImageScope` is removed. `useHeroImages()` exposes mutations for each
of the four actions above instead of one `save`; each `onSuccess` seeds the
query cache from the response the same way the current `save` does, so no
action causes a refetch-flicker.

### Admin UI (`HeroImagesAdminView.vue`)

Drops the gallery picker (`useAlbums`, `AlbumPhoto`, the "Add from gallery"
modal) and the draft/dirty/reseed pattern — `heroImageScopes.ts`'s
`shouldReseedDraft` becomes dead code and is deleted along with its test,
since there is no longer a local draft to reseed. Every action below is
immediate against the server, the same UX `PhotosAdminView.vue` already uses
for per-photo delete and the EPK-featured toggle:

- **Upload** — a multi-file `<input type="file" multiple accept="image/*">`
  (or drag/drop) uploads immediately with no caption entered up front —
  building a second pre-upload captioning form isn't worth it for an optional
  field. `caption` is edited **inline on the thumbnail after upload** (a text
  input, `PATCH` on blur).
- **Active toggle** — a switch on each thumbnail, `PATCH` on change, dimmed
  styling when off.
- **Reorder** — the existing ← → arrow buttons now fire the `PUT .../order`
  call immediately per click. No "Save order" bar: these lists are a handful
  of pictures, not a full photo album, so a dirty-tracked batch save isn't
  worth the extra state.
- **Remove** — immediate `DELETE`, unchanged from today's behaviour.

`scopeSet()` and `hasOwnSet()` in `heroImageScopes.ts` stay, but `hasOwnSet`
must filter to **active** rows — the scope summary ("inherits Main" vs "N
pictures") has to agree with what the public resolver actually does, or the
editor lies about what visitors see. A scope holding only inactive pictures
shows "inherits Main," matching `resolveHeroImages()`'s treatment of an empty
override.

## Testing

**Pest (`api/tests/Feature/HeroImageTest.php`, rewritten):**

- Upload: creates a row per file, appended after the current max position;
  rejects a non-image / oversized file; rejects more than the bound.
- `PATCH`: updates caption alone, active alone, or both; rejects an unknown id.
- Reorder: writes `position` from array order, with `id` deliberately inverted
  against it (the existing `AuthorTest`/original hero test trick); rejects an
  id that belongs to a different scope.
- Delete: removes the file from storage and the row; a second delete 404s.
- `site-config`: only active rows appear; an inactive-only scope is absent
  (falls back to main), matching an empty scope today.
- Scope validation (accepts disabled module, rejects unknown string) —
  unchanged behaviour, carried over from the current suite.

**Vitest (`app/src/utils/heroImageScopes.spec.ts`):** drop the reseed test;
add a case that `hasOwnSet` ignores inactive-only rows.

**Playwright:** update the existing hero-images admin spec for the new
upload/toggle/reorder flow (still restoring the dev DB in `afterAll`, per the
existing rule for specs mutating shared dev content — see root `CLAUDE.md`).
Add a case to `hero-backdrop.spec.ts` that an inactive picture is never chosen
on the public page.

## Consequences

- Gallery photo deletion can no longer break a hero backdrop — the two systems
  share nothing.
- Hiding a picture is a toggle, not a delete-and-reupload.
- One more storage folder to account for in backup/cleanup tooling, if any
  exists (`photos/` and `hero-images/` under the `public` disk).
- The admin loses the "Save" button's built-in undo (revert draft by not
  saving); every action is now live. Consistent with how `PhotosAdminView`
  already behaves — not a new UX pattern in the codebase.
