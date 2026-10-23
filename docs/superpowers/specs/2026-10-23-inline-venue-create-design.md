# Spec: create a venue from inside the concert modal

## Objective

Adding a concert requires a venue, and the venue list is a plain `<select>`
fed by `GET /api/venues`. When the venue does not exist yet, the band has to
close the concert modal (losing what they typed), go to *Venues*, create one,
come back and start over. With no venue at all the *+ Add concert* button is
disabled outright.

The band should be able to add the missing venue **without leaving the
concert form**, and have it selected when they return to it.

User story: *as the band's booker, while filling in a show, I notice the
venue is not in the list; I press "New venue", fill in the venue, save, and
the show form is exactly as I left it with the new venue selected.*

## Decisions (made for the user, flagged as such)

1. **A nested modal, not an inline mini-form.** `VenueForm` carries a map
   with place search, address fields, capacity, tags and social links. Folding
   that into the concert form would double its length; a trimmed "name + city"
   form would create venues the band then has to go back and finish. The
   nested modal reuses the full `VenueForm` unchanged.
2. **The affordance is always there, not only when the list is empty.** A
   *+ New venue* button sits beside the venue select. "The venue is missing"
   covers both "the list is empty" and "the one I need isn't in it".
3. **The view-level gate is relaxed.** With the inline affordance, disabling
   *+ Add concert* when there are no venues no longer protects anyone from a
   dead end; it creates one. The button stays enabled. The amber notice stays
   but its wording changes to point at the in-form button; the *Go to
   Venues* link stays for the band that wants the full page.
   `venueGate()` itself is untouched; only the view stops binding `noVenues`
   to `disabled`.
4. **Editing an existing venue from the concert form is out of scope.** Only
   create. (Non-goal.)
5. **The new venue is appended to the query cache at once** (`setQueryData`)
   and the list is invalidated afterwards, so the select shows the new row
   the moment the nested modal closes rather than after a refetch.

## Modal stacking — the part that needs care

`AdminModal` teleports to `<body>` at `z-index: 50`, so a second instance
rendered later in the DOM paints on top: no CSS change needed. Two things do
need work:

- **Escape.** Every open `AdminModal` listens for Escape on `window`, and the
  outer one registered first, so today the *outer* modal would handle the
  key and ask to discard the concert. `AdminModal` gets a module-level stack
  of open instances; only the topmost acts on Escape.
- **Discard guard.** The nested modal provides its own `MODAL_GUARD`, and
  `VenueForm` injects the nearest one, so the venue form's dirty state binds
  to the nested modal and the concert form's to the outer one. No change
  needed; the E2E spec proves it.

Focus: the nested modal moves focus into itself on open and back to its
opener (the *+ New venue* button) on close, which `AdminModal` already does.

## Tech stack

Vue 3 `<script setup>` + TypeScript strict, TanStack Query v5, vue-i18n,
Playwright for E2E, vitest for units. No backend change: `POST /api/venues`
already exists.

## Commands

```bash
cd app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build   # type-check + guards
cd app && pnpm test:unit                                                             # vitest
cd app && pnpm exec playwright test e2e/tests/admin/concerts.spec.ts                 # the E2E half
bash scripts/test-all.sh                                                             # everything, before PR
```

## Project structure (files touched)

```
app/src/components/admin/forms/ConcertForm.vue      + button beside the select, mounts the quick-add
app/src/components/admin/forms/VenueQuickAdd.vue    NEW: button + nested AdminModal + VenueForm + create mutation
app/src/components/admin/AdminModal.vue             open-modal stack; only the top one handles Escape
app/src/composables/useVenues.ts                    create: append to cache, then invalidate
app/src/views/admin/ConcertsAdminView.vue           stop disabling the button; reword the notice
app/src/i18n/en/shows.ts, pl/shows.ts               newVenue, venueCreatedInline, needVenue rewording
app/e2e/tests/admin/concerts.spec.ts                venue-gate block updated; new inline-create spec
```

## Code style

Same shape as the existing form children. The new component owns its state
and emits the result; the host form sets its own field:

