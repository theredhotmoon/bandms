#!/usr/bin/env bash
# Run all test suites: backend unit tests + E2E (Playwright).
# Usage: bash scripts/test-all.sh [--skip-e2e] [--skip-unit]
#
# Exit codes: 0 = all green, 1 = unit failures, 2 = E2E failures, 3 = both failed

set -euo pipefail

SKIP_UNIT=0
SKIP_E2E=0
UNIT_STATUS=0
E2E_STATUS=0
UNIT_SKIPPED=0
E2E_SKIPPED=0

for arg in "$@"; do
  case $arg in
    --skip-e2e)  SKIP_E2E=1 ;;
    --skip-unit) SKIP_UNIT=1 ;;
  esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

banner() { echo -e "\n${CYAN}══ $1 ══${RESET}"; }
ok()     { echo -e "${GREEN}✅ $1${RESET}"; }
fail()   { echo -e "${RED}❌ $1${RESET}"; }
warn()   { echo -e "${YELLOW}⚠️  $1${RESET}"; }

# ── Backend unit tests ────────────────────────────────────────────────────────
if [ "$SKIP_UNIT" -eq 0 ]; then
  banner "Backend unit tests (Pest)"
  APP_KEY=$(grep '^APP_KEY=' .env | cut -d= -f2-)
  docker build --target test -t bandms_test ./api >/dev/null 2>&1
  if docker run --rm -e APP_ENV=testing -e APP_KEY="${APP_KEY}" bandms_test; then
    ok "Backend tests passed"
  else
    fail "Backend tests FAILED"
    UNIT_STATUS=1
  fi
else
  warn "Backend tests skipped (--skip-unit)"
  UNIT_SKIPPED=1
fi

# ── E2E tests (Playwright) ────────────────────────────────────────────────────
if [ "$SKIP_E2E" -eq 0 ]; then
  banner "E2E tests (Playwright)"

  if [ ! -f app/playwright.config.ts ]; then
    warn "No app/playwright.config.ts found — skipping E2E"
  elif ! command -v docker &>/dev/null || ! docker ps --format '{{.Names}}' | grep -q bandms_backend; then
    warn "Backend container not running — skipping E2E (start with: make up)"
  else
    cd app
    if pnpm test:e2e --reporter=list; then
      ok "E2E tests passed"
    else
      fail "E2E tests FAILED"
      E2E_STATUS=2
    fi
    cd ..
  fi
else
  warn "E2E tests skipped (--skip-e2e)"
  E2E_SKIPPED=1
fi

# ── Summary ───────────────────────────────────────────────────────────────────
banner "Summary"
if   [ "$UNIT_SKIPPED" -eq 1 ]; then warn "Unit tests  (skipped)"
elif [ "$UNIT_STATUS"  -eq 0 ]; then ok   "Unit tests"
else                                  fail "Unit tests"
fi

if   [ "$E2E_SKIPPED" -eq 1 ]; then warn "E2E tests   (skipped)"
elif [ "$E2E_STATUS"  -eq 0 ]; then ok   "E2E tests"
else                                 fail "E2E tests"
fi

EXIT_CODE=$(( UNIT_STATUS | E2E_STATUS ))
exit $EXIT_CODE
