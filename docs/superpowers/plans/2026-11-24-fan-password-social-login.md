# Fan sign-in: passwords, Google and Facebook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fan can sign in with a saved password or with Google / Facebook, beside the emailed link, and stays signed in for months.

**Architecture:** Fan sessions move from cache entries to a `fan_sessions` table behind the existing `App\Support\FanSession`. Every way of signing in ends in the same place: either a session opened directly (password) or the existing single-use `fan_magic` token exchanged by `/account?token=…` (link, register, social). A browser-made *claim* decides whether a parked password or provider identity may be applied by that exchange.

**Tech Stack:** Laravel 11 + Pest (`api/`), `laravel/socialite` (PR 2), Vue 3 SPA + vitest (`app/`), Astro + Vue island + vitest (`web/`), `@bandms/site-copy`, Playwright (`app/e2e`).

**Spec:** `docs/superpowers/specs/2026-11-24-fan-password-social-login-design.md` — read it first; this plan argues from it.

## Global Constraints

- **Two PRs.** Tasks 1–9 are PR 1 (`feature/fan-password-social-login`). Tasks 10–13 are PR 2 (`feature/fan-social-login`, branched from `main` after PR 1 merges). Commit locally per task; **squash to one commit and push once per PR** (`git reset --soft main && git commit`), Conventional Commits, `CHANGELOG.md` entry in that commit, `/code-review` before the push.
- An unproven email never yields a session. A parked password / identity is applied only with its matching claim.
- Register and failed sign-in answer identically for a known and an unknown email.
- No third-party script or asset on the public site. Provider buttons are plain links with inline SVG.
- Deploying signs nobody out: legacy `fan_session:{token}` cache entries keep working.
- Password: 8–72, no composition rules, no `uncompromised()`.
- Session lifetime 180 days sliding (`config('fan_auth.session_days')`), written at most once a day.
- Nothing calls `SiteRebuild::markDirty`. Nothing in tests reaches Google, Facebook or a real mailbox (`Mail::fake()`, Socialite mocked, `page.route`).
- `web/src`: semantic tokens only (`pnpm build` runs the token lint); every new string is a `CopyField` reaching the island through props. `app/`: every string is a `fan.*` key in **en and pl**; specs are `*.spec.ts`. `web/`: `*.test.ts`. API messages: `api/lang/{en,pl}/api.php` under `fan.*`.
- Backend env vars go in the `environment:` map of **both** `docker-compose.yml` and `docker-compose.prod.yml`.
- New tables are prod-only in `scripts/prodsync/tables.py`.

**Running tests**

```bash
# backend, one file (from repo root)
docker build --target test -t bandms_test ./api
APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
docker run --rm -e APP_ENV=testing -e APP_KEY="$APP_KEY" bandms_test --filter FanSessionTest
# unit suites
cd app && pnpm test:unit        # *.spec.ts
cd web && pnpm test:unit        # *.test.ts
# one E2E file
cd app && pnpm exec playwright test e2e/tests/public/fan-password.spec.ts
# everything before shipping
bash scripts/test-all.sh
```

## Review Focus

1. **Email typed in another case** (`Fan@Example.com` vs `fan@example.com`): login, register and social must land on the same account — MySQL's collation hides this, SQLite in tests does not. → Task 2.
2. **A password over 72 bytes in under 72 characters** (40 × `ż`): must be refused, not silently truncated by bcrypt. → Task 2.
3. **The sign-in link opened twice** (mail client prefetch, double click): the second exchange is a clean 401 and must not have consumed the claim's effect or left a half-applied password. → Task 4.
4. **`localStorage` or `crypto.subtle` unavailable** (private mode, http on a LAN address): register and social still work as plain sign-in, no claim, no thrown error. → Task 5.
5. **The provider callback loaded twice / with a stale state** (back button, a 10-minute-old tab): redirect to `/account?auth_error=failed`, never a 500. → Task 11.

---

# PR 1 — durable sessions and passwords

### Task 1: Sessions in the database

**Files:**
- Create: `api/database/migrations/2026_11_24_000001_create_fan_sessions.php`, `api/app/Models/FanSessionRow.php`, `api/config/fan_auth.php`, `api/tests/Feature/FanSessionTest.php`
- Modify: `api/app/Support/FanSession.php`, `api/app/Http/Middleware/FanAuth.php`, `api/app/Http/Controllers/FanAccountController.php` (`verifyMagicLink`, `logout`), `api/app/Console/Commands/SeedE2eFanSession.php`, `api/app/Support/Activity/ActivityRecorder.php` (skip `FanSessionRow`), `api/tests/Pest.php`, `scripts/prodsync/tables.py`
- Modify (mechanical): every `Cache::put("fan_session:…")` in `api/tests/Feature/{FanAccountTest,FanMessageLocaleTest,PostCommentTest,TicketTransferTest}.php` → `fanToken($fan)`

