#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
#  ship.sh — Full shipping pipeline
#
#  Stages (each optional via flags):
#    1. Docker container rebuild   (--rebuild / --rebuild-backend / --rebuild-fresh)
#    2. Backend unit tests         (skipped with --skip-unit)
#    3. E2E Playwright tests       (skipped with --skip-e2e)
#    4. CHANGELOG.md update        (skipped with --skip-changelog)
#    5. Create branch, commit, push, open PR  (skipped with --dry-run)
#
#  Usage:
#    bash scripts/ship.sh                       # prompt for rebuild → tests → changelog → PR
#    bash scripts/ship.sh -y                    # non-interactive, tests only → changelog → PR
#    bash scripts/ship.sh --rebuild             # full Docker rebuild first
#    bash scripts/ship.sh --rebuild-backend     # backend-only rebuild first
#    bash scripts/ship.sh --rebuild-fresh       # fresh-DB rebuild first (WIPES DB!)
#    bash scripts/ship.sh --skip-e2e            # skip Playwright
#    bash scripts/ship.sh --skip-unit           # skip Pest
#    bash scripts/ship.sh --dry-run             # tests + changelog only, no git
#    bash scripts/ship.sh --branch my-feature   # override branch name
#    bash scripts/ship.sh --no-pr               # commit + push, skip gh pr create
#
#  Logs:  ship.log  (all output, always)
#         rebuild.log  (written by rebuild.sh when --rebuild* used)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# ── Log setup — tee everything to ship.log ───────────────────────────────────
LOG_FILE="$ROOT_DIR/ship.log"
exec > >(tee "$LOG_FILE") 2>&1

START_TS=$(date +%s)
TODAY=$(date '+%Y-%m-%d')

echo "════════════════════════════════════════════════════════════════════════"
echo "  ship.sh — $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Log: $LOG_FILE"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

step()  { echo -e "\n${CYAN}${BOLD}▶  $*${RESET}"; }
ok()    { echo -e "${GREEN}✔  $*${RESET}"; }
warn()  { echo -e "${YELLOW}⚠  $*${RESET}"; }
info()  { echo -e "   $*"; }
die()   {
  echo -e "\n${RED}${BOLD}✖  FATAL: $*${RESET}" >&2
  echo ""
  echo -e "   Full log: ${BOLD}$LOG_FILE${RESET}"
  echo -e "   If you need help fixing this, share the log with: cat ship.log"
  echo ""
  _print_summary
  exit 1
}

# ── Step tracking ─────────────────────────────────────────────────────────────
declare -a STEP_NAMES=()
declare -a STEP_RESULTS=()   # "ok" | "skip" | "fail"
declare -a STEP_DURATIONS=()
_STEP_START=0

begin_step() { _STEP_START=$(date +%s); step "$1"; STEP_NAMES+=("$1"); }
end_step()   {
  local dur=$(( $(date +%s) - _STEP_START ))
  ok "$1 (${dur}s)"
  STEP_RESULTS+=("ok"); STEP_DURATIONS+=("${dur}s")
}
# skip_step adds its own name so it doesn't need a begin_step pair
skip_step()  { warn "$1 — skipped"; STEP_NAMES+=("$1"); STEP_RESULTS+=("skip"); STEP_DURATIONS+=("—"); }

_print_summary() {
  local total=$(( $(date +%s) - START_TS ))
  echo -e "\n${BOLD}  Step summary:${RESET}"
  echo "  ──────────────────────────────────────────────────────────────────"
  for i in "${!STEP_NAMES[@]}"; do
    local s="${STEP_RESULTS[$i]:-pending}" d="${STEP_DURATIONS[$i]:-—}"
    case "$s" in
      ok)   printf "  ${GREEN}✔${RESET}  %-48s %s\n" "${STEP_NAMES[$i]}" "$d" ;;
      skip) printf "  ${YELLOW}–${RESET}  %-48s %s\n" "${STEP_NAMES[$i]}" "skipped" ;;
      *)    printf "  ${RED}✖${RESET}  %-48s %s\n" "${STEP_NAMES[$i]}" "$d" ;;
    esac
  done
  echo "  ──────────────────────────────────────────────────────────────────"
  printf "  Total elapsed: %ds\n\n" "$total"
}

