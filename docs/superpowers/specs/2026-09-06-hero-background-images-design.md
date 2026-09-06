# Hero background images

**Date:** 2026-09-06
**Status:** approved

## Problem

The public site has no hero background image, and no way to upload one.

The old SPA homepage (`app/src/views/HomeView.vue`, deleted in #65) had what
looked like one — but it was never a dedicated image. It reused the band **logo**
as a full-bleed backdrop:

```vue
<img v-if="profile?.logo_url" :src="profile.logo_url" class="hero-bg" />
```
```css
.hero-bg { position: absolute; inset: 0; object-fit: cover;
           filter: grayscale(1) contrast(1.25) brightness(.6); }
```

When the public site moved to Astro, `web/src/pages/[lang]/index.astro` kept
`profile.logo_url` but rendered it as a 56px foreground mark (`.hero-logo`). So
the backdrop was not lost in a migration — the underlying field never existed.
`band_profiles` carries no image column beyond logos, tech rider and stage plot.

Adding one is therefore a new feature, not a restored one.

## Goals

- A **main** set of hero pictures used across the site by default.
- A **per-page override**: the homepage and any page module may carry its own
  set, which *replaces* the main set for that page rather than adding to it.
- When a set holds more than one picture, **one is chosen at random per visit**.
- Pictures are chosen from photos already in the gallery. No second uploader.

## Non-goals

- **Detail pages.** An individual concert, release or post inherits the main
  set; it gets no picker of its own. Adding one later is additive.
- **Cross-fading or slideshow motion.** One picture per page load, held still.
- **Crop or focal-point control.** A portrait photo will crop badly in a wide
  hero; the answer for now is to choose landscape shots. A focal-point picker is
  a clean follow-up if it bites.
- **A new media library.** Heroes are gallery photos, tagged.

## Design

### Data model

New table, `hero_images`:

```php
$table->id();
$table->foreignId('photo_id')->constrained()->cascadeOnDelete();
$table->string('scope');
$table->unsignedSmallInteger('position')->default(0);
$table->timestamps();
$table->index(['scope', 'position']);
```

**`scope` is a non-null string**, one of `main`, `home`, or a live
`website_modules.slug`. The homepage is not a `website_modules` row (live slugs
are `posts, releases, concerts, photos, press, videos, merch, epk, tech-rider,
newsletter, contact, about, footer`), so two reserved names are needed
regardless — and given that, `NULL`-means-main reads worse than it writes.

Validation follows the `faqs.module_slug` precedent: checked against **live**
`website_modules` rows, so a new module becomes a hero scope with no code
change. A **disabled** module stays a valid target — switching a section off
must not make its pictures unsavable, exactly as with its FAQ entries.

**No unique index.** Writes are sync-style: delete every row for the scope, then
recreate from the payload in array order — the shape `syncRelations()` already
uses for social links.

**`position` is written explicitly** from the payload index, and every read is
`orderBy('position')`. CLAUDE.md records the precise bug this avoids: social
links worked by accident because delete-and-recreate made auto-increment `id`
agree with drag order, and anything that stopped recreating from scratch
scrambled it silently.

`cascadeOnDelete` means deleting a gallery photo removes it from every hero set,
rather than leaving a scope pointing at a file that is gone.

### API

**Admin (Passport-guarded):**

| Route | Behaviour |
|---|---|
| `GET /api/hero-images` | every scope at once, for the editor |
| `PUT /api/hero-images/{scope}` | `{photo_ids: [...]}` replaces that one scope, in order |

The `PUT` is wrapped in `DB::transaction` so a failure part-way through cannot
leave a scope holding half a set.

**Public:** `GET /api/site-config` grows **one new top-level key**, an object
mapping every populated scope to its list:

```json
"hero_images": {
  "main":    [{"id": 4, "url": "/storage/photos/x.jpg", "caption": null}],
  "home":    [...],
  "contact": [...]
}
```

Each list is **always an array, never null**, on the reasoning
`resolveSettings()` already documents: the Astro build bakes whatever it gets,
and a null there throws at build time, which takes down all 35 pages rather than
one. The public site still reads `?? []`, so an API predating this migration
keeps building.

**These do not go inside `module_config`**, which would be the obvious place.
`web/src/lib/slugs.ts` builds the site's slug map by iterating
`Object.keys(module_config)`, so a synthetic `home` key there would inject a
phantom `home` module into `slugMap` for every locale. No route would be emitted
— `[lang]/[section].astro` filters against an explicit section list — so
`astro build` would stay green and nothing would visibly break; it would just
quietly seed a module that does not exist into the map that decides where the
nav points. A separate top-level key keeps the scope namespace (which includes
two non-module names) out of a structure that is defined as one-entry-per-module.

### Admin UI

New view at `/admin/hero-images`, reached through `adminUrl('hero-images')` —
never a literal path, since `ADMIN_PATH` moves the whole panel. It joins the
`pageconfig` nav group in `AdminLayout.vue` alongside `website-modules` and
`faqs`, which is where page-shaping config already lives.

Layout:

- **Left — scopes.** `Main` first, then `Homepage`, then one row per page
  module. Each row shows a thumbnail count, or *"inherits Main"* when empty.
- **Right — the selected scope's set.** Drag to reorder, click to remove, and
  **Add from gallery** opening a picker over existing album photos.

Saving surfaces the same rebuild affordance `/admin/website-modules` already
has (`WebsiteModuleController::rebuild()` / `rebuildStatus()` exist). The public
site is static — without a rebuild you change the hero and see nothing, which
would read as the feature being broken.

### Public rendering

**`web/src/lib/heroImages.ts`** — `resolveHeroImages(cfg, scope)` returns the
scope's own set when non-empty, else the main set, else `[]`. It lives in
`web/src/lib` and is unit-tested, per the rule that anything there with a
fallback belongs in `web/src/lib/*.test.ts`: `astro build` is green whichever
list it resolves, so no other stage can see a wrong answer.

**`web/src/components/HeroBackdrop.astro`** — renders **nothing** for an empty
list, so the current look is unchanged until pictures are actually added.
Otherwise it emits the candidate URLs in a `data-` attribute plus an inline
**synchronous** script that picks one and sets `background-image` before first
paint. That gives no flash of the wrong image and exactly one image fetched.

Known trade-off: a JS-set background cannot be preloaded, so LCP lands slightly
later than a hardcoded `<img>` would. Accepted — the picture sits behind a dark
overlay and is decoration, not content.

The darkening treatment is rebuilt from the old SPA's (grayscale, raised
contrast, ~56% ink) but expressed through `var(--color-inverse)` and
`color-mix`. A raw `#121212` would fail `scripts/check-tokens.mjs`, and
correctly so: the backdrop must theme with the rest of the site.

