# News Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verified fans comment under news posts; comments publish at once, in a flat list, with admin moderation.

**Architecture:** A `post_comments` table and a `PostCommentController` in the Laravel API; a Vue island on the Astro post page reads and writes it at runtime with the fan session token from `localStorage`; an admin page moderates. Nothing here triggers a site rebuild except the per-post switch, which rides the post save.

**Tech Stack:** Laravel 11 + Pest, Vue 3 admin (TanStack Query, vue-i18n), Astro + Vue island, `@bandms/site-copy`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-news-comments-design.md`

## Global Constraints

- Comment body: plain text, 1–2000 chars after trim. Display name: 1–50 chars after trim, not equal to `band_profiles.name` (case-insensitive).
- Fan-readable messages go through `lang/{en,pl}/api.php` under `fan.*`.
- Fan routes carry an explicit throttle prefix (`throttle:5,1,fan-comment`).
- Admin moderation routes sit in the `role:admin` group; admin URLs through `adminUrl()`.
- Public components use semantic tokens only; copy through `POSTS_COPY` props; no `v-html` for comment text.
- `app/` unit specs are `*.spec.ts` under `src/utils`; `web/` unit tests are `*.test.ts` under `src/lib`.
- One commit, one push for the PR; Conventional Commits.

## Review Focus

1. A stale or garbage `fan_token` in `localStorage` on the public GET → list still loads, `mine` false (Task 2 test).
2. `return_to` carrying `//evil.example`, `/\evil`, `https://…` → dropped server-side and client-side (Task 3 tests).
3. A fan with no display name posting whitespace-only name or body → 422, nothing saved (Task 2 test).
4. A blocked fan's own older comments → gone for everyone, including in their own GET (Task 2 test).
5. Notification mail throwing → comment still 201 (Task 4 test).

---

### Task 1: Schema and models

**Files:**
- Create: `api/database/migrations/2026_11_18_000001_create_post_comments.php` (table + `fan_accounts.display_name`, `fan_accounts.comments_blocked_at`, `posts.comments_enabled` default true)
- Create: `api/app/Models/PostComment.php`, `api/database/factories/PostCommentFactory.php`
- Modify: `api/app/Models/FanAccount.php`, `api/app/Models/Post.php`, `api/app/Http/Resources/PostResource.php`, `Store/UpdatePostRequest`, `PostController` (store/update/list columns), `ActivityRecorder::PERSONAL`, `scripts/prodsync/tables.py`
- Test: `api/tests/Feature/PostCommentTest.php` (schema part)

**Interfaces — produces:**
- `PostComment` (`post()`, `fan()`; `scopeVisible()` = `hidden_at` null and fan `comments_blocked_at` null)
- `Post::comments()`, `FanAccount::comments()`, `FanAccount::isCommentBlocked(): bool`
- `PostResource` / summary: `comments_enabled: bool`

- [ ] Tests: post resource carries `comments_enabled`; update persists `false`; deleting a fan or post removes its comments; `PostComment` activity row has no label/value.
- [ ] Implement; run `--filter PostCommentTest`.

### Task 2: Public list and fan endpoints

**Files:**
- Create: `api/app/Http/Controllers/PostCommentController.php`, `api/app/Http/Resources/PostCommentResource.php`, `api/app/Support/FanSession.php`
- Modify: `api/routes/api.php`, `FanAccountController` (`me` adds `display_name`, `comments_blocked`; `updateMe`), `FanAuth` (use `FanSession`), `api/lang/{en,pl}/api.php`
- Test: `api/tests/Feature/PostCommentTest.php`

**Interfaces — produces:**
- `FanSession::fan(Request): ?FanAccount` (null on absent/invalid token, never aborts)
- `GET /api/posts/{post}/comments` → `{data: [{id, author_name, body, created_at, mine}], enabled}`
- `POST /api/fan/posts/{post}/comments {body, display_name?}` → 201 `{data: comment}`
- `DELETE /api/fan/comments/{comment}` → 204
- `PUT /api/fan/me {display_name}` → fan payload
- Lang keys: `api.fan.comments_disabled`, `api.fan.comments_blocked`, `api.fan.display_name_reserved`

- [ ] Tests per spec's Pest list plus Review Focus 1, 3, 4.
- [ ] Implement; run filter.

### Task 3: Sign-in return path

**Files:**
- Create: `api/app/Support/ReturnPath.php` (`ReturnPath::clean(?string): ?string`), `app/src/utils/returnPath.ts` + `returnPath.spec.ts`
- Modify: `FanAccountController::requestMagicLink` (appends `&return=` urlencoded), `app/src/views/FanAccountView.vue` (after `setSession`, `window.location.assign(path)` when `cleanReturnPath(route.query.return)` is non-null), `app/src/api/fan.ts` (`requestMagicLink(email, name?, returnTo?)`)
- Test: `FanAccountTest.php`, `returnPath.spec.ts`, extend `app/e2e/tests/public/fan-sign-in-link.spec.ts`

