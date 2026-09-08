# News content blocks — design

**Date:** 2026-09-07
**Branch:** `feature/news-content-blocks`
**Status:** approved, ready for implementation planning

---

## Problem

A news post's body is a single translatable HTML blob (`posts.content`), and
everything else it shows — related concerts and releases, press coverage,
external links — is rendered by `web/src/components/detail/PostDetail.astro` in
a **fixed order the editor cannot change**:

```
content → press pull-quote → Related → In the press → links
```

The band wants to compose a post as an ordered sequence of mixed items: a
paragraph, then a photo, then a Vimeo clip, then a link to a concert, then
another paragraph.

**The shift is that presentation order stops being template logic and becomes
data.** The renderer stops deciding sequence and becomes a dispatcher over a
typed, ordered block list.

---

## Scope

A post keeps `title`, `slug_en`/`slug_pl`, `intro`, `published_at`,
`event_date`, `image` and its tags. Its body becomes an ordered list of blocks
of four types:

| type | what it is |
|---|---|
| `text` | a translatable paragraph |
| `image` | an uploaded picture with translatable alt + caption |
| `embed` | a pasted URL; the provider is detected server-side |
| `ref` | a reference to another record in the CMS |

`ref` targets: `concert`, `album`, `release`, `music_video`, `press_release`,
`shop_item`.

`tour` is deliberately **not** a ref target: tours have no public page of any
kind, so a tour reference could only ever link somewhere it isn't.

`embed` providers: `youtube`, `vimeo`, `instagram`, `tiktok`, and `link` as the
fallback for any other host.

### Out of scope

- Removing the "assign posts" control from the press-release and shop-item
  admin forms. Those keep writing their pivots.
- Removing the legacy unlocalised `/posts/{id}` route. It gets the block
  renderer like any other article route; deleting live URLs is a separate call.
- A rich-text editor. A `text` block is authored as plain multi-line text in a
  textarea, exactly as `content` is today.

**A `text` block holds HTML and is rendered with `set:html`**, matching today's
`art-prose`. This is not a new decision — `posts.content` is already rendered
that way, and backfilled content would otherwise appear as escaped tag soup.
The authoring field stays a plain textarea; an editor who pastes markup gets
markup, as now. Content is admin-authored behind `auth:api`, so the trust
boundary is unchanged.

---

## Decisions

Each of these was chosen deliberately; the rejected alternative is recorded so
a later reader does not re-litigate it.

### Blocks fully replace `content`

`posts.content` is backfilled into a `text` block and the column is dropped.
Rejected: keeping both, which leaves two places to write body text and no rule
for which wins.

### Blocks replace four post-owned pivots

`post_concerts`, `post_albums`, `post_releases` and `post_music_videos` are
written **only** by `PostController`. They are dropped and become `ref` blocks.

**`post_tours` is left in the database, untouched and unread.** With `tour`
dropped as a ref target there is nowhere to backfill it to, and dropping the
table would destroy the only record of every post↔tour association. Those rows
are not rendered anywhere today — `web/src/types/post.ts` does not even declare
`tours` on the `Post` interface — so nothing visible is lost either way, but one
direction is reversible and the other is not. The post editor stops writing it;
removing the table is a separate, explicit decision.

`press_release_posts`, `shop_item_post` and `photo_post` are **not** dropped —
they have reverse-side writers that this change does not touch:

- `PressReleaseController.php:118` — `$pr->posts()->sync(...)`
- `ShopItemController.php:228` — `$item->posts()->sync(...)`
- `PhotoSummaryResource.php:28` reads a photo's posts

`post_tag` also stays; tags remain their own field in the editor.

### The article page renders blocks only

Existing `press_release_posts` rows are backfilled into `ref` blocks, and from
then on the article page reads **only** blocks. The PR form keeps writing the
pivot for `PressReleaseResource`'s own use, but that no longer affects what a
post renders. One source of truth for rendering.

### One `embed` type with server-side provider detection

The editor pastes a URL; `App\Support\EmbedProvider` maps host to provider.
Adding Bandcamp or Spotify later is one regex plus one renderer arm — no
migration, no admin change, no new validation rule.

Rejected: a separate block type per provider, which puts the provider list in
four places (enum, validation, admin picker, renderer).

### Images are files, not base64

A picture block uploads to `Storage::disk('public')` under `post-blocks/` and
stores a path — the pattern `Photo`, concert posters and release covers already
use.

Rejected: base64 in the payload, as `posts.image` does today. At n images per
post it produces multi-megabyte rows that are uncacheable and that the Astro
build re-downloads in full on every rebuild.