```vue
<!-- VenueQuickAdd.vue -->
const emit = defineEmits<{ created: [venue: Venue] }>()
const { create } = useVenues()
async function handleSubmit(payload: VenuePayload) {
  fieldErrors.value = {}
  try {
    const venue = await create.mutateAsync(payload)
    toast.success(t('shows.venues.created'))
    emit('created', venue)
    open.value = false
  } catch (e) {
    reportSaveError(e, t('common.state.somethingWentWrong'), fieldErrors)
  }
}
```

## Testing strategy

| Level | What | Where |
|---|---|---|
| Unit (vitest) | `useVenues.create` appends the created row to `['venues']` | hard to isolate (composable pulls `useAuth`); covered by E2E instead |
| E2E (Playwright) | open concert modal → *+ New venue* → fill name → save → venue selected, concert fields intact → save concert → row shows the venue; cleanup deletes both | `concerts.spec.ts` |
| E2E | Escape in the nested modal closes only the nested modal | `concerts.spec.ts` |
| E2E | venue gate: with `[]` the button is **enabled** and the notice names the in-form button | `concerts.spec.ts` (existing block, updated) |

## Boundaries

- **Always:** run `pnpm build` in `app/` (the `-b` form) and the concerts E2E
  spec before calling it done; every new string goes in both catalogues.
- **Ask first:** any backend change (none expected); touching `venueGate()`.
- **Never:** reintroduce a hand-built `/admin/...` URL; use `adminUrl()`.

## Success criteria

1. From an open concert modal, a venue can be created without the modal
   closing, and it is selected on return.
2. Everything already typed into the concert form survives the detour.
3. Escape and the discard guard act on the nested modal only while it is open.
4. With zero venues, *+ Add concert* is enabled and the notice explains
   where the in-form button is.
5. `pnpm build` green; `concerts.spec.ts` and `venues.spec.ts` green.

## Open questions

None blocking. Decision 3 (enabling the button with no venues) is the one
judgment call worth a glance.

## Appendix: where else the same pattern applies (survey, 2026-10-23)

Every modal form in the admin that picks a record managed on another page.
Only the venue select is **required**; the rest are optional, so a missing
record there is a smaller detour (save without it, add it later) rather than
a dead end. Best candidates first.

| Form (in a modal) | Picks | Created on | Required | Why it ranks here |
|---|---|---|---|---|
| `ConcertForm` venue select | Venue | Venues | **yes** | done in this PR |
| `RefBlockEditor` (post reference block) | concert, album, release, video, press release, shop item | six pages | **yes** (per block) | the only other required picker; the clip entity already has *Add a new clip…* |
| `BandForm` contacts | Author | Authors | no | when empty it shows a *add one first* link that leaves the modal |
| `BandMemberForm` instruments | Instrument | Instruments | no | the whole block is hidden when there are none |
| `ConcertForm` lineup pool | Band | Bands | no | shows "no bands yet" |
| `BatchPhotoUpload` / album edit | Concert, Venue, Tag | three pages | no | two `<select>`s, same shape as the venue one |
| `UsersAdminView` add/edit user | Band member | Band members | no | `<select>` |
| Tag checkbox lists (`ConcertForm`, `VenueForm`, `PostForm`, `PressReleaseForm`, `ShopItemForm`) | Tag | Tags | no | a `TagForm` is small; a quick-add would be cheap |
| `EntityRelationsPanel` consumers (clip, post, press release, shop item) | concerts, releases, members… | many | no | empty sections are hidden with no hint at all |
| `ShopItemForm` categories / currencies | Category, Currency | modals on the same Shop page | no | already same-page; a hint exists |
| `TourForm` concerts | Concert | Concerts | no | shows "no concerts" |
| `PlacementModal` "playing through" | a member's saved rig | My setups | no | *Add blank* already covers it |

`VenueQuickAdd` is the shape to copy: a button, a nested `AdminModal`, the
existing form, the existing `create` mutation, one `created` emit. Modal
stacking is solved once in `AdminModal`.

Modals that already sit over a modal today (all popovers, not `AdminModal`):
`ConfirmDialog` inside every guarded modal, `PhotoMemberTags` in the photos
modal, `InstrumentIconPicker` in `PlacementModal` and the instruments modal.
Each consumes Escape with `preventDefault()`, which the stack respects.