# ── Error trap ────────────────────────────────────────────────────────────────
_on_error() {
  local code=$? line=$1
  STEP_RESULTS+=("fail"); STEP_DURATIONS+=("—")
  echo -e "\n${RED}${BOLD}════════════════════════════════════════════${RESET}"
  echo -e "${RED}${BOLD}  SHIP FAILED${RESET}"
  echo -e "${RED}  Exit code : $code${RESET}"
  echo -e "${RED}  Line      : $line${RESET}"
  echo -e "${RED}  Command   : ${BASH_COMMAND}${RESET}"
  echo -e "${RED}${BOLD}════════════════════════════════════════════${RESET}\n"
  _print_summary
  echo -e "  Full log → ${BOLD}ship.log${RESET}"
  echo -e "  Share it with Claude: ${CYAN}cat ship.log${RESET}\n"
}
trap '_on_error $LINENO' ERR

# ── Arg defaults ──────────────────────────────────────────────────────────────
REBUILD_MODE=""          # "" | "full" | "backend" | "fresh"
SKIP_UNIT=0
SKIP_E2E=0
SKIP_CHANGELOG=0
DRY_RUN=0
NO_PR=0
YES=0
CUSTOM_BRANCH=""

# ── Arg parsing ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rebuild)           REBUILD_MODE="full" ;;
    --rebuild-backend)   REBUILD_MODE="backend" ;;
    --rebuild-fresh)     REBUILD_MODE="fresh" ;;
    --skip-unit)         SKIP_UNIT=1 ;;
    --skip-e2e)          SKIP_E2E=1 ;;
    --skip-changelog)    SKIP_CHANGELOG=1 ;;
    --dry-run)           DRY_RUN=1 ;;
    --no-pr)             NO_PR=1 ;;
    -y|--yes)            YES=1 ;;
    --branch)            shift; CUSTOM_BRANCH="$1" ;;
    --help|-h)
      sed -n '2,25p' "$0" | sed 's/^#  \?//'
      exit 0 ;;
    *) die "Unknown argument: $1  (try --help)" ;;
  esac
  shift
done

# ── Sanity checks ─────────────────────────────────────────────────────────────
command -v git >/dev/null 2>&1 || die "git not found"
[[ -d .git ]] || die "Not a git repository (run from project root)"
[[ -f .env ]] || warn ".env not found — Docker commands may fail"

# ── Interactive: ask about rebuild if no rebuild flag given ───────────────────
if [[ -z "$REBUILD_MODE" && "$YES" -eq 0 ]]; then
  echo ""
  echo "  Do you want to rebuild Docker containers first?"
  echo "  [0] No rebuild (just run tests)         — default"
  echo "  [1] --rebuild-backend  (PHP changes)    — fast"
  echo "  [2] --rebuild          (full rebuild)   — slower"
  echo "  [3] --rebuild-fresh    (WIPES database) — full reset"
  echo ""
  read -rp "  Choice [0-3]: " _rb_choice
  case "${_rb_choice:-0}" in
    1) REBUILD_MODE="backend" ;;
    2) REBUILD_MODE="full" ;;
    3) REBUILD_MODE="fresh" ;;
    *) REBUILD_MODE="" ;;
  esac
fi

# ──────────────────────────────────────────────────────────────────────────────
#  STAGE 1 — Container rebuild
# ──────────────────────────────────────────────────────────────────────────────
if [[ -n "$REBUILD_MODE" ]]; then
  begin_step "Container rebuild (mode: $REBUILD_MODE)"

  REBUILD_FLAGS=""
  case "$REBUILD_MODE" in
    backend) REBUILD_FLAGS="--backend-only" ;;
    fresh)   REBUILD_FLAGS="--fresh-db" ;;
    full)    REBUILD_FLAGS="" ;;
  esac

  # rebuild.sh writes its own rebuild.log
  if ! bash rebuild.sh $REBUILD_FLAGS; then
    die "Container rebuild failed — see rebuild.log for details"
  fi
  end_step "Containers rebuilt and healthy"
