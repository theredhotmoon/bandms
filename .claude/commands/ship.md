# Ship

Take the current work from "done on a branch" to "reviewed, changelogged, and
merged." Orchestrates summary → language-aware review → CHANGELOG → commit →
MR/PR → merge. Be careful and **confirm before any irreversible/outward step**
(push, PR, merge to the default branch).

## Steps

1. **Summarize the work**
   - `git log <base>..HEAD --oneline` and `git diff --stat <base>...HEAD`
     (base = `main` if it exists, else `master`).
   - Write a tight, human summary: what changed and why, grouped by area
     (backend / frontend / infra / docs).

2. **Test gate (blocking)** — run the suites and STOP on any failure:
   - Backend: `make test` (Pest, ~15 s).
   - Frontend + E2E: `make test-all` (unit + Playwright).
   - Frontend type-check only: `cd app && pnpm build`.
   - A red suite or type error is a 🔴 and blocks the ship — fix before merging.
   - New behaviour in this diff with no test added is also a 🔴: write the test.

3. **Language-aware review** — detect changed file types and run the matching
   review skills, then surface findings (🔴 must-fix block the ship):
   - `*.php` → `/review-php`
   - `*.ts`/`*.tsx` → `/review-ts`
   - `*.js`/`*.mjs`/`*.cjs` → `/review-js`
   - `*.vue` → `/vue-review`
   - Also run `/code-review` for cross-cutting correctness.
   - Fix 🔴 issues (or list them and stop if they need a decision).

4. **Update `CHANGELOG.md`** (Keep a Changelog format, newest on top):
   - Add/extend the `## [Unreleased]` section with `Added / Changed / Fixed /
     Security` bullets derived from the commits. Keep entries user-facing.

5. **Commit** the changelog (+ any review fixes) with a clear message.
   End the message with the project's `Co-Authored-By` trailer.

6. **Prepare the MR/PR**
   - **If a git remote exists:** work must be on a feature branch — never ship
     straight from the default branch.
     - **Already on a feature branch:** `git push -u origin <branch>`.
     - **Commits sitting on `main`:** rescue them first:
       ```bash
       git branch <feature-branch> HEAD          # create branch at current HEAD
       git reset --hard origin/main              # put local main back
       git checkout <feature-branch>
       git push -u origin <feature-branch>
       ```
     Then `gh pr create --base main --head <feature-branch>` with a title + body
     containing the summary and a review checklist. End the PR body with the
     project's PR trailer.
   - **If no remote:** say so. Offer to `gh repo create` (⚠️ outward-facing —
     confirm first; a charity repo may contain personal data — verify
     `.gitignore` excludes it). Otherwise produce the summary as a local
     `MR.md` and prepare a local merge.

7. **Review & merge** — only after 🔴 issues are clear and the user confirms:
   - PR path: `gh pr merge --squash --delete-branch` with a one-sentence
     `--body` summarising the review outcome; then `git checkout main && git pull`
     to sync local main.
   - Local path: `git checkout <base> && git merge --no-ff <branch>` with a
     descriptive merge-commit message; report the result.

## Rules

- **Never auto-merge or push without explicit confirmation** — these are
  outward-facing and hard to reverse.
- Block the merge on unresolved 🔴 findings.
- Don't fabricate a remote or PR — report the actual state.
- Keep the changelog user-facing (what they get), not a raw commit dump.

Scope / target (optional, e.g. a base ref or "since last tag"): $ARGUMENTS
