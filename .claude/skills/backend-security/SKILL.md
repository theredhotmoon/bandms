---
name: backend-security
description: Backend security audit for Laravel 11 / PHP 8.4 — covers OWASP API Top 10 (2023), privilege escalation, BOLA/IDOR, SQL injection, SSRF, broadcast channel auth, rate limiting, and Passport token hardening.
origin: local
---

# Backend Security — Laravel / PHP

Comprehensive security reference for auditing and hardening the Movesetters backend API.
Covers both timeless vulnerability classes and current (2024–2025) attack trends.

---

## When to Activate

- Before shipping any new API endpoint or controller
- When adding or modifying authentication / authorisation logic
- When a feature touches user-controlled input, file uploads, external HTTP calls, or payments
- During a full security review pass on the codebase
- When a new model, policy, or broadcast channel is added

---

## 1 — Privilege Escalation via Mass Assignment

The most impactful Laravel-specific vulnerability: a privilege-sensitive field (`type`, `role`,
`is_admin`, `status`, `subscription_valid_until`) listed in `$fillable`, combined with a
controller that passes `$request->validated()` directly to `Model::create()` or `->update()`.

**What to check:**
- Every model's `$fillable` for role/status columns. `User::$fillable` in this project contains
  `type` (CLIENT / COMPANY / ADMIN) and `subscription_valid_until` — both dangerous if a
  non-admin request can set them.
- Every `FormRequest` that feeds into `User::create()` / `->update()`. Confirm `type` and
  `subscription_valid_until` are either absent from the rules or validated against a strict
  `Rule::in([...])` on an admin-only route.
- Absence of `Model::unguard()`, `forceFill()`, or `$guarded = []`.

**Grep patterns:**
```
grep -rn "fillable" backend/app/Models/ -A 20
grep -rn "type\|role\|is_admin\|subscription_valid_until" backend/app/Http/Requests/
grep -rn "unguard\|forceFill\|\$guarded\s*=\s*\[\s*\]" backend/app/
```

**Fix:** Remove privilege-sensitive fields from `$fillable` on non-admin models, or add an
explicit `Rule::in()` enum check and ensure the route is admin-gated.

---

## 2 — BOLA / IDOR (Broken Object Level Authorization)

OWASP API Top 10 #1 (2023). An authenticated user accesses or mutates another user's resource
by guessing / enumerating an ID. Laravel's route-model binding does NOT enforce ownership —
that is the policy's job.

**What to check:**
- Every controller method that acts on a specific model instance (`show`, `update`, `destroy`,
  `store` with a parent ID) must call `$this->authorize('action', $model)`.
- High-risk controllers: `QuoteController`, `OfferController`, `OfferMessageController`,
  `CompanyController`, `QuoteQuestionController`.
- `GET /api/quotes` and `GET /api/offers` must scope results to the authenticated user or their
  company — returning all records to any authenticated user is data exposure.
- Every model used in a resource route must have a Policy registered in `AppServiceProvider`.

**Grep patterns:**
```
grep -rn "public function show\|public function update\|public function destroy" backend/app/Http/Controllers/ -A 10
grep -rn "Gate::policy" backend/app/Providers/AppServiceProvider.php
grep -rn "::all()\|->get()" backend/app/Http/Controllers/ | grep -v admin
```

**Fix:** Add `$this->authorize('view', $model)` before every resource read/write; register all
policies in `AppServiceProvider::boot()`.

---

## 3 — SQL Injection

Laravel parameterizes queries by default. Risk surfaces when raw SQL methods receive
interpolated strings instead of bound parameters.

**Vulnerable patterns:**
```php
// BAD — interpolated
DB::select("SELECT * FROM quotes WHERE user_id = $id");
->whereRaw("status = '$status'");

// SAFE — bound
DB::select('SELECT * FROM quotes WHERE user_id = ?', [$id]);
->whereRaw('status = ?', [$status]);
```

**Grep patterns:**
```
grep -rn "whereRaw\|orderByRaw\|havingRaw\|selectRaw\|DB::statement\|DB::unprepared\|DB::select" backend/app/
```

For each hit: verify no user input is concatenated into the SQL string.

---

## 4 — SSRF and Path Traversal in External Calls

`FmcsaService::lookup()` appends a user-supplied `$dotNumber` directly to a URL path:
```php
self::BASE_URL . '/' . $dotNumber
```

