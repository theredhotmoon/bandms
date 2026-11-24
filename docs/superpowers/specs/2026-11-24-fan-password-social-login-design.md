# Fan sign-in: passwords, Google and Facebook — design

Date: 2026-11-24. Branch: `feature/fan-password-social-login`.

## Intent

A fan signs in today by asking for an emailed link, on every device and again
whenever the session lapses. Fans hate that. They should be able to sign in
the way they do everywhere else — a saved password, or Google / Facebook —
and stay signed in.

## Decided by the band

- **The emailed link stays**, exactly as it works now.
- **A fan can have a password** — set on an existing account, or chosen while
  registering with email and password.
- **Google and Facebook sign-in.** No Apple, no others.
- Social sign-in is a server-side redirect (Socialite); a password on an
  existing account is set while signed in.

## Goals

- A fan with a password signs in on a new device without opening their mail.
- A new fan can register with email + password from a post's comment box or
  from `/account`.
- A fan presses *Continue with Google* / *Facebook* under a post and comes
  back to that post signed in.
- A session survives a cache flush and lasts long enough that "sign in again"
  is rare.
- Whatever way a fan signs in, it is the **same account** per email: one
  display name, one set of comments, tickets and orders.

## Non-goals (v1)

- Apple, X, Discord or any third provider.
- Two-factor authentication, passkeys.
- Unlinking a provider, removing a password, changing the account's email,
  deleting the account from `/account`.
- A "signed-in devices" list or a manual "sign out everywhere" button.
- Showing sign-in methods in the admin's fan list.
- Checking passwords against a breach list (`uncompromised()` calls an
  outside service; CI and the privacy policy both say no).
- Facebook's automated data-deletion callback — the Meta app gets a
  data-deletion *instructions* URL (the privacy page) instead.

## Anti-goals

- **An unproven email must never yield a session.** A fan session shows the
  tickets and orders bought with that email (`FanAccountController::tickets()`
  matches `holder_email`, `orders()` matches `email`). So no path — register,
  social, anything — may sign someone in as an address they have not shown
  they control.
- **Nobody may plant a password on someone else's account**, including one
  that does not exist yet (pre-hijacking).
- **The API must not say whether an email has an account.** Register and
  wrong-password answers are the same for a known and an unknown address.
- **No third-party script on the public site.** No Google One Tap, no
  Facebook SDK: the consent card promises GA only.
- **Deploying this signs nobody out.**
- Nothing here triggers a site rebuild or marks an area dirty.
- Nothing in CI reaches Google or Facebook.

## Constraints found in the code

- Sessions are cache entries (`fan_session:{token}`, 30 days) read by
  `App\Support\FanSession`, the one place both `FanAuth` and the public
  comments list resolve a fan. Dev cache is `file`, prod is `database`.
- `fan_accounts.password_hash` and `email_verified_at` exist and are unused.
- The single-use sign-in token is `fan_magic:{token}` in the cache, exchanged
  by the SPA's `/account?token=…&return=…` (`FanAccountView`), with the
  login-CSRF guard `consumeReturnPath()` / `rememberReturnPath()`.
- The browser keeps `fan_token` + `fan` in `localStorage`, shared by the SPA
  (`useFanAccount`) and the Astro island (`web/src/lib/comments.ts`).
- Two sign-in UIs exist: `web/src/components/PostComments.vue` (island; copy
  through `@bandms/site-copy` props) and `app/src/components/fan/FanLoginForm.vue`
  (SPA; `fan.*` vue-i18n keys). API messages are `api/lang/{en,pl}/api.php`.
- A backend env var must be in the `environment:` map of **both** compose
  files or it never arrives.
- `fan_accounts` is prod-only in `scripts/prodsync/tables.py`; `FanAccount`
  is on `ActivityRecorder::PERSONAL`.
- The running backend has debug off, so E2E cannot follow an emailed link;
  `e2e:seed-fan-session` creates sessions directly.

## Approaches considered

**Social sign-in**

1. **Server-side redirect with Laravel Socialite (chosen).** The callback
   ends by minting the same single-use `fan_magic` token the emailed link
   uses and redirecting to `/account?token=…&return=…`. The exchange, the
   return-to-post handling and its login-CSRF guard are reused unchanged, and
   the public site loads nothing from Google or Meta.
