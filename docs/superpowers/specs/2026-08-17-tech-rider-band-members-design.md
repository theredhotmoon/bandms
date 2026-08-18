# Tech Riders & Band Member Setups — Analysis and Redesign Proposal

**Date:** 2026-08-17
**Status:** Part 3.1 implemented on `feature/rider-single-source-of-truth`; phase 3 (versioning) and the
remainder of phase 4 implemented on `feature/rider-versioning` — see [Implementation log](#implementation-log)
**Scope:** `api/` tech riders + band members + member setups, `app/` admin editors and rider preview. Public Astro site unaffected.

---

## TL;DR

The feature set is genuinely good — signal-chain presets, a member-centric stage plot, completeness scoring, QR-token public rider. The problem is not *what* it does, it's that **the same technical data is stored in three places and kept in sync by hand, with buttons.**

Answering your question directly: **keep per-member setups — don't fold them into the rider.** They're the only thing preventing you from re-typing a 10-channel drum kit for every gig. What should go away is the *copying*. A rider should **reference** a member's setup plus a small per-gig override, and the flat rider sections (Inputs List / Monitors / Backline / Power) should be **derived**, not stored — except at the moment you publish, where you freeze an immutable snapshot the way `EpkVersion` already does.

That single change ("reference + override, derive live, freeze on publish") removes the Build buttons, the Import panel, the drift, and about half of the type surface.

---

## Part 1 — How it works today

### The three storage layers

| # | Where | Shape | Written by |
|---|---|---|---|
| 1 | `band_member_setups` table (one row per member per rig) | `inputs[]`, `monitor` (**singular**), `backline`, `power`, `wireless[]`, `foh_notes`, `signal_chain_type` | Band Members → Stage Setups tab, and My Setups (self-service) |
| 2 | `tech_riders.stage_plot_data[]` JSON — one `StagePlotMemberItem` per placed musician | `inputs[]`, `monitors[]` (**plural**), `backline`, `power`, `wireless[]`, `foh_notes`, `signal_chain_type`, `instruments[]`, `x`, `y` | Stage plot canvas → `StagePlotMemberModal` |
| 3 | `tech_riders.inputs / monitors / backline / power / rf_wireless` JSON — flat printable lists | `InputRow[]`, `MonitorMix[]`, `BacklineItem[]`, `PowerRequirements`, `RfWirelessUnit[]` | "Build from stage plot" banners, "Import from members" panel, manual editing |

Layer 2 is a copy of layer 1. Layer 3 is a copy of layer 2 (or of layer 1, bypassing 2).

### The four sync paths a user has to understand

```
                 ┌─────────────────────────┐
                 │ 1. band_member_setups   │  the library
                 └───────────┬─────────────┘
        linkSetup()          │           ▲   saveToProfile()
   StagePlotMemberModal:96   │           │   StagePlotMemberModal:~125
                             ▼           │
                 ┌─────────────────────────┐
                 │ 2. stage_plot_data[]    │  per-gig positions + rig
                 └───────────┬─────────────┘
   "Build from stage plot"   │
   TechRiderAdminView:202    ▼
                 ┌─────────────────────────┐
                 │ 3. rider.inputs etc.    │  the printed rider
                 └─────────────────────────┘
                             ▲
   "Import from members" ────┘   TechRiderImportPanel — goes 1 → 3, skipping 2 entirely
```

Four transfer paths, all manual, all one-shot, none reversible, and path 4 produces a rider whose printed channel list has no relationship to its own stage plot.

### Where the drift becomes visible

`TechRiderPreviewView.vue:98-108`:

```ts
const effectiveInputs = computed(() => {
  const saved = rider.value?.inputs ?? []
  if (saved.length) return saved.map(...)   // ← saved wins, always
  // ... otherwise derive from stage plot
})
```

So: press **Build** once, then move a musician / add a channel on the stage plot → the preview and the PDF the promoter gets still show the old list. Nothing warns you. `effectiveMonitors` has the same shape.

---

## Part 2 — Findings

Ordered by how much pain each one causes.

### F1 — Manual sync, silent drift *(correctness)*
Described above. The completeness bar measures layer 2; the printed rider renders layer 3. They can disagree indefinitely and the UI never says so.

### F2 — Lossy, destructive round-trip *(correctness)*
`saveToProfile()` in `StagePlotMemberModal.vue` writes the stage item back to the linked setup, but:
- the DB column is `monitor` (singular) while the stage item holds `monitors[]` → **only `monitors[0]` survives**. Wedge + IEM becomes wedge.
- it calls `updateMemberSetup(...linkedId...)`, so a one-off festival tweak **overwrites the member's stored default rig**. There is no "save as new setup" branch, and no confirmation.

### F3 — Four near-duplicate type families *(maintenance)*
| Concept | Shapes | Converters that exist |
|---|---|---|
| Monitor | `MemberMonitorPrefs` · `PlacedMonitor` · `MonitorMix` | `monitorToPrefs` / `prefsToMonitor` only (the third is hand-mapped in `stagePlotSuggestions`) |
| Backline | `MemberBacklinePrefs` (has `needed`) · `BacklineItem` (has `category`/`name`) | none — hand-mapped, drops to `instruments[0].label` |
| Power | `MemberPowerPrefs` (outlets, notes) · `PowerPosition` (location, outlets, notes) | none — hand-mapped, same lossy label |
| Wireless | `WirelessUnit` · `RfWirelessUnit` | none |

Every new field on any of these has to be added in 2–3 interfaces plus a mapper, or it silently vanishes on the way to the printed rider.

### F4 — ~260 lines of dead code with a divergent mic catalogue *(maintenance)*
`app/src/utils/stagePlotSuggestions.ts:26-281` — `suggestInputs`, `suggestMonitors`, `suggestBackline`, `suggestPowerPositions` and the `StagePlotItem` interface they use (`types/techRider.ts:49`) have **no callers anywhere** in `app/src`, `app/e2e`, or `api`. They contain a second, independent set of mic recommendations (SM57 / D112 / SM81…) that duplicates and can diverge from the live one in `signalChainPresets.ts`.

### F5 — Instrument identity is modelled five ways *(maintenance)*
`instruments` table · `band_member_instrument` pivot · `band_members.main_instrument_id` · `band_member_setups.instrument_id` · `PlacedInstrument.type` + free-text `label` on the stage plot.

The stage plot stores an **icon enum string and a typed-in label**, not a foreign key. Rename an instrument in the admin and nothing propagates; the icon on the plot can contradict the instrument on the linked setup. (The recent `guessInstrumentType` / profile-instrument fallback work papers over this well, but the underlying reference is still missing.)

### F6 — "Template" and "gig instance" are the same object *(conceptual)*
The UI says *"Each rider template stores its own full configuration"* (`TechRiderAdminView.vue:643`), yet a rider also carries `concert_id` and `gig_lineup` (who's available tonight, plus guest musicians) — that's an instance, not a template. Consequences:
- Only one global `is_active` flag, so "the rider" is a singleton even though the sidebar implies a library.
- No duplicate action. Deriving a Festival version from your Club rider means rebuilding it by hand.
- Linking a concert triggers `saveRider()` on `@change` mid-edit (`TechRiderAdminView.vue:466`) — the one field that autosaves, inconsistent with everything else.

### F7 — No server-side shape validation *(maintenance / risk)*
Every JSON section is validated as `['nullable', 'array']` (`TechRiderController.php:44-54` and `76-87`). Same for `default_gear` on band members. The TypeScript interfaces are the *only* contract. That means:
- a frontend bug can persist a malformed rider permanently;
- any future change to the JSON shape has no migration story and no way to detect old rows;
- `TechRiderResource` compensates with `?? []` / `?? (object)[]` defaults rather than the model guaranteeing shape.

### F8 — Save UX *(usability)*
One "Save rider" button over a ~900-line reactive form. No dirty tracking, no autosave, no unsaved-changes guard. Clicking a different rider in the sidebar changes `openId`, the watcher overwrites `form`, and edits are gone without a prompt. `MemberSetupsPanel` behaves the same way.

### F9 — Convention breach and copy-paste in the editor *(maintenance)*
`TechRiderAdminView.vue` is **967 lines** with reactive state, mutation handlers and business logic inline — `app/CLAUDE.md` says views are thin orchestrators with ≤ ~50 template lines and no reactive state. The build-banner block is duplicated **four times** (inputs / monitors / backline / power), ~20 lines each, differing only in noun and pluralisation.

### F10 — `profile_id = 1` hardcoded *(future risk)*
Six occurrences in `TechRiderController`. `Band` / `BandProfile` / `BandsAdminView` already exist as concepts, so this is a landmine for the day a second profile appears. Route-model binding on `show`/`update`/`destroy` also does no profile scoping (admin-only routes today, so not exploitable now).

---

## Part 3 — Proposal

### 3.1 The core idea: reference + override, derive live, freeze on publish

**Keep** `band_member_setups` as a library of reusable rigs. It's the feature's best asset, it's already self-service for members (`MySetupsView` + `can_login`), and per-rider-only would mean re-entering a drum kit every time.

**Change** what a rider stores. A stage placement becomes a pointer, not a copy:

```ts
interface StagePlacement {
  id: string
  subject: { kind: 'member'; member_id: number } | { kind: 'guest'; temp_id: string }
  setup_id: number | null        // ← the reference into the library
  x: number
  y: number
  overrides: Partial<SetupSpec>  // ← sparse, per-gig only. Empty for most placements.
  guest_setup?: SetupSpec        // guests have no library row; inline is correct for them
}
```

**Derive** the flat sections instead of storing them:

```
resolved(placement) = merge(library_setup(setup_id), placement.overrides)
rider.inputs        = flatten(placements.map(resolved).inputs)  + rider.extra_inputs
rider.monitors      = flatten(...)                              + rider.extra_monitors
rider.backline      = ...
```

Drop `tech_riders.inputs / monitors / backline / power` as *authoritative* storage. Keep two small deliberate fields instead:
- `extra_inputs[]` / `extra_monitors[]` — talkback, playback, spare vocal, house DJ. Things that belong to no musician.
- `channel_order[]` — an array of placement/row ids so the engineer can reorder and stereo-pair channels without that being "an edit to the data".

**Freeze on publish.** A rider you emailed to a venue must not change under them. Copy the existing `EpkVersion` pattern verbatim:

```
tech_rider_versions
  id, tech_rider_id, version_number, snapshot (json), status, published_at, public_token
```

- The **public token points at a version**, not at the live rider.
- While editing, everything is live-derived — no Build buttons, no drift possible.
- **Publish** renders the resolved rider once and stores it immutably.
- Free bonus: "what changed since v3" diff, and re-sending a corrected rider is a first-class action rather than an overwrite.

This resolves F1, F2, F3 and F6 at once: layer 3 stops existing, the converter zoo loses its reason to exist, and "template vs instance" becomes "live rider vs published version".

### 3.2 What the admin UI becomes

Today's mental model is *stage plot → press Build → edit the flat list → hope they still match*. The proposed model:

```
┌──── Riders ────┬───────────────────────────────────────────────────────┐
│ ● Club show    │  Club show          v3 published 12 Aug   [Publish v4]│
│   Festival     ├───────────────────────────────────────────────────────┤
│   Acoustic     │  Lineup    Stage    Channels    Requirements   Cover  │
│                ├───────────────────────────────────────────────────────┤
│                │                                                       │
│                │   Channels — derived from 5 musicians  ⟳ live         │
│                │   1  Kick (in)      Mic  D112     ← Marek · Drums     │
│                │   2  Kick (out)     Mic  Beta91A  ← Marek · Drums     │
│                │   …                                                   │
│                │  11  Gtr L          DI            ← Ola · Helix  ✎    │
│                │  12  Talkback       Mic  SM58     ← extra channel     │
│                │                                       [+ extra channel]│
└────────────────┴───────────────────────────────────────────────────────┘
```

Concretely:
- **Delete** the four "Build from stage plot" banners and the "Import from members" panel. Both become unnecessary — the list is always current.
- Every derived row shows **its source** ("← Marek · Acoustic kit"). Clicking it opens that musician's rig inline.
- Editing a derived row prompts once: **"Just this gig"** (writes `overrides`) or **"Update Marek's saved setup"** (writes the library). That's the honest version of today's `saveToProfile()`, and it fixes the accidental-overwrite in F2.
- Overridden rows get a small badge, so at a glance you can see what deviates from the members' standard rigs.
- Collapse the eight section tabs to five: **Lineup · Stage · Channels · Requirements (monitors + backline + power + RF) · Cover**. Monitors/backline/power/RF are short lists that read better on one scrollable page than behind four tabs.
- Move **Publish** into the topbar next to Preview, gated on the existing completeness score ("2 musicians have no inputs — publish anyway?").

### 3.3 Features worth adding on top

Small, each independently shippable, each enabled by the model above:

1. **Duplicate rider / "derive from"** — Festival = Club + 4 extra channels. Currently impossible without retyping.
2. **Rider from concert** — from the Concerts admin: *Create rider for this gig* → pre-fills lineup from current members, links `concert_id`, names it after the venue and date.
3. **Ask the band to confirm their rig** — one button mails every member with `can_login` a link to My Setups: *"Confirm your setup for Off Festival, 12 Sep."* Their confirmation timestamps against the rider; the completeness bar shows who hasn't replied. `login_email` / `can_login` / member-scoped update are already in place, so this is mostly a notification + a `confirmed_at` column.
4. **Version diff** — "v4 vs v3 sent to the venue: +2 channels, monitor 3 wedge→IEM". Trivial once snapshots exist.
5. **Stereo pairing + channel renumbering** — group L/R as one row, drag to reorder, auto-renumber. Currently `channel` is a free integer you can duplicate.
6. **Instrument references** — `PlacedInstrument.instrument_id` instead of icon-enum-plus-label, with `stage_plot_type` resolved from the instrument (extending what commits `5fb5aee` / `9cde9ab` already started). Renames then propagate.

### 3.4 Cleanups worth doing regardless of whether the redesign happens

These are independent, low-risk, and each is a small PR:

| # | Change | Effect |
|---|---|---|
| C1 | Delete `stagePlotSuggestions.ts:26-281` + the `StagePlotItem` interface | −260 lines, kills the duplicate mic catalogue (F4) |
| C2 | Extract `<TechRiderBuildBanner>` | −60 lines of 4× copy-paste (F9) |
| C3 | Split `TechRiderAdminView` into `useTechRiderEditor()` + section components | Brings the file back under the project's own view convention (F9) |
| C4 | `TechRiderRequest` Form Request with per-key `array` rules (`inputs.*.channel` etc.) | Enforces the JSON contract server-side (F7) |
| C5 | Change `band_member_setups.monitor` → `monitors` (json array) | Fixes the lossy round-trip (F2) |
| C6 | Collapse the three monitor shapes into one `MonitorSpec` | −1 interface, −2 converters (F3) |
| C7 | Dirty tracking + `onBeforeRouteLeave` guard + confirm on rider switch | Stops silent data loss (F8) |
| C8 | Replace `profile_id = 1` with a `currentProfile()` resolver; scope route-model binding | Removes the multi-band landmine (F10) |
| C9 | Make the concert `<select>` follow the same save flow as everything else | Consistency (F6) |

C1, C2 and C9 are near-zero-risk and could go in today.

---

## Part 4 — Suggested sequencing

Each phase leaves the app shippable.

**Phase 0 — Cleanups (½–1 day).** C1, C2, C9, C7. No behaviour change beyond the unsaved-changes guard.

**Phase 1 — One shape per concept (1–2 days).** C5, C6, C4. Migration to backfill `monitor` → `monitors[]`. Backend validation lands before the model changes, so the next phase has a safety net.

**Phase 2 — Reference + override (3–4 days).** Introduce `StagePlacement` with `setup_id` + `overrides`. Migrate existing `stage_plot_data` in a data migration: for each item, if it matches a linked setup, store the reference and the diff; if not, keep it inline as an override-only placement. Derive the flat sections; keep the old columns readable for one release so preview/public keep working, then drop them.

**Phase 3 — Versioning (2 days).** `tech_rider_versions` modelled on `EpkVersion`. Public token moves to the version. Publish button + completeness gate.

**Phase 4 — Editor rebuild (2–3 days).** Five tabs, source-attributed channel rows, inline override editing, remove Build banners and the import panel.

**Phase 5 — Features (à la carte).** Duplicate, rider-from-concert, confirm-your-rig, version diff.

Roughly **9–13 days** for phases 0–4. Phases 0 and 1 deliver most of the maintenance win on their own and are worth doing even if the rest is deferred.

---

## Part 5 — What I would *not* do

- **Don't move setups into the rider.** It looks like simplification but it deletes the reuse that makes the feature worth having, and it makes the member self-service page (`MySetupsView`) meaningless.
- **Don't keep the flat sections as editable stored state "just in case".** That's exactly the current bug. If a section must hold data that belongs to no musician, model it explicitly as `extra_inputs` — a named, small, obviously-manual list.
- **Don't unify `default_gear` with setups yet.** It overlaps conceptually (`DefaultGearItem` vs `MemberBacklinePrefs` both answer "own gear or backline?"), but it's a separate, smaller question and folding it in now would widen phase 2 for little gain.
- **Don't add rider templates as a separate entity.** "Duplicate this rider" gets you 95% of the value for 5% of the work.

---

## Open questions for you

1. **Does a published rider need to be immutable?** If you routinely email a PDF or share the QR with a venue days ahead, yes — and phase 3 is important. If you always regenerate on the day, versioning can be dropped and the whole thing gets simpler.
2. **How often does a rider genuinely deviate from a member's saved setup?** If it's rare, the override layer can be minimal (a note + a channel add/remove). If it's every gig, overrides deserve their own UI.
3. **Multi-band — real roadmap item or hypothetical?** It decides whether C8 is a cleanup or a prerequisite.
4. **Do you want guest musicians in the library?** Today they're inline-only (`temp_musicians`). A recurring dep/sub is a real thing; a lightweight "guest" record with saved setups may be worth it.

---

## Implementation log

**2026-08-17 — branch `feature/rider-single-source-of-truth`.**
Implemented section 3.1 ("reference + override, derive live") plus the cleanups it
made unavoidable. Versioning (3.1's publish snapshot / phase 3) was deliberately
deferred — see the open question about immutability.

### The three layers are now one

| Was | Now |
|---|---|
| `band_member_setups` (library) | unchanged in role — still the library, now the *only* place a rig is stored |
| `tech_riders.stage_plot_data[]` — a copy of the rig | `tech_riders.placements[]` — `setup_id` reference + sparse `overrides` patch |
| `tech_riders.inputs / monitors / backline / power / rf_wireless` — a copy of the copy | **gone.** Derived at render time by `app/src/utils/riderResolver.ts` |

What remains on the rider is only what belongs to no musician: `extra_inputs`,
`extra_monitors`, `extra_backline`, `extra_wireless`, `channel_order`,
`power_notes`, `pa_foh`.

### Same data

`app/src/types/rig.ts` is the single vocabulary: `InputRow`, `MonitorSpec`,
`BacklineSpec`, `PowerSpec`, `WirelessSpec`, composed into `RigSpec`. A saved
setup *is* a `RigSpec` plus identity; a placement override is `Partial<RigSpec>`.

Deleted as duplicates: `MonitorMix`, `PlacedMonitor`, `MemberMonitorPrefs`,
`BacklineItem`, `MemberBacklinePrefs`, `PowerPosition`, `MemberPowerPrefs`,
`RfWirelessUnit`, `WirelessUnit`, `StagePlotItem`, `StagePlotMemberItem` — and
every hand-written mapper between them.

`InputRow` lost its `channel` field: channel numbers are assigned during
resolution, so a stored one could only ever be stale or duplicated.

### Same components

`app/src/components/rig/` is used by both surfaces:

- `RigEditor.vue` — tabbed rig editor. `mode="library"` in Band Members → Stage
  Setups, `mode="placement"` in the stage plot. It never decides where an edit
  is stored: it emits `change(field, value)` and the caller writes to the setup
  or to the override patch.
- `RigSignalChain` · `RigInputsTable` · `RigMonitors` · `RigBackline` ·
  `RigPower` · `RigWireless` — one implementation each, shared.

### Same logic

`riderResolver.ts` is the only place derivation happens. `resolveRider()` is
called by the admin editor, the preview, and the public token view. The API
ships `referenced_setups` with every single-rider response so the
unauthenticated public page resolves with that same code rather than a PHP
re-implementation.

On the backend, `App\Http\Requests\Concerns\ValidatesRig` generates the rules for
a rig at any prefix, so `BandMemberSetupRequest` and the `placements.*.overrides`
of `TechRiderRequest` validate identically. This replaces the
`['nullable', 'array']` catch-all that let malformed sections reach the database.

### Fixed along the way

- **Drift.** There is no "Build from stage plot" step any more — the four build
  banners and the "Import from members" panel are deleted, because the lists are
  always current. The preview's `if (saved.length) return saved` fallback, which
  froze the printed rider after the first Build, is gone with them.
- **Lossy round-trip.** `band_member_setups.monitor` → `monitors` (array). A
  member can run a wedge *and* an IEM without one being dropped.
- **Silent overwrite.** The old `saveToProfile()` rewrote a member's saved rig
  from a one-off gig tweak. Now an edit defaults to an override ("this gig only")
  and promoting it into the library is an explicit button that names the member.
- **Dead code.** `stagePlotSuggestions.ts` deleted (~280 lines, including a
  second divergent mic catalogue).
- **View size.** `TechRiderAdminView.vue` 967 → ~300 lines of orchestration, with
  state in `useTechRiderEditor.ts` and chrome in `TechRiderSidebar` /
  `TechRiderCover`. Eight section tabs collapsed to five.
- **Data loss.** Dirty tracking plus a confirm on rider switch and an
  `onBeforeRouteLeave` guard.
- **`profile_id = 1`.** Replaced by a single `profileId()` resolver.

### Known gaps

- **No backfill.** By agreement (dev data only), the migration drops the old
  columns without converting them. Existing rider rows keep their positions and
  instruments but resolve to empty rigs. Run `bash rebuild.sh --fresh-db`.
- **`shared_monitor_id`** is still on the model and the API but no longer has a
  UI. It never affected any rendered output — a rig's `monitors` list covers the
  case now. Worth dropping in a follow-up.
- **No unit tests for the resolver.** `app/` has Playwright but no unit runner.
  `riderResolver.ts` is pure and is the highest-value thing in the change to
  test — adding Vitest is the obvious follow-up.
- ~~**Versioning not built.**~~ Built — see the phase 3 entry below.

---

**2026-08-18 — branch `feature/rider-versioning`.**
Phase 3 (versioning) and the part of phase 4 that depended on it.

### A rider is now frozen when it is sent

`tech_rider_versions` follows `epk_versions` with two deliberate differences:
versions belong to a rider rather than to the band, and there is no `pending`
state. An EPK is drafted and then released; a rider is *sent*, and the sending
is the thing worth recording — a `pending` step would only create versions
nobody received. Publishing archives its predecessor, so exactly one version is
`published` per rider at any time.

### What a snapshot contains

Not the printed sheet — what the sheet is derived *from*: the rider, the saved
rigs its placements reference, the musicians it places, and the band's logo.

The alternative was to re-implement `resolveRider()` in PHP and freeze the
resolved channel list. That is finding F1 and F3 again in a new place: two
implementations of one rule, free to drift, with nothing to catch it. The
resolver is pure, so freezing its inputs freezes its output just as effectively,
and `app/src/utils/riderResolver.ts` is still the only copy. A resolver *bugfix*
then reaches old versions too — which is right for a rendering change and was
never wanted for a data change.

`App\Services\TechRiderSnapshotBuilder` builds it. Only the members a placement
references are frozen, with display fields only: a snapshot is a public
document, and `BandMemberResource` exposes `login_email` to authenticated staff.

### Two kinds of public token

- **The rider's token** — the one on the QR code. Follows the band forward and
  always serves whichever version is published. Returns **404 until the rider
  has been published at least once**, which is the intended behaviour and is
  documented as a footgun in the root `CLAUDE.md`.
- **A version's token** — pinned to that version for good. This is what makes
  "re-send a corrected rider" a first-class action rather than an overwrite: the
  promoter who got v1 in August still opens the August sheet.

`GET /api/public/rider/{token}` now returns `{ format, taken_at, rider, members,
profile, version }`. `RiderPublicView` reads all of it from the snapshot, so the
page went from three requests to one and no longer touches live data at all.

### Editor

`Publish v{n}` sits next to Preview in the topbar, as 3.2 asked. A version chip
beside the Active badge opens the history, where every version is a copyable
permalink.

The confirm dialog splits what 3.2 described as one gate into two, because the
gaps are not alike:

- **A rider with no named channels cannot be published.** That is not an
  incomplete document but a blank one — the engineer receives an input sheet
  with nothing on it. The button is disabled.
- **Everything else is a warning you can send past**: musicians not yet placed,
  a musician with no inputs or no monitor. A rider is routinely sent while one
  of them is still confirming their rig, and an editor that refuses in that
  state just gets worked around.

Only channels carrying an instrument name count toward the gate. A blank row
would otherwise unblock Publish and then fail the save that publishing performs
first — `inputs.*.instrument` is required — turning a lock into a stray 422.

### The blank row that could not be saved

Fixed here rather than left for later, because the publish gate sends people
straight at it. `+ Add row` creates a channel with no instrument name, which the
server requires, so the next save was refused as `Failed to save rider` with no
indication of which row in a form with five tabs and a rig per musician.

`app/src/utils/rigValidation.ts` holds that one rule for all three paths that
can send a rig — the rider's extra channels, a placement's override, and a
member's saved rigs. The row is marked where it is created, the save is refused
before the request with a message naming the row and its section, and
`saveErrorMessage()` unwraps `ApiValidationError` so a server rejection keeps
its field path instead of becoming a generic toast.

Publishing saves the draft first. Publishing freezes what is *stored*, so an
unsaved form would otherwise freeze the wrong sheet, silently.

### Known gaps

- **No version diff.** Phase 5 item 4. Snapshots make it straightforward now:
  resolve two of them and compare the channel lists.
- **`/tech-rider` and `/tech-rider/:id` still render the live rider** and are
  unauthenticated. They are the admin preview, not the shared link, but they
  predate versioning and are worth revisiting.
- **The Astro island at `web/src/components/PublicRider.vue`** expects a
  `title` / `content_html` payload the API has never returned; it was already
  non-functional before this change and is untouched by it.
