# Scheduled news posts: `published_at` becomes a timer

**Date:** 2026-09-16
**Status:** approved, not built — parked in `TODO.md` until wanted

## Problem

`posts.published_at` is a switch, not a timer. Since #117 a null hides the
post from every public surface; **any non-null value shows it**, including a
date in the future. An editor who sets "next Friday 10:00" on a post gets it
on the site at the next rebuild, dated Friday.

The band wants to write posts ahead of time and have them appear on their
own. JavaScript cannot do this: the public site is static, `astro build`
bakes every post's HTML into `dist/`, and a client-side "hide until the
date" leaves the full text in the HTML for Googlebot, `view-source`, the
sitemap and the news island's JSON. Scheduling has to happen where the
pages are *decided* — the API the build reads — and at the moment the build
runs, which today is only ever an admin save.

A second, quieter problem surfaces the moment the date is a timer.
`published_at` is a `datetime-local` value sent zone-naive and stored as
typed on a UTC server (`APP_TIMEZONE=UTC`). While it only decided the
*displayed* date, an editor in Warsaw typing `10:00` and getting `10:00Z`
never mattered. As a trigger it is a one- or two-hour surprise every time.

## Goals

- A post with a future `published_at` is invisible publicly — list, search,
  detail, press-release links, sitemap — exactly like a draft, and goes live
  within about a minute of that time without anyone touching the admin.
- The time an editor types means the band's local time.
- The admin distinguishes *Draft*, *Scheduled* and *Published*, and can tell
  when the thing that publishes on the clock is not running.
