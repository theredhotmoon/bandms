# Website Module Management — Design Spec

**Date:** 2026-06-29  
**Status:** Approved  
**Author:** Kuba Urbańczyk

---

## Overview

A new admin panel sub-page (`/admin/website-modules`) that shows the full public website (Astro SSG) section structure and allows enabling/disabling each module. Disabling a module makes all pages in that section return 404 on the public site and removes the nav link. Changes can trigger an automatic or manual Astro rebuild.

---

## Scope

### In scope
- Enable/disable toggle for each of the 10 public website modules
- Auto-rebuild on change toggle (site-level setting)
- Manual "Rebuild Public Site" button
- Rebuild webhook in the web container (hot-swap, no downtime)
- Astro build integration: 404 for disabled modules, conditional nav links
- Admin panel view + composables + route

### Out of scope (future)
- Per-module configurable settings (items per page, etc.)
- Nav link ordering / drag-to-reorder
- Separate sub-page visibility (list vs. detail toggled independently)

---

## Architecture: Approach B — Database + Rebuild Webhook

Module state lives in the database (consistent with the rest of the stack). The backend triggers an Astro rebuild by POSTing to a lightweight webhook server inside the `web` container on the internal Docker network. The public site stays up during rebuild — Nginx continues serving the old build while the new one compiles, then swaps atomically.

---

## Section 1: Data Layer

### `website_modules` table

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `slug` | varchar unique | See slug list below |
| `display_name` | varchar | Human-readable name |
| `enabled` | boolean | Default `true` |
| `sort_order` | int | Default 0, reserved for future ordering |
| `created_at` / `updated_at` | timestamps | |

**Module slugs (seeded as enabled by default):**

| Slug | Display Name | Pages covered |
|---|---|---|
| `concerts` | Concerts | `/concerts`, `/concerts/[slug]` |
| `releases` | Releases | `/releases`, `/releases/[id]` |
| `posts` | News | `/posts`, `/posts/[id]` |
| `photos` | Photos | `/photos` |
| `press` | Press | `/press` |
| `videos` | Videos | `/videos` |
| `merch` | Shop | `/merch`, `/merch/[slug]` |
| `epk` | EPK | `/epk` |
| `tech-rider` | Tech Rider | `/tech-rider` |
| `newsletter` | Newsletter | `/newsletter` only (confirm/unsubscribe always on) |

### `site_settings` table

| Column | Type | Notes |
|---|---|---|
| `key` | varchar unique | |
| `value` | text | |
| `created_at` / `updated_at` | timestamps | |

**Seeded rows:**

| Key | Default Value |
|---|---|
| `auto_rebuild` | `false` |

---

## Section 2: API Layer (Laravel)

### New files
- `app/Models/WebsiteModule.php`
- `app/Models/SiteSetting.php`
- `app/Http/Controllers/WebsiteModuleController.php`
- `app/Http/Resources/WebsiteModuleResource.php`
- `database/migrations/YYYY_MM_DD_create_website_modules_table.php`
- `database/migrations/YYYY_MM_DD_create_site_settings_table.php`
- `database/seeders/WebsiteModuleSeeder.php`

### Endpoints

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/site-config` | public | `{ modules: { concerts: true, videos: false, … } }` — consumed by Astro at build time |
| `GET` | `/api/admin/modules` | admin | Full module list + `auto_rebuild` setting |
| `PUT` | `/api/admin/modules/{slug}` | admin | Toggle `enabled`; triggers rebuild if `auto_rebuild = true` |
| `PUT` | `/api/admin/site/settings` | admin | Update site settings (e.g. `auto_rebuild`) |
| `POST` | `/api/admin/site/rebuild` | admin | POST to `http://web:3001/rebuild`, return `{ status: "rebuild_started" }` |

### Auto-rebuild logic
`WebsiteModuleController::update()` checks `SiteSetting::get('auto_rebuild')` after saving the module. If `true`, it immediately calls the rebuild webhook before returning the response.

---

## Section 3: Rebuild Webhook (web container)

### New file: `web/docker/rebuild-webhook.js`

