#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
#  BandMS — Docker rebuild & restart script
#
#  Usage:
#    ./rebuild.sh                 # Rebuild all images + run pending migrations
#    ./rebuild.sh --backend-only  # Rebuild only the backend image (faster, PHP changes)
#    ./rebuild.sh --fresh-db      # Rebuild all images + wipe DB + re-migrate + seed
#    ./rebuild.sh --help          # Show this help
#
#  Logs are written to: rebuild.log (same directory as this script)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Resolve script location first (needed for log path) ──────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/rebuild.log"

# ── Logging setup ─────────────────────────────────────────────────────────────
exec > >(tee "$LOG_FILE") 2>&1

START_TS=$(date +%s)

echo "════════════════════════════════════════════════════════════════════════"
echo "  BandMS rebuild — $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Log: $LOG_FILE"
echo "════════════════════════════════════════════════════════════════════════"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

step() { echo -e "\n${CYAN}${BOLD}▶ $*${RESET}"; }
ok()   { echo -e "${GREEN}✔  $*${RESET}"; }
warn() { echo -e "${YELLOW}⚠  $*${RESET}"; }
die()  { echo -e "${RED}✖  $*${RESET}" >&2; exit 1; }

# ── Step timing helpers ───────────────────────────────────────────────────────
declare -a STEP_NAMES=()
declare -a STEP_STATUS=()   # "ok" or "fail"
declare -a STEP_DURATIONS=()

_STEP_START=0

begin_step() {
  _STEP_START=$(date +%s)
  step "$1"
  STEP_NAMES+=("$1")
}

end_step() {
  local elapsed=$(( $(date +%s) - _STEP_START ))
  ok "$1 (${elapsed}s)"
  STEP_STATUS+=("ok")
  STEP_DURATIONS+=("${elapsed}s")
}

# ── Error trap ────────────────────────────────────────────────────────────────
_on_error() {
  local exit_code=$?
  local line_no=$1
  # Mark the last step as failed
  STEP_STATUS+=("FAIL")
  STEP_DURATIONS+=("—")

  echo ""
  echo -e "${RED}${BOLD}════════════════════════════════════════════${RESET}"
  echo -e "${RED}${BOLD}  REBUILD FAILED${RESET}"
  echo -e "${RED}  Exit code : $exit_code${RESET}"
  echo -e "${RED}  Line      : $line_no${RESET}"
  echo -e "${RED}  Command   : ${BASH_COMMAND}${RESET}"
  echo -e "${RED}${BOLD}════════════════════════════════════════════${RESET}"
  echo ""
  _print_summary
  echo "  Full log saved to: $LOG_FILE"
  echo ""
}

trap '_on_error $LINENO' ERR

# ── Summary printer ───────────────────────────────────────────────────────────
_print_summary() {
  local total_elapsed=$(( $(date +%s) - START_TS ))
  echo ""
  echo -e "${BOLD}  Step summary:${RESET}"
  echo "  ──────────────────────────────────────────────────────"
  for i in "${!STEP_NAMES[@]}"; do
    local name="${STEP_NAMES[$i]}"
    local status="${STEP_STATUS[$i]:-pending}"
    local dur="${STEP_DURATIONS[$i]:-—}"
    if [[ "$status" == "ok" ]]; then
      printf "  ${GREEN}✔${RESET}  %-42s %s\n" "$name" "$dur"
    else
      printf "  ${RED}✖${RESET}  %-42s %s\n" "$name" "$dur"
    fi
  done
  echo "  ──────────────────────────────────────────────────────"
  printf "  Total elapsed: %ds\n" "$total_elapsed"
  echo ""
}

# ── Defaults ─────────────────────────────────────────────────────────────────
FRESH_DB=false
BACKEND_ONLY=false
BACKEND_CONTAINER="bandms_backend"

# ── Argument parsing ──────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --fresh-db)      FRESH_DB=true ;;
    --backend-only)  BACKEND_ONLY=true ;;
    --help|-h)
      echo -e "${BOLD}BandMS rebuild script${RESET}"
      echo ""
      echo "  Usage: ./rebuild.sh [--backend-only | --fresh-db]"
      echo ""
      echo "  (no flags)       Rebuild all Docker images, start containers, run pending migrations"
      echo "  --backend-only   Rebuild only the backend image — faster for PHP-only changes"
      echo "  --fresh-db       Rebuild all images + wipe DB volumes + re-migrate + seed"
      echo "  --help           Show this message"
      echo ""
      echo "  IMPORTANT: Always use this script instead of raw docker commands."
      echo "  It ensures migrations run after every rebuild."
      exit 0
      ;;
    *) die "Unknown argument: $arg  (try --help)" ;;
  esac
done

# --fresh-db and --backend-only are mutually exclusive
if [[ "$FRESH_DB" == true && "$BACKEND_ONLY" == true ]]; then
  die "--fresh-db and --backend-only cannot be used together"