**Interfaces — Produces:**
- Table `fan_sessions`: `id`, `fan_account_id` (FK cascade), `token_hash` char(64) unique, `method` string(16), `last_used_at`, `expires_at` (indexed), `created_at`.
- `App\Models\FanSessionRow` (`$table = 'fan_sessions'`, no `updated_at`).
- `config('fan_auth.session_days')` = 180.
- `FanSession::METHODS = ['link', 'password', 'google', 'facebook']`
- `FanSession::open(FanAccount $fan, string $method): string` — raw 64-char token; stores `hash('sha256', $token)`; deletes that fan's expired rows.
- `FanSession::fan(Request $request): ?FanAccount` — unchanged signature.
- `FanSession::current(Request $request): ?FanSessionRow` — the row behind the Bearer token (after legacy migration), or null.
- `FanSession::close(Request $request): void` — deletes the row and forgets the legacy key.
- `FanSession::revokeOthers(FanAccount $fan, ?FanSessionRow $keep): void` — deletes the fan's other rows and puts `fan_legacy_revoked:{fan_id}` in the cache for 31 days.
- `FanAuth` additionally sets request attribute `fan_session` (`FanSessionRow`).
- Pest helper `fanToken(FanAccount $fan, string $method = 'link'): string` in `tests/Pest.php`.
- `e2e:seed-fan-session` output unchanged; token now from `FanSession::open`.

- [ ] **Step 1: Write `FanSessionTest.php` (failing)**

```php
it('opens a session that /fan/me accepts and stores only the hash', function () {
    $fan = FanAccount::factory()->create();   // add a factory if none exists
    $token = FanSession::open($fan, 'password');
    $this->withToken($token)->getJson('/api/fan/me')->assertOk();
    $row = FanSessionRow::sole();
    expect($row->token_hash)->toBe(hash('sha256', $token))->and($row->method)->toBe('password');
    expect($row->expires_at->diffInDays(now(), true))->toBeGreaterThan(179);
});
it('refuses an expired session', …);                       // expires_at in the past → 401
it('slides the expiry once a day, not on every request', function () {
    // open; travel 2 days; request → expires_at moved, last_used_at = now
    // request again same day → row untouched (compare updated values)
});
it('still accepts a legacy cache session and moves it into the table', function () {
    Cache::put('fan_session:legacy-token', $fan->id, now()->addDays(30));
    $this->withToken('legacy-token')->getJson('/api/fan/me')->assertOk();
    expect(Cache::get('fan_session:legacy-token'))->toBeNull();
    expect(FanSessionRow::where('token_hash', hash('sha256', 'legacy-token'))->value('method'))->toBe('link');
    $this->withToken('legacy-token')->getJson('/api/fan/me')->assertOk();   // now from the table
});
it('refuses a legacy session of a fan whose legacy sessions were revoked', …); // revokeOthers($fan, null) then legacy token → 401
it('revokeOthers keeps the given row and deletes the rest', …);
it('logout deletes the row', …);                            // then /fan/me → 401
it('deletes the sessions with the fan account', …);         // cascade
it('verifying a magic link opens a link session', …);       // method = link, fan_sessions has 1 row
it('opening a session clears that fan\'s expired rows', …);
```

- [ ] **Step 2:** Run `--filter FanSessionTest`. Expected: FAIL (class `FanSessionRow` not found).
- [ ] **Step 3:** Migration, model, config, then `FanSession` per the Interfaces block. Legacy branch order inside `fan()`/`current()`: table hit → else cache hit → refuse if `fan_legacy_revoked:{id}` → else insert row (method `link`, same hash), forget the cache key. Put a comment on the legacy branch: *removable 30 days after this ships* with the date. Sliding write: only when `last_used_at` is not today.
- [ ] **Step 4:** `FanAuth` sets `fan_session`; `verifyMagicLink` and `logout` use `open`/`close`; seed command uses `open($fan, 'link')`; add `FanSessionRow` to the recorder's skipped models; `fan_sessions` to the prod-only list in `tables.py`.
- [ ] **Step 5:** Add `fanToken()` and replace the `Cache::put("fan_session:…")` lines in the four test files. `FanAccountTest`'s logout assertion becomes "row gone".
- [ ] **Step 6:** Run `--filter 'Fan|PostComment|TicketTransfer'`. Expected: all PASS.
- [ ] **Step 7:** Commit `feat(api): keep fan sessions in the database`.

### Task 2: Sign in with a password

**Files:**
- Create: `api/app/Support/FanPassword.php`, `api/app/Http/Controllers/FanAuthController.php`, `api/tests/Feature/FanPasswordLoginTest.php`
- Modify: `api/routes/api.php` (inside `Route::prefix('fan/auth')`), `api/app/Http/Controllers/FanAccountController.php` (`fanPayload` → shared), `api/lang/{en,pl}/api.php`

**Interfaces:**
- Consumes: `FanSession::open`.
- Produces:
  - `FanPassword::rules(): array` — `['required', 'string', 'min:8', 'max:72', <closure refusing strlen() > 72>]`.
  - `FanPassword::normaliseEmail(string $email): string` — `mb_strtolower(trim())`; every fan-auth lookup and create uses it from now on (including `requestMagicLink`).
  - `App\Support\FanPayload::for(FanAccount $fan): array` — the old `fanPayload()` plus `has_password: bool` (and, in Task 10, `providers`). `FanAccountController` calls it.
  - `POST /api/fan/auth/login` `{email, password}` → 200 `{token, fan}`; failure 422 `{message: __('api.fan.login_failed'), code: 'login_failed'}`; over the limit 429 `{message: __('api.fan.login_limit'), code: 'login_limit'}`. Route throttle `throttle:10,1,fan-login`. Per-email limiter key `fan-login:` + sha1 of the normalised email, 10 failures / 900 s, cleared on success.

