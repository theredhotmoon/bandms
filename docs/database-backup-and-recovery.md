# Database Backup & Recovery

What gets backed up on a production deploy, where it lands, how to get at it,
and how to undo a bad release. Written for the moment you actually need it —
skim the [Quick reference](#quick-reference) first, read the rest when you have
time.

Companion to [`deployment.md`](deployment.md), which covers the deploy itself.

---

## Quick reference

| I need to… | Command |
|---|---|
| List backups | `ssh deploy@SERVER "ls -lh /opt/bandms/backups"` |
| Take one now | `ssh deploy@SERVER "cd /opt/bandms && ./scripts/prod-backup-db.sh"` |
| Pull one down | `scp deploy@SERVER:/opt/bandms/backups/bandms-YYYYMMDD-HHMMSS.sql.gz .` |
| Roll back code | set `APP_VERSION=<good-sha>` in `/opt/bandms/.env`, then `docker compose -f docker-compose.prod.yml up -d` |
| Roll back data | [Restoring](#data) — scratch database first |
| Back up uploads | `docker run --rm -v bandms-storage:/data -v ~:/backup alpine tar czf /backup/bandms-storage-$(date +%F).tar.gz -C /data .` |

**Rolling back code alone leaves you broken.** See
[Rolling back a deploy](#rolling-back-a-deploy) before you do it.

---

## Is a backup taken before every deploy?

**Yes, and a failed backup aborts the deploy before anything migrates.**

The deploy runs over SSH under `set -e`
(`.github/workflows/deploy.yml:141-160`), in this order:

```bash
docker compose -f docker-compose.prod.yml pull backend frontend web
docker compose -f docker-compose.prod.yml up -d mysql      # DB must be reachable
chmod +x scripts/prod-backup-db.sh
./scripts/prod-backup-db.sh                                # <- dump + verify
docker compose ... up -d --no-deps --wait backend          # <- migrations run here
```

The ordering is the entire point. `api/docker/entrypoint.sh:24` runs
`php artisan migrate --force`, so **starting the backend is the one step of a
deploy that changes data irreversibly**. Images roll back by retagging; a
dropped column does not. The dump happens strictly before that, and under
`set -e` a non-zero exit from the script stops the deploy — no verified backup,
no schema change.

MySQL is brought up explicitly on the line before because every other command
uses `--no-deps`; without it, nothing would start the database on a first
deploy and the backup would have nothing to talk to.

---

## What the backup script actually does

`scripts/prod-backup-db.sh` — runs on the server, also safe to run by hand at
any time. It is deliberately more careful than `mysqldump | gzip`:

| Behaviour | Why |
|---|---|
| Reads `MYSQL_ROOT_PASSWORD` from the running container | Sourcing a dotenv in shell is a quoting minefield; the container's own env is guaranteed to match what the server actually used |
| `MYSQL_PWD` rather than `-p"$PW"` | Keeps the password off the process list inside the container |
| `--single-transaction` | Consistent InnoDB snapshot without blocking writes |
| `--routines --triggers --events` | Schema objects a plain dump would silently drop |
| Waits up to 60s for `mysqladmin ping` | The deploy starts MySQL immediately before this; on a cold boot it may still be initialising |
| Writes `.partial`, renames only after verifying | An interrupted run cannot leave a plausible-looking file in the backups directory |
| **Checks the `Dump completed` marker, not just `gzip -t`** | See below — this is the one that matters |
| Retains newest 20 **by count, not age** | A burst of deploys must not be able to age out every copy of a good database |

### Why the completion marker matters more than it looks

`gzip -9` compresses a *stream*. A stream truncated at 60% still produces a
structurally valid archive, and `gzip -t` passes it happily. Only mysqldump's
trailing `-- Dump completed` line proves the **source** ran to the end.

Checking gzip integrity alone would accept a truncated database — which is
worse than having no backup, because it looks like one until the night you try
to restore it. Confirmed against a simulated partial dump: `gzip -t` accepts
it, the marker check rejects it.

### Exit codes

| Code | Meaning | Effect on the deploy |
|---|---|---|
| `0` | Backup written and verified | Continues |
| `0` | Nothing to back up yet — container or schema absent | Continues (a first deploy is not blocked by having no data) |
| `1` | Anything went wrong, including *container exists but is not running* | **Aborts** — it refuses to deploy over a database it cannot reach |

---

## Where backups are stored

`/opt/bandms/backups/bandms-YYYYMMDD-HHMMSS.sql.gz` on the Hetzner VM
(UTC timestamps). Newest **20** retained.

Override via env vars if ever needed: `BACKUP_DIR`, `MYSQL_CONTAINER`,
`DB_DATABASE`, `KEEP`, `WAIT_SECS`.

---

## How to access them

```bash
# List
ssh deploy@YOUR_SERVER_IP "ls -lh /opt/bandms/backups"

# Copy one to your machine
scp deploy@YOUR_SERVER_IP:/opt/bandms/backups/bandms-20260826-120000.sql.gz .

# Take an ad-hoc dump (before a risky manual change, say)
ssh deploy@YOUR_SERVER_IP "cd /opt/bandms && ./scripts/prod-backup-db.sh"

# Read one without restoring it
gzip -dc bandms-20260826-120000.sql.gz | less
```

---

## Rolling back a deploy

**Code and schema are two separate rollbacks. Doing only the first is often
worse than the bad deploy.**

### Code

Every image is tagged with its commit SHA alongside `latest`
(`docker-compose.prod.yml` uses `${APP_VERSION:-latest}`):

```bash
# in /opt/bandms/.env
APP_VERSION=<the-good-commit-sha>

cd /opt/bandms
docker compose -f docker-compose.prod.yml up -d
```

> **The pin is sticky and silent.** The deploy workflow's
> `docker compose pull` reads `/opt/bandms/.env` on the server. If you leave
> `APP_VERSION` set to a SHA, **every subsequent push to `main` will build new
> images and then deploy the old pinned one** — CI goes green and nothing
> changes. Remove or comment the line the moment you have recovered.

### Why code rollback alone is not enough

Retagging to an older SHA restarts the backend, whose entrypoint runs
`migrate --force` again. Laravel **ignores** rows in the `migrations` table
whose files are not present in the older image — it does not roll them back.

You end up with **new schema + old code**. If the bad release added a
`NOT NULL` column or dropped one, the old code now runs against a shape it was
never written for. Restore the dump as well, or do not roll the code back at
all and fix forward instead.

### Data

Restore into a scratch database first, so a bad backup cannot destroy a working
one:

```bash
PW=$(docker exec bandms-mysql printenv MYSQL_ROOT_PASSWORD)
BACKUP=/opt/bandms/backups/bandms-YYYYMMDD-HHMMSS.sql.gz

docker exec -e MYSQL_PWD="$PW" bandms-mysql mysql -u root \
  -e "DROP DATABASE IF EXISTS restore_test; CREATE DATABASE restore_test;"

gzip -dc "$BACKUP" | docker exec -i -e MYSQL_PWD="$PW" bandms-mysql mysql -u root restore_test

docker exec -e MYSQL_PWD="$PW" bandms-mysql mysql -u root -e "
  SELECT COUNT(*) FROM restore_test.users;
  SELECT COUNT(*) FROM restore_test.migrations;"
```

Sanity-check those counts against what you expect. Once satisfied, restore over
the real database — **stop the backend first** so nothing writes mid-restore:

```bash
cd /opt/bandms
docker compose -f docker-compose.prod.yml stop backend

gzip -dc "$BACKUP" | docker exec -i -e MYSQL_PWD="$PW" bandms-mysql mysql -u root bandms

docker compose -f docker-compose.prod.yml start backend
docker compose -f docker-compose.prod.yml restart web   # republish the static public site
```

The `restart web` is not optional. The Astro public site is static and built at
container startup, so it keeps serving pre-restore HTML until it rebuilds.

Drop the scratch database when you are done:

```bash
docker exec -e MYSQL_PWD="$PW" bandms-mysql mysql -u root -e "DROP DATABASE restore_test;"
```

---

## Known gaps

The pre-deploy dump covers **the database, on the same machine, at deploy
time**. Three things it does not cover. None is automated today — each protects
against a failure the others do not, and no one of them replaces another.

### 1. The `bandms-storage` volume is never backed up

It holds every uploaded poster and photo **and Passport's signing keys**.
Losing the keys invalidates every issued token — every admin gets logged out
and API clients break until new keys are generated. A deploy never touches this
volume, which is why it is out of scope for the pre-deploy dump, and why it
still needs its own periodic copy:

```bash
docker run --rm -v bandms-storage:/data -v ~:/backup \
  alpine tar czf /backup/bandms-storage-$(date +%F).tar.gz -C /data .
```

### 2. Backups sit on the same disk as the database they protect

They survive a bad migration. They do not survive a dead server, a corrupted
volume, or a deleted VM. There is no off-site copy configured — copy them off
the machine on whatever schedule matches how much data you are willing to lose.

### 3. No whole-disk snapshots

Hetzner's automated backups (+20% of server cost) cover the failures the other
two do not — OS-level corruption, a bad `rm`, an unbootable machine. Not
enabled.

---

## Related

- [`deployment.md`](deployment.md) — the deploy runbook and server setup
- `scripts/prod-backup-db.sh` — the script itself, heavily commented
- `.github/workflows/deploy.yml` — where it is invoked in the deploy
