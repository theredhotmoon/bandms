# Rebuilding the Public Site

Why a concert you just added in the admin is not on the public site, and how to
push it live without a deploy. Written after exactly that confusion — the
rebuild button already existed and was simply never found.

Companion to [`deployment.md`](deployment.md). The footguns around stale content
are catalogued in the root [`CLAUDE.md`](../CLAUDE.md); this doc is the
operator's view of the same machinery.

---

## Quick reference

| I need to… | Do this |
|---|---|
| Publish content I just edited in the admin | `/admin/website-modules` → **↺ Rebuild Public Site** |
| Same, from a shell | `docker exec bandms_web wget -qO- --post-data='' http://localhost:3001/rebuild` |
| Check whether a rebuild is running | `docker exec bandms_web wget -qO- http://localhost:3001/status` |
| Publish after changing `web/src` **code** | `docker compose build web && docker compose up -d web` |
| Full clean republish | `docker compose restart web` |

**Content changes never need an image rebuild or a deploy.** If you find
yourself redeploying to see a gig, you are using the wrong lever.

---

## Why the site goes stale

`web/` is an **Astro static site generator**. It does not query the API when a
visitor loads a page. It queries the API *once*, at container startup, and bakes
the result into flat HTML:

```sh
# web/docker/start.sh
until wget -qO- "${API_BASE}/api/health"; do sleep 2; done   # wait for the API
pnpm build                                                    # fetch ALL data, emit HTML
rm -rf /usr/share/nginx/html/*                                # publish (clean)
cp -r /app/dist/* /usr/share/nginx/html/
node /docker/rebuild-webhook.js &                             # on-demand rebuilds
exec nginx -g "daemon off;"
```

After that, Nginx serves frozen files. A new concert exists in MySQL and in
`GET /api/concerts`, but `dist/en/concerts/index.html` was written before the
concert did. A redeploy appears to fix it only as a side effect: it restarts the
container, which re-runs the script above.

This is the ordinary SSG trade-off — sub-10ms page loads and no database load
from public traffic, in exchange for freshness becoming an **explicit action**.
The admin SPA (`app/`) does not have the problem because it fetches live over
`/api/*`, which is why the same record looks correct in one place and stale in
the other.

---

## The on-demand rebuild

A small Node server runs alongside Nginx inside the `web` container for the
whole life of the container.

| Piece | File |
|---|---|
| Webhook server (port 3001) | `web/docker/rebuild-webhook.js` |
| Build + publish script it runs | `web/docker/rebuild.sh` |
| Laravel proxy to it | `WebsiteModuleController::triggerRebuild()` |
| Routes | `POST /api/admin/site/rebuild`, `GET /api/admin/site/rebuild/status` |
| Admin UI | `app/src/views/admin/WebsiteModulesView.vue` |

Port 3001 is **not published** in either compose file — it is reachable only on
the `bandms` Docker network, which is why the backend calls it as
`http://web:3001` and why it is not an unauthenticated public endpoint. The
Laravel routes in front of it sit behind `auth:api`.

### The button

`/admin/website-modules`, top right: **↺ Rebuild Public Site**, with a live
progress bar and an elapsed-second counter. It rebuilds the **entire** site —
concerts, releases, posts, everything — not just website modules. Roughly
30–60s.

`POST /rebuild` returns `202 {"status":"started"}`, or **`409` if a build is
already in progress** — concurrent requests are rejected, not queued. The
webhook kills any build still running after 5 minutes and reports `error`.

### From a shell

```sh
docker exec bandms_web wget -qO- --post-data='' http://localhost:3001/rebuild
docker exec bandms_web wget -qO- http://localhost:3001/status
# {"status":"idle","startedAt":null,"finishedAt":null}
```

`status` is one of `idle`, `building`, `done`, `error`.

---

## Known gaps

Both are **recorded, not fixed** — rebuilds are triggered manually for now by
choice.

### 1. "Auto-rebuild on changes" only covers module edits

The checkbox next to the rebuild button sets `SiteSetting` `auto_rebuild`. It is
consulted in exactly one place:

```php
// WebsiteModuleController::update() — the only caller of triggerRebuild()
if (SiteSetting::get('auto_rebuild', 'false') === 'true') {
    $this->triggerRebuild();
}
```

`ConcertController` does not call it. Neither does any other resource
controller, and there is no `api/app/Observers/` directory. So the toggle means
*"rebuild when I edit module settings"*, not *"rebuild when I add a gig"* —
which is precisely the surprise this doc was written for. **Adding content still
requires pressing the button.**

If this is ever wired up, the design question is what to do about cost: a
rebuild takes 30–60s, and editing five concerts in a row would fire five
overlapping builds. Since `POST /rebuild` answers `409` rather than queueing,
the later edits would be **silently dropped from the build**. A naive
`triggerRebuild()` on every `save()` is therefore worse than the manual button,
not better. Debouncing through a queued job, or a dirty-flag plus a scheduled
sweep, are the two shapes worth considering.

### 2. The webhook path publishes with a merge, not a clean copy

`start.sh` clears the web root before copying. `rebuild.sh` — the path the
button uses — does not:

```sh
# start.sh  ✅
rm -rf /usr/share/nginx/html/* && cp -r /app/dist/* /usr/share/nginx/html/

# rebuild.sh  ⚠️ merges
cp -r /app/dist/* /usr/share/nginx/html/
```

`cp -r` merges into the existing tree. A button-triggered rebuild will happily
*add* a new gig, but **deleting** a concert leaves its page served from the
previous build. Same failure as the "disabled module leaves its page served"
footgun in `CLAUDE.md`, re-introduced on the newer code path.

**Workaround until it is fixed:** after deleting content, publish with
`docker compose restart web` rather than the button — `start.sh` clears the
directory first.

---

## Choosing the right lever

| What changed | Button | `restart web` | `build web && up -d web` |
|---|---|---|---|
| Content (concert, release, post, page copy) | ✅ | ✅ | ✅ |
| Content **deleted** | ⚠️ stale page survives | ✅ | ✅ |
| Module enabled/disabled, slug, nav order | ✅ | ✅ | ✅ |
| `web/src` source, theme, component code | ❌ | ❌ | ✅ |
| `PUBLIC_THEME` or other compose env | ❌ | ❌ | ✅ |

The last two rows are the trap documented at length in `CLAUDE.md`: the `web`
service has **no bind mount**, so a restart rebuilds the source baked into the
image, not the source on disk. Both `restart` and the webhook will run a
complete, green Astro build of the *old* code and change nothing.

---

## When a rebuild fails

The build is **all-or-nothing** — one page that throws aborts all 35. A failed
webhook build reports `error` and leaves the previously published files in
place, so the site stays up on stale content rather than going blank.

```sh
docker logs bandms_web 2>&1 | grep -A5 ERROR         # what threw
cd web && API_BASE=http://localhost:8081 pnpm build  # reproduce locally, faster
```

A build failure *at container startup* is far worse than one from the webhook:
`restart: unless-stopped` turns it into a crash loop that takes the whole public
site down. See the crash-loop section of `CLAUDE.md` for diagnosis.