- [ ] **Step 1: Write the failing tests**

```php
it('signs a fan in with the right password', function () {
    $fan = FanAccount::factory()->create(['email' => 'fan@example.com', 'password_hash' => Hash::make('correct horse')]);
    $res = $this->postJson('/api/fan/auth/login', ['email' => 'fan@example.com', 'password' => 'correct horse'])->assertOk();
    expect($res->json('fan.has_password'))->toBeTrue();
    expect(FanSessionRow::sole()->method)->toBe('password');
    $this->withToken($res->json('token'))->getJson('/api/fan/me')->assertOk();
});
it('answers the same for a wrong password, an unknown email and an account with no password', function () {
    // three requests → each 422, identical json body, code login_failed
});
it('finds the account whatever case the email is typed in', …);   // 'Fan@Example.COM' → 200   (Review Focus 1)
it('stops after 10 failures for one email, from any address', …); // 11th → 429 code login_limit, even with the right password
it('clears the failure count on success', …);
it('never puts password_hash in a response', …);
it('refuses a password longer than 72 bytes', function () {        // Review Focus 2 — exercised through FanPassword::rules()
    expect(Validator::make(['p' => str_repeat('ż', 40)], ['p' => FanPassword::rules()])->fails())->toBeTrue();
    expect(Validator::make(['p' => str_repeat('a', 72)], ['p' => FanPassword::rules()])->passes())->toBeTrue();
    expect(Validator::make(['p' => 'short'], ['p' => FanPassword::rules()])->fails())->toBeTrue();
});
```

- [ ] **Step 2:** Run `--filter FanPasswordLoginTest`. Expected: FAIL (404 on the route).
- [ ] **Step 3:** Implement. Unknown email / null hash: still call `Hash::check($password, <a fixed dummy bcrypt hash>)` so timing matches. Login validates `password` as `required|string|max:200` only — the 8–72 rule is for *setting* one.
- [ ] **Step 4:** Run. Expected: PASS. Also `--filter FanAccountTest` (payload moved).
- [ ] **Step 5:** Commit `feat(api): let a fan sign in with a password`.

### Task 3: Set and change a password

**Files:**
- Create: `api/app/Mail/FanPasswordChanged.php` (+ its text view), `api/tests/Feature/FanPasswordChangeTest.php`
- Modify: `api/app/Http/Controllers/FanAuthController.php`, `api/routes/api.php` (inside the `fan.auth` group, `throttle:10,1,fan-password`), `api/lang/{en,pl}/api.php`, `api/config/fan_auth.php`

**Interfaces:**
- Consumes: request attributes `fan`, `fan_session`; `FanSession::revokeOthers`; `FanPassword::rules`.
- Produces:
  - `config('fan_auth.fresh_link_minutes')` = 15.
  - `PUT /api/fan/me/password` `{password, current_password?}` → 200 `FanPayload`. 422 on `current_password` (`__('api.fan.current_password_wrong')`) when one is required and missing/wrong.
  - `FanPayload` gains `password_needs_current: bool` — true when the account has a password and this session is not a `link` session younger than 15 minutes. (How the UI knows whether to show the field.) `FanPayload::for(FanAccount $fan, ?FanSessionRow $session = null)`.

- [ ] **Step 1: Failing tests**

```php
it('sets a first password from any session', …);                 // session method google → 200, Hash::check passes
it('needs the current password to change one', …);               // missing → 422 errors.current_password; wrong → 422; right → 200
it('changes without the current password from a link session under 15 minutes old', …);
it('asks for the current password from a link session 16 minutes old', …);   // travel(16)->minutes()
it('signs out every other session and keeps this one', function () {
    // two tokens A,B + a legacy cache token C for the same fan; change with A
    // A → /fan/me 200; B → 401; C → 401
});
it('mails the fan, and a mail failure does not fail the change', …);  // Mail::fake assertSent(FanPasswordChanged) ; Mail::shouldReceive throw → still 200
it('reports password_needs_current in /fan/me', …);
```

- [ ] **Step 2:** Run `--filter FanPasswordChangeTest`. Expected: FAIL (405/404).
- [ ] **Step 3:** Implement. Store with `Hash::make`. The mail follows the request locale and names whether a password was *set* or *changed*; send inside try/catch with `Log::warning`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): let a fan set and change a password`.

### Task 4: Register with email and password; the claim

**Files:**
- Create: `api/app/Support/FanMagicToken.php`, `api/tests/Feature/FanRegisterTest.php`
- Modify: `api/app/Http/Controllers/FanAccountController.php` (`requestMagicLink`, `verifyMagicLink` → both through `FanMagicToken`), `api/app/Http/Controllers/FanAuthController.php` (`register`), `api/routes/api.php` (`throttle:5,1,fan-register`), `api/lang/{en,pl}/api.php`

**Interfaces — Produces:**
- `FanMagicToken::issue(FanAccount $fan, array $extra = [], int $minutes = 1440): string` — `$extra` keys: `method` (default `link`), `password_hash`, `claim_hash`, `identity` (`['provider' => …, 'provider_user_id' => …]`).
- `FanMagicToken::pull(string $token): ?array` — `['fan_id', 'method', 'password_hash', 'claim_hash', 'identity']`, all keys always present; a bare integer (a link mailed before the deploy) reads as `fan_id` with the rest null / `link`.
- `FanMagicToken::forget(string $token): void`.
- `FanMagicToken::claimMatches(?string $claimHash, mixed $claim): bool` — `hash_equals($claimHash, hash('sha256', $claim))`, false for null / non-string.
- `POST /api/fan/auth/register` `{email, password, claim_hash?, return_to?}` → always 200 `{message: __('api.fan.register_sent')}` (+ `dev_link` under debug). `claim_hash` rule: `nullable|regex:/^[a-f0-9]{64}$/`.
- `GET /api/fan/auth/verify?token=&claim=` → `{token, fan, password_set: bool, linked: ?string}`. Sets `email_verified_at` when null.
- The mailed URL is built by one private method shared by `requestMagicLink` and `register` (`/account?token=…[&return=…]`).

- [ ] **Step 1: Failing tests**

```php
function claim(): array { $c = Str::random(64); return [$c, hash('sha256', $c)]; }
function mailedToken(): string { /* read the token out of the dev_link with app.debug on, or spy FanMagicToken via Cache */ }

