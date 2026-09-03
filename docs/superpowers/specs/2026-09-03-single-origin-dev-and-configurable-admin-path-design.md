# Single-origin dev, and a configurable admin path

**Date:** 2026-09-03
**Status:** approved

## Problem

Two problems with one root cause.

**1. `localhost:8081/` is a blank page.** Production runs Caddy in front of
everything: the `@spa` allowlist goes to the Vue SPA, all else falls through to
the Astro public site. **Development has no Caddy.** It exposes two naked ports —
8081 (`frontend`, admin SPA) and 4322 (`web`, public site) — so no dev URL
behaves the way production does. After #65 removed the SPA's public views, the
SPA root became an empty shell, and a user reasonably read that as the public
site having been destroyed.

**2. The admin panel sits at a fixed, guessable `/admin` and `/login`.**

## Goals

- One dev origin, `localhost:8081`, routing identically to production.
- The entire admin surface behind a configurable path, default `admin`.
- The default must reproduce today's URLs exactly, so nothing breaks unopted-in.

## Non-goals

- Runtime (no-rebuild) reconfiguration of the admin path. Vite bakes env at
  build time; we match the existing `VITE_CARTO_KEY` pattern instead.
- Any change to authentication or authorization. This is obscurity layered on
  top of the existing auth guard and login rate limit, not a replacement.

## Design

### Dev topology

`docker-compose.yml` gains a `caddy` service that mounts the **existing**
`docker/caddy/Caddyfile`. One routing config, both environments.

`frontend` moves to **8082** because Caddy takes 8081. `.env` and `.env.example`
must both change or `up` fails with a bind collision. `web` stays on 4322. Both
remain directly reachable for debugging.

### `ADMIN_PATH` plumbing

| Consumer | Mechanism | Reload cost |
|---|---|---|
| Caddy | `@spa path /{$ADMIN_PATH:admin}*` | `up -d --force-recreate caddy` |
| Vue SPA | `VITE_ADMIN_PATH` build arg | `docker compose build frontend` |
| Astro | none — the footer link is deleted | n/a |

Caddy's env substitution inside a `path` matcher and its `{$VAR:default}` form
were both verified with `caddy adapt` before committing to this design.

The value is normalised once, in `app/src/config/admin.ts`:

```ts
const raw = (import.meta.env.VITE_ADMIN_PATH as string) ?? 'admin'
export const ADMIN_PATH = raw.replace(/^\/+|\/+$/g, '') || 'admin'
export const adminUrl = (sub = '') => (sub ? `/${ADMIN_PATH}/${sub}` : `/${ADMIN_PATH}`)
```

Paths rather than route names, because `AdminLayout.vue` matches on path
prefixes and stores its nav groups as path arrays. One concept covers all 85
call sites.

### Login is a state, not a URL

The `/login` route is deleted. `/{ADMIN_PATH}` renders `AdminEntry.vue`, which
shows the login form when signed out and the dashboard when signed in. Deeper
admin routes bounce to `{ name: 'admin' }`.

This is what makes the obscurity hold: there is no login URL to discover, only
*the* admin URL. It also minimises churn — the 139 `goto('/admin…')` E2E calls
are untouched; only `e2e/fixtures/auth.ts` and 13 direct `/login` gotos move.

### The public footer link is removed

`web/src/components/Footer.astro:112` rendered `<a href="/admin">` on every
public page. Left in place it publishes the hidden URL site-wide and reduces the
feature to nothing. The admin is a bookmark for a handful of band members, not a
public destination.

### Failure mode for wrong guesses

`/login`, and `/admin` when a custom path is set, fall through to Astro and 404.
Indistinguishable from any other nonexistent page: no redirect, no bounce, no
signal that an admin panel exists.

## Security note

This is obscurity, not access control. It reduces automated scanning of
`/login`. The real protection remains the router's auth guard and the rate limit
on `/api/auth/login`, neither of which changes.

## Testing

- Unit: `adminUrl()` normalisation — `/admin/`, `admin`, `''`, `//admin//`.
- E2E: auth fixture and the 13 direct `/login` gotos; a spec asserting `/login`
  404s.
- `caddy validate` on the edited Caddyfile before recreating — a malformed one
  takes down the entire site, not just the changed route.
- Full `bash scripts/test-all.sh` before shipping.

## Files

`docker-compose.yml`, `docker-compose.prod.yml`, `.env`, `.env.example`,
`docker/caddy/Caddyfile`, `app/Dockerfile`, `app/src/config/admin.ts` (new),
`app/src/views/AdminEntry.vue` (new), `app/src/router/index.ts`, `app/src/App.vue`,
`app/src/api/client.ts`, `app/src/components/**` (85 call sites),
`web/src/components/Footer.astro`, `app/e2e/**`,
`.github/workflows/deploy.yml`, `CLAUDE.md`.

Note: `deploy.yml` passes **no** build args today, so `VITE_CARTO_KEY` is
already empty in production builds. Both args get wired.
