# TODO

Open work, most important first. Each item says enough to pick it up cold.

---

## Pre-sale early access — designed, not built

**Status:** design approved, no implementation. Spec: [`docs/superpowers/specs/2026-08-23-presale-early-access-design.md`](docs/superpowers/specs/2026-08-23-presale-early-access-design.md)

**The problem:** pre-sale shipped as a shell. There are codes, a `presale_code_tiers` pivot, admin CRUD and a `POST /api/presale-codes/validate` endpoint — but nothing marks a ticket as gated, hides it, or refuses to sell it. `ConcertTicketController` and `CheckoutController` have zero presale references, and `used_count` is never incremented. Two Vue components (`PresaleCodeManager.vue`, `PresaleUnlockWidget.vue`) were built against gating that was never implemented and are still unreferenced.

**What was decided:** a code means *early access before public on-sale* — it shifts when you may buy, not what you pay. No new gating flag; `available_from` already expresses "not yet on sale". The code travels with the request (listing query param, checkout payload) and is re-validated server-side in both places, so the client's unlocked state is presentation only.

**Next step:** write the implementation plan from the spec.

**Two judgement calls to revisit when building:** `max_uses` is checked at checkout rather than reserved (a code can finish slightly over its limit), and `PresaleUnlockWidget.vue` gets deleted rather than wired — the Astro concert page has no Vue runtime, so the input is reimplemented inline.

---

## Other open items

### E2E flakiness is connection resets, not memory
Every full run loses ~2 specs, a different pair each time, always downstream of `[vite] http proxy error … ECONNRESET` — never an assertion mismatch. No OOM or GPU signatures in any run. Suspected cause is `pm.max_children = 20` in `api/docker/www.conf`: an admin page fires 6–10 parallel API calls, times two Playwright workers plus setup traffic. **Untested** — raising the pool trades RAM for connection headroom. Documented in `CLAUDE.md`.

### `--prefer-source` makes builds ~8× slower and fragile
`api/Dockerfile` uses `composer install --prefer-source`, which git-clones every package instead of downloading zips. Observed: one composer step took **51 minutes** and then died on a single DNS blip. `--prefer-dist` would fix both. It was introduced in PR #10; worth checking whether whatever prompted it still applies.

### `FRONTEND_URL` needs a real value in production
The variable is now passed through both compose files, but production needs it set to the actual domain. It drives CORS allowed origins (`config/cors.php`, which otherwise falls back to `http://localhost:5173`) and every link in outgoing email (`config/newsletter.php`).

### Admin routes return 500 instead of 401
Any admin route without an `Accept: application/json` header returns 500, not 401 — Laravel's auth middleware trying to redirect to a `login` named route that does not exist in an API-only app. Verified across five endpoints. Needs an exception-handler fix.

### A 429 is reported to users as a server error
`POST /api/auth/login` returns `{"message": "Too Many Attempts."}` when throttled, but the login page renders **"Internal Server Error"**. The SPA collapses an unrecognised status into a generic message, so a rate-limited user is told the server broke instead of to wait a minute.

### Docker housekeeping
`docker system df` errors on a corrupt build-cache record left over from a disk-full incident (`too many levels of symbolic links`) — builds work, only the accounting fails. Separately, the WSL2 disk at `%LOCALAPPDATA%\Docker\wsl\data\ext4.vhdx` stays ~175 GB after pruning; WSL2 disks never shrink on their own and need explicit compaction to return the space to Windows.

### Stale branches
`astro-restoration-wip` has 2 unmerged commits (tip is literally *"WIP: Save Astro page restoration work before reverting"*) — not merged anywhere, so deleting it loses work. The agent worktree at `.claude/worktrees/agent-ab3efffd3d61327c7` holds 14 uncommitted modified files.

### Known issues carried from the ticket platform (PR #36)
- dompdf does not support `display:flex`/`gap`, so the `.row` layout in `pdf.blade.php` stacks instead of sitting side by side. Cosmetic.
- UUID regex is loose in `qrCode()`/`walletGoogle()` and strict in `pdf()`/`walletApple()`. Cosmetic inconsistency, no security impact.
- Bulk pre-sale code generation has no intra-batch collision guard. Astronomically unlikely at `count <= 100`.
- `PresaleUnlockWidget` label is not programmatically associated with its input (missing `for`/`id`). Accessibility.
- Some ticket tests call `ConcertTicketType::create()` directly rather than using a factory.

### No E2E coverage of the public site
Every spec targets the admin SPA on `:5173`. The Astro site on `:4322` — including the public ticket purchase flow — has none, and covering it needs a second Playwright project.
