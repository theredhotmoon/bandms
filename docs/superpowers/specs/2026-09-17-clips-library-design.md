# Clips library: live, studio and backstage video attached to what it documents

**Date:** 2026-09-17
**Status:** approved design, not built

## Problem

The band has video of almost every gig — a fan's phone on YouTube, an
Instagram reel, a TikTok, a Facebook live — and nowhere in the system to keep
it. Today a clip can only appear on the site as an `embed` block inside one
news post. It has no relation to the concert it was filmed at, so the
concert page never lists it, a second post about the same show needs the URL
pasted again, and "all the videos from that gig" is a question the data
cannot answer.

The same is true of studio sessions, backstage footage and interviews: they
exist as embeds scattered through posts, belonging to nothing.

`music_videos` is not the answer. It is the band-profile-owned list of
*official* videos — YouTube-only, with view-count sync and channel metadata —
and it feeds the public Videos page. Live and backstage footage would pollute
that list and still could not be attached to a concert.

## Goals

- A **library of clips**, each a pasted URL from YouTube, Vimeo, Instagram,
  TikTok or Facebook (anything else becomes a labelled link), with a bilingual
  title, a category and an optional recording date.
- A clip is **attached to the things it documents** — a concert, a release, a
  shop item, an album — and each of those public pages lists its clips.
- A news post can **embed any clip from the library**, or **create one on
  the spot** and attach it to a concert without leaving the post editor.
  Either way the clip is one row, shown on the concert page as well.
- Categories are the five presets — live, studio, backstage, interview,
  other — **plus anything the band types**.
- A clip can be marked for the **EPK**, and lands in the next published
  snapshot.
- Facebook joins the embed providers, for embeds in posts as well as clips.

## Non-goals

- Thumbnails, durations or view counts. Instagram, TikTok and Facebook give
  none without an oEmbed round-trip; the clip renders as the provider's
  iframe, exactly like an `embed` block does today.
- Any change to `music_videos` or the Videos page. A future "Clips" tab
  there is a filter on this table, not a migration.
- Migrating existing `embed` blocks into clips. An embed with no owner is
  still a legitimate thing to put in a post.
- A category table with CRUD. Five words and a free-text field.
- Attaching clips to tours, band members, venues or posts as owners. Tours
  and members have no public page to show them; posts *consume* clips
  through blocks (see *Decisions*).

## Decisions taken during design

| Question | Decision |
|---|---|
| Concert-only, or a library? | **Library.** Studio and charity footage need a home too, and the table costs the same either way. |
| How does a clip know what it belongs to? | **Polymorphic many-to-many** (`clippables`). One clip, several owners; adding an owner type is a trait, not a migration. Not four nullable FKs — see the `social_links` footgun in `CLAUDE.md`. |
| Is a post an owner? | **No.** A post decides *where in the article* a clip sits; that is what blocks are for. Posts reference clips with a `ref` block, `entity: clip`. Giving `Post` a `clips()` relation too would be two ways to say one thing. |
| Do a post's plain `embed` blocks count as clips of the concert the post is linked to? | **No.** Only explicitly attached clips appear on an owner's page. What is on the concert page is an intentional act, not a side effect of linking a post. |
| Category storage? | **Free string** with five presets offered as chips. Presets get bilingual public labels from the copy registry; a custom category prints as typed. |
| Which owners does the admin offer? | Only ones with a public surface: **concert, release, shop item**. `Album` gets the trait so the model is ready, but the UI does not offer it until albums have a page — the "tour" rule from `PostBlockType`. |
| Stable ids? | **Required.** Posts reference clips by id, so no write path may delete-and-recreate. Attachments are synced; clip rows are upserted. |
| "Other" providers? | The existing detector's set plus **Facebook**. Anything else falls back to a labelled link row, as embeds already do. |
| Where does the concert editor's "add a video" live? | A small reusable `AttachedClipsField` on the concert, release and shop-item forms: list, quick-add, detach. The clip's own form owns the full attachment picker. |
| Ship as? | **Two PRs, one spec.** PR 1: library + Facebook + admin screen + concert surface + news. PR 2: release, merch and EPK surfaces. Nothing in PR 1 is redone in PR 2. |

