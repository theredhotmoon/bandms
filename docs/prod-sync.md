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

**Contents** — *Instructions:* [1 Setup](#1-one-time-setup) ·
[2 Publish local edits](#2-publish-content-you-edited-locally) ·
[3 Pull safely](#3-get-productions-data-without-losing-your-local-data) ·
[4 Check backups](#4-check-the-backups-on-the-server) ·
[5 Undo a push](#5-undo-a-push-restore-the-production-database) ·
[6 When it refuses](#6-when-it-refuses-error-messages) —
*Reference:* [what each mode moves](#what-each-mode-moves) and below.

Every command below was run against this project's real stack before it was
written down. Run them from the **repo root** in **Git Bash** (the shell the
repo's scripts assume). Commands marked *on the server* go through `ssh`.

---

# Instructions

## 1. One-time setup

1. **Check the tools** — all three must answer:

   ```bash
   python --version     # 3.10 or newer
   ssh -V
   docker compose ps    # the local stack must be up: bandms_mysql, _backend, _web
   ```

2. **Tell the script where production is.** Add to the root `.env` (local
   only — the server never reads these):

   ```dotenv
   SYNC_SSH_HOST=YOUR_SERVER_IP
   SYNC_SSH_USER=deploy                 # default
   SYNC_SSH_KEY=~/.ssh/bandms_deploy    # default
   ```

   No passwords are configured anywhere: every MySQL call runs inside the
   mysql container and reads `MYSQL_ROOT_PASSWORD` from that container's own
   environment.

3. **Check you can reach the server** — it must list the `bandms-*` containers
   without asking for a password:

   ```bash
   ssh -i ~/.ssh/bandms_deploy deploy@YOUR_SERVER_IP "docker ps --format '{{.Names}}'"
   ```

4. **Try it without writing anything:**

   ```bash
   python scripts/sync_db.py pull --dry-run
   ```

   ```
   [1] check prod is reachable and its containers are running... ok (0.7s)
   [2] check local containers are running... ok (0.4s)
   [3] read prod tables... ok (0.8s)
       99 tables: 74 content, 25 prod-only
   [4] measure prod uploads... ok (0.8s)
       prod storage/app/public: 4 files, 976.0K
       dry run - nothing written
   ```

   Every line ends in `ok`. Anything else stops the run with an `ERROR:` line
   — look it up in [section 6](#6-when-it-refuses-error-messages).

## 2. Publish content you edited locally

The normal loop. Do it in one sitting: a pull replaces your local edits, and
any change on production after your pull (a shop sale counts) blocks the push.

1. **Pull** right before you start, so you edit on top of what is live:

   ```bash
   python scripts/sync_db.py pull
   ```

   It asks `Replace the LOCAL database and uploads with production? [y/N]`.
   Your previous local data is gone after `y` — see
   [section 3](#3-get-productions-data-without-losing-your-local-data) if it
   matters. Your local admin login is now production's.

2. **Edit** in the local admin, `http://localhost:8081/admin` — concerts,
   posts, releases, shop items, page copy, images. Check the result on
   `http://localhost:8081/en/` (`docker compose restart web` rebuilds the
   local public site).

3. **Dry-run the push:**

   ```bash
   python scripts/sync_db.py push --content --dry-run
   ```

   ```
   [1] check prod is reachable and its containers are running... ok (1.0s)
   [2] check local containers are running... ok (0.3s)
   [3] read local tables... ok (0.4s)
   [4] compare migrations... ok (1.2s)
   [5] check prod has not changed since the last pull... ok (0.8s)
   [6] check prod-only rows keep their parents... ok (14.4s)
   [7] measure local uploads... ok (0.5s)
       local storage/app/public: 4 files, 976.0K
       dry run - all checks passed, nothing written
   ```

   If it ends in `ERROR:` instead, nothing was written; see
   [section 6](#6-when-it-refuses-error-messages).

4. **Push:**

   ```bash
   python scripts/sync_db.py push --content
   ```

   It repeats every check above, then prints
   `This replaces prod content tables and uploads with your local copy.` and
   asks `Type the server host (YOUR_SERVER_IP) to continue:` — type it exactly.
   Then, in order:

   | Step | What you see | What happens |
   |---|---|---|
   | back up prod uploads | `prod uploads backup: …/sync/uploads-<stamp>.tar.gz` | archive of production's files |
   | dump local database | `dump: 15 KB` | your content tables |
   | back up prod database | `prod backup: …/sync/bandms-<stamp>.sql.gz` | full dump of production — **write this name down** |
   | stop prod backend | | `/api` shows the maintenance page (~15 s) |
   | re-check prod has not changed | | a sale during the prompt stops it here, nothing written |
   | load into prod database | | your content replaces production's |
   | start prod backend | | waits until healthy |
   | mirror uploads local -> prod | | your files replace production's |
   | restart prod web | | the public site rebuilds — pages may 502 for ~30–40 s |

   It ends with `push complete.`

5. **Check the live site** a minute later.

To push only one half, add `--db-only` or `--files-only`. Never use
`push --full` for this — it also replaces users, orders and tickets.

## 3. Get production's data without losing your local data

`pull` keeps no copy of what it replaces. If your local database or uploads
hold anything you want back, save both first — about a second each:

```bash
mkdir -p ~/bandms-local-backups
docker exec bandms_mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --events --no-tablespaces "$MYSQL_DATABASE"' \
  | gzip > ~/bandms-local-backups/local-$(date +%Y%m%d-%H%M%S).sql.gz
docker exec bandms_backend sh -c 'tar -C /var/www/html/storage/app -czf - public' \
  > ~/bandms-local-backups/local-uploads-$(date +%Y%m%d-%H%M%S).tar.gz

python scripts/sync_db.py pull
```

The dump is good if its last line says `-- Dump completed`:
`gzip -dc ~/bandms-local-backups/local-<stamp>.sql.gz | tail -1`.

**Keep every container path inside `sh -c '…'` as above.** Git Bash rewrites a
bare argument like `/var/www/html/...` into `C:/Program Files/Git/var/...`
before Docker sees it, and the command fails with `Cannot open: No such file
or directory`.

**To go back** to the saved state (this replaces the local database and
uploads again):

```bash
gzip -dc ~/bandms-local-backups/local-<stamp>.sql.gz \
  | docker exec -i bandms_mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"'

docker exec -i bandms_backend sh -c "
  set -e; cd /var/www/html/storage/app; rm -rf .sync-incoming .sync-old; mkdir .sync-incoming
  tar -xzf - -C .sync-incoming; test -d .sync-incoming/public
  if [ -d public ]; then mv public .sync-old; fi
  mv .sync-incoming/public public; rm -rf .sync-old .sync-incoming
  chown -R www-data:www-data public" < ~/bandms-local-backups/local-uploads-<stamp>.tar.gz

docker exec bandms_backend php artisan cache:clear
docker compose restart web
```

**Do not push after going back.** The pull-first guard only watches
*production* — it compares production with your last pull, and production has
not changed — so it will **not** stop a push of this older local state, which
would publish it over production. Use the restored data locally, and `pull`
again before you edit anything you mean to publish.

## 4. Check the backups on the server

Every push leaves its backups in `/opt/bandms/backups/sync/`, newest 5 of each
kind; deploys keep theirs, newest 20, one level up.

```bash
ssh deploy@YOUR_SERVER_IP "ls -lht /opt/bandms/backups/sync /opt/bandms/backups"
```

A database dump and an uploads archive with the same push share a timestamp
to within seconds. The name is UTC.

**Is a database dump usable?** It must be valid gzip *and* end with the
completion line — a dump cut off half-way is still valid gzip:

```bash
ssh deploy@YOUR_SERVER_IP "f=/opt/bandms/backups/sync/bandms-YYYYMMDD-HHMMSS.sql.gz; gzip -t \$f && gzip -dc \$f | tail -1"
# -- Dump completed on 2026-10-06 20:44:29
```

**Is an uploads archive usable?** It lists every file:

```bash
ssh deploy@YOUR_SERVER_IP "tar -tzf /opt/bandms/backups/sync/uploads-YYYYMMDD-HHMMSS.tar.gz | grep -v '/\$'"
```

The pushes of 2026-10-06 predate the `sync/` folder: their dumps are
`bandms-20261006-164910`, `-180443` and `-204428` in `/opt/bandms/backups/`.

## 5. Undo a push: restore the production database

Two cases:

- **A push failed part-way.** It printed `prod backend left STOPPED on
  purpose - restore …/sync/bandms-<stamp>.sql.gz …`. Prod's API is down until
  you finish these steps; the public site keeps serving its last build.
- **A push worked, but you regret it.** Use the `bandms-<stamp>.sql.gz` it
  printed as `prod backup:` — or the newest one in `sync/`.

The backup is a **full** dump of production taken seconds before the push
wrote anything, so restoring it brings back everything as it was then,
orders and users included.

On the server (`ssh deploy@YOUR_SERVER_IP`), first prove the backup restores,
into a scratch database:

```bash
PW=$(docker exec bandms-mysql printenv MYSQL_ROOT_PASSWORD)
BACKUP=$(ls -t /opt/bandms/backups/sync/bandms-*.sql.gz 2>/dev/null | head -1)
echo "${BACKUP:-NONE - set BACKUP=/opt/bandms/backups/<file> by hand}"

docker exec -e MYSQL_PWD="$PW" bandms-mysql mysql -u root \
  -e "DROP DATABASE IF EXISTS restore_test; CREATE DATABASE restore_test;"
gzip -dc "$BACKUP" | docker exec -i -e MYSQL_PWD="$PW" bandms-mysql mysql -u root restore_test
docker exec -e MYSQL_PWD="$PW" bandms-mysql mysql -u root -e "
  SELECT COUNT(*) AS concerts FROM restore_test.concerts;
  SELECT COUNT(*) AS migrations FROM restore_test.migrations;"
```

**Do not continue if it printed `NONE`** — the restore below would read
nothing. Set `BACKUP=` to a full path to pick a specific one. If the counts
look right, restore over the real database. The backend must be stopped — after a
failed push it already is:

```bash
cd /opt/bandms
docker compose -f docker-compose.prod.yml stop backend
gzip -dc "$BACKUP" | docker exec -i -e MYSQL_PWD="$PW" bandms-mysql mysql -u root bandms
docker compose -f docker-compose.prod.yml start backend
docker compose -f docker-compose.prod.yml restart web
docker exec -e MYSQL_PWD="$PW" bandms-mysql mysql -u root -e "DROP DATABASE restore_test;"
```

Then, **on your machine**, `python scripts/sync_db.py pull` — the restore
changed production, so the next push would refuse until you do.

Uploads restore separately: [Restoring uploads](#restoring-uploads).

## 6. When it refuses: error messages

Every refusal before the host prompt, and every check up to the second guard,
leaves production untouched.

| Message (after `ERROR:`) | Means | Do |
|---|---|---|
| `SYNC_SSH_HOST is not set in .env` | setup step 2 missing | add it |
| `.env not found` | no root `.env` | `cp .env.example .env`, then setup |
| `ssh: connect to host … Connection timed out` | wrong host, or the server is down | check `SYNC_SSH_HOST`; try setup step 3 |
| `Permission denied (publickey)` | wrong or missing key | check `SYNC_SSH_KEY` points at an existing key the server accepts |
| `local containers not running: bandms_…` | your stack is down | `docker compose up -d` |
| `prod containers not running: bandms-backend` … `restore the newest backup in …/sync/ first` | a failed push left it stopped, or prod is down | [section 5](#5-undo-a-push-restore-the-production-database); never just start it on a half-loaded database |
| `no record of a pull from <host> - run pull first` | no pull from this server on this machine | pull, then edit, then push |
| `prod content changed since the last pull (…): shop_items, …` | a sale or a prod-admin edit since your pull | pull (replaces local edits — save them as in section 3 first), redo the edits, push. `--force` overwrites the change instead |
| `local and prod are on different migrations` + `only local: …` | your code is ahead of what is deployed | merge and deploy first, or switch to the deployed code |
| `… only prod: …` | production is ahead of your checkout | `git pull` on `main`, then `pull` (it brings production's schema with it) |
| `this push would leave prod rows dangling:` + `1 prod row(s) in presale_codes.concert_id point at concerts.id=7, which is missing locally` | you deleted something a real order, ticket or code points at | the record is still on production: pull, redo your edits without deleting it, push |
| `not enough disk: uploads … KB, free … KB` | the server is nearly full | free space on the server before pushing files |
| `prod-backup-db.sh finished without a verified backup` | the database backup failed | nothing was written; read the output it prints and fix that first |
| `prod uploads were not archived and verified` | the uploads backup failed | nothing was written; check disk and `docker ps` on the server |
| `host did not match` / `no answer on stdin` | the confirmation was not the exact host | run again and type it exactly |

---

# Reference

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