- No change to how the public site formats dates, and no zone-dependent
  rendering in the hydrated islands (the #116 constraint).

## Non-goals

- `published_at` on press releases, photo albums and music videos stays a
  switch. Same column name, different feature; nobody asked.
- An admin UI for the timezone. One band per deployment; it is an env var.
- RSS, or any "coming soon" surface for scheduled posts.
- Rebuilding on a fixed timer in `web/docker/start.sh`. It rebuilds the
  baked source and would thrash the site every N minutes whether or not
  anything changed; the dirty-area mechanism exists to avoid that.

## Decisions taken during design

| Question | Decision |
|---|---|
| Which clock does "Friday 10:00" mean? | The band's local time, via one site-wide `BAND_TIMEZONE`. |
| Where does the timezone live? | Env var in both compose files, like `PUBLIC_THEME`. Not a `site_settings` row. |
| Auto-rebuild switch is off when a schedule fires? | **Always rebuild.** A schedule is an explicit "publish at this time"; the switch keeps governing ordinary edits. |
| Watermark scheduler vs delayed queue job? | **Watermark scheduler** (see *Alternatives*). |
| Interval? | Every minute. One indexed query; "within a minute" is a far better promise than "within five". |

## Design

### 1. Time semantics — the API boundary speaks band-local time

`BAND_TIMEZONE` (an IANA name) is added to the `backend` service's
`environment:` block in `docker-compose.yml` **and** `docker-compose.prod.yml`
— the *Setting a backend env var in `.env` alone does nothing* footgun
applies — and to `.env.example` as `Europe/Warsaw`. `config/app.php` reads
it as `'band_timezone' => env('BAND_TIMEZONE', 'UTC')`. Code reads
`config('app.band_timezone')`, never the env directly (the config cache
bakes it at container start).

**Storage stays UTC.** `APP_TIMEZONE` is untouched; every `datetime` cast,
`now()` and `created_at` keeps meaning what it means today.

**In.** `StorePostRequest` and `UpdatePostRequest` normalise `published_at`
in `prepareForValidation()` (a small shared method in `Concerns\PostRules`):

- a zone-naive string — `2026-09-18T10:00`, what `datetime-local` sends — is
  parsed *in the band's zone* and converted to UTC;
- a string carrying an offset or `Z` is respected as written;
- null/empty stays null (a draft).

Validation keeps its `nullable|date` rule; normalisation runs before it.

**Out.** `PostResource` and `PostSummaryResource` serialise `published_at`
*in the band's zone*:
`$this->published_at?->setTimezone(config('app.band_timezone'))->toIso8601String()`
→ `2026-09-18T10:00:00+02:00`. `created_at`/`updated_at` are unchanged.

Why this shape: the admin form already does `val.published_at.slice(0, 16)`
to fill the input and sends the input's value back untouched, so it
round-trips with **zero client-side timezone code**, and two editors in
different countries see and type the same wall-clock time. The public site's
`parseApiDate()` in `web/src/lib/i18n.ts` widens its regex from `Z|\+00:00`
to `Z|[+-]\d{2}:\d{2}` and keeps taking the **calendar day as the server
wrote it** — now the band's day. That preserves the #116 invariant (no zone
maths on the client, so the `client:idle` islands render the same in the UTC
build container and in the visitor's browser) and fixes an edge the current
code has: a post published at 00:30 Warsaw time is dated *that* day, not the
UTC day before.

### 2. Publication rule

```php
// api/app/Models/Post.php
public function scopePublished(Builder $q): Builder
{
    return $q->whereNotNull('published_at')->where('published_at', '<=', now());
}

public function isPublished(): bool
{
    return $this->published_at !== null && $this->published_at->lte(now());
}
```

`PostController::show()` swaps `abort_if($post->published_at === null, 404)`
for `abort_if(! $post->isPublished(), 404)`. Nothing else changes: the
public list, search, `PressReleaseController::show()`'s post links and the
Astro build (which reads those endpoints anonymously) all go through the
scope already. A future-dated post 404s and is left out of the build,
indistinguishable from a draft or a post that never existed.

Both resources gain a computed `status` field — `'draft' | 'scheduled' |
'published'` — so the admin never compares clocks itself. It is derived from
the model (`null` → draft, future → scheduled, else published) using server
`now()`.

`GET /api/admin/posts` and `/api/admin/posts/{post}` keep returning
everything; that is the point of the #117 split.

### 3. The clock — `posts:publish-scheduled`

A new `App\Console\Commands\PublishScheduledPosts` (`posts:publish-scheduled`),
registered in `routes/console.php`:

```php
Schedule::command('posts:publish-scheduled')->everyMinute()->withoutOverlapping();
```

It is run by `php artisan schedule:work` as a fourth supervisord program in
`api/docker/supervisord.conf`, shaped like `queue-worker` (user `www-data`,
`autorestart=true`, stdout/stderr to the container log, `priority=40`).
Same image serves dev and prod, so both get it with no compose change. The
`--target test` stage never starts supervisord, which is fine: tests invoke
the command directly.

Each tick:

1. **Read the watermark.** `SiteSetting::get('scheduled_posts_checked_at')`.
   On first run it is null: set it to `now()` and stop. The clock *starts*;
   it does not replay history (every already-past post is already live).
2. **Find posts that crossed into publication since then:**

   ```sql
   published_at > :watermark
   AND published_at <= NOW()
   AND updated_at   <  published_at
   ```

   The third clause is what makes the tick precise. A post whose last save
   happened *after* its publish time was published by the editor, and that
   save already called `SiteRebuild::markDirty('posts')` — counting it again
   would fire a second, pointless rebuild. A post saved *before* its publish
   time is one only the clock can publish.

3. **If any crossed:** `SiteRebuild::request()` then `clearPending()`. The
   `auto_rebuild` setting is **not** consulted (decision above). Log the ids
   at `info`, so `docker logs bandms_backend` shows what fired and when.
4. **Advance the watermark to the tick's `now()`** — but only if step 3 was
   not needed *or* succeeded. `SiteRebuild::request()` grows a `bool` return:
   `true` when the webhook *answered* — a `202 started`, or a `409 building`,
   which means a build is in flight that reads the API *after* the post
   crossed, so the post is in it; `false` on the swallowed-exception path
   (unreachable, timed out) and on any 5xx. A webhook that could not be
   reached leaves the watermark where it was, so the same window is retried
   next minute rather than lost.

The watermark is the API's own row, not the `web` container's in-memory
`startedAt`, which vanishes on every restart.

Edits need no bookkeeping. Rescheduling a post into the future takes it out
of every future window until its new time; moving it into the past is an
ordinary save, published by `markDirty`. Unscheduling (clearing the date)
is a draft. Deleting it is nothing.

`withoutOverlapping()` takes its lock from the cache. Production uses
`CACHE_STORE=database` and dev uses the `file` driver (note dev's compose
still sets the pre-Laravel-11 `CACHE_DRIVER` name, so it actually falls
back to `config/cache.php`'s `database` default — either way the store is
shared by php-fpm and the scheduler process). If it were ever `array` the
lock would be a no-op, which is harmless here: a second tick just finds
nothing new.

### 4. Admin

- `PostsAdminView.vue` status column: `Draft` (grey, as today) / `Scheduled
  · 18 Sep 10:00` (amber) / the date (green). Filters read `status`, not
  `!!published_at`; the status `<select>` gains a *Scheduled* option. The
  *Published* sort key stays `published_at`.
- `SiteRebuildController::rebuildStatus()` adds `schedulerCheckedAt` (the
  watermark, ISO or null). `useSiteRebuild` already polls it.
- `PostsAdminView.vue` shows one warning line — *"Scheduled posts won't go
  live: the scheduler hasn't checked in since …"* — when at least one row is
  `scheduled` **and** `schedulerCheckedAt` is null or older than five
  minutes. The failure mode "the supervisord program is missing or crashed"
  is otherwise perfectly silent, and this is the screen where it matters.
- `PostForm.vue` gains a hint under the date input: *"Band time
  (Europe/Warsaw). Leave empty to keep as draft; a future time schedules
  it."* The zone name comes from `GET /api/site-config` (`band_timezone`),
  which the admin already fetches for modules.

No other admin change. `BatchPhotoUpload.vue`, `PressReleaseForm.vue` and
`MusicVideosAdminView.vue` carry their own `published_at` and are out of
scope.

### 5. Public site

Beyond the `parseApiDate` regex, nothing. `PostDetail.astro`, `PostCard.astro`,
`NewsFilter.vue` and the JSON-LD `datePublished` keep reading
`post.published_at ?? post.created_at`; the value is now band-zone ISO with
an offset, which is valid for `<time datetime>` and schema.org as-is.

### 6. Data

No migration. The one existing row shape (`published_at` nullable datetime,
UTC) is already right. Existing rows keep their UTC instant; only their
*presentation* moves to the band's zone, which for every post dated by the
#117 backfill (stamped from `created_at`) is the correct instant anyway.

### 7. Failure modes considered

| Failure | Behaviour |
|---|---|
| Scheduler process not running | Nothing publishes on the clock. Admin warning (§4) after 5 min; `supervisorctl status scheduler` in the backend container confirms. Next admin save still publishes everything due, because `markDirty` rebuilds against the scope. |
| Webhook unreachable at the tick | Watermark not advanced; retried every minute until it succeeds. |
| Rebuild already in flight at the tick | Webhook answers 409; treated as success (the running build reads post-crossing data). |
| Two ticks overlap | `withoutOverlapping()`; and the query is idempotent anyway. |
| Backend restarted between ticks | Watermark is in the DB; the next tick covers the whole gap in one query. |
| `BAND_TIMEZONE` unset in prod | Falls back to `UTC` — the current behaviour, not a crash. `config/app.php` validates nothing; an invalid name throws from Carbon on the first save, which is loud and correct. |

## Alternatives considered

**Delayed queue job dispatched on save.** Saving a future-dated post would
`dispatch(new PublishScheduledPost($post))->delay($post->published_at)`; the
existing `queue-worker` runs it. Attractive — no new process, precise to the
worker's 3-second sleep — but every reschedule leaves a stale job behind, a
job that fails `--tries=3` times (webhook down for a few minutes) is *dead*
and the post silently never goes live until someone edits something, and
posts scheduled before the feature ships have no job at all. The watermark
command is stateless with respect to edits and self-heals.

**Host cron calling `schedule:run`.** Works, but puts a piece of the stack
outside `docker-compose.prod.yml`, where nothing else lives; the deploy
workflow would not know about it.

**Converting the timezone in the admin (browser zone or a stored setting).**
Rejected in favour of the API boundary doing it: the admin form then needs
no date code at all, and the value every client sees is the wall-clock time
the band means.

## Testing

**Pest (`api/tests/Feature`)**

- `PostVisibilityTest` grows cases: a post dated one hour ahead is absent
  from the public list, search and press-release links and 404s on detail;
  present on the admin routes with `status: scheduled`; a post dated one
  minute ago is `published`; null is `draft`.
- `PostPublishedAtTimezoneTest`: with `band_timezone=Europe/Warsaw` and a
  frozen summer date, `POST` with `published_at: "2026-07-01T10:00"` stores
  `08:00:00` UTC and the resource echoes `2026-07-01T10:00:00+02:00`;
  `2026-07-01T10:00:00Z` is stored as sent; `null` stays null; the same for
  `PUT`.
- `PublishScheduledPostsCommandTest` (`Carbon::setTestNow`, `Http::fake()`
  for the webhook):
  - first run sets the watermark and posts no rebuild;
  - post created at T, dated T+1 min, tick at T+2 → one `POST
    http://web:3001/rebuild`, watermark = T+2, pending areas cleared;
  - nothing due → no request, watermark advanced;
  - post dated T−5 min but saved at T (`updated_at > published_at`) → skipped;
  - webhook fake returns a connection exception → no advance; next tick with
    a healthy fake → request fires, advances;
  - webhook returns 409 → advances;
  - `auto_rebuild = false` → still requests.

**Vitest (`web/src/lib/i18n.test.ts`)**

- `parseApiDate` / `fmtDateParts` on `2026-09-18T00:30:00+02:00` and
  `…-05:00` return the written day under `Europe/Warsaw`,
  `America/Los_Angeles`, `Asia/Tokyo` and `UTC`.

**Playwright, admin (`app/e2e/tests/admin/posts.spec.ts`)**

- Setting a date a year ahead shows *Scheduled* in the row; the *Scheduled*
  filter shows it and *Published* does not; clearing the date shows *Draft*.

**Playwright, public (`app/e2e/tests/public/news-scheduled.spec.ts`,
`describe.serial`, `test.slow()`)**

- Seed a post via the admin API dated **now + 70 s** (band-zone string).
  `rebuildAndWait` → its URL 404s and it is absent from `/en/news/`. Then
  poll the URL every 10 s for up to 3 min until it answers 200; assert it is
  in the list. This is the only test that proves the whole promise —
  scheduler process, command, webhook, build — and costs ~2–3 min of the
  suite. Seed one post more than a minute out so the first rebuild cannot
  race the scheduler's tick.
- `afterAll` deletes the post and `rebuildAndWait`s, per the *E2E specs that
  write to the dev database must restore it* rule.

Every `published_at` string the specs send is band-zone naive, the way the
form sends it.

## Documentation

- `CLAUDE.md`: rewrite the *"`published_at` is a switch, not a timer"*
  paragraph under *A post with no `published_at` is a draft* to describe the
  timer, the band-zone boundary (naive in → band zone; out → band-zone ISO;
  storage UTC), the `updated_at < published_at` clause, and the triage line
  *"Scheduled posts not going live → `docker exec bandms_backend
  supervisorctl status scheduler`, then the admin's scheduler warning."*
- `TODO.md`: drop the *Scheduled news posts — not possible yet* section.
- `CHANGELOG.md`: *Added* entry.

## Implementation order

Each step leaves the suite green.

1. `BAND_TIMEZONE` plumbing (compose ×2, `.env.example`, `config/app.php`),
   `site-config` exposure. Tests: config read.
2. Request normalisation + resource serialisation + `status` field + web
   `parseApiDate` widening. Tests: timezone Pest, vitest.
3. Scope `<= now()`, `isPublished()`, `show()`. Tests: visibility cases.
   *(Ship 3 only together with 4 — the clause alone hides a scheduled post
   until the next unrelated admin save.)*
4. Command + `SiteRebuild::request(): bool` + `routes/console.php` +
   supervisord program. Tests: command cases.
5. Admin: status column, filter, form hint, `schedulerCheckedAt` + warning.
   Tests: admin E2E.
6. Public E2E, docs, changelog.