## Design

### 1. Data

```
clips
  id
  provider      string    -- stamped by EmbedProvider::detect() on every write, stored
  url           string(2048)
  title         json      -- {en, pl}, Spatie translatable; nullable per locale
  category      string(64)  -- 'live' | 'studio' | 'backstage' | 'interview' | 'other' | anything
  recorded_on   date, nullable
  show_in_epk   bool, default false
  timestamps

clippables
  clip_id         FK clips cascade
  clippable_type  string   -- morph alias: concert | release | shop_item | album
  clippable_id    unsignedBigInteger
  position        unsignedSmallInteger default 0
  unique (clip_id, clippable_type, clippable_id)
  index  (clippable_type, clippable_id, position)
```

`Clip` uses `HasTranslations` (`title`). `Relation::enforceMorphMap()` with
short aliases — a renamed class must not orphan pivot rows.

`App\Models\Concerns\HasClips`:

```php
public function clips(): MorphToMany
{
    return $this->morphToMany(Clip::class, 'clippable')
        ->withPivot('position')->orderByPivot('position');
}
```

Applied to `Concert`, `Release`, `ShopItem`, `Album`. `Clip` carries the
inverse `concerts()`, `releases()`, `shopItems()`, `albums()` via
`morphedByMany`, plus an `owners()` helper that returns
`[{type, id, label, slug_en?, date?}]` for the resource.

Category presets live in one place, `App\Support\ClipCategory::PRESETS`,
mirrored by `app/src/utils/clipCategories.ts` — the admin's chip list and
the public label lookup both read from their side of it.

### 2. `EmbedProvider` gains Facebook

`HOSTS` gains `'facebook.com' => 'facebook'` and `'fb.watch' => 'facebook'`;
`PROVIDERS` gains `'facebook'`. Facebook's player is
`https://www.facebook.com/plugins/video.php?href=<encoded video URL>` — it
takes the whole URL, not an id — so `embedId()`'s Facebook arm returns the
URL itself when it matches `facebook.com/<page>/videos/<digits>`,
`facebook.com/watch/?v=<digits>`, `facebook.com/reel/<digits>` or
`fb.watch/<slug>`, and `null` otherwise (a page URL is on facebook.com but
names no video, exactly the Vimeo-channel case). `EmbedBlock.astro`'s `SRC`
map adds the matching arm, URL-encoding the value.

`app/src/utils/postBlocks.ts` (`detectProvider`, `providerLabel`) mirrors
the host list, as it already does for the other four.

### 3. API

Public (anonymous):

| Route | Returns |
|---|---|
| `GET /api/clips` | all clips, `ClipResource`, newest `recorded_on` first — for the news editor's picker and any future public list |
| `GET /api/concerts/{id}`, `/releases/{id}`, `/shop/by-slug/{slug}`, `/shop/{id}` | existing responses gain `clips: ClipResource[]` (`whenLoaded`) |

Protected (`auth:api`):

| Route | Does |
|---|---|
| `POST /api/clips` | create: `{url, title{en,pl}?, category, recorded_on?, show_in_epk?, attach?: [{type, id}]}` |
| `PUT /api/clips/{clip}` | update the same fields; `attach` when present is **synced** (`sync()` on each owner relation, positions from array index) |
| `DELETE /api/clips/{clip}` | delete; pivot cascades; any post block pointing at it now resolves to `null` |
| `POST /api/clips/{clip}/attach` `{type, id}` / `DELETE …/attach` | the `AttachedClipsField` quick paths, so an owner form can attach or detach without knowing the clip's other owners |

`ClipRequest` stamps `provider` in `prepareForValidation()` like `PostRules`
does for embeds, validates `url` as `url|max:2048`, `category` as
`string|max:64`, `attach.*.type` against the morph map and `attach.*.id`
as `exists` on the mapped table.

`ClipResource`:

```json
{ "id": 7, "provider": "youtube", "url": "…", "embed_id": "dQw4w9WgXcQ",
  "title": "Live at Klub X", "category": "live", "recorded_on": "2026-03-12",
  "show_in_epk": false,
  "translations": { "title": { "en": "…", "pl": null } },
  "owners": [ { "type": "concert", "id": 12, "label": "Klub X — 2026-03-12", "slug_en": "…", "date": "2026-03-12" } ] }
```

