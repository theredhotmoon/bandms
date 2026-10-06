# Prod ⇄ local sync script — design

**Date:** 2026-10-06
**Branch:** `feature/prod-sync-script`

## Goal

One command that makes the local dev stack's database and uploaded files
identical to production, and one that sends local data back to production —
either everything (recovery / initial seeding) or only band content (the
regular "edit locally, publish" workflow).

## Decisions taken

| Question | Decision |
|---|---|
| Language | Python 3.10+, **standard library only** — the work is piping binary streams between `ssh` and `docker exec` with checked exit codes |
| Interface | subcommands; exactly one direction per run |
| `pull` scope | full 1:1 — every table, including `users` (so local logins become prod's) and `oauth_*` |
| `push` scope | `--content` (B) or `--full` (A), required and mutually exclusive |
| Concurrent prod edits | allowed; a **pull-first guard** refuses a push when prod content changed since the last pull |

## Interface

```
python scripts/sync_db.py pull            [--dry-run] [--db-only | --files-only] [--yes]
python scripts/sync_db.py push --content  [--dry-run] [--db-only | --files-only] [--force]
python scripts/sync_db.py push --full     [--dry-run] [--db-only | --files-only] [--force]
```

- `pull` / `push` are argparse subcommands; no subcommand → usage error, exit 2,
  before any connection is made.
- `push` requires exactly one of `--content` / `--full`; it never defaults.
- `--yes` skips `pull`'s confirmation. **`push` has no `--yes`**: it always
  requires typing the server host.
- `--force` (push only) overrides the pull-first guard, not the migration check,
  the orphan check or the backup.
- `--dry-run` connects and runs every read-only check (fingerprint, migrations,
  orphans, sizes) and prints what it would do, writing nothing on either side.

## Configuration

Read from the root `.env` (parsed by the script, not sourced):

| Key | Default |
|---|---|
| `SYNC_SSH_HOST` | — required |
| `SYNC_SSH_USER` | `deploy` |
| `SYNC_SSH_KEY` | `~/.ssh/bandms_deploy` |
| `SYNC_REMOTE_DIR` | `/opt/bandms` |
| `SYNC_REMOTE_PREFIX` | `bandms-` (prod containers: `bandms-mysql`, `bandms-backend`, `bandms-web`) |
| `SYNC_LOCAL_PREFIX` | `bandms_` (local containers) |

The prod DB root password is read from the prod container's own environment
(`printenv MYSQL_ROOT_PASSWORD`), the same way `scripts/prod-backup-db.sh` does;
the local one from the local container likewise. Passwords travel as
`MYSQL_PWD`, never on a command line. Database names come from each mysql
container's `MYSQL_DATABASE`.

## Table classification

`PROD_ONLY_TABLES` — explicit list at the top of the script; data created by
visitors, customers or the runtime on prod:

`users`, `fan_accounts`, `orders`, `order_items`, `tickets`, `ticket_transfers`,
`newsletter_subscribers`, `presale_codes`, `presale_code_tiers`, `promo_codes`,
`allowed_emails`, `tech_rider_confirmations`, `oauth_access_tokens`,
`oauth_auth_codes`, `oauth_clients`, `oauth_device_codes`,
`oauth_refresh_tokens`, `sessions`, `password_reset_tokens`, `jobs`,
`job_batches`, `failed_jobs`, `cache`, `cache_locks`, `site_dirty_areas`,
`migrations`.

**Content** = every other table, discovered at runtime from
`information_schema`. A table that is in neither the list nor the previous
run's state is printed as `new table → treated as content` so a new migration
can never be classified silently.

Classification only matters to `push --content` and the fingerprint. `pull`
and `push --full` move every table.

## Uploads

Only `storage/app/public` is ever transferred — **never the rest of
`storage/`**, which holds Passport's `oauth-*.key`; replacing those would
invalidate every token on the receiving side. Every upload path in the code
(`photos`, `hero-images`, `posters`, `logos`, `members`, `release-covers`,
`release-photos`, `shop-photos`, `post-blocks`) is band content, so files are
mirrored 1:1 in every mode: `tar c` on the source, streamed, extracted into a
fresh temp directory on the target, then swapped in (old directory removed only
after a successful extract).

## Flows

### pull (prod → local)

1. Preflight: SSH reachable, both mysql containers running, local stack up.
2. Confirm (`y/N`, skipped by `--yes`) — this replaces the local DB.
3. Stop local `backend` (nothing writes mid-import).
4. `ssh … docker exec bandms-mysql mysqldump --single-transaction --routines
   --triggers --events --no-tablespaces <db> | gzip` → streamed to the local
   machine into a temp file; verify the `-- Dump completed` marker.
5. Drop + recreate the local database, import the dump.
6. Files: mirror `storage/app/public` prod → local.
7. Start local `backend`; `php artisan cache:clear`; `docker compose restart web`.
8. Record the prod fingerprint (below) in `.sync-state.json`.

### push (local → prod) — common preamble

1. Preflight as above.
2. **Pull-first guard:** compute the prod content fingerprint; compare with
   `.sync-state.json`. Missing state or a mismatch → abort, listing the tables
   whose checksum changed (unless `--force`).
3. **Migration check:** the set of `migrations.migration` must be identical on
   both sides; otherwise abort, printing the difference. Not overridable.
4. Mode-specific checks (orphans, below). Stop here on `--dry-run`.
5. Confirm by typing the server host exactly.
6. Run `scripts/prod-backup-db.sh` on the server; abort if it fails. Print the
   backup path — it is the recovery route if the push dies part-way.
7. Stop prod `backend` (Caddy then serves its maintenance page for `/api`).
8. Import (mode-specific).
9. Files: mirror local → prod.
10. Start prod `backend`; `cache:clear`; restart prod `web` (rebuilds the site).
11. Re-fingerprint prod and save it, so a second push needs no new pull.

### push --content

- Dump locally with `mysqldump … <db> <content tables…>` — each table's dump
  carries its own `DROP TABLE` + `CREATE TABLE`, so tables are replaced whole.
- **Orphan check** before anything is written: for each foreign key (from
  `information_schema.KEY_COLUMN_USAGE` on prod) where a prod-only table
  references a content table, find prod-only rows whose referenced id is
  absent from the *local* content table. Any hit → abort, listing table,
  row id and missing parent. (Example: a ticket for a concert deleted
  locally.) The ids present locally are fetched from the local DB and checked
  on prod in a temporary table.
- Import with `SET FOREIGN_KEY_CHECKS=0` for the session; prod-only tables are
  not touched.

### push --full

- Dump everything locally, import over prod.
- Printed warnings before the host confirmation: every prod user is logged out
  (`oauth_*` replaced), and any order, ticket, subscriber or fan account
  created on prod since the last pull is lost.

## Fingerprint

`CHECKSUM TABLE <every content table>` on prod, stored as
`{table: checksum}` in `.sync-state.json` (root, gitignored) together with the
host it came from and a timestamp. A state file recorded for a different host
counts as missing.

**Expected consequence:** `shop_items` / `shop_item_variants`.`stock_quantity`
is decremented by every prod sale (`CheckoutController`), so a sale after the
pull trips the guard. That is correct — pushing would reset stock — and the
abort message names those tables so it reads as a sale, not a bug. Same for
any content edited directly in the prod admin.

## Errors

Every subprocess is run with a checked exit code; each step prints
`[n/N] step… ok (1.2s)` and the first failure aborts with the step name and the
command's stderr tail. Temp files go to the system temp directory and are
removed on exit. If a push fails after step 7, the script still tries to start
prod `backend` again and prints the backup path.

## Testing

- `scripts/test_sync_db.py` (`unittest`, no packages) for the pure parts:
  argument rules, table classification, fingerprint diffing, state-file
  host matching, orphan-query building, dump-marker check.
- Real run, by the agent: `pull --dry-run`, then `pull` against prod, then
  verifying local row counts match prod's.
- **`push` is never run by the agent.** The user runs `push --content --dry-run`
  first, then the real push.

## Out of scope

Per-row merge of concurrent edits; syncing anything but the DB and
`storage/app/public`. The script requires `ssh` and `docker` on PATH (both
present on this machine).