A value like `../../other-endpoint?webKey=` could redirect the HTTP request to a different
FMCSA resource. An attacker could also probe internal network endpoints if the server has
access to private infrastructure.

**Fix:** Validate `usdot_number` / `mc_number` as strictly numeric before they reach
`FmcsaService`:
```php
'usdot_number' => ['required', 'string', 'regex:/^\d{1,8}$/'],
```
And URL-encode the value: `urlencode($dotNumber)`.

**Also check:** Any `Http::get($url)` where `$url` is partially derived from user input.
```
grep -rn "Http::\|file_get_contents\|curl_exec" backend/app/ -A3
```

---

## 5 — Broadcast Channel Authorization (Laravel Reverb)

Private channel callbacks in `routes/channels.php` are the sole gate between a WebSocket
subscriber and real-time data. A weak or missing check leaks live events to unauthorised users.

**Per-channel review checklist:**

| Channel | Expected check | Risk if missing |
|---------|---------------|-----------------|
| `App.Models.User.{id}` | `(int)$user->id === (int)$id` | User sees other users' notifications |
| `quote.{quoteId}` | `$quote->user_id === $user->id` | Any authenticated user sees quote events |
| `user.{userId}.alerts` | `(int)$user->id === (int)$userId` | User sees other users' alert events |
| `offer.{offerId}` | quote owner OR company owner | Third parties see private offer conversation |

**Known gap:** `quote.{quoteId}` only allows the quote *owner*. Companies with offers on the
quote cannot subscribe. Confirm this is intentional (companies use `offer.{offerId}` instead).

**Null-safety check:** `offer.{offerId}` accesses `$offer->quote->user_id`. If a quote was
deleted while the offer exists, this is a null-dereference. Guard with optional chaining:
```php
return $offer->quote?->user_id === $user->id || $offer->company?->user_id === $user->id;
```

**Ensure** `POST /api/broadcasting/auth` is behind `auth:api` middleware (prevents unauthenticated
channel subscriptions).

---

## 6 — Authentication and Token Security

### Passport token lifetime
Personal access tokens created with `$user->createToken('api')` do not expire by default.
A stolen token is valid forever. Set expiry in `AppServiceProvider`:
```php
Passport::personalAccessTokensExpireIn(now()->addDays(90));
```

### Token scopes
`createToken('api')` grants no scopes (all access). If the API introduces scope-protected
endpoints in future, tokens issued without scopes may over-grant. Consider defining minimal
scopes now.

### Single vs all-device logout
`AuthController::logout()` revokes only the current token. If a user's account is compromised,
they cannot revoke all sessions without admin intervention. Consider adding a
"logout all devices" endpoint:
```php
$request->user()->tokens()->each(fn ($token) => $token->revoke());
```

### Timing attacks
`Auth::attempt()` uses `Hash::check()` internally — constant-time, safe. Never compare
passwords with `===` or `==`.

### User enumeration
Login must return the same error message and HTTP status for both "unknown email" and "wrong
password". Any difference (response time, message text, status code) leaks user existence.

---

## 7 — Broken Function Level Authorization (Admin Endpoints)

### Admin middleware integrity
`EnsureUserIsAdmin` must:
1. Check `$user->isAdmin()` (i.e. `$user->type === 'ADMIN'`) — not a mass-assignable flag
2. Return HTTP 403 (not a redirect) for non-admin authenticated users
3. Short-circuit before any controller logic runs

### All admin routes inside the guarded group
Every route under `/api/admin` must be inside the `['auth:api', EnsureUserIsAdmin::class]`
middleware group. A single route registered outside the group is a privilege bypass.

### Subscription gating
`subscription_valid_until` is in `User::$fillable`. An authenticated user who can craft a
request to an endpoint that calls `$user->update($request->validated())` could set their own
subscription date. Confirm no non-admin endpoint exposes this field.

---

## 8 — Rate Limiting and Abuse Prevention

