# Syncing with production — `scripts/sync_db.py`

Copies the database and uploaded files between production and the local Docker
stack. Python 3.10+, standard library only; needs `ssh` and `docker` on PATH.
Design: `docs/superpowers/specs/2026-10-06-prod-sync-script-design.md`.

```bash
python scripts/sync_db.py pull                 # prod -> local, full 1:1
python scripts/sync_db.py push --content       # local band content -> prod
python scripts/sync_db.py push --full          # local -> prod, everything
```

Every command takes `--dry-run` (run all checks, write nothing) and
`--db-only` / `--files-only`. `pull` takes `--yes`; `push` takes `--force`
and never `--yes` — it always asks you to type the server host.

## Setup

In the root `.env` (local only — the server never reads these):

```dotenv
SYNC_SSH_HOST=YOUR_SERVER_IP
SYNC_SSH_USER=deploy                 # default
SYNC_SSH_KEY=~/.ssh/bandms_deploy    # default
```

Passwords are never configured: every MySQL call runs inside the mysql
container and reads `MYSQL_ROOT_PASSWORD` from that container's environment.

## What each mode moves

| | Database | Uploads |
|---|---|---|
| `pull` | every table, replaced 1:1 | `storage/app/public`, mirrored |
| `push --content` | content tables only | `storage/app/public`, mirrored |
| `push --full` | every table, replaced 1:1 | `storage/app/public`, mirrored |

**Prod-only tables** — `push --content` never touches them:
`users`, `fan_accounts`, `allowed_emails`, `orders`, `order_items`, `tickets`,
`ticket_transfers`, `presale_codes`, `presale_code_tiers`, `promo_codes`,
`newsletter_subscribers`, `tech_rider_confirmations`, `oauth_*`, `sessions`,
`password_reset_tokens`, `jobs`, `job_batches`, `failed_jobs`, `cache`,
`cache_locks`, `site_dirty_areas`, `migrations`. Every other table is content —
including any table a new migration adds, which the push prints as
`new table -> treated as content`. The list is `PROD_ONLY_TABLES` in
`scripts/prodsync/tables.py`.

**Only `storage/app/public` ever moves.** The rest of `storage/` holds
Passport's `oauth-*.key`; replacing it would log out every user on that side.

## After a pull

- Your local admin login is **prod's** — `users` came across 1:1.
- Local now holds real customer data (orders, subscribers' emails).
- E2E specs run against prod-shaped data from here on.
- To get your previous local DB back, keep a dump before pulling — the script
  does not make one locally.

## The pull-first guard

`pull` records a checksum of every prod content table in `.sync-state.json`
(gitignored). `push` recomputes it and **refuses** if anything changed:

```
ERROR: prod content changed since the last pull (...): shop_items
```

Two ordinary things trip it:

- **A shop sale.** Checkout decrements `stock_quantity` on `shop_items` /
  `shop_item_variants`, which are content. Pushing would reset stock, so the
  refusal is correct.
- **An edit in the prod admin.**

The fix is `pull` — which **replaces your local edits**, so pull right before
you start editing, not hours ahead. `--force` overrides the guard and
overwrites whatever changed.

After a successful push the script re-records prod's fingerprint, so a second
push needs no new pull.

## What a push checks before writing anything

1. prod and local containers are running
2. local and prod have the **same set of migrations** — deploy or migrate first
   otherwise; not overridable. It runs before the guard, so a table from a
   migration you have not deployed yet is reported as that, not as "prod
   changed - pull first" (a pull would wipe the local migration)
3. the pull-first guard (above)
4. `--content` only: the **orphan check** — no prod-only row may point at a
   content row missing locally (e.g. a ticket for a concert you deleted), and
   no local content row may point at a prod-only row missing on prod
5. you type the server host
6. when the push includes the database: `scripts/prod-backup-db.sh` runs on
   the server and must report a **verified** backup — a run that backs nothing
   up aborts the push. Push backups go to `/opt/bandms/backups/sync/` and only
   the newest **5** are kept there, so pushing never ages out the 20 backups
   deploys keep in `/opt/bandms/backups/`

7. when the push includes files (`--files-only` too): prod's
   `storage/app/public` is archived to
   `/opt/bandms/backups/sync/uploads-<UTC stamp>.tar.gz`, listed with
   `tar -tzf` before it is kept, newest **5** kept. It first requires free
   disk of at least the uploads' size **plus 2 GB**, since the archives share
   the disk with MySQL and the deploy backups (`not enough disk: …` otherwise).
   A failed archive aborts the push before anything is written.

The upload mirror replaces prod's folder with your local one, so any prod file
missing locally is deleted — the archive is the copy. The pull-first guard
still stops most of that happening: an upload in the prod admin adds a content
row, so the push refuses until you pull, unless you pass `--force`.

The two rotations are independent: `prod-backup-db.sh` only counts
`bandms-*.sql.gz`, the upload archive only `uploads-*.tar.gz`.

Then: prod `backend` is stopped (Caddy shows the maintenance page for the
API), **the guard is checked a second time** — a sale during the prompt, the
dump or the backup would otherwise be overwritten — the dump is loaded, the new
fingerprint is recorded while nothing can write, `backend` is started, uploads
are mirrored, the cache is cleared and `web` is restarted so the public site
rebuilds.

`--files-only` pushes run the guard too: a new upload in the prod admin adds a
`photos`/`hero_images` row, and mirroring would delete the file under it.

## If a push fails part-way

The output names the backup it just made, e.g.
`/opt/bandms/backups/sync/bandms-20261006-101500.sql.gz`, and **prod `backend` is
left stopped on purpose**. Its entrypoint runs `migrate` and, when
`band_profiles` is empty, `db:seed` — starting it on a half-loaded database
would publish a freshly seeded default site. Restore the backup with the steps
in [`database-backup-and-recovery.md`](database-backup-and-recovery.md), then
`docker compose -f docker-compose.prod.yml start backend` on the server.

If the second guard check is what stopped the push, nothing was written and
`backend` is started again automatically.

### Restoring uploads

A failed upload mirror names the archive it took. The mirror swaps folders only
after a complete transfer, so a failure normally leaves prod's uploads intact;
restore when files are missing after a push that succeeded — one you regret,
or one forced past the guard:

This is the same extract-then-swap the push itself uses (`UNPACK` in
`scripts/prodsync/ops.py`): the archive is unpacked beside the live folder and
replaces it only once the extract is complete, so a dropped connection or a
mistyped path leaves the current uploads untouched. Never `rm -rf public`
first.

```bash
ssh deploy@YOUR_SERVER_IP 'cd /opt/bandms && docker exec -i bandms-backend sh -c "
  set -e; cd /var/www/html/storage/app; rm -rf .sync-incoming .sync-old; mkdir .sync-incoming
  tar -xzf - -C .sync-incoming; test -d .sync-incoming/public
  if [ -d public ]; then mv public .sync-old; fi
  mv .sync-incoming/public public; rm -rf .sync-old .sync-incoming
  chown -R www-data:www-data public" < backups/sync/uploads-YYYYMMDD-HHMMSS.tar.gz \
  && docker compose -f docker-compose.prod.yml restart web'
```

The last line republishes the public site, which bakes image URLs in.

## Tests

```bash
python -m unittest discover -s scripts/prodsync/tests -t scripts -v
```