it('activates the password when the link is opened with the claim', function () {
    [$claim, $hash] = claim();
    $this->postJson('/api/fan/auth/register', ['email' => 'new@example.com', 'password' => 'correct horse', 'claim_hash' => $hash])->assertOk();
    $res = $this->getJson('/api/fan/auth/verify?token='.mailedToken().'&claim='.$claim)->assertOk();
    expect($res->json('password_set'))->toBeTrue();
    $fan = FanAccount::where('email', 'new@example.com')->sole();
    expect(Hash::check('correct horse', $fan->password_hash))->toBeTrue()->and($fan->email_verified_at)->not->toBeNull();
});
it('signs in but sets no password without the claim', …);          // password_set false, password_hash null
it('signs in but sets no password with a wrong claim', …);
it('sets no password when register sent no claim_hash at all', …);
it('never replaces an existing password', …);                       // account has one → after verify with the right claim, the old one still checks
it('answers identically for a new and an existing email', …);       // same status + same message key
it('sends no password to the log or the mail', …);                  // Mail::fake: body contains the link, not the password
it('exchanges a link issued before the deploy', function () {       // bare id
    Cache::put('fan_magic:old', $fan->id, now()->addHour());
    $this->getJson('/api/fan/auth/verify?token=old')->assertOk()->assertJsonPath('password_set', false);
});
it('refuses the second opening of one link and leaves the first result intact', function () {   // Review Focus 3
    // verify once with claim → 200; verify again with claim → 401; password still checks; exactly one session row
});
it('rejects a weak password with a 422 before anything is mailed', …);  // Mail::assertNothingSent
it('keeps the return path on a register link', …);                  // &return=%2Fen%2Fnews%2Fx
```

- [ ] **Step 2:** Run `--filter FanRegisterTest`. Expected: FAIL.
- [ ] **Step 3:** `FanMagicToken`, then `register`: normalise email, find-or-create as `requestMagicLink` does, hash the password **now** and park the hash (never the plain text), mail the link, forget the token if the mail fails (503, as today). An account that already has a password gets a plain token with nothing parked.
- [ ] **Step 4:** `verifyMagicLink`: `pull` → fan → stamp `email_verified_at` → if `password_hash` parked **and** `claimMatches` **and** the fan has none → save it → `FanSession::open($fan, $method)`. `linked` stays null until Task 11.
- [ ] **Step 5:** Run `--filter 'FanRegister|FanAccount|FanAuthThrottle'`. Expected: PASS.
- [ ] **Step 6:** Commit `feat(api): register a fan with email and password`.

### Task 5: Public site — auth calls and the claim

**Files:**
- Create: `web/src/lib/fanAuth.ts`, `web/src/lib/fanAuth.test.ts`
- Modify: `web/src/lib/comments.ts` (export `headers`, `parse`; add `has_password?: boolean` to `FanProfile`)

**Interfaces — Produces** (all in `fanAuth.ts`):
- `CLAIM_KEY = 'fan_claim'`
- `newClaim(store?: Store | null): Promise<string | null>` — 32 random bytes hex kept under `CLAIM_KEY`, resolves to its SHA-256 hex; **null** (and nothing stored) when storage or `crypto.subtle` is unavailable.
- `signInWithPassword(email: string, password: string, lang: string): Promise<FanSession>` — also writes `fan_token` + `fan` to storage (add `storeSession(session)` beside `storeFan` in `comments.ts`).
- `registerWithPassword(email: string, password: string, lang: string, returnTo: string): Promise<void>` — calls `newClaim()`, sends `claim_hash` (omitted when null) and `return_to`.
- Errors are `CommentApiError` (its `code` carries `login_failed` / `login_limit`).

- [ ] **Step 1: Failing tests** (`fanAuth.test.ts`, fetch stubbed with `vi.stubGlobal`)

```ts
it('keeps the claim and returns its sha-256', async () => {
  const store = memoryStore()
  const hash = await newClaim(store)
  expect(store.getItem(CLAIM_KEY)).toMatch(/^[a-f0-9]{64}$/)
  expect(hash).toBe(await sha256Hex(store.getItem(CLAIM_KEY)!))
})
it('returns null and stores nothing when storage throws', …)          // Review Focus 4
it('returns null when crypto.subtle is missing', …)                    // Review Focus 4
it('register sends claim_hash and a cleaned return_to, never the claim', …)
it('register omits claim_hash when there is no claim', …)
it('password sign-in stores the session', …)                           // readFanSession(store) afterwards
it('surfaces the server code on a failed sign-in', …)                  // 422 {code:'login_failed'} → CommentApiError.code
```

- [ ] **Step 2:** `cd web && pnpm test:unit -- fanAuth`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS, and the suite's test count went up.
- [ ] **Step 5:** Commit `feat(web): add password sign-in and register calls for fans`.

### Task 6: Public site — the sign-in form under a post

**Files:**
- Create: `web/src/components/FanSignIn.vue`
- Modify: `web/src/components/PostComments.vue` (the `v-if="!fan"` block renders `<FanSignIn>`; the `PostCommentsCopy` interface), `web/src/lib/copy.ts` (~line 142), the `packages/site-copy/src/modules/*.ts` file that defines `commentsSignInLead`, `app/src/i18n/copyFields.pl.ts` (Polish for each new admin label)

**Interfaces:**
- Consumes: Task 5's functions; `requestSignInLink`, `rememberReturnPath` from `comments.ts`.
- Produces: `FanSignIn.vue` props `{ copy: FanSignInCopy; lang: string; returnPath: string }`, emits `signed-in: [session: FanSession]`. `FanSignInCopy` is exported from the component and has: `lead, emailLabel, passwordLabel, signIn, signingIn, emailLinkInstead, createAccount, createAccountSubmit, backToSignIn, linkSent, registerSent, loginFailed, loginLimit, passwordHint, orDivider, failed`. New `CopyField` keys are `commentsPasswordLabel`, `commentsSignIn`, … one per member, en + pl defaults, in the existing comments group. **Existing keys are not renamed.**
- `data-testid`s: `fan-signin` (root), `fan-signin-email`, `fan-signin-password`, `fan-signin-submit`, `fan-signin-link` (email me a link), `fan-signin-register` (mode toggle), `fan-signin-notice`, `fan-signin-error`. Keep `comment-signin` on the wrapper in `PostComments.vue` (existing specs use it).

Behaviour the tests in Task 8 pin: mode `signin` (email + password → `signInWithPassword` → emit) / `register` (→ `registerWithPassword` → notice `registerSent`); *Email me a sign-in link instead* needs only the email, calls `rememberReturnPath` then `requestSignInLink`, shows `linkSent`. `loginFailed` text mentions the email-link option (it is the forgotten-password path). Password inputs carry `autocomplete="current-password"` / `"new-password"` and `minlength="8"` in register mode. Shape as in the spec's sketch (provider buttons arrive in Task 12 — leave the slot above the divider, render the divider only when there are providers).

- [ ] **Step 1:** Add the `CopyField`s (en + pl), the Polish admin labels, and extend the shaping in `web/src/lib/copy.ts`.
- [ ] **Step 2:** Build `FanSignIn.vue`; swap it into `PostComments.vue`, whose `signed-in` handler does what the island does today on finding a session.
- [ ] **Step 3:** Verify: `cd web && npx tsc --noEmit -p tsconfig.json` (only the two known errors), `cd app && pnpm test:unit -- copyFields` (PASS), then with the stack up `cd web && API_BASE=http://localhost:8081 pnpm build` (token lint + build green) and `grep -rl undefined dist --include=*.html` prints nothing.
- [ ] **Step 4:** Commit `feat(web): sign in with a password under a news post`.

### Task 7: Account page — exchange with the claim, password form

**Files:**
- Create: `app/src/utils/fanClaim.ts`, `app/src/utils/fanClaim.spec.ts`, `app/src/components/fan/FanSignInOptions.vue`
- Modify: `app/src/api/fan.ts`, `app/src/types/fan.ts`, `app/src/components/fan/FanLoginForm.vue`, `app/src/views/FanAccountView.vue`, `app/src/i18n/en/fan.ts`, `app/src/i18n/pl/fan.ts`

**Interfaces — Produces:**
- `fanClaim.ts`: `CLAIM_KEY = 'fan_claim'` (same key as `web/`), `newClaim(store): Promise<string | null>` (same contract as Task 5), `consumeClaim(store): string | null` — reads and **removes** it.
- `types/fan.ts` `FanAccount` gains `has_password?: boolean`, `password_needs_current?: boolean`.
- `api/fan.ts`: `verifyMagicLink(token: string, claim?: string | null): Promise<VerifyResponse>` (`VerifyResponse` gains `password_set?: boolean`, `linked?: string | null`); `loginFan(email, password): Promise<VerifyResponse>`; `registerFan(email, password, claimHash: string | null): Promise<MagicLinkResponse>`; `setFanPassword(token, password, currentPassword?): Promise<FanAccount>`.
- `FanLoginForm.vue` emits `signed-in: [VerifyResponse]` beside `magic-link-sent`; same three actions and the same `data-testid`s as Task 6.
- `FanSignInOptions.vue` (`data-testid="fan-signin-options"`): *Set a password* / *Change password*; the current-password input (`fan-current-password`) only when `fan.password_needs_current`; `fan-new-password`, `fan-password-save`, `fan-password-saved`. On success `setSession(token, updatedFan)`.

- [ ] **Step 1: Failing spec** `fanClaim.spec.ts`: claim stored + hash returned; `consumeClaim` returns it once then null; null when the store throws; null without `crypto.subtle`.
- [ ] **Step 2:** `cd app && pnpm test:unit -- fanClaim`. Expected: FAIL.
- [ ] **Step 3:** Implement `fanClaim.ts`; run → PASS.
- [ ] **Step 4:** API functions and types. `FanAccountView.onMounted`: `consumeClaim()` **before** the exchange and pass it to `verifyMagicLink`; when `password_set` is true show `fan.account.passwordSet` — but if a return path applies, navigate as today (the post matters more than the notice).
- [ ] **Step 5:** `FanLoginForm` (three actions) and `FanSignInOptions` under the account header. All strings as `fan.login.*` / `fan.account.*` keys in en and pl.
- [ ] **Step 6:** `cd app && rm -f tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo && pnpm build` and `pnpm test:unit`. Expected: both green (the i18n guards included).
- [ ] **Step 7:** Commit `feat(app): password sign-in and password settings on the fan account page`.

### Task 8: End-to-end

**Files:**
- Create: `app/e2e/tests/public/fan-password.spec.ts`
- Modify: `api/app/Console/Commands/SeedE2eFanSession.php` (`--password=`), `app/e2e/fixtures/seed.ts` (`seedFanSession({ password })`), `api/tests/Feature/` test for the option if the command has one

- [ ] **Step 1:** `--password=` hashes into `password_hash`; Pest: seeded fan can log in with it.
- [ ] **Step 2: Write the spec** (`test.describe.serial`, `anonymousVisitor()`, a post with comments on — reuse how `post-comments.spec.ts` finds or creates one, including its rebuild-and-wait if it seeds a post):

```ts
test('a fan signs in with a password under a post and comments', …)
  // seedFanSession({ password, displayName }); open the post signed out;
  // fill fan-signin-email / fan-signin-password; click fan-signin-submit;
  // expect comment-signed-in visible; post a comment; expect it in the list
test('a wrong password says so and offers the email link', …)
  // expect fan-signin-error visible; fan-signin-link still visible
test('creating an account shows "check your email"', …)
  // page.route('**/api/fan/auth/register', fulfil 200) — assert the request body has claim_hash matching /^[a-f0-9]{64}$/ and no "claim" key; expect fan-signin-notice