`title` is resolved for the request locale through `Locales::chain()`, as
`PostBlockResource::translated()` does.

Every write calls `SiteRebuild::markDirty()` for **each owner's area**
(`concerts`, `releases`, `shop`) plus `posts` (a post may embed the clip)
and `band-profile` when `show_in_epk` changed. The owner-derived area follows
`SocialLinkController::dirtyArea()`'s pattern: the area depends on what was
touched, not on which controller was called.

### 4. Post blocks — `ref` entity `clip`

`PostBlockType::REF_ENTITIES` gains `'clip'`. `PostBlockResolver::load('clip')`
returns, per id:

```php
['id', 'provider', 'url', 'embed_id', 'title', 'category',
 'concert' => ['id', 'slug_en', 'date', 'venue' => ['id', 'name']] | null]
```

`concert` is the clip's **first attached concert**, when any — it drives the
"Live at … →" caption. A deleted clip resolves to `null`, which the admin
already renders as "missing item — remove?" and the public dispatcher skips.

`RefEntity` in both `types/post.ts` files gains `'clip'`.

### 5. Admin

**New screen `/admin/clips`** (`ClipsAdminView.vue`, nav entry beside Music
videos, `adminUrl('clips')`). Same shape as `MusicVideosAdminView`: a table
(title, category badge, provider badge, "attached to" count, recorded date)
and a modal form `ClipForm.vue`:

1. `EmbedBlockEditor` — URL + provider badge; the label inputs it shows for
   `link` are hidden here, the clip has its own title.
2. Title EN / PL.
3. Category: chips for the five presets, active state on the stored value;
   a text input beside them for a custom one. Typing clears the chip; a chip
   fills the input.
4. `recorded_on` date, "Show in EPK" toggle.
5. `EntityRelationsPanel` with `concerts`, `releases`, `shopItems` (the panel
   gains a `shopItems` list/model; albums are passed nothing). Saves as
   `attach`.

Server state through TanStack Query in `useClips.ts`; fetchers in
`api/clips.ts`; types in `types/clip.ts`.

**`AttachedClipsField.vue`** on `ConcertForm`, `ReleaseForm`, `ShopItemForm`:
lists the owner's clips (title, category, provider), a **Detach** per row,
and a **＋ Add clip** row (URL + category chips) that `POST /api/clips` with
`attach: [{type, id}]` and invalidates the owner query. On a *create* form
the owner has no id yet, so the field renders a one-line "Save the concert
first to add clips" note. The concert form is PR 1; the other two are PR 2.

**`RefBlockEditor`** gains entity **Clip**. Choosing it shows a searchable
`<select>` over `GET /api/clips` (option text: title · category · first
owner), and a final option **＋ Add a new clip…** that reveals URL, category
chips and an optional concert `<select>` (the `concert` list already passed
in `entities`) with an **Attach** button. Attach POSTs the clip, invalidates
the clips query and sets `payload.id`. A clip created here and then abandoned
(post never saved) stays in the library — it was explicitly created, and the
library is the source of truth.

### 6. Public

**`ClipsGrid.astro`** (`web/src/components/ClipsGrid.astro`): heading from
copy, then a responsive 1→2-column grid where each cell is the existing
`EmbedBlock.astro` fed `{provider, url, embed_id, label: title}` followed by a
caption row — category label + title + `recorded_on`. Renders nothing for an
empty list; the section is content-gated like FAQ, since it links nowhere.

Category labels: `resolveCopy` gives preset labels through the new
`CLIPS_COPY` (`packages/site-copy/src/modules/clips.ts`) — `categoryLive`,
`categoryStudio`, `categoryBackstage`, `categoryInterview`, `categoryOther`,
plus `sectionTitle` ("Videos" / "Nagrania"). A category outside the presets
prints as typed. `clips` is a copy-only module row — seeded by a
migration like `home`/`privacy` were, `enabled` ignored, listed in
`NON_PAGE_MODULES` and `ALWAYS_ON_MODULES` like `site` — so it appears in
Website Modules for its strings and nowhere else, and its key is reserved
against a future module claiming `/en/clips`.