### A child table with a JSON payload

`post_blocks` follows the repo's existing ordered-child-table idiom
(`setlist_items.position`, `post_links.sort_order`, `release_tracks`), and the
JSON `payload` follows the `website_modules.settings` precedent — a generic
`{field: {en, pl}}` bag chosen over named columns so a new block type costs no
migration.

Rejected: a real `morphTo` for `ref` blocks. The repo has zero `morphTo`
anywhere, and it would not buy the integrity it appears to — Laravel morphs have
no DB-level cascade, so a deleted entity still leaves a dangling block the
renderer must skip in code. Same defensive work, new pattern.

Rejected: a single `blocks` JSON column on `posts`. Reordering rewrites the
whole blob, blocks cannot be queried, and orphaned-image cleanup would mean
diffing old JSON against new on every save.

---

## Data model

```
post_blocks
  id           bigint PK
  post_id      FK to posts, cascadeOnDelete
  position     unsignedSmallInteger
  type         string      -- text | image | embed | ref
  payload      json
  created_at, updated_at
  index (post_id, position)
```

`type` is validated against a const list in `App\Support\PostBlockType`.

### Payload shapes

```jsonc
// text
{ "body": { "en": "…", "pl": "…" } }

// image
{ "path": "post-blocks/ab12cd.webp",
  "alt":     { "en": "…", "pl": "…" },
  "caption": { "en": "…", "pl": "…" } }

// embed
{ "provider": "vimeo", "url": "https://vimeo.com/76979871", "label": null }
// `label` is the visible text for a `link`-provider row. Optional, and ignored
// by the four iframe providers. It exists so the backfill does not discard
// `post_links.label`, which editors have already written.

// ref
{ "entity": "concert", "id": 12 }
```

`provider` is stored, not recomputed on read, so a later change to the
detection rules cannot silently re-point existing content.

---

## Migration

Two files, shipped together. The split exists so the drop is revertible
independently of the backfill.

**1. Create and backfill.** Creates `post_blocks`, then calls
`PostBlockBackfill::run()` (see *Support classes*), which for each post emits
blocks in the order that reproduces today's rendered page exactly:

```
0      text   ← posts.content            (all translations preserved)
1..a   ref    ← press_release_posts
a..b   ref    ← post_releases, post_music_videos, post_concerts,
                post_albums          (post_tours is NOT backfilled)
b..n   embed  ← post_links               (sort_order preserved, label kept)
```

**The backfill derives the provider by running each URL through
`EmbedProvider::detect()`, not by mapping the old `type` column.** The old
column carries `facebook`, which is not a provider in the new taxonomy, and
mapping it straight across would write a value nothing renders. Detection also
repairs rows whose `type` was set wrong by hand. A facebook.com URL resolves to
`link` and renders as a link row — the destination is unchanged, only the
presentation.

**2. Drop.** `posts.content`, `post_concerts`, `post_albums`, `post_releases`,
`post_music_videos`, `post_links`. **Not** `post_tours` — see above.

### Knock-on: `excerpt`

`PostSummaryResource.excerpt` is `Str::limit($content, 280)`. With `content`
gone it re-derives from the **first `text` block**, falling back to `intro`. It
feeds `<meta description>` and the JSON-LD `description` on both article routes,
so it cannot simply be dropped.

**This makes the index endpoint touch `post_blocks`, which needs care.**
`PostController::index` currently selects a fixed column list and loads only
`tags`. It must now also reach the first text block per post — and
`PostDetail.astro` walks **every page** of that endpoint on **every article
page** to build its prev/next navigation, so an N+1 there multiplies across the
whole build.

The index eager-loads exactly one constrained relation:

```php
->with(['blocks' => fn ($q) => $q->where('type', 'text')
                                 ->orderBy('position')
                                 ->limit(1)])
```

`PostSummaryResource` reads that for `excerpt` and **does not serialise the
blocks themselves** — the listing has no use for them, and shipping full block
payloads would bloat a response the Astro build already fetches page by page.
Blocks are serialised only by `PostResource` (the `show` endpoint).

A Pest test asserts the index issues a constant number of queries regardless of
how many posts exist; that is the assertion that would catch the N+1
reappearing.

---

## API

### Validation moves to Form Requests

`PostController` duplicates a ~30-line `validate()` array between `store` and
`update`; blocks would take it past 50. Extract `StorePostRequest` and
`UpdatePostRequest`. Precedent: `TechRiderRequest`, `BandMemberSetupRequest`.

