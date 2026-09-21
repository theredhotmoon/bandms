# EPK links a tech rider from the module, not an uploaded PDF

**Date:** 2026-09-21
**Status:** approved design, not built

## Problem

Band profile → EPK carries two upload fields, *Tech rider (PDF)* and *Stage
plot (image)*, stored as `band_profiles.tech_rider_path` and
`stage_plot_path`. They predate the tech-rider module, which now produces
both documents as one sheet: `RiderSheet.vue` renders the stage plot
(`placements`) beside the patch list, backline and PA/FOH notes, and every
rider has a permanent public page at `/rider/{public_token}` that serves
whichever version is currently published.

So the press kit asks the band to export the rider to PDF, upload it, and
upload it again after every change — while the system already holds the
live document and a stable URL for it. The two files also drift from the
rider the moment a musician updates a rig.

## Goals

- The EPK section offers a **selector of the band's tech riders**; picking
  one links the press kit to that rider's public page.
- The link is the **rider's own token**, so re-publishing the rider updates
  every press-kit link without a new EPK version.
- Only a rider **with a published version** can be selected — a
  never-published rider's page 404s, and the press kit must never link
  there.
- The uploaded-file fields, endpoints, admin UI and public rows are
  **removed**, not kept as a fallback.
- On the public site the rider is **one row**, "Tech rider & stage plot",
  in the Contact page's press-kit modal and promo cards. The About page's
  press cards drop the rider and stage plot entirely.

## Non-goals

- Linking a specific *version* of a rider. Decided against: a frozen version
  in the press kit would hand venues a stale patch list.
- Several riders per EPK (a `show_in_epk` flag like clips). A promoter wants
  *the* rider.
- Reusing `tech_riders.is_active`. That flag means "what the preview shows
  by default"; overloading it would make the EPK link impossible to unset
  without deactivating the rider.
- A PDF export of the sheet. The rider page prints; that is the export.
- Changing what `/rider/{token}` renders.

## Decisions

### Data model

`band_profiles` gains `epk_tech_rider_id`: `foreignId`, nullable,
`constrained('tech_riders')`, `nullOnDelete()` — the same shape as
`epk_release_id`, which sits on the same screen. The same migration drops
`tech_rider_path` and `stage_plot_path`, deleting the files those two
columns point at from the `public` disk in `up()` first. `down()` restores
the columns empty; the files are gone, and that half is deliberately
irreversible, like `2026_09_16_000001_backfill_post_published_at`.

`BandProfile::epkTechRider(): BelongsTo`. `epk_tech_rider_id` joins
`$fillable`; the two path columns leave it.

### Validation

`BandProfileController::update()` accepts `epk_tech_rider_id` as
`nullable|integer` plus a closure rule: the id must name a `tech_riders`
row that has a version with `status = published`. Laravel's `exists` rule
cannot express a `whereHas`, so the closure is the rule. Message:
*"Only a rider with a published version can be linked to the EPK."*

This is safe on the read side: `TechRiderVersionController::destroy`
refuses to delete a published version and `store` archives the previous
one inside the same transaction, so once a rider has a published version it
always has exactly one. The only way a linked rider stops being servable is
deleting the rider, and `nullOnDelete` handles that.

### API surface

Removed, with their routes: `uploadTechRider`, `destroyTechRider`,
`uploadStagePlot`, `destroyStagePlot` on `BandProfileController`.

`BandProfileResource`:

| key | before | after |
|---|---|---|
| `tech_rider_url` | `/storage/<path>` or null | `/rider/<token>` when `epkTechRider` is set and has a `publishedVersion`, else `null` |
| `stage_plot_url` | `/storage/<path>` or null | **removed** |
| `epk_tech_rider_id` | — | the FK |
| `epk_tech_rider` | — | `{ id, name, published_version }` or `null`, so the admin can label what is linked without a second fetch |

`tech_rider_url` **keeps its name**. Three public consumers read it, every
frozen EPK snapshot carries it, and its meaning — "the URL a promoter opens
to get the rider" — is unchanged. Only the value's shape moves from a file
to a page.

`EpkSnapshotBuilder` freezes `tech_rider_url` by the same rule and stops
emitting `stage_plot_url`. Snapshots published before this change still
hold a `stage_plot_url`; nothing reads it any more, so it is inert, and the
public EPK type marks it absent rather than optional.

No new `SiteRebuild::markDirty` call is needed: the profile update already
marks `band-profile`, and a rider *publish* does not change the string the
public site bakes — the link is the same token before and after.

### Admin

In `BandProfileAdminView.vue`, the EPK section replaces the two upload
blocks with one field directly under *Featured release*:

```
Tech rider & stage plot
[ — None —                                            ▾ ]
   Skanking Storks — festival set     (v3)
   Klub Stodoła — 2026-10-14          (v1)
Only riders with a published version are listed. The press kit links the
rider's permanent page, which always shows its latest published version.
Manage riders →
```

- Options come from the existing `useTechRiders().query`
  (`TechRiderSummaryResource` already carries `published_version`),
  filtered to `published_version != null`, ordered as the API returns them.