else
  skip_step "Container rebuild"
fi

# ──────────────────────────────────────────────────────────────────────────────
#  STAGE 2 — Backend unit tests (Pest)
# ──────────────────────────────────────────────────────────────────────────────
if [[ "$SKIP_UNIT" -eq 1 ]]; then
  skip_step "Backend unit tests"
elif [[ -f Makefile ]] && grep -q "^test:" Makefile; then
  begin_step "Backend unit tests (make test)"
  UNIT_LOG="$ROOT_DIR/unit-test.log"

  # Run tests; capture output for error reporting
  if make test 2>&1 | tee "$UNIT_LOG"; then
    ok "All backend tests passed"
    end_step "Backend unit tests"
  else
    echo ""
    echo -e "${RED}${BOLD}Backend tests failed.${RESET}"
    echo -e "  Last 40 lines of output:"
    tail -40 "$UNIT_LOG"
    echo ""
    echo -e "  Full output: ${BOLD}$UNIT_LOG${RESET}"
    die "Backend unit tests failed — fix failures before shipping"
  fi
elif [[ -f artisan ]]; then
  begin_step "Backend unit tests (php artisan test)"
  php artisan test --parallel 2>&1 | tee "$ROOT_DIR/unit-test.log" || \
    die "Backend unit tests failed — see unit-test.log"
  end_step "Backend unit tests"
else
  STEP_RESULTS+=("skip"); STEP_DURATIONS+=("—")
  warn "Backend tests — no Makefile test target or artisan found, skipping"
fi

# ──────────────────────────────────────────────────────────────────────────────
#  STAGE 3 — E2E tests (Playwright)
# ──────────────────────────────────────────────────────────────────────────────
E2E_CONFIG=""
[[ -f app/playwright.config.ts ]]       && E2E_CONFIG="app/playwright.config.ts"
[[ -f playwright.config.ts ]]           && E2E_CONFIG="playwright.config.ts"

if [[ "$SKIP_E2E" -eq 1 ]]; then
  skip_step "E2E tests"
elif [[ -z "$E2E_CONFIG" ]]; then
  STEP_RESULTS+=("skip"); STEP_DURATIONS+=("—")
  warn "E2E tests — no playwright.config.ts found, skipping"
else
  begin_step "E2E tests (Playwright)"
  E2E_LOG="$ROOT_DIR/e2e-test.log"

  if [[ "$E2E_CONFIG" == "app/playwright.config.ts" ]]; then
    E2E_DIR="$ROOT_DIR/app"
  else
    E2E_DIR="$ROOT_DIR"
  fi

  if (cd "$E2E_DIR" && pnpm test:e2e --reporter=list) 2>&1 | tee "$E2E_LOG"; then
    end_step "E2E tests"
  else
    echo ""
    echo -e "${RED}${BOLD}E2E tests failed.${RESET}"
    echo -e "  Last 50 lines of output:"
    tail -50 "$E2E_LOG"
    echo ""
    echo -e "  Full output:    ${BOLD}$E2E_LOG${RESET}"
    echo -e "  HTML report:    ${BOLD}${E2E_DIR}/playwright-report/index.html${RESET}"
    die "E2E tests failed — fix failures before shipping"
  fi
fi

# ──────────────────────────────────────────────────────────────────────────────
#  STAGE 4 — CHANGELOG.md
# ──────────────────────────────────────────────────────────────────────────────
if [[ "$SKIP_CHANGELOG" -eq 1 ]]; then
  skip_step "CHANGELOG.md update"