```php
'blocks'           => 'nullable|array',
'blocks.*.type'    => 'required|in:text,image,embed,ref',
'blocks.*.payload' => 'required|array',
// per-type rules resolved in withValidator(), keyed off each row's type
```

### Support classes

**`App\Support\EmbedProvider`** — pure, unit-testable.

- `detect(string $url): string` — host to provider, unknown to `link`
- `embedId(string $url): ?string` — extracts the video/post id; `null` for the
  `link` provider, and `null` for any URL whose id cannot be parsed. A provider
  with a `null` id falls back to rendering as a link row rather than emitting an
  iframe with a broken `src`.

Extraction lives server-side so the admin preview and the public renderer cannot
disagree about a video id.

**`App\Support\PostBlockResolver`** — the batching resolver. Collects every
`ref` block across the posts being serialised, groups by entity type, runs **one
query per type**, and hydrates. A ref whose entity no longer exists resolves to
`null` — never an exception, never an N+1.

**`App\Support\PostBlockBackfill`** — the migration's body, extracted so it can
be tested. `up()` calls `PostBlockBackfill::run()` and nothing else.

The extraction is not stylistic. The test stage runs **SQLite in-memory with
every migration applied during setup** (`api/Dockerfile`, `--target test`), so a
test that ran after migration would find `posts.content` and the five pivots
already dropped — there would be nothing left to assert against. Testing the
class directly lets the test build the *old* shape by hand, run the backfill,
and assert on the blocks it produces.

### Writes

Blocks are delete-and-recreate, matching `post_links` — but `position` is set
**explicitly from the array index**, never left to auto-increment id order.
CLAUDE.md records this trap under the social-links section: ordering that
"used to work by accident" scrambles the moment anything stops recreating from
scratch.

The post-plus-blocks write is wrapped in `DB::transaction`, per the
`AuthorController` precedent, so a failure mid-block-loop cannot leave a
half-saved post.

### `SiteRebuild` — a pre-existing gap this change closes

`grep -c SiteRebuild api/app/Http/Controllers/PostController.php` returns **0**.
CLAUDE.md requires that anything the public site bakes calls
`SiteRebuild::requestIfAuto()`, and posts are baked. With auto-rebuild on, the
admin hides its manual rebuild button, so a post save currently has no way to
reach the public site at all.

`store`, `update` and `destroy` all gain the call. This is the same bug the
hero-images section of CLAUDE.md was written about.

### New endpoint

```
POST /api/posts/blocks/image   (auth:api)   multipart: image (required|image|max:4096)
  → 201 { "path": "post-blocks/ab12cd.webp",
          "url":  "/storage/post-blocks/ab12cd.webp" }
```

Standalone rather than per-post, because a picture block can be added to a post
that does not exist yet. `ConcertController::uploadPoster` cannot be copied
directly for that reason.

**Orphan cleanup.** On update, the controller diffs the outgoing blocks' image
paths against the incoming ones and deletes files that are no longer
referenced. `Post::deleting` removes the rest.

### Resource shape

`PostBlockResource`, one entry per block, already ordered by `position`:

```jsonc
{ "id": 7,  "type": "text",  "position": 0,
  "body": "…", "translations": { "body": { "en": "…", "pl": "…" } } }

{ "id": 8,  "type": "image", "position": 1,
  "url": "/storage/post-blocks/ab12cd.webp", "alt": "…", "caption": "…" }

{ "id": 9,  "type": "embed", "position": 2,
  "provider": "vimeo", "url": "https://vimeo.com/76979871",
  "embed_id": "76979871" }

{ "id": 10, "type": "ref",   "position": 3,
  "entity": "concert",
  "data": { "id": 12, "title": "…", "slug_en": "…", "date": "…" } }

{ "id": 11, "type": "ref",   "position": 4,
  "entity": "release", "data": null }        // entity was deleted
```

**A dangling ref emits `data: null` rather than being omitted.** The public
renderer skips it; the admin shows a "missing item — remove?" row. Omitting it
silently would leave the editor unable to see why a block disappeared.

**`data` carries identity fields, not a URL.** Section slugs are per-locale and
live in the site config, so only the rendering route can build an href —
`RefBlock.astro` resolves it through `getSlugMap()`, exactly as
`PostDetail.astro` already does for `releasesSection` and `concertsSection`.
CLAUDE.md: never derive one locale's URL from another.

What each entity contributes, and how `RefBlock.astro` turns it into a link:

| entity | `data` fields | href | module gate |
|---|---|---|---|
| `concert` | `id`, `slug_en`, `date`, `venue: {id, name}` | `/{lang}/{concerts}/{slug_en}` | `concerts` |
| `release` | `id`, `title`, `type` | `/{lang}/{releases}/{id}` | `releases` |
| `shop_item` | `id`, `title`, `slug_en` | `/{lang}/{merch}/{slug_en}` | `merch` |
| `album` | `id`, `title` | `/{lang}/{photos}` — **listing, not a detail page** | `photos` |
| `music_video` | `id`, `title`, `video_url` | external `video_url` | — |
| `press_release` | `id`, `title`, `url`, `site` | external `url` | — |

The `title`/`site` fallbacks that `PostResource` already applies are preserved —
`og_title ?? url` for press and music videos, and `og_site_name` falling back to
the URL host. CLAUDE.md is explicit about why the latter matters: *"a quote with
no source reads as the band quoting itself"*, and `article-press.spec.ts`
asserts it.

**Only four sections have detail routes.** `web/src/pages/[lang]/[section]/[slug].astro`
builds paths for `concerts`, `releases`, `posts` and `merch` and nothing else
(`DETAIL_SECTIONS` in `[section].astro`). So an `album` ref links to the
**photos listing**, not to a per-album page — there is no such page. Note also
that the shop's section key is `merch`, not `shop`; `/{lang}/{shop}/…` is never
built.

---

## Admin editor

`PostForm.vue` is 241 lines today and blocks would roughly double it, so it
decomposes:

```
components/admin/forms/
  PostForm.vue                 orchestrator — title, slug, intro, image,
                               dates, tags, then <PostBlockEditor>
  PostBlockEditor.vue          ordered list: add, remove, drag-reorder
  blocks/TextBlockEditor.vue   EN/PL textareas, existing .trans-group markup
  blocks/ImageBlockEditor.vue  upload to path; alt + caption per locale
  blocks/EmbedBlockEditor.vue  one URL field; detected provider as a badge
  blocks/RefBlockEditor.vue    entity-type select + searchable item select
utils/postBlocks.ts            pure: defaultPayload(type), move(list, from, to),
                               providerLabel()
```

Drag-and-drop follows `SocialLinksEditor.vue` — native HTML5 drag events, no
library.

`EntityRelationsPanel` is removed from `PostForm` but stays in the codebase;
`ConcertForm` and others still use it.

`RefBlockEditor` needs a `shopItems` prop added alongside the entity lists
`PostForm` already receives.

### Two constraints from CLAUDE.md

**Pure logic goes in `src/utils/`, not a composable.** The admin's vitest
environment is `node`, and `useAuth` reads `localStorage` at module load — so
importing any composable that pulls it in dies with
`localStorage.getItem is not a function`.

**The test file is `postBlocks.spec.ts`, not `.test.ts`.** `app/vitest.config.ts`
sets `include: ['src/**/*.spec.ts']`, so a `.test.ts` file under `app/src` is
silently ignored and the suite goes green having collected nothing. (`web/` is
the opposite: `.test.ts`.)

---

## Public rendering

```
web/src/components/blocks/
  PostBlocks.astro   dispatcher over the ordered array
  TextBlock.astro    reuses .art-prose, keeping the first-paragraph drop cap
  ImageBlock.astro   figure + figcaption, loading="lazy"
  EmbedBlock.astro   provider to iframe
  RefBlock.astro     entity to existing .art-rel-link / .art-press markup
```

`PostDetail.astro` keeps its hero, share button, back link, prev/next and "more
from the blog". The `art-prose`, Related, In-the-press and links sections are
replaced by a single `<PostBlocks>` call. The legacy
`web/src/pages/posts/[id].astro` gets the same treatment.

`web/src/types/post.ts` gains a `PostBlock` discriminated union on `type`.

### Four rules the dispatcher owns structurally

Placed in the dispatcher, not in each block component, so no per-type component
can forget them:

1. **An internal ref whose module is disabled renders as plain text, not a
   link.** Switching a module off in `/admin/website-modules` **unbuilds its
   routes**, so a `ref` to a concert with the concerts module off is a link to a
   page that no longer exists. CLAUDE.md documents this exact failure on the
   homepage, where hero CTAs were ungated and the content sections gated on
   `data.length > 0` — a *content* check standing in for a *routing* check.

   The gate is `siteConfig.modules[section] !== false`, never `=== true`:
   `getSiteConfig` fails open to `{}` when the API is unreachable mid-build, so
   an absent key must mean *enabled*, or one build-time blip ships an article
   with every reference stripped. The `music_video` and `press_release` targets
   are exempt — they link externally and no module can unbuild them.

