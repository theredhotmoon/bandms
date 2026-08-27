# Remaining designed pages — plan

**Date:** 2026-08-27
**Status:** awaiting approval
**Scope:** public Astro site (`web/`) only. The `app/` SPA public views are
unreachable in production and stay untouched.

---

## 1. The surprise: most of this is already built

The design project holds ten pages. Auditing `web/src` against them, four are
already full 2-Tone ports, hand-written before the theme system existed and
tokenised by the migration in `1ef9017`:

| Design page | Astro implementation | Lines | State |
|---|---|---|---|
| `Skanking Storks - Centered Bill.html` | `pages/[lang]/index.astro` | 664 | **Ported** |
| `Shows.html` | `sections/ConcertsSection.astro` | 680 | **Ported** — map, archive filter, stats all present |
| `Concert.html` | `detail/ConcertDetail.astro` | 1625 | **Ported** |
| `Article.html` | `detail/PostDetail.astro` | 729 | **Ported** |
| `News.html` | `sections/PostsSection.astro` + `NewsFilter.vue` | 140 + 426 | **Mostly** — search, featured, tags done; "In the press" missing |
| `Contact.html` | `sections/ContactSection.astro` | 400 | **Done** this branch |
| `Music.html` | `sections/ReleasesSection.astro`, `detail/ReleaseDetail.astro` | — | **Not ported** |
| `Gallery.html` | `sections/PhotosSection.astro` | — | **Not ported** |
| `Shop.html` | `sections/MerchSection.astro`, `detail/MerchItemDetail.astro` | — | **Not ported** |
| `About.html` | `pages/about.astro` | — | **Not ported**, and not a module |

Detection: a ported page has a scoped `<style>` block driven by
`var(--font-display)`; an unported one still leans on Tailwind utility classes.

```
                       var(--font-display)   utility classes
ConcertsSection                        11                  0   ← ported
ConcertDetail                          17                  0   ← ported
PostDetail                              8                  0   ← ported
[lang]/index                            9                  0   ← ported
EpkSection                              0                 26   ← no design
about.astro                             0                 22
PressSection                            0                 12
ReleaseDetail                           0                 12
MerchItemDetail                         0                  9
MerchSection                            0                  7
PhotosSection                           0                  5
VideosSection                           0                  5
ReleasesSection                         0                  3
NewsletterSection                       0                  2
```

So the real work is **five pages**, not ten: Music (list + detail), Gallery,
Shop (list + detail), About, and finishing News.

---

## 2. Features we already have

Nearly everything. The API is in better shape than the front end.

**Data — no backend work needed:**

| Need | Source | Verified |
|---|---|---|
| Releases, type, date, cover, description | `GET /releases` | ✓ |
| Tracklists with duration, BPM, key, ISRC | `ReleaseResource.tracks` | ✓ |
| **Per-track lyrics** | `tracks[].lyrics` | ✓ |
| Per-release and per-track platform links | `links[] {platform, url}` | ✓ |
| Music videos | `GET /music-videos` | ✓ |
| Albums, photo counts, cover, venue, concert, date | `GET /albums` | ✓ |
| **`epk_featured` flag per photo** | `AlbumResource.photos[].epk_featured` | ✓ |
| Shop items, prices + currency, variants, categories, tags | `GET /shop`, `/shop-categories` | ✓ |
| Presale, ships-at, stock, external purchase URL | `ShopItemResource` | ✓ |
| Posts with intro, content, image, tags | `GET /posts` | ✓ |
| Related concerts / albums / releases / videos / press per post | `PostResource` | ✓ |
| Members incl. former (`is_current`), bio, photo, role, instruments | `GET /band-profile/members` | ✓ |
| Bio at three lengths, formation year, hometown, genres, comparables | `GET /band-profile` | ✓ |
| Social/streaming stats | `stat_spotify_monthly` etc. | ✓ |
| Past **and** future concerts in one call | `GET /concerts` returns all | ✓ |

**Components we can reuse rather than rebuild:**

`PhotoLightbox.vue`, `ShowsMap.vue`, `ConcertMap.vue`, `ShowsArchiveFilter.vue`,
`NewsFilter.vue`, `AddToCart.vue`, `CartDrawer.vue`, `CartIcon.vue`,
`ReleaseCard.astro`, `PostCard.astro`, `ConcertCard.astro`, `MemberCard.astro`,
`SocialLinks.astro`, `Icon.astro`, `ModalShell.vue`, `useModalTrigger`,
`ThemeSlot` + the checker/grain ornaments, and the whole token contract.

---

## 3. Features we need to build

### 3.1 Music — `ReleasesSection.astro` + `ReleaseDetail.astro`

Design sections (from the `m*` keys in `variants/shared.jsx`):

| Section | Data | Work |
|---|---|---|
| Featured release with tracklist | `releases[0]` + `tracks` | Layout only |
| Discography grid, click to expand tracklist | `GET /releases` | Layout + a Vue island for expand |
| "Where to listen" platform grid | aggregate `links[]` | Layout; dedupe platforms |
| **Lyrics** viewer | `tracks[].lyrics` | New island — nothing renders lyrics today |
| "Buy physical" | shop items tagged to the release (`release_ids`) | Cross-link, gated on the merch module |
| Music videos | `GET /music-videos` | Layout — decision 1 below |