fi

# ── Sanity checks ─────────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || die "docker not found — is Docker Desktop running?"
command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 \
  || die "docker compose not found"

[[ -f "docker-compose.yml" || -f "compose.yml" ]] \
  || die "No docker-compose.yml found in $SCRIPT_DIR — run from the project root"

# ── Warn on --fresh-db ────────────────────────────────────────────────────────
if [[ "$FRESH_DB" == true ]]; then
  echo ""
  warn "--fresh-db will WIPE all database data. This is irreversible."
  read -rp "  Are you sure? (y/N) " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

# ──────────────────────────────────────────────────────────────────────────────
#  BACKEND-ONLY MODE — just rebuild backend image and restart it
# ──────────────────────────────────────────────────────────────────────────────
if [[ "$BACKEND_ONLY" == true ]]; then
  echo ""
  echo -e "${YELLOW}  Mode: backend-only (PHP changes)${RESET}"

  begin_step "Rebuilding backend image (no-cache)"
  docker compose build --no-cache backend
  end_step "Backend image rebuilt"

  begin_step "Restarting backend container"
  docker compose up -d --no-deps backend
  end_step "Backend container restarted"

  begin_step "Waiting for backend to be healthy"
  WAIT_SECONDS=60; ELAPSED=0
  until docker exec "$BACKEND_CONTAINER" php artisan --version >/dev/null 2>&1; do
    sleep 2; ELAPSED=$((ELAPSED + 2))
    [[ $ELAPSED -ge $WAIT_SECONDS ]] && die "Backend did not become ready after ${WAIT_SECONDS}s"
    echo -n "."
  done
  echo ""
  end_step "Backend is ready"

  begin_step "Running pending migrations"
  docker exec "$BACKEND_CONTAINER" php artisan migrate --force
  end_step "Migrations complete"

  begin_step "Clearing and rebuilding caches"
  docker exec "$BACKEND_CONTAINER" php artisan optimize:clear
  docker exec "$BACKEND_CONTAINER" php artisan optimize
  end_step "Caches rebuilt"

  echo ""
  echo -e "${GREEN}${BOLD}✔  Backend rebuilt and running.${RESET}"
  echo -e "   Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
  _print_summary
  exit 0
fi

# ──────────────────────────────────────────────────────────────────────────────
#  FULL REBUILD MODE
# ──────────────────────────────────────────────────────────────────────────────

# ── 1. Stop containers ────────────────────────────────────────────────────────
begin_step "Stopping containers"
if [[ "$FRESH_DB" == true ]]; then
  docker compose down -v
  end_step "Containers stopped and volumes removed"
else
  docker compose down
  end_step "Containers stopped"
fi

# ── 2. Rebuild images ─────────────────────────────────────────────────────────
begin_step "Rebuilding Docker images (no-cache)"
docker compose build --no-cache
end_step "Images built"

# ── 3. Start containers ───────────────────────────────────────────────────────
begin_step "Starting containers"
docker compose up -d
end_step "Containers started"

# ── 4. Wait for backend ───────────────────────────────────────────────────────
begin_step "Waiting for backend container to be healthy"
WAIT_SECONDS=60; ELAPSED=0
until docker exec "$BACKEND_CONTAINER" php artisan --version >/dev/null 2>&1; do
  sleep 2; ELAPSED=$((ELAPSED + 2))
  [[ $ELAPSED -ge $WAIT_SECONDS ]] && die "Backend did not become ready after ${WAIT_SECONDS}s — check: docker logs $BACKEND_CONTAINER"
  echo -n "."
done
echo ""
end_step "Backend is ready"

# ── 5. Database step ──────────────────────────────────────────────────────────
if [[ "$FRESH_DB" == true ]]; then
  begin_step "Fresh DB: dropping tables, migrating, seeding"
  docker exec "$BACKEND_CONTAINER" php artisan migrate:fresh --seed --force
  end_step "Database wiped, migrated and seeded"

  begin_step "Installing Passport keys & clients"
  docker exec "$BACKEND_CONTAINER" php artisan passport:install --no-interaction
  end_step "Passport installed"
else
  begin_step "Running pending migrations"
  docker exec "$BACKEND_CONTAINER" php artisan migrate --force
  end_step "Migrations complete"
fi

# ── 6. Rebuild caches ────────────────────────────────────────────────────────
begin_step "Clearing and rebuilding caches"
docker exec "$BACKEND_CONTAINER" php artisan optimize:clear
docker exec "$BACKEND_CONTAINER" php artisan optimize
end_step "Caches rebuilt"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✔  All done! Stack is up and running.${RESET}"
echo -e "   Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
_print_summary

echo "  Useful next steps:"
echo "    make logs          # tail all service logs"
echo "    make health        # check /api/health"
echo "    make test          # run the test suite"
echo ""
