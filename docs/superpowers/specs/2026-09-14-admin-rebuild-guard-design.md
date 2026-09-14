# Admin rebuild guard: persistent rebuild control + per-form dirty tracking

**Date:** 2026-09-14
**Status:** approved

## Problem

The "Rebuild" button and the "automatic rebuild after each change" toggle
currently live inside `WebsiteModulesView.vue` only — a single admin screen
that has nothing to do with most of the content that actually needs
rebuilding. An editor who adds a concert, a release, a FAQ, or a band member
has no way to see that the public site is now out of date, and no way to
trigger or check a rebuild, without navigating away to Website Modules.

Worse, the underlying signal is already broken for most content types.
`SiteRebuild::requestIfAuto()` — the one place that's supposed to fire on
every write the public site bakes — is only called from four controllers
(`BandProfileController`, `HeroImageController`, `PostController`,
`WebsiteModuleController`). Concerts, venues, releases, photos/albums, shop
items, FAQs, social links, band members, setlists, music videos, press
releases, and the band logo all bake into `web/`'s static output but never
mark the site dirty today. Auto-rebuild has been silently under-firing for
most of the admin since it shipped.

Separately, no shared "unsaved changes" mechanism exists. One editor
(`useTechRiderEditor.ts`) hand-rolls a `dirty` ref, manually flipped `true` in
every mutator — a pattern duplicated (not shared) in `MemberSetupsPanel.vue`
and `MemberDefaultGear.vue`. Every other admin form (website modules, FAQs,
concerts, releases, ...) has no dirty tracking at all: Save is enabled
whenever the form isn't mid-request, whether or not anything actually
changed.

## Goals

- A persistent Rebuild control, visible on every admin page, reflecting
  accurate "does the public site need rebuilding" state across **all**
  content types that bake into `web/` — not just the four wired today.
- A short list of *which areas* have unrebuilt changes, available from an
  icon next to the Rebuild button.
- Every admin form's Save button reflects whether the form actually has
  unsaved changes (inactive when clean, active when dirty), computed
  automatically rather than hand-flagged per mutator.
- The existing "automatic rebuild after each change" setting is preserved,
  relocated to sit next to the new persistent control.
- Close the gap: every controller that writes content baked into `web/`
  marks the site dirty, not just the four that do today.

## Non-goals

- Per-field change detail in the pending list ("what changed", diffs). The
  list is area-level only, as explicitly requested — a documented future
  extension, not built now.
- Rebuild-completion-aware clearing (waiting for the static build to actually
  finish before clearing "pending"). Pending state clears the moment a
  rebuild is *triggered*, matching the existing fire-and-forget philosophy in
  `SiteRebuild::request()` (failures are already swallowed there).
- A navigation-blocking "you have unsaved changes" confirm dialog on route
  leave. `TechRiderAdminView` already does this locally via
  `onBeforeRouteLeave` + `window.confirm`; extending that pattern app-wide is
  a reasonable follow-up but is not part of what was asked for here (button
  state + pending list), so it's left alone.
- Author-owned and member-owned content that isn't actually exposed on the
  public site today (e.g. author name/bio) does not gain rebuild tracking —
  there is nothing baked to go stale.

## Design

### Backend: dirty-area tracking

**New table `site_dirty_areas`** (migration):

```php
Schema::create('site_dirty_areas', function (Blueprint $table) {
    $table->string('area')->primary();
    $table->timestamp('changed_at');
});
```

One row per area key, upserted (not appended) on every write — a second edit
to the same area just bumps `changed_at`.

**`App\Support\SiteRebuild`** gains:

```php
public static function markDirty(string $area): void
{
    DB::table('site_dirty_areas')->updateOrInsert(
        ['area' => $area],
        ['changed_at' => now()],
    );

    if (SiteSetting::get('auto_rebuild', 'false') === 'true') {
        self::request();
        self::clearPending();
    }
}

public static function clearPending(): void
{
    DB::table('site_dirty_areas')->truncate();
}

public static function pendingAreas(): array
{
    return DB::table('site_dirty_areas')
        ->orderByDesc('changed_at')
        ->get()
        ->map(fn ($row) => ['area' => $row->area, 'changedAt' => $row->changed_at])
        ->all();
}
```

`requestIfAuto()` is removed; every existing call site (`BandProfileController`,
`HeroImageController`, `PostController`, `WebsiteModuleController`) switches to
`markDirty('<area>')`.

**Area keys** (the write side of the registry — see *Area registry* below):
`band-profile`, `band-members`, `hero-images`, `posts`, `website-modules`,
`concerts`, `venues`, `setlists`, `releases`, `photos`, `music-videos`,
`press-releases`, `shop`, `faqs`.

**Controllers gaining a `markDirty()` call** (currently missing it despite
writing baked content): `ConcertController` → `concerts`, `VenueController` →
`venues`, `SetlistController`/`SongController` → `setlists`,
`ReleaseController` → `releases`, `AlbumController`/`PhotoController` →
`photos`, `MusicVideoController` → `music-videos`, `PressReleaseController` →
`press-releases`, `ShopItemController`/`ShopCategoryController` → `shop`,
`FaqController` → `faqs`, `BandMemberController` → `band-members`,
`BandLogoController` → `band-profile`. `SocialLinkController` dispatches by
owner: a `profile_id`-owned link marks `band-profile`, a `venue_id`-owned link
marks `venues`; `member_id`/`author_id`-owned links mark nothing (not baked
publicly, per the Non-goals above).

**Manual rebuild** (`SiteRebuildController::rebuild()`, see below) calls
`SiteRebuild::request()` then `SiteRebuild::clearPending()` — triggering is
treated as handling, same as auto-rebuild.

