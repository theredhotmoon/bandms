#!/usr/bin/env bash
#
# Dump the production database. Runs ON THE SERVER, called by the deploy
# workflow immediately before the backend container starts — which is when
# migrations run, and migrations are the only part of a deploy that changes
# data irreversibly. Containers and images roll back by retagging; a dropped
# column does not.
#
# Also safe to run by hand at any time:
#   ssh deploy@SERVER "cd /opt/bandms && ./scripts/prod-backup-db.sh"
#
# Exit codes:
#   0  backup written and verified, OR nothing to back up yet (first deploy)
#   1  something went wrong — the caller should abort the deploy
#
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/bandms/backups}"
CONTAINER="${MYSQL_CONTAINER:-bandms-mysql}"
DATABASE="${DB_DATABASE:-bandms}"
KEEP="${KEEP:-20}"
WAIT_SECS="${WAIT_SECS:-60}"

log() { printf '[backup] %s\n' "$*"; }
die() { printf '[backup] ERROR: %s\n' "$*" >&2; exit 1; }

# ── Is there anything to back up? ────────────────────────────────────────────
# On a first deploy the container does not exist yet. That is not a failure —
# there is no data to lose — so skip rather than blocking the deploy.
if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    log "container $CONTAINER does not exist — first deploy, nothing to back up"
    exit 0
fi

if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]; then
    die "container $CONTAINER exists but is not running; refusing to deploy over a database we cannot reach"
fi

# Read the password from the container's own environment rather than parsing
# /opt/bandms/.env. Sourcing a dotenv in shell is a quoting minefield, and this
# is guaranteed to match whatever the running server actually used.
ROOT_PW="$(docker exec "$CONTAINER" printenv MYSQL_ROOT_PASSWORD 2>/dev/null || true)"
[ -n "$ROOT_PW" ] || die "could not read MYSQL_ROOT_PASSWORD from $CONTAINER"

# ── Wait for MySQL to accept connections ─────────────────────────────────────
# The deploy starts mysql immediately before calling this, so on a cold boot it
# may still be initialising.
log "waiting for MySQL to accept connections (up to ${WAIT_SECS}s)..."
waited=0
until docker exec -e MYSQL_PWD="$ROOT_PW" "$CONTAINER" \
        mysqladmin ping -u root --silent >/dev/null 2>&1; do
    [ "$waited" -ge "$WAIT_SECS" ] && die "MySQL did not become ready within ${WAIT_SECS}s"
    sleep 2
    waited=$((waited + 2))
done
log "MySQL ready after ${waited}s"

# An empty schema means migrations have never run — nothing worth dumping.
TABLE_COUNT="$(docker exec -e MYSQL_PWD="$ROOT_PW" "$CONTAINER" \
    mysql -u root -N -B -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DATABASE}';" \
    2>/dev/null | tr -d '[:space:]')"

if [ -z "$TABLE_COUNT" ] || [ "$TABLE_COUNT" = "0" ]; then
    log "database '${DATABASE}' has no tables yet — nothing to back up"
    exit 0
fi
log "database '${DATABASE}': ${TABLE_COUNT} tables"

# ── Dump ─────────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/${DATABASE}-${STAMP}.sql.gz"
TMP="${TARGET}.partial"
# mktemp, not a fixed /tmp path: a fixed name written by root once leaves the
# file un-writable by the deploy user forever after, and the redirect failing
# would abort a deploy for no real reason.
ERRLOG="$(mktemp)"

# MYSQL_PWD rather than -p"$PW" keeps the password off the process list inside
# the container. --single-transaction gives a consistent snapshot of InnoDB
# tables without locking writes.
log "dumping to $(basename "$TARGET")"
if ! docker exec -e MYSQL_PWD="$ROOT_PW" "$CONTAINER" \
        mysqldump -u root \
            --single-transaction \
            --routines \
            --triggers \
            --events \
            --no-tablespaces \
            "$DATABASE" 2>"$ERRLOG" | gzip -9 > "$TMP"; then
    err="$(tail -3 "$ERRLOG" 2>/dev/null || echo 'no output')"
    rm -f "$TMP" "$ERRLOG"
    die "mysqldump failed: $err"
fi
rm -f "$ERRLOG"

# ── Verify before trusting it ────────────────────────────────────────────────
# A dump that dies halfway still produces a perfectly valid gzip file. Checking
# only gzip integrity would happily accept a truncated database — worse than no
# backup, because it looks like one. mysqldump writes a completion marker as
# its last line; that is what actually proves the dump ran to the end.
gzip -t "$TMP" 2>/dev/null || { rm -f "$TMP"; die "backup is not a valid gzip archive"; }

# Materialise the tail, then match it with `case` — no pipe involved. Piping
# into `grep -q` lets grep exit on first match and SIGPIPE `tail`, which under
# `set -o pipefail` fails the pipeline, discarding a perfectly good backup
# because the check succeeded too quickly.
TAIL_OUT="$(gzip -dc "$TMP" | tail -5)"
case "$TAIL_OUT" in
    *"Dump completed"*) ;;
    *)
        rm -f "$TMP"
        die "dump is truncated — no completion marker. Refusing to keep a partial backup."
        ;;
esac

mv "$TMP" "$TARGET"
SIZE="$(du -h "$TARGET" | cut -f1)"
log "verified: $(basename "$TARGET") (${SIZE})"

# ── Rotate ───────────────────────────────────────────────────────────────────
# Newest KEEP files survive. Deliberately counts files rather than age: a burst
# of deploys should not be able to age out every copy of a good database.
TOTAL="$(find "$BACKUP_DIR" -maxdepth 1 -name "${DATABASE}-*.sql.gz" -type f | wc -l)"
if [ "$TOTAL" -gt "$KEEP" ]; then
    find "$BACKUP_DIR" -maxdepth 1 -name "${DATABASE}-*.sql.gz" -type f -printf '%T@ %p\n' \
        | sort -n \
        | head -n "$((TOTAL - KEEP))" \
        | cut -d' ' -f2- \
        | while read -r old; do
            log "pruning $(basename "$old")"
            rm -f "$old"
        done
fi

log "done — $(find "$BACKUP_DIR" -maxdepth 1 -name "${DATABASE}-*.sql.gz" -type f | wc -l) backup(s) retained in ${BACKUP_DIR}"