### Auth endpoints (current state)
| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/register` | 5/min per IP ✓ |
| `POST /api/auth/register-company` | 5/min per IP ✓ |
| `POST /api/auth/login` | 10/min per IP ✓ |

### Gaps to evaluate
- `POST /api/offers` — a company could flood a quote with fake offers
- `POST /api/offers/{id}/messages` — message spam in offer threads
- `POST /api/quotes/{id}/questions` — question spam on quotes

**Recommended:** Add per-user rate limits on authenticated write routes:
```php
Route::post('/offers', ...)->middleware('throttle:30,1');
```

For sensitive flows, combine IP + user ID to prevent shared-NAT bypasses:
```php
Limit::perMinute(10)->by($request->user()->id . '|' . $request->ip())
```

---

## 9 — Sensitive Data Exposure

### Hidden model attributes
Every model with sensitive columns must declare them in `$hidden`:
- `User`: `password`, `remember_token` ✓
- Check `Company`, `Offer`, `OfferMessage` for any API key, token, or internal ID fields

### PII in logs
Log calls must never include raw email addresses, passwords, tokens, phone numbers, or
physical addresses. Pattern to grep:
```
grep -rn "Log::" backend/app/ -A3 | grep -i "email\|password\|token\|phone\|address"
```

Safe pattern:
```php
Log::warning('FMCSA lookup failed', ['dot' => $dotNumber, 'error' => $e->getMessage()]);
```
(The existing FmcsaService log is safe — no PII.)

### Debug mode
`APP_DEBUG=true` in production exposes full stack traces, SQL queries, environment variables,
and file paths in JSON error responses. Must be `false` in production. Confirm `.env.example`
defaults to `false`.

### Excessive data exposure
Controllers returning `$model->toArray()` or the full model may expose internal fields.
Use `$model->only([...])` or dedicated API Resources (`php artisan make:resource`) to
explicitly whitelist returned fields.

---

## 10 — Security Misconfiguration

### .env.example defaults
| Variable | Should default to |
|----------|-----------------|
| `APP_DEBUG` | `false` |
| `APP_ENV` | `production` (or clearly document change required) |
| `SESSION_SECURE_COOKIE` | `true` |
| `SESSION_HTTP_ONLY` | `true` |
| `SESSION_SAME_SITE` | `lax` or `strict` |

Passwords and secrets must be empty placeholders — never real values.

### CORS
`config/cors.php` must not allow `['*']` as `allowed_origins` for routes that accept
credentials. Restrict to the exact frontend origin(s).

### Container security
`Dockerfile.dev` (used in dev) runs as root by default. For production: add a non-root user,
exclude `--dev` composer dependencies, and never bake `APP_DEBUG=true` into the image.

### Dependency vulnerabilities
Run regularly:
```bash
docker exec movesetters-app composer audit
```
Patches within a major version are almost always safe to apply immediately.

---

## 11 — Business Logic Vulnerabilities

### Race conditions (TOCTOU)
Concurrent requests can exploit check-then-act gaps. Examples in this codebase:
- Two companies submitting an offer at the same time
- User accepting an offer while a company is updating its price

Wrap state-changing operations in database transactions with pessimistic locking:
```php
DB::transaction(function () use ($offer) {
    $offer = Offer::lockForUpdate()->findOrFail($offer->id);
    // state check + mutation inside the lock
});
```

### Price and quantity manipulation
Monetary and quantity fields must have explicit numeric validation with min/max bounds:
```php
'price'    => ['required', 'numeric', 'min:0.01', 'max:9999999.99'],
'quantity' => ['required', 'integer', 'min:1', 'max:1000'],
```
Missing `min:0` allows negative prices. Missing `max` allows integer overflow in aggregates.

### Subscription bypass
Every feature gated on subscription status must check `$user->hasActiveSubscription()` in the
Policy or middleware — not just at the UI level. A direct API call bypasses frontend checks.

---

## PHP / Laravel-Specific Pitfalls

### Type juggling
PHP loose comparisons (`==`) can produce unexpected equality:
- `"0" == false == null == []` → all true
- Token comparisons must use `===` or `hash_equals()`
- Integer IDs from JSON must be cast to `(int)` before comparison

### Null byte injection
User-supplied filenames containing `\0` (null byte) can truncate paths in some PHP file
functions. Validate filenames with `preg_match('/^[\w\-\.]+$/', $filename)`.

### Insecure deserialization
`unserialize()` on user-controlled data can achieve remote code execution. Use `json_decode()`
instead. Never pass untrusted input to `unserialize()`.

### `object_vars` / reflection on user input
Dynamically resolving class names from request data (`new $className()`, `$method($args)`)
allows attackers to instantiate arbitrary classes. Never derive class or method names from input.
