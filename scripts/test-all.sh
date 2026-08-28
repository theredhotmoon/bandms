#!/usr/bin/env bash
# Run all test suites: backend unit (Pest) + frontend unit (Vitest) + E2E (Playwright).
# Usage: bash scripts/test-all.sh [--skip-e2e] [--skip-unit]
#
# Exit codes are a bitmask: 1 = backend unit, 2 = E2E, 4 = frontend unit.
# 0 = all green; 5 = both unit suites failed, and so on.

set -euo pipefail

SKIP_UNIT=0
SKIP_E2E=0
UNIT_STATUS=0
E2E_STATUS=0
FE_UNIT_STATUS=0
UNIT_SKIPPED=0
E2E_SKIPPED=0
FE_UNIT_SKIPPED=0

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

# ── Frontend unit tests (Vitest) ──────────────────────────────────────────────
# Pure logic only — the resolver, the diff and the rig contract. Sub-second and
# dependency-free — the only stage needing neither Docker nor a browser, so it
# runs first and fails fastest.
if [ "$SKIP_UNIT" -eq 0 ]; then
  banner "Frontend unit tests (Vitest)"
  if [ ! -f app/vitest.config.ts ]; then
    warn "No app/vitest.config.ts found — skipping"
    FE_UNIT_SKIPPED=1
  else
    cd app
    if pnpm test:unit; then
      ok "Admin SPA unit tests passed"
    else
      fail "Admin SPA unit tests FAILED"
      FE_UNIT_STATUS=4
    fi
    cd ..

    # The public site's lib layer — cms.ts and slugs.ts — decides which routes
    # get built and which hrefs the nav emits. Both are plain TypeScript and both
    # have shipped bugs no other stage could see: an Astro build is green either
    # way, and E2E only ever exercises whichever config the API happened to
    # serve. Same bitmask bit as the SPA: both are frontend unit tests.
    if [ -f web/vitest.config.ts ]; then
      cd web
      if pnpm test:unit; then
        ok "Public site unit tests passed"
      else
        fail "Public site unit tests FAILED"
        FE_UNIT_STATUS=4
      fi
      cd ..
    fi
  fi
else
  warn "Frontend unit tests skipped (--skip-unit)"
  FE_UNIT_SKIPPED=1
fi

# ── Backend unit tests ────────────────────────────────────────────────────────
if [ "$SKIP_UNIT" -eq 0 ]; then
  banner "Backend unit tests (Pest)"
  APP_KEY=$(grep '^APP_KEY=' .env 2>/dev/null | cut -d= -f2-)
  if [ -z "$APP_KEY" ]; then
    fail "APP_KEY not found in .env — run: cp .env.example .env && php artisan key:generate"
    exit 1
  fi
  docker build --target test -t bandms_test ./api >/dev/null
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
if   [ "$UNIT_SKIPPED" -eq 1 ]; then warn "Backend unit  (skipped)"
elif [ "$UNIT_STATUS"  -eq 0 ]; then ok   "Backend unit"
else                                  fail "Backend unit"
fi

if   [ "$FE_UNIT_SKIPPED" -eq 1 ]; then warn "Frontend unit (skipped)"
elif [ "$FE_UNIT_STATUS"  -eq 0 ]; then ok   "Frontend unit"
else                                     fail "Frontend unit"
fi

if   [ "$E2E_SKIPPED" -eq 1 ]; then warn "E2E tests   (skipped)"
elif [ "$E2E_STATUS"  -eq 0 ]; then ok   "E2E tests"
else                                 fail "E2E tests"
fi

EXIT_CODE=$(( UNIT_STATUS | E2E_STATUS | FE_UNIT_STATUS ))
exit $EXIT_CODE