Surfaces:

| Page | Reads | PR |
|---|---|---|
| `ConcertDetail.astro` | `concert.clips` | 1 |
| `RefBlock.astro`, `entity === 'clip'` | block `data` → `EmbedBlock` + caption linking via `refHref('concert', data.concert, …)` when `data.concert` is set; module-off or unbuilt route degrades to the dead label as concert refs do | 1 |
| `ReleaseDetail.astro`, `MerchItemDetail.astro` | `release.clips`, `item.clips` | 2 |
| `EpkSection.astro` | `epk.clips` from the snapshot | 2 |

`EpkSnapshotBuilder` adds `'clips' => Clip::where('show_in_epk', true)->…`
in PR 2. Already-published snapshots predate the key, so the section reads
`epk.clips ?? []` — the `testimonials` crash in `CLAUDE.md` is the
precedent.

Types: `web/src/types/clip.ts` (`Clip`), `clips?: Clip[]` on `Concert`,
`Release`, `ShopItem`, `EpkData`.

### 7. Error handling

- Unparseable provider URL → stored as `link`, renders as a link row; never
  an iframe with a broken `src`. Same rule as embeds.
- `attach` naming a missing owner → 422 from `exists`.
- Deleting a clip that posts reference → allowed; blocks resolve to `null`.
  The admin's existing "missing item" affordance covers it.
- A clip attached only to an album (possible via API, not via UI) shows on no
  page and in no post unless referenced — accepted; the model is ahead of
  the UI on purpose.

## Testing

**Pest**
- `EmbedProviderTest`: Facebook detection for `/videos/`, `/watch/?v=`,
  `/reel/`, `fb.watch`; page URL → `null` id.
- `ClipTest`: create stamps provider; `PUT` keeps the id; `attach` syncs
  (adds, removes, positions from index); attach/detach endpoints; cascade on
  owner delete removes pivot but not the clip; delete removes pivot rows;
  validation (bad URL, unknown type, missing owner); anonymous write → 401;
  `GET /api/concerts/{id}` carries `clips` in pivot order.
- `PostTest`: `ref clip` resolves with `concert` when attached, `null`
  concert when not, `null` data after the clip is deleted.
- PR 2: `EpkVersionTest` snapshot carries `show_in_epk` clips only.

**Vitest** (`app/src/**/*.spec.ts`): `detectProvider('…facebook…')`,
`clipCategories` label lookup for preset vs custom.

**Playwright, admin** (`app/e2e/tests/admin/`)
- `clips.spec.ts`: create a clip with category *studio*, edit title, delete.
- `concert-clips.spec.ts`: quick-add from the concert form, reload, present;
  detach.
- `post-clip-block.spec.ts`: add a `Clip` ref block via *Add a new clip…*
  with a concert chosen; save; open `/admin/clips`, the row exists with
  that owner. `afterAll` deletes what it created.

**Playwright, public** (`app/e2e/tests/public/`) — the rebuild-and-wait
pattern (`.serial`, seed via API, trigger the rebuild webhook, poll):
- `concert-clips.spec.ts`: a YouTube clip attached to a concert → the
  concert page has an `iframe[src*="youtube-nocookie.com/embed/<id>"]` inside
  the clips grid, and the category label.
- `article-clip.spec.ts`: a post with a `clip` ref → iframe present and the
  caption links to the concert page.
- PR 2: release and merch pages, EPK.

## Alternatives considered

- **`concert_clips` with a plain FK.** The first design; dropped when studio
  and charity footage came up. The library costs one more table and gains
  every owner type for free.
- **Widen `concert_links` with a `provider` column.** Buttons and iframes are
  different things on the page, labels have different semantics, and every
  existing link would need a backfill.
- **Nullable `concert_id` on `music_videos`.** Wrong on three axes:
  YouTube-only, profile-owned, feeds the Videos page.
- **`Post` as a clip owner.** Would put a clip *on* a post with no position in
  the article; the `ref` block already places it.
- **Auto-attach a post's embeds to the concerts the post is linked to.**
  Turns a routing choice into a content side effect; rejected in favour of
  explicit attachment.
