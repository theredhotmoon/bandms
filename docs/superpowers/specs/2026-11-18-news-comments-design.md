# Comments on news posts — design

Date: 2026-11-18. Branch: `feature/news-comments`.

## Intent

Fans can comment under a news post on the public site. The band wants a
conversation under its news without spam and without daily moderation work.

## Decided by the band

- **Only verified fans can comment.** Verification is the fan account that
  already exists: email → magic link → 30-day session (`FanAccountController`,
  `FanAuth`).
- **A comment is published immediately.** No approval queue.
- **Flat list.** No replies, no threading.

## Goals

- A signed-in fan writes a comment under a post and sees it at once.
- A visitor who is not signed in can sign in from the post and comes back to
  the same post.
- The band can hide, delete, and block a fan from commenting, in the admin.
- The band hears about a new comment without opening the admin.
- Comments can be switched off per post.

## Non-goals (v1)

- Replies, reactions, likes, mentions, editing a comment after posting.
- Rich text, links rendered as links, images. A comment is plain text.
- Comments on anything but news posts (concerts, releases, albums).
- Pre-moderation, word filters, captcha.
- A global "comments off" switch. Per-post only; revisit if asked.
- Pagination. All visible comments of a post are returned in one response.

## Anti-goals

- **A comment must never trigger a public-site rebuild.** The site is static;
  comments are read and written at runtime.
- **No part of a fan's email may appear publicly.** `fan_accounts.name`
  defaults to the email's local part (`requestMagicLink`), so it must not be
  the public author name.
- A failed notification mail must never fail the comment.

## Approaches considered

1. **Runtime island + own API (chosen).** A Vue island on the post page
   fetches and posts comments against the Laravel API, authenticated with the
   fan session token already in `localStorage` (`fan_token`, same origin
   behind Caddy). Fits the static site, reuses fan accounts, keeps the data
   with the band.
2. **Bake comments into the page at build time.** Ruled out: every comment
   would need a rebuild, and "published immediately" would mean minutes.
3. **Third-party widget (Disqus, Facebook comments).** Ruled out: its own
   login contradicts "verified fan accounts", it adds trackers and a consent
   entry, and the band does not own the data.

## Design

### Data

New table `post_comments`:

| Column | Notes |
|---|---|
| `id` | |
| `post_id` | FK → `posts`, cascade on delete |
| `fan_account_id` | FK → `fan_accounts`, cascade on delete |
| `body` | text, 1–2000 chars after trim, plain text |
| `hidden_at` | nullable timestamp; set = not shown publicly |
| timestamps | |

Index on `(post_id, created_at)`.

`fan_accounts` gains:

- `display_name` — nullable string, max 50. The public author name. Asked for
  the first time a fan comments; never derived from the email.
- `comments_blocked_at` — nullable timestamp. Set = this fan cannot comment
  and their existing comments are not shown publicly.

`posts` gains `comments_enabled` — boolean, default `true` (existing posts
get `true`). Served on the public post resource; the post editor has a
checkbox. Saving a post already marks `posts` dirty, so the switch reaches
the baked page through the normal rebuild.