2. **`data === null` skips the block.** This is the all-or-nothing-build hazard.
   CLAUDE.md: *"One page that throws aborts all 35 — a single unreachable record
   takes down the entire site."* It documents two prior outages of this exact
   shape, one of which ran undetected for two months at `RestartCount 103`.
   Skipping must be the structural default, not a `try/catch` someone remembers.
3. **Unknown `type` skips, does not throw.** Stored content can predate a
   renderer.
4. **Press refs keep the existing contract.** The first `press_release` ref
   renders as `.art-pull` (the pull quote); the rest render as `.art-press`
   rows. This is why `article-press.spec.ts` needs only its *seeding* changed,
   not its assertions.

### Embeds are iframes, with no third-party JavaScript

| provider | embed |
|---|---|
| `youtube` | `youtube-nocookie.com/embed/{id}` |
| `vimeo` | `player.vimeo.com/video/{id}` |
| `instagram` | `instagram.com/p/{id}/embed` |
| `tiktok` | `tiktok.com/embed/v2/{id}` |
| `link` | existing `.art-ext-link` row, no iframe |

Instagram and TikTok also publish blockquote-plus-async-script embeds. Those are
rejected: the public specs run `failOnPageError()`, and a third-party script
that throws would fail unrelated specs.

### Theming

`scripts/check-tokens.mjs` walks `web/src`, so every new component uses semantic
tokens only — no raw colours, fonts or radii. Existing `.art-*` classes are
reused rather than a parallel set being invented.

---

## Testing

Per CLAUDE.md's "cover both halves" rule: hero images shipped with five admin
specs and none for the public result, so a regression that stopped every page
rendering a picture would have passed the whole suite.

| Layer | File | Covers |
|---|---|---|
| Pest | `PostBlockTest.php` | CRUD with blocks; order preserved; position from array index, not id; per-type validation; transaction rollback; dangling ref to `data: null`; `SiteRebuild` fired |
| Pest | `EmbedProviderTest.php` | host to provider for all five arms; id extraction; unknown host to `link` |
| Pest | `PostBlockUploadTest.php` | upload endpoint; auth required; orphan cleanup on update and on post delete |
| Pest | `PostBlockBackfillTest.php` | backfill preserves content translations, link order, link labels and pivot order; provider re-detected from URL; runs against a hand-built old shape, not the migrated schema |
| Pest | `PostIndexTest.php` | index issues a constant query count regardless of post count; summary omits block payloads |
| Vitest (`app/`) | `utils/postBlocks.spec.ts` | move/reorder; default payload per type |
| Playwright admin | `posts.spec.ts` (extended) | add each of the four types; reorder; save; reload; assert stored order |
| Playwright public | `post-blocks.spec.ts` **(new)** | blocks render in stored order; dangling ref absent; each provider's iframe present |
| Vitest (`web/`) | `lib/refHref.test.ts` | href per entity; `merch` not `shop`; album resolves to the listing; module gate uses `!== false` so an absent key still links |
| `dist/` assertion | manual, in the plan | every internal href a post block emits resolves to a built page — the `for h in $(grep -o 'href=…')` loop CLAUDE.md prescribes, run against an article with one ref of each kind |
| Playwright public | `article-press.spec.ts` | reseeded to create a press ref block; assertions unchanged |

**The public spec asserts order, not just presence.** `expect(blocks.nth(2))` is
what catches a dispatcher that renders every block correctly but sorts by id.

### E2E fixtures must restore what they write

`post-blocks.spec.ts` writes real posts to the dev database, and the public site
bakes whatever is there when its container starts. Per CLAUDE.md, the spec
captures original state in `beforeAll` and restores it in `afterAll`, and the
capture **throws** rather than returning empty on failure — a failed capture
becoming a destructive restore is the documented `hero-images.spec.ts` bug.

Note also that an API context built from `storageState` replays **cookies only**,
and `e2e/.auth/admin.json` holds none. Admin API calls in a spec must read
`auth_token` out of the storage-state file and send it as an explicit
`Authorization: Bearer` header.

---

## Verification

Beyond the suites above, three checks the suites structurally cannot make:

1. **The Astro build survives a dangling ref.** Delete a referenced concert,
   rebuild `web`, and confirm all pages still build — the failure mode is a
   crash-loop, not a red test.
2. **`docker compose build web && docker compose up -d web`**, not `restart`.
   `web` has no bind mount; a restart rebuilds the *baked* source, which means
   verifying stale code. Confirm the asset hash changed.
3. **Migration runs against a copy of the dev database**, whose posts carry real
   content, links and pivot rows that no seeder reproduces.