### 3.2 Gallery — `PhotosSection.astro`

| Section | Data | Work |
|---|---|---|
| Album grid with cover + photo count | `GET /albums` | Layout only |
| Category/album filter | album fields | Layout |
| "Press-ready" badge | `photos[].epk_featured` | Layout — flag exists, is unused on the public site |
| Lightbox | `PhotoLightbox.vue` | Restyle to 2-Tone |
| Shot-at line (venue / concert / date) | `AlbumResource.venue`, `.concert`, `.taken_at` | Layout |

### 3.3 Shop — `MerchSection.astro` + `MerchItemDetail.astro`

| Section | Data | Work |
|---|---|---|
| Category tabs | `GET /shop-categories` | Layout |
| Product grid, price from, variant count | `GET /shop` | Layout |
| Stock / presale / sold-out states | `is_available`, `is_presale`, `stock_quantity` | Layout |
| Variant picker + add to cart | `AddToCart.vue` | Restyle |
| Cart drawer, subtotal, checkout | `CartDrawer.vue`, Stripe checkout | Restyle only — flow works |
| Currency label | `prices[].currency` | Layout |

### 3.4 About — `pages/about.astro`

| Section | Data | Work |
|---|---|---|
| Hero, formed / based / for-fans facts | `GET /band-profile` | Layout |
| Bio length switcher (short / medium / full) | three bio fields | New island |
| "By the numbers" stats | profile stats; shows-played and years-on-stage derived | Layout + derivation |
| Line-up, tap a player for their story | `GET /band-profile/members` | Layout + island |
| Past members | `is_current = false` | Layout |
| Press & booking cards | profile + rider/EPK links | Layout, module-gated |

**This is the only page needing backend work:** About is not a module. It exists
only at the unlocalised `/about`, is absent from the nav, and cannot be renamed,
reordered or switched off. The design's nav includes it. So:

- migration adding an `about` row to `website_modules` with per-locale slugs
  (`about` / `o-nas`), mirroring `2026_08_26_000001_add_contact_website_module`
- add `about` to `MODULE_SLUGS` in `Header.astro` and to the `[lang]/[section]`
  dispatch
- move the page into `sections/AboutSection.astro`; keep `/about` delegating to
  it, as `/contact` now does

### 3.5 News — finish

Only "In the press" is missing: `GET /press-releases` rendered as a strip on the
News page. Everything else is done.

---

## 4. Pages with no design

`EpkSection`, `PressSection`, `VideosSection`, `NewsletterSection` have no
counterpart in the design project. They currently render with 2-Tone *tokens*
and their old layout — coherent, but plainly undesigned next to a ported page.

Three options, and I'd take the second:

1. Leave them. Cheapest, but four pages visibly lag the rest.
2. **Restyle them by extension** — reuse the ported pages' section header, card
   and divider patterns without inventing new layouts. Modest work, consistent
   result.
3. Design them properly first (in Claude Design, then port). Best result,
   biggest detour.

Note `videos` and `press` can also simply be switched off in
`/admin/website-modules` if the band does not want them — the module map already
removes their routes and every link to them.

---

## 5. Decisions I need from you

1. **Music videos** — the design puts a videos section on the Music page, while
   we have a separate `videos` module. Fold videos into Music (and retire the
   module), show them in both places, or leave the module standalone?
2. **About as a module** — add the migration so it is localised, toggleable and
   in the nav (my recommendation), or leave it at `/about`?
3. **Undesigned pages** — option 1, 2 or 3 from §4.
4. **Sequencing** — one PR per page (5–6 PRs, reviewable) or one large PR?

---

## 6. Proposed sequence

Assuming per-page PRs, ordered by value and by how much each teaches the next:

| # | PR | Why here |
|---|---|---|
| 1 | Music (list + detail + lyrics island) | Largest, most new UI, sets the pattern for detail pages |
| 2 | Gallery | Small; exercises the lightbox restyle |
| 3 | Shop (list + detail) | Touches the cart, so worth doing after the pattern is settled |
| 4 | About (+ `about` module) | Only PR with backend work |
| 5 | News "In the press" | Tiny; could ride along with any of the above |
| 6 | Undesigned pages, if option 2 | Cleanup pass once every pattern exists |

Each page's exact values come from its `variants/*_page.jsx` in the design
project, fetched when that page is built rather than up front.

---

## 7. Verification, per page

The same gates this branch has used, all of which have caught real bugs:

- `pnpm build` in `web/` — runs the token lint, so no raw palette value can
  reach a component
- resolve every href in `dist/` and check module gating in **both** directions
- E2E against the running `web` container, capturing `pageerror` — this is what
  found the Teleport hydration bug, which no build-time check reports
- `bash scripts/test-all.sh` before any PR
- compare against `screenshots/` in the design project

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| The four "ported" pages may not match their design as closely as line count suggests | Screenshot-compare each before declaring it done; treat gaps as small follow-ups, not rewrites |
| Shop touches live Stripe checkout | Restyle only; no changes to cart or checkout logic, and the existing shop E2E specs must stay green |
| `about` module migration must not move any existing URL | Same assertion approach as the slug migration: check every module's effective slug before and after |
| Lyrics may be long or absent per track | Guard for null and make the island collapsible |
| One page throwing kills all 244 | Every API field read defensively, as with the EPK snapshot fields |