A minimal Node.js HTTP server (~25 lines):
- Listens on **port 3001** — Docker internal network only, never exposed on host
- `POST /rebuild` → spawns `start.sh` as a detached background process, responds `{ status: "started" }` immediately
- Any other request → 404

### Changes to `web/docker/start.sh`
After Nginx starts: `node /docker/rebuild-webhook.js &`

### `docker-compose.yml`
Port 3001 is **not** added to `ports:` — internal only. Backend reaches it via `http://web:3001/rebuild`.

### Rebuild behaviour
- `start.sh` re-runs: polls `/api/health`, fetches all data, runs `astro build`, outputs to dist
- Nginx serves the old dist during the build — no downtime
- After build completes, Nginx serves the new dist (static files swapped on disk)

---

## Section 4: Astro Build Integration

### New function in `web/src/lib/cms.ts`
`fetchSiteConfig()` → calls `GET /api/site-config`, returns `Record<string, boolean>` module map.

### Each toggleable page
Both list pages and detail pages (e.g. `concerts/index.astro` and `concerts/[slug].astro`) add at the top of their frontmatter:

```astro
---
const siteConfig = await fetchSiteConfig()
if (!siteConfig.modules['concerts']) {
  return new Response(null, { status: 404 })
}
---
```

In Astro 4 SSG mode, returning a 404 Response means Astro does not write the output file — Nginx naturally serves 404.

### `Header.astro`
Fetches `fetchSiteConfig()` once and conditionally renders each nav link:

```astro
{ siteConfig.modules['concerts'] && <a href="/concerts">Concerts</a> }
```

### Newsletter exception
`newsletter/confirm/[token]/index.astro` and `newsletter/unsubscribe/[token]/index.astro` are **not** gated — existing subscribers must always be able to unsubscribe regardless of the newsletter module state.

---

## Section 5: Admin Panel (Vue 3)

### New files
- `app/src/types/website-module.ts` — `WebsiteModule`, `SiteSettings` interfaces
- `app/src/api/website-modules.ts` — fetch/update functions
- `app/src/composables/useWebsiteModules.ts` — TanStack Query composable: `useModules()`, `useUpdateModule()`, `useSiteSettings()`, `useUpdateSiteSettings()`, `useTriggerRebuild()`
- `app/src/views/admin/WebsiteModulesView.vue` — page view

### New route (in `app/src/router/index.ts`, admin section)
```js
{ path: '/admin/website-modules', component: WebsiteModulesView, meta: { requiresAuth: true } }
```

### UI layout

```
Website Modules
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ Auto-rebuild on changes  ●──] [🔄 Rebuild Public Site]
Status: Last rebuilt 3 min ago  (or "Rebuild pending")

┌──────────┐ ┌──────────┐ ┌──────────┐
│ Concerts │ │ Releases │ │  Posts   │
│ /concerts│ │/releases │ │ /posts   │
│  ● ON    │ │  ● ON    │ │  ○ OFF   │
└──────────┘ └──────────┘ └──────────┘
(3-column card grid for all 10 modules)
```

### Interactions
| Action | Behaviour |
|---|---|
| Toggle module | `PUT /api/admin/modules/{slug}`; if `auto_rebuild` on → shows spinner on rebuild button while rebuilding |
| "Rebuild Public Site" | `POST /api/admin/site/rebuild`; button shows "Rebuilding…" then reverts; disabled while `auto_rebuild` active |
| `auto_rebuild` toggle | `PUT /api/admin/site/settings`; no rebuild triggered |

### Admin sidebar
A "Website" nav link added pointing to `/admin/website-modules`.

---

## Key constraints & decisions

| Decision | Rationale |
|---|---|
| DB as source of truth (not env vars / config files) | Consistent with existing stack; extensible for future per-module settings |
| Rebuild webhook over Docker socket | No root-equivalent access to host Docker daemon; safer for production |
| Hot-swap rebuild (no downtime) | Old build stays served while new one compiles |
| Newsletter confirm/unsubscribe always-on | GDPR-aligned: off-ramp must always exist |
| `auto_rebuild` in `site_settings` table | Generic key-value store is reusable for future site-level settings |
| `/api/site-config` is public | Astro fetches it unauthenticated at build time from inside the container |