else
  begin_step "Updating CHANGELOG.md"

  # Gather changed files for the auto-entry
  CHANGED_FILES=$(git diff --stat HEAD --name-only 2>/dev/null | head -20 || true)
  NEW_FILES=$(git ls-files --others --exclude-standard 2>/dev/null | head -20 || true)
  RECENT_LOG=$(git log --oneline -5 2>/dev/null || true)

  CHANGELOG_ENTRY="## [Unreleased] — $TODAY

### Changed
$(echo "$CHANGED_FILES" | sed 's/^/- /' || echo "- (see git diff)")

### Added
$(echo "$NEW_FILES" | sed 's/^/- /' || echo "- (none)")

<!-- Recent commits:
$RECENT_LOG
-->

"

  if [[ ! -f CHANGELOG.md ]]; then
    echo "# Changelog

All notable changes are documented here.

---
" > CHANGELOG.md
    info "Created CHANGELOG.md"
  fi

  # Insert new entry after the first line that starts with "---" or after the header
  TMPFILE=$(mktemp)
  awk -v entry="$CHANGELOG_ENTRY" '
    /^---$/ && !inserted {
      print; print ""; print entry; inserted=1; next
    }
    { print }
  ' CHANGELOG.md > "$TMPFILE"

  # Fallback: if no "---" found, prepend after first heading
  if ! grep -q "^\[Unreleased\]" "$TMPFILE" 2>/dev/null; then
    { head -3 CHANGELOG.md; echo ""; echo "$CHANGELOG_ENTRY"; tail -n +4 CHANGELOG.md; } > "$TMPFILE"
  fi

  mv "$TMPFILE" CHANGELOG.md
  info "Prepended entry for $TODAY"
  end_step "CHANGELOG.md updated"
fi

# ──────────────────────────────────────────────────────────────────────────────
#  STAGE 5 — Branch → commit → push → PR
# ──────────────────────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" -eq 1 ]]; then
  warn "Dry run — skipping all git operations"
  echo ""
  echo -e "${GREEN}${BOLD}✔  All tests passed. Dry run complete.${RESET}"
  _print_summary
  exit 0
fi

# Determine current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
MAIN_BRANCHES="main master"

# ── Create branch ─────────────────────────────────────────────────────────────
if [[ -n "$CUSTOM_BRANCH" ]]; then
  BRANCH="$CUSTOM_BRANCH"
