# Activity log, one account per member, members timeline — design

Three requests from the band, shipped together:

1. **Activity log** — who changed what, and when, for every entity, with a
   page in the admin to read it.
2. **One account per band member** — a member already linked to a user cannot
   be linked to a second one; the Users form greys them out.
3. **Band members timeline** — restore the line-up timeline (removed with the
   old SPA About page in #6, file deleted in #65), styled like a Wikipedia band
   article's EasyTimeline chart.

---

## 1. Activity log

### What gets recorded

Two layers, because neither alone answers "who edited this post":

| Layer | Source | Answers |
|---|---|---|
| **Action** (`activity_logs`) | `RecordActivity` middleware on `auth:api` | *who* did *what* through *which route*, even when no model event fires (pivot `sync()`, a relation `->delete()` query) |
| **Change** (`activity_changes`) | a wildcard `eloquent.created/updated/deleted: *` listener | *which records* changed and the *old → new* values |

Both belong to one row per request (the *action*). A request that writes
nothing and is not a successful admin mutation records nothing.

- Model events are listened to **globally** (`Event::listen('eloquent.…: *')`),
  so every model is covered from its first line — including ones added later.
  A short denylist skips the log's own models, `SiteDirtyArea` (bookkeeping),
  and Passport's token/client models (every login would be an entry).
- **Writes that bypass Eloquent events are not itemised** — query-builder
  `update()`/`delete()`, `sync()`/`attach()` on pivots. The action row still
  records that the request happened and which record the route named, which is
  why the middleware layer exists.
- Writes outside an HTTP request (queue jobs, `artisan`) are recorded with no
  user ("System"). Seeding and migrations (`db:seed`, `migrate*`) are skipped —
  a fresh database would otherwise start with thousands of entries.
- Anonymous public writes (checkout, newsletter sign-up) are **not** recorded:
  the log is the band's record of its own edits, and a visitor's details must
  not outlive their own rows. Records about people who are not users
  (subscribers, fans, orders, tickets) are logged by field name only, with no
  values and no label, for the same reason (GDPR erasure).
- Writes that bypass events but matter — a news body, rewritten by
  `PostBlockSync` as delete-and-bulk-insert — are reported with
  `recordField()`; two lists are diffed per position (`blocks.2`).

### What a change row stores

`event` (`created|updated|deleted`), `subject_type` (class basename, e.g.
`Post`), `subject_id`, `subject_label` (a snapshot: title/name/… resolved in
the default locale, so a deleted record still reads as something), and
`diff` — `{attribute: [old, new]}` (not `changes`, which Eloquent already owns as a property):

- **updated**: only the dirty attributes, minus `updated_at`/`created_at`. An
  update whose only dirty column is a timestamp is not recorded.
- **created**: every non-null attribute as `[null, new]`.
- **deleted**: every non-null attribute as `[old, null]`.
- **Redacted**: the model's `$hidden` attributes plus any column or JSON-bag
  key matching a pattern (password, secret, token, api key, credential,
  `ticket_code`). The key stays (`"***"`), so the log still says it changed.
- JSON columns (translation bags) are decoded so the UI can show them per
  locale; strings longer than 2,000 characters are truncated with `…`.

### What an action row stores

`user_id` (nullable, `nullOnDelete`), `user_name` (snapshot — a deleted
account still reads as a person), `method`, `route` (route name, e.g.
`api.posts.update`), `subject_type/id/label` (the first Eloquent model bound
in the route; for a `store` route, the first *created* change), `ip`,
`created_at`.

Rows are written through `DB::afterCommit()`: never inside the caller's
transaction. A rolled-back or retried transaction drops its pending rows, so a
change that never happened is not logged, and the log's INSERTs cannot widen a
lock window or become a deadlock victim. An action row with nothing itemised
is created only when the route names a record (not for a logout or upload).

### Who can read it

`GET /api/admin/activity` — `role:admin`. Filters: `subject_type`,
`subject_id`, `user_id`, `action`, `from`, `to` (days in the admin's time
zone, via `tz_offset`), `q` (label search). Paginated
25 per page, newest first, each action with its changes embedded.
`GET /api/admin/activity/filters` lists the users and entity types that occur,
for the filter dropdowns.

### Admin UI

`/admin/activity` (nav: *More → Activity log*), a table of actions:
*when · who · what (verb + entity + label) · route*, each row expandable to
the field diffs. Filters along the top; the URL carries them
(`?subject_type=Post&subject_id=12`), so "history of this post" is a link.

### Not in scope

Retention/pruning (no scheduler runs in this stack yet), reverting a change,
and logging reads.

---

## 2. One user account per band member

- API: `band_member_id` gets `Rule::unique('users', 'band_member_id')`
  (ignoring the edited user on update). Nulls do not collide.
- No DB unique index in this PR: production may already hold a duplicate,
  and a migration that fails on deploy leaves the schema half-applied. The
  validation stops new duplicates; an index can follow once prod is checked.
- Admin: in both the Add and Edit modals, a member already linked to *another*
  user is a disabled `<option>` labelled with that user's name. Pure logic in
  `utils/memberAccounts.ts` with a spec.

---

## 3. Band members timeline (public About page)

Wikipedia's band articles draw the line-up as an EasyTimeline: one row per
member, a horizontal bar per tenure coloured by **instrument**, thin inner
stripes for secondary instruments, a year axis with vertical gridlines, a
legend, and **vertical lines for album releases**.

- Rendered by Astro as plain HTML/CSS (no island, no JS): bars are absolutely
  positioned by percentage; hover text via `title`. A visually hidden list
  carries the same information for screen readers.
- Rows ordered by join date, then `sort_order`. Bars run `joined_at →
  quit_at` (or the build date for current members) at day precision.
  A member with no `joined_at` starts at the formation year.
- Colour: the member's main instrument (else first instrument); each distinct
  instrument gets the next of eight `--chart-*` colours declared in
  `tokens.css` (`:root`, so a theme may override them). Up to two secondary
  instruments are drawn as thin stripes inside the bar.
- Vertical lines: `LP` releases solid, `EP` dashed; singles and compilations
  are omitted, as on Wikipedia, to keep the chart readable.
- Axis from the formation year (or earliest join) to the next year; ticks
  every 1/2/5 years by span.
- Shown under the line-up grid. New visibility toggle `show_timeline`
  (Website modules → About), absent-means-shown like the others; hidden
  automatically when no member has a start date and no formation year exists.
- New copy fields in `ABOUT_COPY`: `timeline`, `timelineAlbums`, `timelineEps`.
- The maths lives in `web/src/lib/memberTimeline.ts` with a vitest beside it.

---

## Tests

- Pest: `ActivityLogTest` — create/update/delete itemised with user; redaction;
  timestamp-only update skipped; middleware action for a route with no model
  change; the endpoint's filters and admin-only access. `UserTest` additions —
  a second user cannot take a linked member, the same user can keep theirs.
- Vitest: `memberAccounts.spec.ts` (app), `memberTimeline.test.ts` (web).
- Playwright: `admin/activity-log.spec.ts` (edit a record → the entry appears
  with the diff), `admin/users-member-unique.spec.ts` (linked member is
  disabled), `public/members-timeline.spec.ts` (bars, legend, release lines).