test('on /account a fan sets a password, signs out and signs back in with it', …)
  // seedFanSession() without password; inject fan_token/fan; /account; fan-new-password + save → fan-password-saved;
  // sign out; fan-signin-email + password → account header visible
```

- [ ] **Step 3:** Rebuild so the stack serves the new code: `bash rebuild.sh --skip-tests` (backend + both frontends changed). Confirm the public island is the new one: `curl -s <a post URL> | grep -o 'PostComments[^"]*' | head -1` differs from before.
- [ ] **Step 4:** `cd app && pnpm exec playwright test e2e/tests/public/fan-password.spec.ts e2e/tests/public/post-comments.spec.ts e2e/tests/public/fan-sign-in-link.spec.ts e2e/tests/public/fan-locale.spec.ts`. Expected: all pass.
- [ ] **Step 5:** Commit `test(e2e): cover fan password sign-in`.

### Task 9: Document, verify, ship PR 1

- [ ] **Step 1:** `CLAUDE.md`: a *Fan sign-in* section — sessions table + the legacy fallback and its removal date; the claim rule and why; "email proven first"; `FanPassword` / `FanMagicToken` as the single definitions; the 15-minute link window as forgot-password. Fix the lines in the comments section that say a session is a 30-day cache entry. `CHANGELOG.md` entry.
- [ ] **Step 2:** `bash scripts/test-all.sh` (split chromium / chains if it outgrows one call). Expected: exit 0.
- [ ] **Step 3:** `/code-review` on the branch; fix what it finds; re-run the affected suites.
- [ ] **Step 4:** Squash, push once, open the PR: `feat(web): let fans sign in with a password and stay signed in`. After merge, check the **push** run on `main`: `gh run list --branch main --limit 3`.

---

# PR 2 — Google and Facebook

### Task 10: Providers, identities, the capabilities endpoint

**Files:**
- Create: `api/database/migrations/2026_11_25_000001_create_fan_identities.php`, `api/app/Models/FanIdentity.php`, `api/app/Support/FanProviders.php`, `api/tests/Feature/FanProvidersTest.php`
- Modify: `api/composer.json` + lock (`composer require laravel/socialite` inside the backend build context), `api/config/fan_auth.php`, `api/config/services.php`, `api/app/Models/FanAccount.php` (`identities()`), `api/app/Support/FanPayload.php`, `api/app/Support/Activity/ActivityRecorder.php` (`FanIdentity` in `PERSONAL`), `api/routes/api.php`, `docker-compose.yml`, `docker-compose.prod.yml`, `.env.example`, `scripts/prodsync/tables.py`

**Interfaces — Produces:**
- Table `fan_identities`: `id`, `fan_account_id` (FK cascade), `provider` string(16), `provider_user_id` string(191), timestamps, unique `(provider, provider_user_id)`.
- `config('fan_auth.providers')` = `['google' => ['trust_email' => true, 'scopes' => ['openid', 'email']], 'facebook' => ['trust_email' => false, 'scopes' => ['email']]]`.
- `config('services.google|facebook')` = `client_id`, `client_secret` from `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`, `redirect` = `rtrim(config('newsletter.frontend_url'), '/') . '/api/fan/auth/{provider}/callback'`.
- `FanProviders::enabled(): string[]` — providers with **both** id and secret non-empty, in config order. `FanProviders::isEnabled(string $p): bool`. `FanProviders::trustsEmail(string $p): bool`.
- `GET /api/fan/auth/providers` → `{providers: string[]}`.
- `FanPayload` gains `providers: string[]` (the fan's linked ones).

- [ ] **Step 1: Failing tests:** nothing configured → `[]`; id without secret → still `[]`; both → `['google']`; both providers → `['google','facebook']`; `/fan/me` lists a linked provider; deleting the fan deletes identities; the same `(provider, id)` twice violates the unique index.
- [ ] **Step 2:** Run `--filter FanProvidersTest`. Expected: FAIL.
- [ ] **Step 3:** Implement; add the four env vars to both compose `environment:` maps and `.env.example`; `fan_identities` prod-only in `tables.py`.
- [ ] **Step 4:** Run → PASS. Rebuild the test image first (new dependency).
- [ ] **Step 5:** Commit `feat(api): add fan sign-in providers and identities`.

### Task 11: Redirect and callback

**Files:**
- Create: `api/app/Http/Controllers/FanSocialAuthController.php`, `api/tests/Feature/FanSocialAuthTest.php`
- Modify: `api/routes/api.php` (`{provider}` constrained to `google|facebook`, `throttle:20,1,fan-social`), `api/app/Http/Controllers/FanAccountController.php` (`verifyMagicLink` applies a parked identity), `api/lang/{en,pl}/api.php`

**Interfaces:**
- Consumes: `FanProviders`, `FanMagicToken::issue/claimMatches`, `ReturnPath::clean`, `FanPassword::normaliseEmail`.
- Produces:
  - `GET /api/fan/auth/{provider}/redirect?return_to=&lang=&claim_hash=` → 302 to the provider with `state`; cache `fan_oauth:{state}` = `{provider, return_to, lang, claim_hash}` for 10 min; cookie `fan_oauth_state` (HttpOnly, SameSite=Lax, Secure when the request is, path `/api/fan/auth`, 10 min). A provider that is not enabled → 404.
  - `GET /api/fan/auth/{provider}/callback` → always a 302 to `FRONTEND_URL/account…`:
    - signed in: `?token=<fan_magic, 5 min, method = provider>[&return=…]`
    - mail sent: `?auth_notice=confirm_email`
    - otherwise: `?auth_error=cancelled|no_email|failed`
  - `verifyMagicLink`: a parked `identity` is created (`firstOrCreate` on the unique pair) only when `claimMatches`; response `linked` = the provider then, else null.

- [ ] **Step 1: Failing tests** — Socialite mocked: `Socialite::shouldReceive('driver')->with('google')->andReturn($driver)` where `$driver` is a Mockery double answering `stateless()`, `scopes()`, `with()`, `redirect()`, `user()`; a helper `providerUser(id, email, verified)` builds the `Laravel\Socialite\Two\User` (Google's flag is `user['email_verified']`).

```php
it('redirects with a state it also sets as a cookie and remembers', …);
it('404s for a provider with no keys', …);
it('signs in a fan whose identity is already linked', …);          // Location has ?token= ; exchanging it → session method google
it('creates and links an account when Google vouches for the email', …); // email_verified_at set, 1 identity, name = local part, display_name null
it('links to the existing account with that email when Google vouches', …); // no second fan row; case-insensitive email
it('does not trust a Google email flagged unverified', …);          // → confirm_email path, no session token in Location
it('mails a link instead of signing in on a first Facebook sign-in', function () {
    // Location = …/account?auth_notice=confirm_email ; Mail sent to the address ; no fan_sessions row ; no identity yet
});
it('links Facebook when that mail is opened with the claim', …);   // verify?token=&claim= → linked = facebook ; next callback signs in directly
it('signs in without linking when the mail is opened without the claim', …); // session yes, fan_identities empty
it('carries a cleaned return path through to the account URL', …);  // return_to=/en/news/x → &return=%2Fen%2Fnews%2Fx ; return_to=//evil → absent
it('redirects with no_email when the provider gives none', …);
it('redirects with cancelled when the user declined', …);           // ?error=access_denied
it('refuses a state that does not match the cookie', …);            // auth_error=failed, Socialite user() never called
it('refuses a state used twice or expired', …);                     // Review Focus 5: second callback → auth_error=failed, 302 not 500
it('redirects with failed when the provider call throws', …);
it('stores nothing from the provider but its id', …);               // fan.name is not the provider name
```

- [ ] **Step 2:** Run `--filter FanSocialAuthTest`. Expected: FAIL.
- [ ] **Step 3:** Implement the redirect, then the callback in the spec's table order. `state` is pulled from the cache (single use) and compared to the cookie with `hash_equals` **before** `->user()`. The cookie is read raw (`$request->cookies->get`) — the `api` group has no cookie encryption. The unvouched-email mail reuses the sign-in link builder from Task 4 with `identity` + `claim_hash` parked and the stored `return_to`; its wording follows `lang`.
- [ ] **Step 4:** Extend `verifyMagicLink`; run `--filter 'FanSocial|FanRegister|FanAccount'` → PASS.
- [ ] **Step 5:** Commit `feat(api): sign fans in with google and facebook`.

### Task 12: Buttons, notices, privacy copy

**Files:**
- Create: `web/src/components/ProviderButtons.vue`, `app/src/components/fan/FanProviderButtons.vue`, `app/src/utils/authQuery.ts`, `app/src/utils/authQuery.spec.ts`
- Modify: `web/src/lib/fanAuth.ts` (+ test), `web/src/components/FanSignIn.vue`, `app/src/api/fan.ts`, `app/src/components/fan/FanLoginForm.vue`, `app/src/components/fan/FanSignInOptions.vue`, `app/src/views/FanAccountView.vue`, `app/src/i18n/{en,pl}/fan.ts`, `packages/site-copy/src/modules/privacy.ts`, the comments copy module + `web/src/lib/copy.ts` + `app/src/i18n/copyFields.pl.ts`

**Interfaces — Produces:**
- `web/src/lib/fanAuth.ts`: `fetchProviders(lang: string): Promise<string[]>` — `[]` on any failure (a broken endpoint must not break the form); `providerUrl(provider: string, lang: string, returnTo: string, claimHash: string | null): string` → `/api/fan/auth/{provider}/redirect?lang=…&return_to=…[&claim_hash=…]`.
- `app/src/api/fan.ts`: `fetchFanProviders(): Promise<string[]>` (same fail-open), and the same `providerUrl` in `app/src/utils/authQuery.ts`.
- `authQuery.ts`: `readAuthQuery(query): { error: 'cancelled' | 'no_email' | 'failed' | null; notice: 'confirm_email' | null }` — anything unknown is null.
- Buttons: `<a data-testid="fan-provider-google|facebook">`; on click, `preventDefault` → `rememberReturnPath` (web) → `await newClaim()` → `location.assign(providerUrl(…))`. New copy: `commentsContinueWith` (`'Continue with {provider}'`), SPA keys `fan.login.continueWith`, `fan.login.authError.{cancelled,no_email,failed}`, `fan.login.confirmEmail` (says *open the link in this browser*), `fan.account.linked` / `fan.account.linkedNone`.
- `FanAccountView`: shows the error / notice from `readAuthQuery` (`data-testid="fan-auth-error"`, `fan-auth-notice`) and drops both params from the URL. `FanSignInOptions` lists `fan.providers` read-only (`data-testid="fan-linked-providers"`).
- `privacy.ts`: one new `CopyField` (do not edit an existing default — keys and stored overrides are permanent) for the Google / Facebook paragraph: the band receives the email address and an account id, nothing else; how to have the account removed.

- [ ] **Step 1: Failing unit tests:** `web` — `fetchProviders` returns `[]` on a 500 and on a network error; `providerUrl` encodes the return path and omits `claim_hash` when null. `app` — `readAuthQuery` maps known values, nulls unknown ones and arrays.
- [ ] **Step 2:** Run both unit suites. Expected: FAIL on the new cases.
- [ ] **Step 3:** Implement functions, both button components (inline SVG marks, semantic tokens only in `web/`; brand colours need `token-lint-ignore` on their lines if used), wire into both forms and the account page; render the "or" divider only when `providers.length > 0`.
- [ ] **Step 4:** `cd web && pnpm test:unit && npx tsc --noEmit -p tsconfig.json`; `cd app && rm -f tsconfig.*.tsbuildinfo && pnpm build && pnpm test:unit`. Expected: green.
- [ ] **Step 5:** Commit `feat(web): offer google and facebook sign-in to fans`.

### Task 13: End-to-end, docs, ship PR 2

**Files:**
- Create: `app/e2e/tests/public/fan-social-login.spec.ts`
- Modify: `CLAUDE.md`, `CHANGELOG.md`, `docs/deployment.md`

- [ ] **Step 1: Spec** (providers served through `page.route('**/api/fan/auth/providers')`; nothing reaches a provider):

```ts
test('no provider configured: no buttons and no divider under a post', …)
test('google configured: the button leads to the redirect with lang, return_to and a claim_hash', …)
  // route providers → ['google']; page.route('**/api/fan/auth/google/redirect**', r => r.fulfill({status: 200, body: 'ok'}));
  // click; expect the captured URL's params: return_to = the post path, claim_hash /^[a-f0-9]{64}$/; localStorage fan_return_to + fan_claim set
test('/account shows a worded message for auth_error and for confirm_email, and cleans the URL', …)
test('/account lists linked providers', …)   // route /api/fan/me → providers: ['google']
```

- [ ] **Step 2:** `bash rebuild.sh --skip-tests`, confirm the new island hash is served, run this spec plus the four fan specs from Task 8. Expected: pass.
- [ ] **Step 3:** Docs. `CLAUDE.md` *Fan sign-in*: the vouching table and why Facebook is untrusted; the state cookie is the login-CSRF defence for stateless Socialite; a parked identity needs the claim; "no key, no button"; redirect URIs derive from `FRONTEND_URL`. `docs/deployment.md`: the four env vars, the two callback URLs to register, Google consent screen, Meta Live mode + privacy URL + data-deletion instructions URL.
- [ ] **Step 4:** `bash scripts/test-all.sh` → exit 0. `/code-review`; fix; re-run.
- [ ] **Step 5:** Squash, push once, PR `feat(web): let fans sign in with google and facebook`. After merge check the push run on `main`. Tell the band the buttons appear once the keys are in the server's `.env` and the backend is recreated.