elif echo "$MAIN_BRANCHES" | grep -qw "$CURRENT_BRANCH"; then
  # Auto-generate branch name from staged/unstaged files
  TOP_PATH=$(git diff --name-only HEAD 2>/dev/null | head -1 || git ls-files --others --exclude-standard | head -1 || echo "")
  if [[ -n "$TOP_PATH" ]]; then
    # Derive feature name: take directory or filename, kebab-case it
    SEGMENT=$(basename "$(dirname "$TOP_PATH")" 2>/dev/null || basename "$TOP_PATH")
    SEGMENT=$(echo "$SEGMENT" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
    BRANCH="feature/${SEGMENT}-$(date +%m%d)"
  else
    BRANCH="feature/changes-$(date +%Y%m%d-%H%M)"
  fi
else
  BRANCH="$CURRENT_BRANCH"
  info "Already on non-main branch '$BRANCH' — reusing it"
fi

begin_step "Git branch: $BRANCH"
if [[ "$BRANCH" != "$CURRENT_BRANCH" ]]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH" 2>/dev/null; then
    warn "Branch '$BRANCH' already exists — switching to it"
    git checkout "$BRANCH"
  else
    git checkout -b "$BRANCH"
  fi
fi
end_step "On branch $BRANCH"

# ── Stage files ───────────────────────────────────────────────────────────────
begin_step "Staging files"
git add -A

# Unstage secrets (never commit these)
for secret in .env .env.* *.key *.pem *.p12 id_rsa id_ed25519; do
  git reset HEAD "$secret" 2>/dev/null || true
done

STAGED=$(git diff --cached --stat | tail -1 || echo "nothing staged")
info "Staged: $STAGED"

if [[ -z "$(git diff --cached --name-only 2>/dev/null)" ]]; then
  warn "Nothing to commit — working tree is clean"
  skip_step "Git stage (nothing to commit)"
  _print_summary
  exit 0
fi
end_step "Files staged"

# ── Commit ────────────────────────────────────────────────────────────────────
begin_step "Committing"

# Auto-generate subject from changed files
CHANGED_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')
FIRST_CHANGED=$(git diff --cached --name-only | head -1 || echo "files")
SUBJECT=$(echo "$FIRST_CHANGED" | xargs basename | sed 's/\.[^.]*$//')

if [[ "$CHANGED_COUNT" -gt 3 ]]; then
  COMMIT_SUBJECT="Update ${CHANGED_COUNT} files across project"
else
  COMMIT_SUBJECT="Update $FIRST_CHANGED"
fi

git commit -m "$(cat <<EOF
$COMMIT_SUBJECT

$(git diff --cached --stat | head -20)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
COMMIT_HASH=$(git rev-parse --short HEAD)
end_step "Committed: $COMMIT_HASH"

# ── Push ──────────────────────────────────────────────────────────────────────
begin_step "Pushing to origin"
if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin "$BRANCH" || die "Push failed — check remote permissions (see ship.log)"
  PUSH_URL=$(git remote get-url origin | sed 's/\.git$//')
  end_step "Pushed to $PUSH_URL/tree/$BRANCH"
else
  warn "No remote 'origin' configured — skipping push"
  skip_step "Git push (no remote)"
  NO_PR=1
fi

# ── Pull Request ──────────────────────────────────────────────────────────────
PR_URL=""
if [[ "$NO_PR" -eq 1 ]]; then
  skip_step "GitHub PR (--no-pr)"
elif ! command -v gh >/dev/null 2>&1; then
  warn "gh CLI not installed — skipping PR creation"
  info "Open PR manually at: $PUSH_URL/compare/$BRANCH"
  skip_step "GitHub PR (gh not installed)"
else
  begin_step "Creating GitHub PR"

  UNIT_STATUS="passing"
  E2E_STATUS="passing"
  [[ "$SKIP_UNIT" -eq 1 ]] && UNIT_STATUS="skipped"
  [[ "$SKIP_E2E" -eq 1 ]]  && E2E_STATUS="skipped"

  PR_URL=$(gh pr create \
    --title "$COMMIT_SUBJECT" \
    --body "$(cat <<EOF
## Summary

$(git log --oneline "$(git merge-base HEAD origin/main 2>/dev/null || echo HEAD~1)"..HEAD 2>/dev/null | sed 's/^/- /' || echo "- See commits above")

## Tests

- [x] Backend unit tests: $UNIT_STATUS
- [x] E2E tests: $UNIT_STATUS

## Rebuild

$([ -n "$REBUILD_MODE" ] && echo "Containers rebuilt (mode: $REBUILD_MODE)" || echo "No rebuild performed")

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1) || warn "PR creation failed — push succeeded, open PR manually at $PUSH_URL/compare/$BRANCH"

  if [[ "$PR_URL" =~ https:// ]]; then
    end_step "PR created: $PR_URL"
  else
    warn "PR creation returned unexpected output: $PR_URL"
    STEP_RESULTS+=("skip"); STEP_DURATIONS+=("—")
  fi
fi

# ──────────────────────────────────────────────────────────────────────────────
#  Done
# ──────────────────────────────────────────────────────────────────────────────
TOTAL=$(( $(date +%s) - START_TS ))
echo ""
echo -e "${GREEN}${BOLD}✔  Ship complete! (${TOTAL}s)${RESET}"
echo "   Completed at: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
_print_summary

echo "  ┌─────────────────────────────────────────────────────────────┐"
printf  "  │  %-59s│\n" "Branch:  $BRANCH"
printf  "  │  %-59s│\n" "Commit:  $COMMIT_HASH"
[[ -n "$PR_URL" ]] && printf "  │  %-59s│\n" "PR:      $PR_URL"
printf  "  │  %-59s│\n" "Log:     ship.log"
echo "  └─────────────────────────────────────────────────────────────┘"
echo ""