2. Provider JavaScript SDKs in the browser. Nicer one-tap, but third-party
   scripts on every post page against the consent promise, and one bespoke
   integration per provider.
3. A hosted auth service. A monthly fee and an outside dependency for a
   comment box.

**Password**

1. **Email proven first, password second (chosen).** A password only ever
   becomes active on an account whose email has been proven by a link (or a
   trusted provider). "Forgot password" is the emailed link that already
   exists. Registration with email + password (the band's addition) is this
   same rule: the form takes both, the password takes effect when the
   emailed link is opened — see *Register* below.
2. Classic sign-up with a separate verification mail, reset tokens and an
   "unverified account" state. More flows, and each is a place for the
   anti-goals above to break.

## Design

Two PRs, each shippable alone: **PR 1** durable sessions + passwords,
**PR 2** Google + Facebook.

### Data

`fan_sessions` (new):

| Column | |
|---|---|
| `id` | |
| `fan_account_id` | FK, cascade on delete |
| `token_hash` | `sha256` of the token, unique. The raw token exists only in the browser |
| `method` | `link` \| `password` \| `google` \| `facebook` — how this session was opened |
| `last_used_at`, `expires_at`, `created_at` | |

`fan_identities` (new, PR 2):

| Column | |
|---|---|
| `id`, `fan_account_id` | FK, cascade on delete |
| `provider` | `google` \| `facebook` |
| `provider_user_id` | unique together with `provider` |
| timestamps | |

Nothing else from the provider is stored — no name, no picture, no token.

`fan_accounts`: no new columns. `password_hash` (cast `hashed` is **not**
used — the column is not named `password`; hash explicitly) and
`email_verified_at` come into use. The fan payload (`fanPayload()`) gains
`has_password: bool` and `providers: string[]`.

Both new tables are prod-only in `scripts/prodsync/tables.py` (a push must
not sign production's fans out or drop their links). `FanIdentity` joins
`ActivityRecorder::PERSONAL`.

### Sessions (PR 1)

- `FanSession::fan()` hashes the Bearer token and looks up a row with
  `expires_at > now()`. It stays the single answer to "is this a valid fan
  session".
- **Lifetime 180 days, sliding**: a session used on a later day than
  `last_used_at` gets both stamps moved forward. At most one write per
  session per day. (My call; `config('fan_auth.session_days')`.)
- **Legacy fallback:** when no row matches, the old `fan_session:{token}`
  cache key is still honoured. That is what keeps the deploy from signing
  anyone out. A legacy token is **moved into the table on first use** (a row
  with method `link` and the same token's hash; the cache key forgotten), so
  an active old session becomes an ordinary, revocable one. The fallback can
  be deleted 30 days after the deploy, when every cache session has expired
  by itself — say so in a comment with the date.
- Legacy entries are keyed by token only and cannot be listed per fan. So a
  password change also sets `fan_legacy_revoked:{fan_id}` in the cache (31
  days), and the legacy branch refuses a fan who has that marker. The session
  making the change has already been moved to the table by its own request,
  so it survives. (My call.)
- One helper opens a session (`FanSession::open($fan, $method)` → raw token);
  `verifyMagicLink`, password login and `e2e:seed-fan-session` all use it.
  Opening one deletes that fan's expired rows — no scheduled prune.
- `logout` deletes the row (and forgets the legacy key).

### Password (PR 1)

Rules: 8–72 characters (bcrypt reads 72 bytes), no composition rules. One
definition for every write path, as `DisplayName` is for names.

**Sign in — `POST /api/fan/auth/login` `{email, password}`.**
Session + fan payload on success. Any failure — unknown email, no password
set, wrong password — is one 422 with one message ("Email or password is
wrong"), and an unknown email still runs a hash check so the timing matches.
Throttled per visitor like the other fan auth routes, plus a per-email
`RateLimiter` (10 failures / 15 min → 429 with a `code` the UIs can word, the
`comment_limit` pattern), so one address cannot be hammered from many IPs.

**Set or change — `PUT /api/fan/me/password` `{password, current_password?}`**
(`fan.auth`).

| Account state | Allowed when |
|---|---|
| No password yet | any valid session |
| Has a password | `current_password` matches, **or** this session's `method` is `link` and it was opened in the last 15 minutes |

The second row's link case *is* "forgot password": sign in by emailed link,
set a new one, no reset-token flow to build. On success every **other**
session of that fan is deleted, and the fan is mailed "your password was
set/changed" (mail failure never fails the request).

**Register — `POST /api/fan/auth/register` `{email, password, return_to?}`.**
The answer is always the same "check your email", whatever the address.

- The account is found or created as `requestMagicLink` does today, and the
  same sign-in link is mailed.
- The password is hashed and parked **with the link token** in the cache
  (`fan_magic:{token}` becomes `{fan_id, password_hash?, claim_hash?,
  identity?}`; a bare id from a link issued before the deploy must still
  work).
- **The browser makes a random `claim`** before the request, keeps it
  (`localStorage`, beside the return path) and sends only its SHA-256 as
  `claim_hash`. It presents the raw claim when exchanging the token. **The
  parked password is applied only when the exchange presents the matching
  claim and the account has no password yet.** Otherwise the link signs the
  fan in and the password is silently dropped. The claim is single use:
  cleared from the browser by the exchange that presents it.

Why the claim: without it, anyone could register *your* address with *their*
password, and your click on a mail that looks routine would activate it —
on your existing account, or on one created for you in advance. With it,
only the browser that typed the password can activate it, and only the
person who can open the mailbox has the token. The cost: a fan who registers
on a laptop and opens the mail on a phone is signed in on the phone with no
password set; `/account` then shows *Set a password*. An account that
already has a password is never changed by register — that fan just gets a
sign-in link.

`verifyMagicLink` therefore becomes: pull token → sign in → stamp
`email_verified_at` if null → apply parked password / identity when allowed
→ open session with the token's method. The response says whether a password was
applied, so the page can confirm it.

### Google and Facebook (PR 2)

`laravel/socialite`, stateless. Scopes: Google `openid email`; Facebook
`email`.

- `GET /api/fan/auth/providers` → `{providers: ['google', …]}` — only those
  with both env vars set. Both UIs fetch it when showing a signed-out form
  and render a button per entry; **no key, no button** (the "unset means
  off" rule). Runtime, so adding a key needs no site rebuild.
- `GET /api/fan/auth/{provider}/redirect?return_to=&lang=&claim_hash=` — creates a
  random `state`, stores `{return_to (cleaned), lang, claim_hash}` under it in the cache
  for 10 minutes, sets the same value in an HttpOnly, SameSite=Lax cookie
  scoped to `/api/fan/auth`, and redirects to the provider. The page calls
  `rememberReturnPath()` before navigating, as it does before asking for a
  link.
- `GET /api/fan/auth/{provider}/callback` — requires `state` to match both
  the cookie and a live cache entry (single use). Stateless Socialite checks
  no state of its own, so this is the login-CSRF defence; do not drop it.
  Then, with the provider's `id`, `email` and whether it vouches for the
  email:

| Case | Result |
|---|---|
| Identity `(provider, id)` already linked | sign in as that fan |
| Not linked, provider **vouches** for the email | find or create the fan by email, link, stamp `email_verified_at`, sign in |
| Not linked, email present but **not vouched** | mail the usual sign-in link to that address with the identity parked on its token, under the **same claim rule as a parked password** (below). The fan lands on `/account?auth_notice=confirm_email` |
| No email at all, user cancelled, provider error | `/account?auth_error=<code>` — a worded message and the ordinary form |

  **A parked identity needs the claim too.** Otherwise an attacker whose
  Facebook account carries your address presses the button, you click a
  routine-looking sign-in mail, and their Facebook is linked to your account
  for good. So the page generates a claim before navigating, exactly as for
  register, and passes `claim_hash` on the redirect URL; it rides in the
  `state` cache entry and onto the parked identity. The link is applied only
  when the exchange presents the matching claim; in any other browser the
  mail is just a sign-in link and nothing is linked. The notice therefore
  says "open the link in this browser". Consequence, accepted: a fan who
  always opens mail on another device never links Facebook and gets a mail
  each time — they can still sign in by link or password.

  "Sign in" means: mint a `fan_magic` token (5-minute life, carrying the
  method so the session records `google`/`facebook`) and redirect to
  `FRONTEND_URL/account?token=…&return=…`. Nothing new in the browser.

- **Which provider vouches is config**, `config('fan_auth.providers')`:
  Google yes — and only when its own `email_verified` claim is true;
  **Facebook no**. Meta does not promise the address it returns is verified,
  and an email here opens tickets and orders. So a fan's *first* Facebook
  sign-in costs one mail click; every later one is instant, because the
  identity is linked. (My call — the band can flip Facebook to trusted in
  config if they accept that risk.)
- A new account made through a provider gets `name` from the email's local
  part, as today. **The provider's display name is never stored or shown**;
  the first comment still asks for a display name.
- Env, in both compose files: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`. Redirect URIs derive from
  `FRONTEND_URL` (`…/api/fan/auth/{provider}/callback`; Caddy already sends
  `/api/*` to the backend, so no matcher change).

### What the fan sees

Both sign-in forms — under a post, and on `/account` — take the same shape:

```
Sign in to comment

[ G  Continue with Google   ]      ← only the configured ones
[ f  Continue with Facebook ]
────────────── or ──────────────
Email     [____________________]
Password  [____________________]
[ Sign in ]
Email me a sign-in link instead  ·  Create an account
```

- *Email me a sign-in link instead* uses the email field alone — today's
  flow, and the answer to a forgotten password (say so in the hint under a
  failed sign-in).
- *Create an account* switches the button to *Create account* and the result
  to "Check your email to finish".
- The two provider buttons are plain links styled with tokens; brand marks
  are inline SVG. No external asset.

`/account`, signed in, gains a **Sign-in options** block: *Set a password* /
*Change password* (current-password field shown only when one is needed),
and which of Google / Facebook are linked (read-only).

Copy: island strings are new `CopyField`s beside the existing comment
sign-in fields in `packages/site-copy`, passed as props; SPA strings are
`fan.*` keys in en + pl; API messages in `api/lang`. New mails follow the
request's locale.

The privacy page's default copy gains a paragraph: signing in with Google or
Facebook gives the band the email address and an account id, nothing else,
and how to have the account removed (this is also the URL Meta asks for).

### For the band to do (outside the code)

- Google Cloud: an OAuth client (web), consent screen published, the
  production callback URL registered.
- Meta: an app in Live mode with Facebook Login, privacy-policy URL,
  data-deletion instructions URL, the callback URL; Meta may ask for
  business verification before strangers can use it.
- Put the four values in the server's `.env`. Until then the buttons simply
  do not appear; passwords work without any of it.

### Tests

| Layer | Covers |
|---|---|
| Pest | sessions table + legacy fallback + sliding expiry; login (uniform failure, per-email limit); set/change password table above, other sessions revoked; password change kills legacy sessions but not the caller's; register — claim applies / wrong or missing claim does not / existing password untouched / identical answer for known and unknown email; old bare-id magic tokens still exchange; providers endpoint; callback's four cases with Socialite faked; a parked identity links only with its claim; state mismatch refused |
| Vitest | `web/src/lib` (`*.test.ts`) and `app/src/utils` (`*.spec.ts`): claim storage, new API calls' error mapping |
| Playwright, public | under a post: sign in with a password and comment; register shows "check your email"; provider button present with the right href when `providers` (served through `page.route`) lists it, absent when empty |
| Playwright, SPA | `/account`: set a password, sign out, sign back in with it; `auth_error` / `auth_notice` messages |

E2E gets passworded fans from `e2e:seed-fan-session --password=…`. The
OAuth round trip itself is Pest-only.

### Docs

A *Fan sign-in* section in `CLAUDE.md` (the claim rule, the vouching table,
the legacy-session removal date, state cookie), `CHANGELOG.md`,
`docs/deployment.md` for the four env vars.

## Left to the builder

- Class and file layout (a `FanAuthController` split from
  `FanAccountController` is welcome), exact route throttles, message wording.
- Whether the two UIs share anything beyond shape (they are separate apps;
  duplication is expected).
- Mail format (today's are `Mail::raw`).
- How the island and SPA split the form into components.