**Relocation:** `rebuild`, `rebuildStatus`, and `updateSettings` move off
`WebsiteModuleController` (where they were a known misfit — see that class's
existing doc comment) onto a new `SiteRebuildController`. Same route paths,
reassigned handlers.

**Endpoint:** `GET /admin/site/rebuild/status` (existing route, on the new
controller) is extended to return:

```json
{
  "status": "idle",
  "startedAt": null,
  "finishedAt": "...",
  "autoRebuild": false,
  "pendingAreas": [{ "area": "concerts", "changedAt": "..." }]
}
```

No new route. `POST /admin/site/rebuild` and `PUT /admin/site/settings` are
unchanged in shape.

### Area registry

Mirrors the existing locale-registry convention (`api/config/locales.php` /
`web/src/lib/locales.ts` / `app/src/locales.ts`, documented in the root
CLAUDE.md): the backend uses raw area-key strings with no label of its own;
the frontend owns display labels. Adding a 12th area means adding the
`markDirty()` call on the backend **and** a label entry in
`app/src/config/rebuildAreas.ts` — two places, not auto-synced, same failure
mode as an unmapped locale. `REBUILD_AREA_LABELS` falls back to the raw key
when a label is missing, so a forgotten mapping degrades to a slightly ugly
label instead of a blank one.

### Frontend: global rebuild state

**`app/src/composables/useSiteRebuild.ts`** — new module-level singleton
composable (same pattern as `useAuth.ts`: refs declared at file scope, shared
across every importer). Wraps:

- `rebuildStateQuery` — `GET /admin/site/rebuild/status`, polling every 2s
  while `status === 'building'` (same behaviour as today's
  `useWebsiteModules.ts`), otherwise a normal TanStack Query with default
  staleness.
- `rebuild` mutation — `POST /admin/site/rebuild`, invalidates the status
  query.
- `setAutoRebuild` mutation — `PUT /admin/site/settings`, invalidates the
  status query.

Exposes: `pendingAreas`, `autoRebuild`, `isBuilding`, `rebuild()`,
`setAutoRebuild()`.

`useWebsiteModules.ts` drops its local rebuild-status/mutation code and
consumes `useSiteRebuild()` instead — removes the duplication rather than
leaving two implementations of the same polling logic.

### Frontend: per-form dirty tracking

**`app/src/composables/useDirtyGuard.ts`**:

```ts
export function useDirtyGuard<T>(getState: () => T) {
  const baseline = ref(cloneState(getState())) as Ref<T>
  const isDirty = computed(() => !deepEqual(baseline.value, getState()))
  function markClean(): void {
    baseline.value = cloneState(getState())
  }
  return { isDirty, markClean }
}
```

`cloneState`/`deepEqual` are small, dependency-free utilities (no new
package — the admin forms are small enough that a plain structural deep-equal
is cheap). A snapshot is taken on load and reset via `markClean()` after a
successful save, so `isDirty` is derived, never manually flagged — nothing to
forget in a new mutator, unlike the existing hand-rolled pattern.

**Rollout:** every existing draft-then-Save admin form is wired to it in this
same piece of work — `WebsiteModulesView`, `FaqEditor`, `TechRiderAdminView`
(replacing its hand-rolled `dirty` ref), `MemberSetupsPanel`,
`MemberDefaultGear`, and the concert/release/post/shop-item/band-profile
forms. Each form's Save button becomes `:disabled="!isDirty || saving"`.

Instant-action views with no Save step (`HeroImagesAdminView`'s drag
reordering, which already mutates on every action) are out of scope for the
button guard — there's no Save button to disable. They already report into
the backend pending-areas list via their controller's existing writes.

### Frontend: the persistent rebuild bar

**`RebuildBar.vue`** — new component, mounted once in `AdminLayout.vue` as a
topbar strip above `<slot />` in `.main-content`, so it's present on every
admin route regardless of sidebar state. Contains:

- **Rebuild button** — disabled while `isBuilding`, while `autoRebuild` is on,
  or while `pendingAreas` is empty. Click calls `rebuild()`.
- **Pending-changes icon** — a small badge showing `pendingAreas.length`;
  click opens a popover listing each area's label (via
  `REBUILD_AREA_LABELS`) and a relative timestamp, e.g. "Concerts · 3m ago".
  Sorted by most-recently-changed first (matches `pendingAreas()`'s backend
  ordering).
- **Settings gear** — opens `RebuildSettingsModal.vue`, holding the
  "automatic rebuild after each change" toggle (`setAutoRebuild`), relocated
  from `WebsiteModulesView`.

The old rebuild button, auto-rebuild checkbox, and progress-bar block are
**removed** from `WebsiteModulesView.vue` — left in place, it would be a
second, divergent copy of the same control.

## Testing

- **Pest:** one feature test per newly-wired controller, asserting its write
  action upserts the expected `site_dirty_areas` row (and, under
  `auto_rebuild=true`, that a rebuild fires and the table clears). A test
  that manual rebuild (`POST /admin/site/rebuild`) clears pending areas.
- **Vitest:** `useDirtyGuard.spec.ts` covering the snapshot/deep-equal
  behaviour (clean on load, dirty on mutation, clean again after
  `markClean()`), plus a `deepEqual`/`cloneState` unit spec if those are
  non-trivial enough to warrant one directly.
- **Playwright:** new `e2e/tests/admin/rebuild-bar.spec.ts` — edit content in
  one area, assert the pending badge/list reflects it, trigger rebuild,
  assert the list clears. Extend one representative existing form spec (e.g.
  FAQs) to assert Save starts disabled and enables only after an actual edit.