### Consolidating the page headers

`PageHero.astro` exists and its docstring says it was extracted "before a fifth
appeared" — but **only four of the eleven page sections use it** (Epk,
Newsletter, Press, Videos). About, Concerts, Contact, Merch, Photos, Posts and
Releases still carry their own header markup (`ab-hero`, `ct-hero`, `gl-hero`,
`mu-hero`, bare `.kicker` / `.page-title` / `.lead`), all reading the same
`s.title` / `s.lead` settings and differing only in class names. The duplication
the component was meant to stop has already happened seven times.

(`FaqSection` is the twelfth file in that directory but is **not** a page — it
renders an embedded `<h2>` accordion inside the others, and is left alone.)

The backdrop has to go into every page header, so those seven migrate onto
`PageHero` as part of this work. Each keeps its own `titleSize` / `leadWidth`,
and page-specific extras move into the existing `meta` / `aside` slots —
`ReleasesSection`'s social-links column is exactly the `aside` case the slot was
built for. `PageHero` and the homepage hero then each get one `<HeroBackdrop>`.

This is the riskiest part of the diff — it touches pages unrelated to hero
images, and a spacing regression would fail no test. Each page is verified
against `dist/` individually. The site is not yet live, which is what makes
doing it now cheaper than doing it later.

## Testing

**Pest (`api/tests`):**

- `PUT` replaces a scope rather than appending.
- Ordering follows `position`, with `id` deliberately inverted against it — the
  trick `AuthorTest` already uses to pin exactly this class of bug.
- Deleting a photo cascades out of every scope.
- Scope validation accepts a **disabled** module and rejects an unknown string.
- `site-config` emits the main set and a module override.

**Vitest (`web/src/lib/heroImages.test.ts`):** override wins; an empty override
falls back to main; keys absent (an older API) resolve to `[]`.

**Vitest (`web/src/lib/slugs.test.ts`):** the existing slug map is unchanged by
the new payload — a regression guard for the `module_config` hazard described
above, so a future refactor cannot quietly reintroduce it.

**Vitest (`app/`):** the admin composable's scope selection and save.

**Playwright:** pick a photo for a scope, save, reload, confirm it persists —
and **restore the dev database in `afterAll`**, per the rule for specs that
mutate shared dev content. Note that restoring the row is not enough on its own;
the public container still holds the stale build.

## Consequences

- Adding a website module automatically gains a hero scope. Nothing to wire.
- Deleting a gallery photo silently shrinks any hero set it belonged to. If that
  empties a scope, the page falls back to the main set rather than breaking.
- Changing hero pictures requires a public-site rebuild to become visible, in
  common with every other content change.
- One new place a locale-independent asset is served from `site-config`, which
  is otherwise locale-resolved. Hero images are deliberately not translatable.