Rule (both sides): string, ≤300 chars, starts with `/`, second char not `/` or `\`, no `\` anywhere, no control chars.

- [ ] Tests (Review Focus 2), implement, run.

### Task 4: Notification mail

**Files:**
- Create: `api/app/Mail/NewPostComment.php`, `api/resources/views/emails/new-post-comment.blade.php`
- Modify: `PostCommentController::store` (queue to each `is_superadmin` user inside try/catch + `Log::warning`)
- Test: `PostCommentTest.php` (`Mail::fake` queued to superadmins only; Review Focus 5)

Link: `rtrim(config('newsletter.frontend_url'),'/') . '/' . config('assistant.admin_path') . '/comments'`.

### Task 5: Admin API and page

**Files:**
- Create: `api/app/Http/Controllers/AdminCommentController.php`; `app/src/api/comments.ts`, `app/src/types/comment.ts`, `app/src/composables/useAdminComments.ts`, `app/src/views/admin/CommentsAdminView.vue`
- Modify: `api/routes/api.php` (role:admin group), `app/src/router/index.ts`, `AdminLayout.vue` (content group, admin-only), i18n catalogues en/pl (+ `documentTitle.ts`), `PostForm.vue` + `app/src/types/post.ts` + posts api payload (`comments_enabled`)
- Test: `api/tests/Feature/AdminCommentTest.php`

**Interfaces — produces:**
- `GET /api/admin/comments?post_id=&page=` (paginated 50, newest first; rows `{id, body, created_at, hidden_at, post: {id, title}, fan: {id, display_name, email, comments_blocked_at}}`)
- `PUT /api/admin/comments/{comment} {hidden}`; `DELETE /api/admin/comments/{comment}`; `PUT /api/admin/fan-accounts/{fan}/comments-block {blocked}`

- [ ] Pest: auth (guest 401, publisher 403), each action. Implement API, then UI; `pnpm build` in `app/`.

### Task 6: Public island

**Files:**
- Create: `web/src/components/PostComments.vue`, `web/src/lib/comments.ts` (fetch helpers, `readFanSession()`, `cleanReturnPath()`), `web/src/lib/comments.test.ts`
- Modify: `web/src/components/detail/PostDetail.astro` (mount `client:visible` in an `ar-col` section with `id="comments"`, before "more from the blog", only when `post.comments_enabled !== false`), `web/src/types/post.ts`, `web/src/lib/copy.ts` (`postCommentsCopy()`), `packages/site-copy/src/modules/posts.ts` (group "Comments"), `packages/site-copy/src/modules/privacy.ts` (one sentence)

Copy keys (permanent): `commentsTitle`, `commentsEmpty`, `commentsSignInLead`, `commentsEmailLabel`, `commentsSendLink`, `commentsLinkSent`, `commentsNameLabel`, `commentsBodyLabel`, `commentsSubmit`, `commentsSignedInAs` (`{email}`), `commentsSignOut`, `commentsDelete`, `commentsDeleteConfirm`, `commentsBlocked`, `commentsError`, `commentsChangeName`, `commentsSaveName`.

Test ids: `post-comments`, `comment-item`, `comment-form`, `comment-body`, `comment-name`, `comment-submit`, `comment-signin`, `comment-delete`.

- [ ] Vitest for helpers; build with `API_BASE=http://localhost:8081 pnpm build`; check `dist/` for the island and no `undefined`.

### Task 7: E2E

**Files:**
- Create: `api/app/Console/Commands/SeedE2eFanSession.php` (`e2e:seed-fan-session --force` → JSON `{fan_id, email, token}`; fan email `e2e-fan-…@bandms.test`), `seedFanSession()` in `app/e2e/fixtures/seed.ts`
- Create: `app/e2e/tests/public/post-comments.spec.ts`, `app/e2e/tests/admin/comments.spec.ts`
- Modify: `PurgeE2eFixtures` only if comments are not removed by the fan cascade.

Public spec: signed-out sees sign-in form; seeded session in `localStorage` → posts a comment with a display name, sees it, deletes it. Admin spec: seed a comment through the API with the fan token, hide/show, block/unblock, delete; clean up.

### Task 8: Ship

- [ ] `CLAUDE.md` section + `CHANGELOG.md` entry.
- [ ] `bash rebuild.sh`; `docker compose build web && docker compose up -d web`; `bash scripts/test-all.sh`.
- [ ] `/code-review`, fix, squash into one commit, push once, open PR.