Model `PostComment`, added to `ActivityRecorder::PERSONAL` (holds a
non-user's personal data). `post_comments` is prod-only in
`scripts/prodsync/tables.py`, like `fan_accounts`.

### API

Public:

- `GET /api/posts/{post}/comments` — published posts only (404 for a draft).
  Returns visible comments, oldest first:
  `{ data: [{ id, author_name, body, created_at, mine }], enabled }`.
  Visible = `hidden_at` null and the author not blocked. `mine` is true when
  the request carries a valid fan token belonging to the author; the token is
  optional here, and an invalid one is treated as absent, not as a 401.
  When `comments_enabled` is false: `enabled: false` and an empty list.
  Never cached by the build; the island calls it in the browser.

Fan (`fan.auth`):

- `POST /api/fan/posts/{post}/comments` `{ body, display_name? }` — own
  throttle prefix `fan-comment`, 5 per minute. `display_name` is required
  when the fan has none, and is saved on the fan; ignored otherwise.
  404 for a draft; 403 when comments are off for the post or the fan is
  blocked. Returns the created comment in the list shape.
- `DELETE /api/fan/comments/{comment}` — own comment only (404 otherwise).
  Hard delete.
- `GET /api/fan/me` additionally returns `display_name` and
  `comments_blocked` (boolean).

Sign-in return: `POST /api/fan/auth/magic-link` accepts an optional
`return_to`. It is kept only when it is a site-relative path (starts with one
`/`, no `//`, no backslash, no scheme, max 300 chars); anything else is
dropped silently. The emailed link becomes
`/account?token=…&return=<path>`; `FanAccountView` signs the fan in as today
and then navigates to that path (same validation again on the client, full
page navigation because the post is served by Astro, not the SPA).

Admin (Passport, same guard as the other admin routes):

- `GET /api/admin/comments` — newest first, paginated 50, optional
  `post_id`; each row carries post id + title, fan id, display name, email,
  body, `hidden_at`, fan `comments_blocked_at`.
- `PUT /api/admin/comments/{comment}` `{ hidden: bool }`.
- `DELETE /api/admin/comments/{comment}`.
- `PUT /api/admin/fan-accounts/{fan}/comments-block` `{ blocked: bool }`.

Messages a fan can read (403, validation) go through `lang/` like the other
fan errors (`api.fan.*`), in en and pl.

### Notification

On each new comment, a queued mail to every superadmin: post title, author
display name, the comment text, a link to the admin comments page built from
`config('assistant.admin_path')`-style config (`ADMIN_PATH`) and
`FRONTEND_URL`. Sent after the response; a failure is logged and nothing
else. No switch in v1.

### Public site

`web/src/components/PostComments.vue`, mounted in `PostDetail.astro` below
the article, `client:visible`, rendered only when the baked post has
`comments_enabled`. Props: post id, locale, the current path, and a
`PostCommentsCopy` object shaped from `POSTS_COPY` (new `CopyField`s, en + pl
defaults, group "Comments"; keys are permanent once shipped).

States:

```
Comments (3)
  Ania · 12 Nov 2026
  Great show in Kraków!                       [Delete]   ← only on `mine`
  …

signed out:   [ email ] [Send me a sign-in link]
              → "Check your inbox — the link brings you back here."
signed in:    Name shown publicly: [      ]   ← only while display_name is empty
              [ textarea, 2000 max, counter ]
              [Post comment]            Signed in as a@b.c · Sign out
blocked:      "You can't comment on this site."
disabled by API (`enabled: false`): the whole block renders nothing
no comments:  "No comments yet. Be the first."
```

- Reads `fan_token` / `fan` from `localStorage` (the keys `useFanAccount`
  writes), guarded with try/catch; a 401 from a fan endpoint clears them and
  falls back to the signed-out state.
- Comment text is rendered as text (never `v-html`), line breaks preserved
  with CSS `white-space: pre-line`.
- A posted comment is appended from the POST response; no refetch needed.
- Delete asks for a second click within 3 s (no browser `confirm`).
- Styling uses semantic tokens only; the block sits in the article's reading
  column.
- The post page anchor is `#comments`; `return_to` includes it.

### Admin

- New page **Comments** (`adminUrl('comments')`), in the nav group that holds
  News. Table: date, post (link to its editor), author (display name +
  email), text, status. Row actions: Hide / Show, Delete, Block fan /
  Unblock fan. Filter by post. Strings through the admin i18n catalogue
  (en + pl).
- Post editor: "Allow comments" checkbox.
- Route added to `app/src/router/index.ts`; it lives under the admin prefix,
  so the Caddy `@spa` matcher needs no change.

### Privacy

A comment and a display name are personal data. Deleting a fan account
cascades to their comments. The privacy policy text is the band's to update;
the default policy copy in `packages/site-copy/src/modules/privacy.ts` gets
one sentence saying that a comment is shown publicly with the chosen name.

## Tests

- **Pest:** list (visible only, hidden and blocked excluded, draft 404,
  disabled post, `mine` with/without/invalid token); create (auth, blocked,
  disabled, validation, display name required once and saved, throttle
  prefix); fan delete (own vs someone else's); admin endpoints (auth,
  hide/show, delete, block); `return_to` validation; notification mail
  queued and its failure not failing the request; `PostComment` logged
  without values.
- **Vitest (`web/src/lib/*.test.ts`):** pure helpers — `return_to` path
  validation mirror, session read from storage.
- **Playwright admin:** comments page hide/show/delete/block; post editor
  checkbox.
- **Playwright public:** signed-in fan posts a comment and sees it; signed
  out sees the sign-in form; a post with comments off shows no block. The
  spec obtains a fan session without mail (see "Left to the builder").

## Left to the builder

- How E2E obtains a fan session: `APP_DEBUG` is `false` in the dev stack, so
  the magic-link response carries no `dev_link`. Follow whatever
  `fan-accounts.spec.ts` already does (an artisan seed command exists for
  E2E tickets); extend it rather than inventing a second path.
- Exact copy wording and key names in `POSTS_COPY`.
- Component split inside the island and the admin page (composable/api/type
  files follow `app/CLAUDE.md`).
- Whether optional fan resolution on the public GET is a small middleware or
  a helper shared with `FanAuth`.

## Calls made after the builder check (mine, not the band's)

- **Moderation is admin-only.** The comments list shows fan emails and can
  block a fan, so its routes sit in the admin-only group and the nav entry
  is hidden from publishers. A publisher can still tick "Allow comments" on
  a post, because that is part of the post form.
- **A fan can change their display name**: `PUT /api/fan/me`
  `{ display_name }`, offered in the island next to "Signed in as". The new
  name shows on all their comments. Names need not be unique. A name equal
  to the band's name (`band_profiles.name`, compared case-insensitively
  after trim) is rejected with 422, on first comment and on change.
- **The band commenting as the band is a non-goal in v1.** A member comments
  from an ordinary fan account.
- **A hidden comment, or any comment by a blocked fan, disappears for
  everyone, the author included.** No "hidden" marker. A blocked fan sees
  the blocked message in place of the form.
- (Superseded by the band, 2026-11-19: see "Changed after review" below.)
- E2E specs live under `app/e2e/tests/`; `PurgeE2eFixtures` already purges
  `e2e-%` fans, so E2E fans use that prefix.

## Changed after review (decided by the band, 2026-11-19)

- **A per-fan comment limit the band can set.** "One fan may post at most N
  comments in M minutes", edited on the admin Comments page, stored in
  `site_settings`, default 5 in 10 minutes, bounds 1–100 comments and
  1–1440 minutes. Counted per fan account. Over the limit: 429 with
  `code: comment_limit` and a localised message saying how long to wait.
  Replaces the fixed `throttle:5,1` as the real brake; the route throttle
  stays at 30 a minute as a backstop.
- **The notification is delayed two minutes and gathered per post.** One
  mail per superadmin for everything posted on a post since the first new
  comment, instead of one mail per comment. This replaces "On each new
  comment, a queued mail" in the Notification section above.
- **The sign-in return path is followed only in the browser that asked for
  the link** (a `fan_return_to` note in `localStorage`, used once). Found in
  review: without it, a sign-in link sent to someone else signed them in as
  the sender and forwarded them to an article unnoticed.