- `Manage riders →` is `adminUrl('tech-rider')` — never a literal path.
- `form.epk_tech_rider_id` joins the form state, the dirty check and the
  save payload exactly as `epk_release_id` does. It is saved by the
  section's *Save profile* button, not on change.
- The four upload/delete mutations in `useBandProfile.ts`, the four fetch
  functions in `api/bandProfile.ts`, the file-input refs and handlers, and
  the `.file-row` / `.file-upload-row` / `.stage-thumb` / `.btn-upload-file`
  / `.btn-remove-file` styles are deleted.
- `app/src/types/bandProfile.ts`: `stage_plot_url` removed from
  `BandProfile` and the EPK snapshot type; `epk_tech_rider_id` and
  `epk_tech_rider` added; `epk_tech_rider_id` added to the update payload
  type.

### Public site

`web/src/types/bandProfile.ts`: `stage_plot_url` removed from the profile
and snapshot types; `tech_rider_url` stays `string | null`.

**About** (`AboutSection.astro`): the rider and stage-plot press cards are
removed. Every remaining card (EPK, photos) is an internal route, so the
`isFile` flag and its `target`/`rel`/download-icon branches leave the
template. The comment about "storage files" is rewritten.

**Contact** (`ContactSection.astro`):

- Press-kit modal: the `epkStagePlot` row is removed. The `epkRider` row
  becomes `isFile: false` with `show: Boolean(profile.tech_rider_url) &&
  enabled('tech-rider')`. `isFile` there doubles as "exempt from module
  gating" in the `.filter(...)` line; the rider is now a `tech-rider`-module
  page, and a disabled module unbuilds `/rider/*`, so the row must gate on
  the module map like every other route link.
- Promo card: same change to the `riderTitle` card. The comment there
  ("Links the file, not /rider … renders 'Invalid rider link'") is now
  wrong and is replaced: the href carries a token, which is exactly what
  `PublicRider` reads.
- Because `isFile` is false, the row and card open in the same tab with the
  chevron icon. A rider page is a page, not a download.

### Copy (`packages/site-copy`)

Retired keys — overrides stored under them are dropped, deliberately:

| module | keys |
|---|---|
| `about` | `rider`, `riderSub`, `stagePlot`, `stagePlotSub`, `download` |
| `contact` | `epkStagePlot`, `epkStagePlotMeta` |

Changed defaults, so the single row says what it now carries:

| module | key | en | pl |
|---|---|---|---|
| `contact` | `riderTitle` | Tech rider & stage plot | Rider techniczny i plan sceny |
| `contact` | `epkRider` | Tech rider & stage plot | Rider techniczny i plan sceny |
| `contact` | `epkRiderMeta` | Stage plan, input list & backline | Plan sceny, lista wejść i backline |

`epkRiderMeta` loses its `· PDF` suffix because the row now opens a page.
`riderSub` ("Stage plan, input list, monitors & hospitality.") and
`riderCta` ("View rider") already describe the page correctly and are
unchanged. `resolve.spec.ts` pins the key set; the retired keys are removed
from it with a comment naming this spec.

### Documentation

CLAUDE.md, under *Public rider link 404s until the rider is published*,
gains a paragraph: the EPK selector offers only published riders, the
press-kit link is the rider's own token, and a rider publish therefore
reaches the press kit without a new EPK version or a site rebuild.
CHANGELOG entry.

## Tests

| Layer | Coverage |
|---|---|
| Pest `BandProfileTest` | Remove the upload/delete describe blocks. Add: update accepts a rider with a published version; rejects one with none (422, the message above); rejects an unknown id; `tech_rider_url` is `/rider/{token}` when linked and `null` when not; `epk_tech_rider` carries `{id, name, published_version}`; deleting the rider nulls the FK and the URL. |
| Pest `EpkSnapshotBuilder` (existing test or new) | snapshot freezes `tech_rider_url` from the token; no `stage_plot_url` key. |
| Vitest | none — no pure logic is added. |
| E2E admin `band-profile.spec.ts` | In the EPK tab: a rider with a published version is offered, an unpublished one is not; select, save, reload, the selection persists; restore the original value in `afterAll`. Seed one published and one unpublished rider through the API in `beforeAll` and delete them after. |
| E2E public `epk-modal.spec.ts` | With a rider linked: the press-kit modal has one rider row and no stage-plot row; its href matches `/rider/[A-Za-z0-9]{32}`; following it renders `.preview-root` (RiderSheet's root). Uses the rebuild-and-wait pattern and restores the profile. |
| E2E public `about.spec.ts` | The press cards contain no rider or stage-plot card. |

## Open risks

- `band-profile.spec.ts` writes a shared singleton, and an admin Save
  resends the whole form. Its EPK-tab writes must not overlap with another
  spec editing the same profile in parallel; keep the seeded riders' names
  unique (timestamp plus random suffix, per the `SeedE2eTicket` lesson).
- Old EPK snapshots keep a `stage_plot_url` key. Nothing reads it; nothing
  migrates it.
