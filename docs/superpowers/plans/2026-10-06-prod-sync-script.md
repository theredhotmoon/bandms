# Prod ⇄ Local Sync Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `python scripts/sync_db.py pull | push --content | push --full` — copy the database and `storage/app/public` between production and the local Docker stack, with a pull-first guard, migration check, orphan check and verified backup protecting every push.

**Architecture:** A small stdlib-only Python package `scripts/prodsync/`. Pure modules (config, table classification, state/fingerprint, SQL builders/parsers) are unit-tested; a `Side` abstraction turns "run this in container X" into either a local `docker exec` argv or the same argv wrapped in `ssh`; `flows.py` composes those into `pull` and `push`. Passwords never leave the containers: every MySQL call runs `sh -c` inside the mysql container and reads `$MYSQL_ROOT_PASSWORD` / `$MYSQL_DATABASE` from the container's own environment.

**Tech Stack:** Python 3.10 standard library (`argparse`, `subprocess`, `shlex`, `gzip`, `json`, `unittest`); `ssh` and `docker` CLIs on PATH; MySQL 8.4 `mysqldump`/`mysql` and `tar`/`gzip` inside the containers.

**Spec:** `docs/superpowers/specs/2026-10-06-prod-sync-script-design.md`

## Global Constraints

- Python 3.10+, **standard library only** — no `pip install`.
- Subcommands `pull` / `push`; `push` requires exactly one of `--content` / `--full`; `push` has **no `--yes`**; `--force` exists only on `push`.
- `pull` is a full 1:1 copy, including `users` and `oauth_*`.
- Only `storage/app/public` is ever transferred — never the rest of `storage/` (Passport `oauth-*.key`).
- Prod containers `bandms-mysql`, `bandms-backend`, `bandms-web` in `/opt/bandms` (`docker-compose.prod.yml`); local `bandms_mysql`, `bandms_backend`, `bandms_web` (`docker-compose.yml` at repo root).
- Passwords travel only as `MYSQL_PWD` inside the container — never on a command line, never through the script.
- Console output is ASCII only (Windows consoles redirected to a pipe use cp1252).
- The agent never runs `push` (dry-run included is fine); the user runs the first real push.
- Commit subjects follow Conventional Commits; scope `scripts` is new — use `feat(deploy)` / `test(deploy)` / `docs`.

## Review Focus

1. **A Windows-edited `.env` (CRLF line endings, quoted values)** — values must not carry a trailing `\r` or quotes into the SSH host. Test in Task 1.
2. **A table name that is not a plain identifier reaching a shell or SQL string** — must be rejected before any command is built. Test in Task 2 / Task 3.
3. **Every row of a referenced content table deleted locally** (empty id set in the orphan check) — the generated SQL must still be valid and report *every* prod row as orphaned rather than none. Test in Task 3.
4. **`.sync-state.json` from another server, or corrupt** — must count as "no pull recorded", never as a match. Test in Task 2.
5. **Remote quoting** — `$MYSQL_ROOT_PASSWORD` must be expanded by the container's `sh`, not by the server's login shell (which does not have it). Test in Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/sync_db.py` | entry point: puts `scripts/` on `sys.path`, calls `prodsync.cli.main` |
| `scripts/prodsync/__init__.py` | empty package marker |
| `scripts/prodsync/config.py` | `.env` parsing, `Config`, `Options` |
| `scripts/prodsync/tables.py` | `PROD_ONLY_TABLES`, classification, `ForeignKey`, FK splitting |
| `scripts/prodsync/state.py` | `.sync-state.json`, fingerprint diff, guard + migration decisions, backup-name parsing |
| `scripts/prodsync/sql.py` | pure SQL/shell-script builders and output parsers |
| `scripts/prodsync/side.py` | `Side` (local vs ssh argv), subprocess runners, `SyncError` |
| `scripts/prodsync/ops.py` | database + file operations on a `Side` (thin, uses `sql` + `side`) |
| `scripts/prodsync/flows.py` | `Reporter`, confirmations, `pull()`, `push()` |
| `scripts/prodsync/cli.py` | argparse + `main()` |
| `scripts/prodsync/tests/test_*.py` | `unittest` suites for the pure modules |
| `docs/prod-sync.md` | operator doc |
| `.gitignore`, `.env.example`, `CLAUDE.md` | small additions |

Run all tests from the repo root with:

```bash
python -m unittest discover -s scripts/prodsync/tests -t scripts -v
```

---

### Task 1: Package skeleton, config and options

**Files:**
- Create: `scripts/prodsync/__init__.py`, `scripts/prodsync/tests/__init__.py` (both empty)
- Create: `scripts/prodsync/config.py`
- Test: `scripts/prodsync/tests/test_config.py`
- Modify: `.gitignore` (append), `.env.example` (append)

**Interfaces:**
- Produces: `parse_env(text: str) -> dict[str, str]`, `ConfigError(Exception)`, `Config` (fields `repo_root: Path, ssh_host, ssh_user, ssh_key, remote_dir, remote_prefix, local_prefix: str, state_path: Path`), `config_from_env(env, repo_root) -> Config`, `load_config(repo_root) -> Config`, `Options` (fields `command: str, mode: str | None, dry_run: bool, db: bool, files: bool, yes: bool, force: bool`).

- [ ] **Step 1: Write the failing test** — `scripts/prodsync/tests/test_config.py`

```python
import os
import unittest
from pathlib import Path

from prodsync.config import ConfigError, config_from_env, parse_env


class ParseEnvTest(unittest.TestCase):
    def test_reads_plain_pairs_and_skips_comments(self):
        env = parse_env("# comment\nA=1\n\nB = two\nnot a pair\n")
        self.assertEqual(env, {"A": "1", "B": "two"})

    def test_strips_crlf_and_matching_quotes(self):
        env = parse_env('SYNC_SSH_HOST="1.2.3.4"\r\nSYNC_SSH_USER=\'deploy\'\r\n')
        self.assertEqual(env["SYNC_SSH_HOST"], "1.2.3.4")
        self.assertEqual(env["SYNC_SSH_USER"], "deploy")

    def test_accepts_export_prefix_and_equals_in_value(self):
        env = parse_env("export APP_KEY=base64:abc==\n")
        self.assertEqual(env["APP_KEY"], "base64:abc==")


class ConfigFromEnvTest(unittest.TestCase):
    def test_requires_host(self):
        with self.assertRaises(ConfigError):
            config_from_env({}, Path("/repo"))

    def test_defaults(self):
        cfg = config_from_env({"SYNC_SSH_HOST": "example.org"}, Path("/repo"))
        self.assertEqual(cfg.ssh_user, "deploy")
        self.assertEqual(cfg.ssh_key, os.path.expanduser("~/.ssh/bandms_deploy"))
        self.assertEqual(cfg.remote_dir, "/opt/bandms")
        self.assertEqual(cfg.remote_prefix, "bandms-")
        self.assertEqual(cfg.local_prefix, "bandms_")
        self.assertEqual(cfg.state_path, Path("/repo") / ".sync-state.json")

    def test_overrides(self):
        cfg = config_from_env(
            {"SYNC_SSH_HOST": "h", "SYNC_SSH_USER": "u", "SYNC_REMOTE_DIR": "/srv/x"},
            Path("/repo"),
        )
        self.assertEqual((cfg.ssh_user, cfg.remote_dir), ("u", "/srv/x"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s scripts/prodsync/tests -t scripts -v`
Expected: ERROR — `ModuleNotFoundError: No module named 'prodsync.config'` (after creating the two empty `__init__.py` files).

- [ ] **Step 3: Write the implementation** — `scripts/prodsync/config.py`

```python
"""Settings for the prod sync script, read from the repo-root .env."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


class ConfigError(Exception):
    pass


def parse_env(text: str) -> dict[str, str]:
    """Parse a dotenv file without sourcing it: KEY=VALUE lines, comments skipped."""
    values: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key.startswith("export "):
            key = key[len("export "):].strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


@dataclass(frozen=True)
class Config:
    repo_root: Path
    ssh_host: str
    ssh_user: str
    ssh_key: str
    remote_dir: str
    remote_prefix: str
    local_prefix: str
    state_path: Path


@dataclass(frozen=True)
class Options:
    command: str          # 'pull' | 'push'
    mode: str | None      # push only: 'content' | 'full'
    dry_run: bool
    db: bool              # False with --files-only
    files: bool           # False with --db-only
    yes: bool             # pull only
    force: bool           # push only


def config_from_env(env: dict[str, str], repo_root: Path) -> Config:
    host = env.get("SYNC_SSH_HOST", "").strip()
    if not host:
        raise ConfigError("SYNC_SSH_HOST is not set in .env - add the production server address")
    return Config(
        repo_root=repo_root,
        ssh_host=host,
        ssh_user=env.get("SYNC_SSH_USER") or "deploy",
        ssh_key=os.path.expanduser(env.get("SYNC_SSH_KEY") or "~/.ssh/bandms_deploy"),
        remote_dir=env.get("SYNC_REMOTE_DIR") or "/opt/bandms",
        remote_prefix=env.get("SYNC_REMOTE_PREFIX") or "bandms-",
        local_prefix=env.get("SYNC_LOCAL_PREFIX") or "bandms_",
        state_path=repo_root / ".sync-state.json",
    )


def load_config(repo_root: Path) -> Config:
    path = repo_root / ".env"
    if not path.exists():
        raise ConfigError(f"{path} not found - copy .env.example to .env first")
    return config_from_env(parse_env(path.read_text(encoding="utf-8")), repo_root)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -s scripts/prodsync/tests -t scripts -v`
Expected: 6 tests, OK.

- [ ] **Step 5: Add ignore rules and example config**

Append to `.gitignore`:

```gitignore

# scripts/sync_db.py - fingerprint of prod's content tables from the last pull
/.sync-state.json
__pycache__/
```

Append to `.env.example`:

```dotenv

# ── scripts/sync_db.py (prod <-> local sync) ─────────────────────────────────
# Only read by the sync script on your machine; never needed on the server.
# See docs/prod-sync.md.
SYNC_SSH_HOST=
SYNC_SSH_USER=deploy
SYNC_SSH_KEY=~/.ssh/bandms_deploy
```

- [ ] **Step 6: Commit**

```bash
git add scripts/prodsync .gitignore .env.example
git commit -m "feat(deploy): add sync script config parsing"
```

---

### Task 2: Table classification and sync state

**Files:**
- Create: `scripts/prodsync/tables.py`, `scripts/prodsync/state.py`
- Test: `scripts/prodsync/tests/test_tables.py`, `scripts/prodsync/tests/test_state.py`

**Interfaces:**
- Produces (tables): `PROD_ONLY_TABLES: frozenset[str]`, `validate_table_name(name: str) -> str` (raises `ValueError`), `classify(tables) -> tuple[list[str], list[str]]` (content, prod_only — both sorted), `new_tables(content, known) -> list[str]`, `ForeignKey(table, column, ref_table, ref_column)` frozen dataclass, `split_cross_foreign_keys(fks, prod_only) -> tuple[list[ForeignKey], list[ForeignKey]]` (prod-only child → content parent, content child → prod-only parent).
- Produces (state): `diff_fingerprints(saved, current) -> list[str]`, `load_state(path, host) -> dict[str, str | None] | None`, `save_state(path, host, fingerprint, now=None) -> None`, `guard_problem(saved, current, host) -> str | None`, `migration_problem(local, prod) -> str | None`, `parse_backup_name(output: str) -> str | None`.

- [ ] **Step 1: Write the failing tests** — `scripts/prodsync/tests/test_tables.py`

```python
import unittest

from prodsync.tables import (
    PROD_ONLY_TABLES, ForeignKey, classify, new_tables,
    split_cross_foreign_keys, validate_table_name,
)


class ClassifyTest(unittest.TestCase):
    def test_splits_and_sorts(self):
        content, prod_only = classify(["posts", "users", "concerts", "orders"])
        self.assertEqual(content, ["concerts", "posts"])
        self.assertEqual(prod_only, ["orders", "users"])

    def test_tables_written_by_prod_traffic_are_prod_only(self):
        for name in ("tech_rider_confirmations", "migrations", "oauth_clients",
                     "tickets", "newsletter_subscribers", "site_dirty_areas"):
            self.assertIn(name, PROD_ONLY_TABLES)

    def test_unknown_table_defaults_to_content(self):
        content, _ = classify(["brand_new_table"])
        self.assertEqual(content, ["brand_new_table"])

    def test_new_tables(self):
        self.assertEqual(new_tables(["a", "b", "c"], {"a": "1", "b": "2"}), ["c"])


class ValidateTableNameTest(unittest.TestCase):
    def test_accepts_identifiers(self):
        self.assertEqual(validate_table_name("post_blocks"), "post_blocks")

    def test_rejects_anything_else(self):
        for bad in ("posts`; DROP", "a b", "", "x;y", "$(id)"):
            with self.assertRaises(ValueError):
                validate_table_name(bad)

    def test_classify_validates(self):
        with self.assertRaises(ValueError):
            classify(["ok", "not ok"])


class SplitForeignKeysTest(unittest.TestCase):
    def test_only_cross_boundary_keys(self):
        fks = [
            ForeignKey("tickets", "concert_id", "concerts", "id"),     # prod-only -> content
            ForeignKey("posts", "user_id", "users", "id"),             # content -> prod-only
            ForeignKey("post_blocks", "post_id", "posts", "id"),       # content -> content
            ForeignKey("order_items", "order_id", "orders", "id"),     # prod-only -> prod-only
        ]
        down, up = split_cross_foreign_keys(fks, PROD_ONLY_TABLES)
        self.assertEqual([f.table for f in down], ["tickets"])
        self.assertEqual([f.table for f in up], ["posts"])


if __name__ == "__main__":
    unittest.main()
```

`scripts/prodsync/tests/test_state.py`

```python
import json
import tempfile
import unittest
from pathlib import Path

from prodsync.state import (
    diff_fingerprints, guard_problem, load_state, migration_problem,
    parse_backup_name, save_state,
)


class DiffTest(unittest.TestCase):
    def test_changed_added_removed(self):
        saved = {"a": "1", "b": "2", "c": "3"}
        current = {"a": "1", "b": "9", "d": "4"}
        self.assertEqual(diff_fingerprints(saved, current), ["b", "c", "d"])

    def test_identical(self):
        self.assertEqual(diff_fingerprints({"a": None}, {"a": None}), [])


class StateFileTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = Path(self.dir.name) / ".sync-state.json"

    def tearDown(self):
        self.dir.cleanup()

    def test_roundtrip(self):
        save_state(self.path, "prod.example", {"posts": "12"})
        self.assertEqual(load_state(self.path, "prod.example"), {"posts": "12"})

    def test_other_host_counts_as_missing(self):
        save_state(self.path, "prod.example", {"posts": "12"})
        self.assertIsNone(load_state(self.path, "staging.example"))

    def test_missing_or_corrupt_counts_as_missing(self):
        self.assertIsNone(load_state(self.path, "h"))
        self.path.write_text("{not json", encoding="utf-8")
        self.assertIsNone(load_state(self.path, "h"))
        self.path.write_text(json.dumps({"host": "h", "fingerprint": []}), encoding="utf-8")
        self.assertIsNone(load_state(self.path, "h"))


class GuardTest(unittest.TestCase):
    def test_no_state(self):
        self.assertIn("run pull first", guard_problem(None, {"a": "1"}, "h"))

    def test_changed_tables_are_named(self):
        msg = guard_problem({"shop_items": "1", "posts": "2"},
                            {"shop_items": "5", "posts": "2"}, "h")
        self.assertIn("shop_items", msg)
        self.assertNotIn("posts", msg)

    def test_unchanged(self):
        self.assertIsNone(guard_problem({"a": "1"}, {"a": "1"}, "h"))


class MigrationTest(unittest.TestCase):
    def test_equal_sets(self):
        self.assertIsNone(migration_problem(["m1", "m2"], ["m2", "m1"]))

    def test_reports_both_directions(self):
        msg = migration_problem(["m1", "m3"], ["m1", "m2"])
        self.assertIn("m3", msg)
        self.assertIn("m2", msg)


class BackupNameTest(unittest.TestCase):
    def test_parses_verified_line(self):
        out = "[backup] dumping\n[backup] verified: bandms-20261006-101500.sql.gz (1.2M)\n"
        self.assertEqual(parse_backup_name(out), "bandms-20261006-101500.sql.gz")

    def test_nothing_backed_up(self):
        self.assertIsNone(parse_backup_name("[backup] database 'bandms' has no tables yet\n"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m unittest discover -s scripts/prodsync/tests -t scripts -v`
Expected: ERROR — `No module named 'prodsync.tables'` / `'prodsync.state'`.

- [ ] **Step 3: Write `scripts/prodsync/tables.py`**

```python
"""Which tables are band content and which only ever exist on production."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

# Rows created by visitors, customers or the runtime on prod. `push --content`
# never touches these; everything else is content. A new migration's table is
# therefore content by default - the flows print it so that is never silent.
PROD_ONLY_TABLES = frozenset({
    "users", "fan_accounts", "allowed_emails",
    "orders", "order_items", "tickets", "ticket_transfers",
    "presale_codes", "presale_code_tiers", "promo_codes",
    "newsletter_subscribers", "tech_rider_confirmations",
    "oauth_access_tokens", "oauth_auth_codes", "oauth_clients",
    "oauth_device_codes", "oauth_refresh_tokens",
    "sessions", "password_reset_tokens",
    "jobs", "job_batches", "failed_jobs",
    "cache", "cache_locks", "site_dirty_areas", "migrations",
})

_IDENTIFIER = re.compile(r"^[A-Za-z0-9_]+$")


def validate_table_name(name: str) -> str:
    """Table names end up in shell commands and SQL; allow plain identifiers only."""
    if not _IDENTIFIER.match(name):
        raise ValueError(f"refusing unexpected table name: {name!r}")
    return name


def classify(tables: Iterable[str]) -> tuple[list[str], list[str]]:
    content, prod_only = [], []
    for name in tables:
        validate_table_name(name)
        (prod_only if name in PROD_ONLY_TABLES else content).append(name)
    return sorted(content), sorted(prod_only)


def new_tables(content: Iterable[str], known: Iterable[str]) -> list[str]:
    return sorted(set(content) - set(known))


@dataclass(frozen=True)
class ForeignKey:
    table: str
    column: str
    ref_table: str
    ref_column: str


def split_cross_foreign_keys(
    fks: Iterable[ForeignKey], prod_only: Iterable[str]
) -> tuple[list[ForeignKey], list[ForeignKey]]:
    """(prod-only child -> content parent, content child -> prod-only parent)."""
    prod_only = set(prod_only)
    down, up = [], []
    for fk in fks:
        child_prod, parent_prod = fk.table in prod_only, fk.ref_table in prod_only
        if child_prod and not parent_prod:
            down.append(fk)
        elif parent_prod and not child_prod:
            up.append(fk)
    return down, up
```

- [ ] **Step 4: Write `scripts/prodsync/state.py`**

```python
"""The pull-first guard's memory: prod's content fingerprint at the last pull."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

_MISSING = object()


def diff_fingerprints(saved: dict, current: dict) -> list[str]:
    tables = set(saved) | set(current)
    return sorted(t for t in tables if saved.get(t, _MISSING) != current.get(t, _MISSING))


def load_state(path: Path, host: str) -> dict[str, str | None] | None:
    """The saved fingerprint for `host`, or None when there is no usable record."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or data.get("host") != host:
        return None
    fingerprint = data.get("fingerprint")
    return fingerprint if isinstance(fingerprint, dict) else None


def save_state(path: Path, host: str, fingerprint: dict, now: datetime | None = None) -> None:
    payload = {
        "host": host,
        "recorded_at": (now or datetime.now(timezone.utc)).isoformat(timespec="seconds"),
        "fingerprint": fingerprint,
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def guard_problem(saved: dict | None, current: dict, host: str) -> str | None:
    if saved is None:
        return f"no record of a pull from {host} - run pull first"
    changed = diff_fingerprints(saved, current)
    if changed:
        return ("prod content changed since the last pull (a sale, or an edit in the "
                "prod admin): " + ", ".join(changed))
    return None


def migration_problem(local: Iterable[str], prod: Iterable[str]) -> str | None:
    local, prod = set(local), set(prod)
    if local == prod:
        return None
    lines = ["local and prod are on different migrations - deploy or migrate first"]
    lines += [f"  only local: {m}" for m in sorted(local - prod)]
    lines += [f"  only prod:  {m}" for m in sorted(prod - local)]
    return "\n".join(lines)


def parse_backup_name(output: str) -> str | None:
    match = re.search(r"verified: (\S+)", output)
    return match.group(1) if match else None
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m unittest discover -s scripts/prodsync/tests -t scripts -v`
Expected: all tests OK (6 config + 8 tables + 12 state).

- [ ] **Step 6: Commit**

```bash
git add scripts/prodsync
git commit -m "feat(deploy): classify sync tables and record prod fingerprints"
```

---

### Task 3: SQL and shell-script builders

**Files:**
- Create: `scripts/prodsync/sql.py`
- Test: `scripts/prodsync/tests/test_sql.py`

**Interfaces:**
- Consumes: `validate_table_name`, `ForeignKey` from `prodsync.tables`.
- Produces: constants `LIST_TABLES`, `LIST_MIGRATIONS`, `LIST_FOREIGN_KEYS`, `SCHEMA_CHARSET`, `MYSQL_CLIENT`, `IMPORT_SCRIPT`; functions `quote_ident(name) -> str`, `quote_value(value: str) -> str`, `checksum_sql(tables) -> str`, `parse_checksums(output) -> dict[str, str | None]`, `parse_rows(output) -> list[list[str]]`, `parse_foreign_keys(output) -> list[ForeignKey]`, `distinct_values_sql(table, column) -> str`, `children_missing_parent_sql(fk, parent_values) -> str`, `parents_missing_sql(fk, child_values) -> str`, `recreate_database_sql(database, charset, collation) -> str`, `dump_script(tables: list[str] | None) -> str`, `dump_completed(tail: bytes) -> bool`.

- [ ] **Step 1: Write the failing test** — `scripts/prodsync/tests/test_sql.py`

```python
import unittest

from prodsync.sql import (
    checksum_sql, children_missing_parent_sql, distinct_values_sql, dump_completed,
    dump_script, parents_missing_sql, parse_checksums, parse_foreign_keys,
    quote_value, recreate_database_sql,
)
from prodsync.tables import ForeignKey


class ChecksumTest(unittest.TestCase):
    def test_builds_one_statement(self):
        self.assertEqual(checksum_sql(["a", "b"]), "CHECKSUM TABLE `a`, `b`;")

    def test_rejects_empty_and_bad_names(self):
        with self.assertRaises(ValueError):
            checksum_sql([])
        with self.assertRaises(ValueError):
            checksum_sql(["ok", "bad name"])

    def test_parses_values_and_null(self):
        out = "bandms.posts\t12345\nbandms.gone\tNULL\n"
        self.assertEqual(parse_checksums(out), {"posts": "12345", "gone": None})


class ForeignKeysTest(unittest.TestCase):
    def test_parse(self):
        out = "tickets\tconcert_id\tconcerts\tid\n"
        self.assertEqual(parse_foreign_keys(out),
                         [ForeignKey("tickets", "concert_id", "concerts", "id")])


class QuoteTest(unittest.TestCase):
    def test_escapes(self):
        self.assertEqual(quote_value("it's"), "'it''s'")
        self.assertEqual(quote_value("a\\b"), "'a\\\\b'")


class OrphanSqlTest(unittest.TestCase):
    fk = ForeignKey("tickets", "concert_id", "concerts", "id")

    def test_children_query_carries_values(self):
        sql = children_missing_parent_sql(self.fk, ["1", "2"])
        self.assertIn("VALUES ('1'),('2')", sql)
        self.assertIn("FROM `tickets` c", sql)
        self.assertIn("k.v IS NULL", sql)

    def test_empty_parent_set_still_valid_and_matches_everything(self):
        sql = children_missing_parent_sql(self.fk, [])
        self.assertNotIn("INSERT", sql)
        self.assertIn("CREATE TEMPORARY TABLE", sql)
        self.assertIn("k.v IS NULL", sql)

    def test_inserts_are_chunked(self):
        sql = children_missing_parent_sql(self.fk, [str(i) for i in range(2500)])
        self.assertEqual(sql.count("INSERT IGNORE"), 3)

    def test_parents_query(self):
        sql = parents_missing_sql(ForeignKey("posts", "user_id", "users", "id"), ["7"])
        self.assertIn("LEFT JOIN `users` p", sql)
        self.assertIn("p.`id` IS NULL", sql)

    def test_distinct_values(self):
        self.assertIn("SELECT DISTINCT", distinct_values_sql("concerts", "id"))
        with self.assertRaises(ValueError):
            distinct_values_sql("concerts", "id; drop")


class DumpTest(unittest.TestCase):
    def test_full_dump_has_routines_and_reads_password_in_container(self):
        script = dump_script(None)
        self.assertIn("--routines", script)
        self.assertIn('MYSQL_PWD="$MYSQL_ROOT_PASSWORD"', script)
        self.assertTrue(script.endswith("| gzip -c"))

    def test_table_dump_lists_tables(self):
        script = dump_script(["posts", "tags"])
        self.assertIn('"$MYSQL_DATABASE" posts tags |', script)
        self.assertNotIn("--routines", script)

    def test_table_dump_validates(self):
        with self.assertRaises(ValueError):
            dump_script(["posts; rm -rf /"])

    def test_completion_marker(self):
        self.assertTrue(dump_completed(b"...\n-- Dump completed on 2026-10-06 10:00:00\n"))
        self.assertFalse(dump_completed(b"INSERT INTO posts VALUES (1"))

    def test_recreate(self):
        sql = recreate_database_sql("bandms", "utf8mb4", "utf8mb4_unicode_ci")
        self.assertIn("DROP DATABASE IF EXISTS `bandms`", sql)
        self.assertIn("CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", sql)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s scripts/prodsync/tests -t scripts -v`
Expected: ERROR — `No module named 'prodsync.sql'`.

- [ ] **Step 3: Write `scripts/prodsync/sql.py`**

```python
"""SQL and container shell scripts, built as strings; no I/O here."""
from __future__ import annotations

from typing import Iterable

from .tables import ForeignKey, validate_table_name

# Every MySQL call runs inside the mysql container and takes the password and
# database name from the container's own environment, so neither ever crosses
# a command line or the SSH connection.
_AUTH = 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD"'
MYSQL_CLIENT = f'{_AUTH} exec mysql -uroot -N -B "$MYSQL_DATABASE"'
IMPORT_SCRIPT = f'gzip -dc | {_AUTH} mysql -uroot "$MYSQL_DATABASE"'

LIST_TABLES = ("SELECT TABLE_NAME FROM information_schema.TABLES "
               "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' "
               "ORDER BY TABLE_NAME;")
LIST_MIGRATIONS = "SELECT migration FROM migrations ORDER BY migration;"
LIST_FOREIGN_KEYS = ("SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME "
                     "FROM information_schema.KEY_COLUMN_USAGE "
                     "WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL "
                     "ORDER BY TABLE_NAME, COLUMN_NAME;")
SCHEMA_CHARSET = ("SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME "
                  "FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE();")

_CHUNK = 1000
# Ids are compared as binary strings on both sides: an explicit COLLATE wins
# coercibility, so a temp table and a column with different default collations
# cannot raise "Illegal mix of collations".
_AS_KEY = "CAST({} AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_bin"


def quote_ident(name: str) -> str:
    return f"`{validate_table_name(name)}`"


def quote_value(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def checksum_sql(tables: Iterable[str]) -> str:
    names = [quote_ident(t) for t in tables]
    if not names:
        raise ValueError("no tables to checksum")
    return f"CHECKSUM TABLE {', '.join(names)};"


def parse_rows(output: str) -> list[list[str]]:
    return [line.split("\t") for line in output.splitlines() if line.strip()]


def parse_checksums(output: str) -> dict[str, str | None]:
    result: dict[str, str | None] = {}
    for qualified, value in parse_rows(output):
        result[qualified.split(".", 1)[-1]] = None if value == "NULL" else value
    return result


def parse_foreign_keys(output: str) -> list[ForeignKey]:
    return [ForeignKey(*row) for row in parse_rows(output)]


def distinct_values_sql(table: str, column: str) -> str:
    col = quote_ident(column)
    return f"SELECT DISTINCT CAST({col} AS CHAR) FROM {quote_ident(table)} WHERE {col} IS NOT NULL;"


def _values_table(values: list[str]) -> str:
    parts = [
        "DROP TEMPORARY TABLE IF EXISTS _sync_keep;",
        "CREATE TEMPORARY TABLE _sync_keep "
        "(v VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY);",
    ]
    for start in range(0, len(values), _CHUNK):
        chunk = values[start:start + _CHUNK]
        rows = ",".join(f"({quote_value(v)})" for v in chunk)
        parts.append(f"INSERT IGNORE INTO _sync_keep (v) VALUES {rows};")
    return "\n".join(parts)


def children_missing_parent_sql(fk: ForeignKey, parent_values: list[str]) -> str:
    """Rows of prod-only fk.table whose parent id is absent from `parent_values`.

    Output columns: table, column, missing value, row count.
    """
    col = f"c.{quote_ident(fk.column)}"
    return _values_table(parent_values) + (
        f"\nSELECT {quote_value(fk.table)}, {quote_value(fk.column)}, CAST({col} AS CHAR), COUNT(*) "
        f"FROM {quote_ident(fk.table)} c "
        f"LEFT JOIN _sync_keep k ON k.v = {_AS_KEY.format(col)} "
        f"WHERE {col} IS NOT NULL AND k.v IS NULL GROUP BY {col};"
    )


def parents_missing_sql(fk: ForeignKey, child_values: list[str]) -> str:
    """Values of content fk.table.fk.column with no row in prod-only fk.ref_table.

    Output columns: table, column, missing value.
    """
    ref = f"p.{quote_ident(fk.ref_column)}"
    return _values_table(child_values) + (
        f"\nSELECT {quote_value(fk.table)}, {quote_value(fk.column)}, k.v FROM _sync_keep k "
        f"LEFT JOIN {quote_ident(fk.ref_table)} p ON {_AS_KEY.format(ref)} = k.v "
        f"WHERE {ref} IS NULL;"
    )


def recreate_database_sql(database: str, charset: str, collation: str) -> str:
    db = quote_ident(database)
    return (f"DROP DATABASE IF EXISTS {db};\n"
            f"CREATE DATABASE {db} CHARACTER SET {validate_table_name(charset)} "
            f"COLLATE {validate_table_name(collation)};")


def dump_script(tables: list[str] | None) -> str:
    """mysqldump of the whole database (None) or of the given tables, gzipped to stdout."""
    flags = "--single-transaction --no-tablespaces --triggers"
    if tables is None:
        flags += " --routines --events"
        names = ""
    else:
        names = " " + " ".join(validate_table_name(t) for t in tables)
    return f'{_AUTH} mysqldump -uroot {flags} "$MYSQL_DATABASE"{names} | gzip -c'


def dump_completed(tail: bytes) -> bool:
    # mysqldump writes this as its last line; a dump that died part-way is
    # still a valid gzip, so this marker is what proves it ran to the end.
    return b"-- Dump completed" in tail
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -s scripts/prodsync/tests -t scripts -v`
Expected: all OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/prodsync
git commit -m "feat(deploy): add sql builders for the sync script"
```

---

### Task 4: `Side` — local vs SSH command building and process runners

**Files:**
- Create: `scripts/prodsync/side.py`
- Test: `scripts/prodsync/tests/test_side.py`

**Interfaces:**
- Consumes: `Config` from `prodsync.config`.
- Produces: `SyncError(Exception)`, `CommandFailed(SyncError)`, `Side` with `name: str`, `cwd: Path | None`, methods `container(service) -> str`, `exec_argv(service, script, stdin=False) -> list[str]`, `docker_argv(*args) -> list[str]`, `compose_argv(*args) -> list[str]`, `shell_argv(command: str) -> list[str]` (remote only); factories `local_side(cfg) -> Side`, `remote_side(cfg) -> Side`; runners `run(argv, *, cwd=None, input=None) -> str`, `run_to_file(argv, path, *, cwd=None)`, `run_from_file(argv, path, *, cwd=None)`, `pipe(src_argv, dst_argv, *, src_cwd=None, dst_cwd=None)`.

- [ ] **Step 1: Write the failing test** — `scripts/prodsync/tests/test_side.py`

```python
import shlex
import unittest
from pathlib import Path

from prodsync.config import config_from_env
from prodsync.side import CommandFailed, local_side, remote_side, run
from prodsync.sql import MYSQL_CLIENT

CFG = config_from_env({"SYNC_SSH_HOST": "203.0.113.5", "SYNC_SSH_KEY": "/k/id"}, Path("/repo"))


class LocalSideTest(unittest.TestCase):
    def test_exec(self):
        argv = local_side(CFG).exec_argv("mysql", "echo hi", stdin=True)
        self.assertEqual(argv, ["docker", "exec", "-i", "bandms_mysql", "sh", "-c", "echo hi"])

    def test_compose_runs_in_repo_root(self):
        side = local_side(CFG)
        self.assertEqual(side.compose_argv("restart", "web"), ["docker", "compose", "restart", "web"])
        self.assertEqual(side.cwd, Path("/repo"))


class RemoteSideTest(unittest.TestCase):
    def test_ssh_prefix(self):
        argv = remote_side(CFG).exec_argv("mysql", "echo hi")
        self.assertEqual(argv[:7], ["ssh", "-i", "/k/id", "-o", "BatchMode=yes",
                                    "-o", "ConnectTimeout=15"])
        self.assertEqual(argv[7], "deploy@203.0.113.5")

    def test_remote_command_round_trips_through_the_server_shell(self):
        argv = remote_side(CFG).exec_argv("mysql", MYSQL_CLIENT, stdin=True)
        self.assertEqual(shlex.split(argv[-1]),
                         ["docker", "exec", "-i", "bandms-mysql", "sh", "-c", MYSQL_CLIENT])

    def test_password_variable_is_not_expanded_by_the_server_shell(self):
        remote = remote_side(CFG).exec_argv("mysql", MYSQL_CLIENT)[-1]
        script_part = remote.split(" sh -c ", 1)[1]
        # single-quoted for the server's login shell, so only the container's sh expands it
        self.assertTrue(script_part.startswith("'") and script_part.endswith("'"))
        self.assertIn("$MYSQL_ROOT_PASSWORD", script_part)

    def test_compose_changes_into_remote_dir(self):
        cmd = remote_side(CFG).compose_argv("restart", "web")[-1]
        self.assertEqual(cmd, "cd /opt/bandms && docker compose -f docker-compose.prod.yml restart web")


class RunTest(unittest.TestCase):
    def test_failure_raises_with_stderr(self):
        import sys
        with self.assertRaises(CommandFailed) as ctx:
            run([sys.executable, "-c", "import sys; sys.stderr.write('boom'); sys.exit(3)"])
        self.assertIn("boom", str(ctx.exception))
        self.assertIn("exit 3", str(ctx.exception))

    def test_success_returns_stdout(self):
        import sys
        self.assertEqual(run([sys.executable, "-c", "print('ok')"]).strip(), "ok")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s scripts/prodsync/tests -t scripts -v`
Expected: ERROR — `No module named 'prodsync.side'`.

- [ ] **Step 3: Write `scripts/prodsync/side.py`**

```python
"""Where a command runs: on this machine, or on the prod server over SSH."""
from __future__ import annotations

import shlex
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from .config import Config


class SyncError(Exception):
    pass


class CommandFailed(SyncError):
    def __init__(self, argv: list[str], code: int, stderr: bytes):
        tail = stderr.decode("utf-8", "replace").strip().splitlines()[-8:]
        shown = argv[-1] if argv and argv[0] == "ssh" else shlex.join(argv)
        if len(shown) > 200:
            shown = shown[:200] + "..."
        super().__init__(f"command failed (exit {code}): {shown}\n" + "\n".join(f"    {l}" for l in tail))


@dataclass(frozen=True)
class Side:
    name: str                     # 'local' | 'prod'
    prefix: str                   # container-name prefix
    cwd: Path | None              # where compose runs (local only)
    ssh: tuple[str, ...] = ()     # ssh argv prefix; empty for local
    remote_dir: str = ""

    def container(self, service: str) -> str:
        return f"{self.prefix}{service}"

    def _wrap(self, argv: list[str]) -> list[str]:
        return [*self.ssh, shlex.join(argv)] if self.ssh else argv

    def exec_argv(self, service: str, script: str, stdin: bool = False) -> list[str]:
        argv = ["docker", "exec", *(["-i"] if stdin else []), self.container(service), "sh", "-c", script]
        return self._wrap(argv)

    def docker_argv(self, *args: str) -> list[str]:
        return self._wrap(["docker", *args])

    def compose_argv(self, *args: str) -> list[str]:
        if not self.ssh:
            return ["docker", "compose", *args]
        compose = shlex.join(["docker", "compose", "-f", "docker-compose.prod.yml", *args])
        return [*self.ssh, f"cd {shlex.quote(self.remote_dir)} && {compose}"]

    def shell_argv(self, command: str) -> list[str]:
        if not self.ssh:
            raise ValueError("shell_argv is only for the remote side")
        return [*self.ssh, command]


def local_side(cfg: Config) -> Side:
    return Side(name="local", prefix=cfg.local_prefix, cwd=cfg.repo_root)


def remote_side(cfg: Config) -> Side:
    ssh = ("ssh", "-i", cfg.ssh_key, "-o", "BatchMode=yes", "-o", "ConnectTimeout=15",
           f"{cfg.ssh_user}@{cfg.ssh_host}")
    return Side(name="prod", prefix=cfg.remote_prefix, cwd=None, ssh=ssh, remote_dir=cfg.remote_dir)


def run(argv: list[str], *, cwd: Path | None = None, input: bytes | None = None) -> str:
    proc = subprocess.run(argv, cwd=cwd, input=input, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise CommandFailed(argv, proc.returncode, proc.stderr)
    return proc.stdout.decode("utf-8", "replace")


def run_to_file(argv: list[str], path: Path, *, cwd: Path | None = None) -> None:
    with open(path, "wb") as out, tempfile.TemporaryFile() as err:
        code = subprocess.run(argv, cwd=cwd, stdout=out, stderr=err).returncode
        if code != 0:
            err.seek(0)
            raise CommandFailed(argv, code, err.read())


def run_from_file(argv: list[str], path: Path, *, cwd: Path | None = None) -> None:
    with open(path, "rb") as src, tempfile.TemporaryFile() as err:
        code = subprocess.run(argv, cwd=cwd, stdin=src, stdout=subprocess.DEVNULL, stderr=err).returncode
        if code != 0:
            err.seek(0)
            raise CommandFailed(argv, code, err.read())


def pipe(src_argv: list[str], dst_argv: list[str], *,
         src_cwd: Path | None = None, dst_cwd: Path | None = None) -> None:
    """src stdout -> dst stdin, streamed. Both exit codes are checked."""
    with tempfile.TemporaryFile() as src_err, tempfile.TemporaryFile() as dst_err:
        src = subprocess.Popen(src_argv, cwd=src_cwd, stdout=subprocess.PIPE, stderr=src_err)
        dst = subprocess.Popen(dst_argv, cwd=dst_cwd, stdin=src.stdout,
                               stdout=subprocess.DEVNULL, stderr=dst_err)
        src.stdout.close()  # dst owns the read end; src gets SIGPIPE if dst dies
        dst_code, src_code = dst.wait(), src.wait()
        if src_code != 0:
            src_err.seek(0)
            raise CommandFailed(src_argv, src_code, src_err.read())
        if dst_code != 0:
            dst_err.seek(0)
            raise CommandFailed(dst_argv, dst_code, dst_err.read())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m unittest discover -s scripts/prodsync/tests -t scripts -v`
Expected: all OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/prodsync
git commit -m "feat(deploy): run sync commands locally or over ssh"
```

---

### Task 5: Database and file operations

**Files:**
- Create: `scripts/prodsync/ops.py`

**Interfaces:**
- Consumes: `Side`, `run`, `run_to_file`, `run_from_file`, `pipe`, `SyncError` (side); everything in `sql`; `classify`, `split_cross_foreign_keys`, `ForeignKey` (tables).
- Produces: `query(side, sql) -> str`, `list_tables(side) -> list[str]`, `migrations(side) -> list[str]`, `schema_charset(side) -> tuple[str, str]`, `database_name(side) -> str`, `fingerprint(side, tables) -> dict[str, str | None]`, `dump_to(side, path, tables)`, `verify_dump(path)`, `import_dump(side, path, recreate: tuple[str, str] | None)`, `orphan_problems(local, prod, prod_only) -> list[str]`, `check_running(side, services)`, `wait_healthy(side, service, timeout=180)`, `artisan(side, *args) -> str`, `mirror_files(src, dst)`, `files_summary(side) -> str`.

This module is I/O glue over already-tested builders; it is verified against the real local stack in Step 2 rather than with mocks.

- [ ] **Step 1: Write `scripts/prodsync/ops.py`**

```python
"""Database and upload operations against one Side (local or prod)."""
from __future__ import annotations

import gzip
import time
from pathlib import Path
from typing import Iterable

from . import sql
from .side import Side, SyncError, pipe, run, run_from_file, run_to_file
from .tables import split_cross_foreign_keys

STORAGE_APP = "/var/www/html/storage/app"

# Only storage/app/public moves - never the rest of storage/, which holds
# Passport's oauth-*.key (replacing it logs out every user on that side).
PACK = f"tar -C {STORAGE_APP} -czf - public"
# Extract beside the live directory and swap only after a complete extract, so
# a dropped connection leaves the old uploads in place.
UNPACK = (
    f"set -e; cd {STORAGE_APP}; rm -rf .sync-incoming .sync-old; mkdir .sync-incoming; "
    "tar -xzf - -C .sync-incoming; test -d .sync-incoming/public; "
    "if [ -d public ]; then mv public .sync-old; fi; "
    "mv .sync-incoming/public public; rm -rf .sync-old .sync-incoming; "
    "chown -R www-data:www-data public"
)


def query(side: Side, statement: str) -> str:
    return run(side.exec_argv("mysql", sql.MYSQL_CLIENT, stdin=True), cwd=side.cwd,
               input=statement.encode("utf-8"))


def _column(side: Side, statement: str) -> list[str]:
    return [row[0] for row in sql.parse_rows(query(side, statement))]


def list_tables(side: Side) -> list[str]:
    return _column(side, sql.LIST_TABLES)


def migrations(side: Side) -> list[str]:
    return _column(side, sql.LIST_MIGRATIONS)


def schema_charset(side: Side) -> tuple[str, str]:
    rows = sql.parse_rows(query(side, sql.SCHEMA_CHARSET))
    if not rows or len(rows[0]) != 2:
        raise SyncError(f"could not read the {side.name} database charset")
    return rows[0][0], rows[0][1]


def database_name(side: Side) -> str:
    name = run(side.exec_argv("mysql", 'printf %s "$MYSQL_DATABASE"'), cwd=side.cwd).strip()
    if not name:
        raise SyncError(f"MYSQL_DATABASE is empty in the {side.name} mysql container")
    return name


def fingerprint(side: Side, tables: Iterable[str]) -> dict[str, str | None]:
    return sql.parse_checksums(query(side, sql.checksum_sql(tables)))


def dump_to(side: Side, path: Path, tables: list[str] | None) -> None:
    run_to_file(side.exec_argv("mysql", sql.dump_script(tables)), path, cwd=side.cwd)
    verify_dump(path)


def verify_dump(path: Path) -> None:
    tail = b""
    try:
        with gzip.open(path, "rb") as fh:
            while chunk := fh.read(1 << 20):
                tail = (tail + chunk)[-4096:]
    except (OSError, EOFError) as exc:
        raise SyncError(f"dump {path.name} is not a valid gzip: {exc}") from exc
    if not sql.dump_completed(tail):
        raise SyncError(f"dump {path.name} is truncated - no completion marker")


def import_dump(side: Side, path: Path, recreate: tuple[str, str] | None) -> None:
    """Load a gzipped dump. `recreate` = (charset, collation) drops the database first (1:1)."""
    if recreate:
        query(side, sql.recreate_database_sql(database_name(side), *recreate))
    run_from_file(side.exec_argv("mysql", sql.IMPORT_SCRIPT, stdin=True), path, cwd=side.cwd)


def orphan_problems(local: Side, prod: Side, prod_only: Iterable[str]) -> list[str]:
    """What a content push would leave dangling on prod, as human-readable lines."""
    fks = sql.parse_foreign_keys(query(prod, sql.LIST_FOREIGN_KEYS))
    down, up = split_cross_foreign_keys(fks, prod_only)
    problems = []
    for fk in down:
        keep = _column(local, sql.distinct_values_sql(fk.ref_table, fk.ref_column))
        for table, column, value, count in sql.parse_rows(query(prod, sql.children_missing_parent_sql(fk, keep))):
            problems.append(f"{count} prod row(s) in {table}.{column} point at "
                            f"{fk.ref_table}.{fk.ref_column}={value}, which is missing locally")
    for fk in up:
        values = _column(local, sql.distinct_values_sql(fk.table, fk.column))
        for table, column, value in sql.parse_rows(query(prod, sql.parents_missing_sql(fk, values))):
            problems.append(f"local {table}.{column}={value} points at "
                            f"{fk.ref_table}.{fk.ref_column}, which does not exist on prod")
    return problems


def check_running(side: Side, services: Iterable[str]) -> None:
    names = [side.container(s) for s in services]
    out = run(side.docker_argv("inspect", "-f", "{{.Name}} {{.State.Running}}", *names), cwd=side.cwd)
    stopped = [line.split()[0].lstrip("/") for line in out.splitlines() if not line.endswith(" true")]
    if stopped:
        raise SyncError(f"{side.name} containers not running: {', '.join(stopped)}")


def wait_healthy(side: Side, service: str, timeout: int = 180) -> None:
    fmt = "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}"
    deadline = time.monotonic() + timeout
    while True:
        status = run(side.docker_argv("inspect", "-f", fmt, side.container(service)), cwd=side.cwd).strip()
        if status in ("healthy", "none"):
            return
        if time.monotonic() > deadline:
            raise SyncError(f"{side.name} {service} not healthy after {timeout}s (status: {status})")
        time.sleep(3)


def artisan(side: Side, *args: str) -> str:
    return run(side.docker_argv("exec", side.container("backend"), "php", "artisan", *args), cwd=side.cwd)


def mirror_files(src: Side, dst: Side) -> None:
    pipe(src.exec_argv("backend", PACK), dst.exec_argv("backend", UNPACK, stdin=True),
         src_cwd=src.cwd, dst_cwd=dst.cwd)


def files_summary(side: Side) -> str:
    out = run(side.exec_argv("backend", f"cd {STORAGE_APP} && du -sh public | cut -f1 && "
                                        "find public -type f | wc -l"), cwd=side.cwd)
    size, count = (out.split() + ["?", "?"])[:2]
    return f"{count} files, {size}"
```

- [ ] **Step 2: Smoke-test the read-only operations against the local stack**

Run (repo root, local stack up):

```bash
cd scripts && python -c "
from pathlib import Path
from prodsync.config import config_from_env
from prodsync.side import local_side
from prodsync import ops
from prodsync.tables import classify
s = local_side(config_from_env({'SYNC_SSH_HOST':'x'}, Path('..').resolve()))
ops.check_running(s, ['mysql','backend','web'])
t = ops.list_tables(s); c, p = classify(t)
print(len(t), 'tables', len(c), 'content', len(p), 'prod-only')
print(len(ops.migrations(s)), 'migrations', ops.schema_charset(s), ops.database_name(s))
print(list(ops.fingerprint(s, c).items())[:3])
print(ops.files_summary(s))
"
```

Expected: ~110 tables split roughly 85/26, a migration count, `('utf8mb4', '...')`, `bandms`, three `(table, checksum)` pairs with numeric checksums, and a files summary — no traceback.

- [ ] **Step 3: Smoke-test dump + verify locally (writes only a temp file)**

```bash
cd scripts && python -c "
import tempfile; from pathlib import Path
from prodsync.config import config_from_env
from prodsync.side import local_side
from prodsync import ops
s = local_side(config_from_env({'SYNC_SSH_HOST':'x'}, Path('..').resolve()))
with tempfile.TemporaryDirectory() as d:
    p = Path(d)/'l.sql.gz'; ops.dump_to(s, p, None); print('full', p.stat().st_size)
    ops.dump_to(s, p, ['posts','tags']); print('subset', p.stat().st_size)
"
```

Expected: two byte sizes, the subset smaller; no `truncated` error.

- [ ] **Step 4: Run the unit suite (unchanged, must stay green) and commit**

```bash
python -m unittest discover -s scripts/prodsync/tests -t scripts
git add scripts/prodsync/ops.py
git commit -m "feat(deploy): add database and upload operations for the sync script"
```

---

### Task 6: Flows, CLI and entry point

**Files:**
- Create: `scripts/prodsync/flows.py`, `scripts/prodsync/cli.py`, `scripts/sync_db.py`
- Test: `scripts/prodsync/tests/test_cli.py`

**Interfaces:**
- Consumes: everything above.
- Produces: `Reporter` (`step(title)` context manager, `info(msg)`), `confirm_yes(prompt, read=input) -> None`, `confirm_host(host, read=input) -> None` (both raise `SyncError` on refusal), `pull(cfg, opts, rep)`, `push(cfg, opts, rep)`; `build_parser() -> ArgumentParser`, `options_from_args(ns) -> Options`, `main(argv=None) -> int`.

Ordering decisions encoded below (deviation from the spec's step list, same guarantees):
- `pull` takes the prod fingerprint **before** the dump. A prod change between the two then makes the next push refuse (safe) instead of passing with data the local copy never saw.
- Files are mirrored **after** the backend is started again: the transfer runs `tar` inside the backend container, so it must be up.

- [ ] **Step 1: Write the failing test** — `scripts/prodsync/tests/test_cli.py`

```python
import contextlib
import io
import unittest

from prodsync.cli import build_parser, options_from_args
from prodsync.flows import confirm_host, confirm_yes
from prodsync.side import SyncError


def parse(*argv):
    with contextlib.redirect_stderr(io.StringIO()):
        return options_from_args(build_parser().parse_args(list(argv)))


class ParserTest(unittest.TestCase):
    def assertUsageError(self, *argv):
        with self.assertRaises(SystemExit) as ctx:
            parse(*argv)
        self.assertEqual(ctx.exception.code, 2)

    def test_needs_a_subcommand(self):
        self.assertUsageError()

    def test_push_needs_exactly_one_mode(self):
        self.assertUsageError("push")
        self.assertUsageError("push", "--content", "--full")

    def test_flags_belong_to_their_direction(self):
        self.assertUsageError("push", "--content", "--yes")
        self.assertUsageError("pull", "--force")
        self.assertUsageError("pull", "--content")

    def test_db_only_and_files_only_exclude_each_other(self):
        self.assertUsageError("pull", "--db-only", "--files-only")

    def test_pull_defaults(self):
        o = parse("pull")
        self.assertEqual((o.command, o.mode, o.db, o.files, o.yes, o.force, o.dry_run),
                         ("pull", None, True, True, False, False, False))

    def test_push_content_files_only(self):
        o = parse("push", "--content", "--files-only", "--dry-run")
        self.assertEqual((o.command, o.mode, o.db, o.files, o.dry_run),
                         ("push", "content", False, True, True))

    def test_push_full_db_only_force(self):
        o = parse("push", "--full", "--db-only", "--force")
        self.assertEqual((o.mode, o.db, o.files, o.force), ("full", True, False, True))


class ConfirmTest(unittest.TestCase):
    def test_host_must_match_exactly(self):
        confirm_host("203.0.113.5", read=lambda _: "203.0.113.5")
        for typed in ("", "y", "203.0.113.50", " 203.0.113.5x"):
            with self.assertRaises(SyncError):
                confirm_host("203.0.113.5", read=lambda _, t=typed: t)

    def test_host_tolerates_surrounding_whitespace(self):
        confirm_host("h", read=lambda _: "  h \n")

    def test_yes(self):
        confirm_yes("?", read=lambda _: "Y")
        with self.assertRaises(SyncError):
            confirm_yes("?", read=lambda _: "")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s scripts/prodsync/tests -t scripts -v`
Expected: ERROR — `No module named 'prodsync.cli'`.

- [ ] **Step 3: Write `scripts/prodsync/flows.py`**

```python
"""pull and push, composed from ops. Every write is preceded by every check."""
from __future__ import annotations

import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Callable

from . import ops
from .config import Config, Options
from .side import Side, SyncError, local_side, remote_side, run
from .state import guard_problem, load_state, migration_problem, parse_backup_name, save_state
from .tables import classify, new_tables


class Reporter:
    def __init__(self) -> None:
        self.n = 0

    @contextmanager
    def step(self, title: str):
        self.n += 1
        print(f"[{self.n}] {title}...", end=" ", flush=True)
        started = time.monotonic()
        try:
            yield
        except BaseException:
            print("FAILED", flush=True)
            raise
        print(f"ok ({time.monotonic() - started:.1f}s)", flush=True)

    def info(self, msg: str) -> None:
        print(f"    {msg}", flush=True)


def confirm_yes(prompt: str, read: Callable[[str], str] = input) -> None:
    if read(prompt).strip().lower() not in ("y", "yes"):
        raise SyncError("aborted - nothing was changed")


def confirm_host(host: str, read: Callable[[str], str] = input) -> None:
    if read(f"Type the server host ({host}) to continue: ").strip() != host:
        raise SyncError("host did not match - aborted, nothing was changed")


def _preflight(rep: Reporter, local: Side, prod: Side) -> None:
    with rep.step("check prod is reachable and its containers are running"):
        ops.check_running(prod, ["mysql", "backend", "web"])
    with rep.step("check local containers are running"):
        ops.check_running(local, ["mysql", "backend", "web"])


def _restart_backend_after(rep: Reporter, side: Side, action: Callable[[], None]) -> None:
    """Stop backend, run `action`, and always start backend again."""
    with rep.step(f"stop {side.name} backend"):
        run(side.compose_argv("stop", "backend"), cwd=side.cwd)
    try:
        action()
    finally:
        with rep.step(f"start {side.name} backend"):
            run(side.compose_argv("start", "backend"), cwd=side.cwd)
            ops.wait_healthy(side, "backend")


def _publish(rep: Reporter, side: Side) -> None:
    with rep.step(f"clear {side.name} cache"):
        ops.artisan(side, "cache:clear")
    with rep.step(f"restart {side.name} web (rebuilds the public site)"):
        run(side.compose_argv("restart", "web"), cwd=side.cwd)


def pull(cfg: Config, opts: Options, rep: Reporter) -> None:
    local, prod = local_side(cfg), remote_side(cfg)
    _preflight(rep, local, prod)

    content: list[str] = []
    if opts.db:
        with rep.step("read prod tables"):
            tables = ops.list_tables(prod)
            content, prod_only = classify(tables)
        rep.info(f"{len(tables)} tables: {len(content)} content, {len(prod_only)} prod-only")
    if opts.files:
        with rep.step("measure prod uploads"):
            summary = ops.files_summary(prod)
        rep.info(f"prod storage/app/public: {summary}")
    if opts.dry_run:
        rep.info("dry run - nothing written")
        return

    if not opts.yes:
        confirm_yes("Replace the LOCAL database and uploads with production? [y/N] ")

    with tempfile.TemporaryDirectory(prefix="bandms-sync-") as tmp:
        if opts.db:
            # Fingerprint BEFORE the dump: a prod change in between then makes
            # the next push refuse, rather than pass on data we never pulled.
            with rep.step("fingerprint prod content"):
                fp = ops.fingerprint(prod, content)
                charset = ops.schema_charset(prod)
            dump = Path(tmp) / "prod.sql.gz"
            with rep.step("dump prod database"):
                ops.dump_to(prod, dump, None)
            rep.info(f"dump: {dump.stat().st_size / 1e6:.1f} MB")

            def load() -> None:
                with rep.step("replace local database"):
                    ops.import_dump(local, dump, recreate=charset)
            _restart_backend_after(rep, local, load)
        if opts.files:
            with rep.step("mirror uploads prod -> local"):
                ops.mirror_files(prod, local)

    _publish(rep, local)
    if opts.db:
        save_state(cfg.state_path, cfg.ssh_host, fp)
        rep.info(f"recorded prod fingerprint in {cfg.state_path.name}")
    print("\npull complete - local now matches production.")


def push(cfg: Config, opts: Options, rep: Reporter) -> None:
    local, prod = local_side(cfg), remote_side(cfg)
    _preflight(rep, local, prod)

    content: list[str] = []
    if opts.db:
        with rep.step("read local tables"):
            content, prod_only = classify(ops.list_tables(local))
        with rep.step("check prod has not changed since the last pull"):
            saved = load_state(cfg.state_path, cfg.ssh_host)
            problem = guard_problem(saved, ops.fingerprint(prod, content), cfg.ssh_host)
        if problem and not opts.force:
            raise SyncError(problem + "\n    run pull first (or pass --force to overwrite anyway)")
        if problem:
            rep.info(f"WARNING (--force): {problem}")
        for name in (new_tables(content, saved) if saved else []):
            rep.info(f"new table -> treated as content: {name}")
        with rep.step("compare migrations"):
            problem = migration_problem(ops.migrations(local), ops.migrations(prod))
        if problem:
            raise SyncError(problem)
        if opts.mode == "content":
            with rep.step("check prod-only rows keep their parents"):
                orphans = ops.orphan_problems(local, prod, prod_only)
            if orphans:
                raise SyncError("this push would leave prod rows dangling:\n"
                                + "\n".join(f"    {o}" for o in orphans))
    if opts.files:
        with rep.step("measure local uploads"):
            summary = ops.files_summary(local)
        rep.info(f"local storage/app/public: {summary}")
    if opts.dry_run:
        rep.info("dry run - all checks passed, nothing written")
        return

    print()
    if opts.mode == "full" and opts.db:
        print("WARNING: --full replaces EVERY prod table with your local copy:")
        print("  - every prod user is logged out (oauth tables are replaced)")
        print("  - orders, tickets, subscribers and fan accounts created on prod")
        print("    since your last pull are lost")
    else:
        print(f"This replaces prod {'content tables' if opts.db else ''}"
              f"{' and ' if opts.db and opts.files else ''}{'uploads' if opts.files else ''}"
              " with your local copy.")
    confirm_host(cfg.ssh_host)

    with tempfile.TemporaryDirectory(prefix="bandms-sync-") as tmp:
        if opts.db:
            dump = Path(tmp) / "local.sql.gz"
            with rep.step("dump local database"):
                ops.dump_to(local, dump, None if opts.mode == "full" else content)
                charset = ops.schema_charset(local) if opts.mode == "full" else None
            rep.info(f"dump: {dump.stat().st_size / 1e6:.1f} MB")
            with rep.step("back up prod database"):
                out = run(prod.shell_argv(f"cd {cfg.remote_dir} && ./scripts/prod-backup-db.sh"))
            backup = parse_backup_name(out)
            rep.info(f"prod backup: {cfg.remote_dir}/backups/{backup}" if backup
                     else "prod backup: none needed (empty database)")

            def load() -> None:
                try:
                    with rep.step("load into prod database"):
                        ops.import_dump(prod, dump, recreate=charset)
                except SyncError:
                    if backup:
                        rep.info(f"restore from {cfg.remote_dir}/backups/{backup} - "
                                 "see docs/database-backup-and-recovery.md")
                    raise
            _restart_backend_after(rep, prod, load)
        if opts.files:
            with rep.step("mirror uploads local -> prod"):
                ops.mirror_files(local, prod)

    _publish(rep, prod)
    if opts.db:
        with rep.step("record new prod fingerprint"):
            save_state(cfg.state_path, cfg.ssh_host, ops.fingerprint(prod, content))
    print("\npush complete.")
```

- [ ] **Step 4: Write `scripts/prodsync/cli.py`**

```python
"""Command line: `sync_db.py pull` / `sync_db.py push --content|--full`."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .config import ConfigError, Options, load_config
from .flows import Reporter, pull, push
from .side import SyncError

REPO_ROOT = Path(__file__).resolve().parents[2]


def _common(sp: argparse.ArgumentParser) -> None:
    sp.add_argument("--dry-run", action="store_true",
                    help="run every check and print the plan; write nothing on either side")
    only = sp.add_mutually_exclusive_group()
    only.add_argument("--db-only", action="store_true", help="database only, no uploads")
    only.add_argument("--files-only", action="store_true", help="uploads only, no database")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sync_db.py",
        description="Copy the database and uploads between production and the local stack. "
                    "See docs/prod-sync.md.")
    sub = parser.add_subparsers(dest="command", required=True, metavar="{pull,push}")

    p = sub.add_parser("pull", help="production -> local, full 1:1 copy")
    _common(p)
    p.add_argument("--yes", action="store_true", help="skip the confirmation prompt")

    q = sub.add_parser("push", help="local -> production")
    _common(q)
    mode = q.add_mutually_exclusive_group(required=True)
    mode.add_argument("--content", dest="mode", action="store_const", const="content",
                      help="replace band-content tables only; keep users, orders, tickets...")
    mode.add_argument("--full", dest="mode", action="store_const", const="full",
                      help="replace everything (recovery / initial seeding)")
    q.add_argument("--force", action="store_true",
                   help="push even if prod content changed since the last pull")
    return parser


def options_from_args(ns: argparse.Namespace) -> Options:
    return Options(
        command=ns.command,
        mode=getattr(ns, "mode", None),
        dry_run=ns.dry_run,
        db=not ns.files_only,
        files=not ns.db_only,
        yes=getattr(ns, "yes", False),
        force=getattr(ns, "force", False),
    )


def main(argv: list[str] | None = None) -> int:
    opts = options_from_args(build_parser().parse_args(argv))
    try:
        cfg = load_config(REPO_ROOT)
        (pull if opts.command == "pull" else push)(cfg, opts, Reporter())
    except (SyncError, ConfigError, ValueError) as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130
    return 0
```

- [ ] **Step 5: Write `scripts/sync_db.py`**

```python
#!/usr/bin/env python3
"""Sync the database and uploads between production and the local stack.

    python scripts/sync_db.py pull
    python scripts/sync_db.py push --content
    python scripts/sync_db.py push --full

See docs/prod-sync.md.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prodsync.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Run the unit suite**

Run: `python -m unittest discover -s scripts/prodsync/tests -t scripts -v`
Expected: all OK (now including `test_cli`).

- [ ] **Step 7: Exercise the CLI without touching prod**

```bash
python scripts/sync_db.py; echo "exit=$?"                 # usage, exit=2
python scripts/sync_db.py push; echo "exit=$?"            # "one of the arguments --content --full is required", exit=2
python scripts/sync_db.py push --help                     # lists --content/--full/--force, no --yes
```

- [ ] **Step 8: Commit**

```bash
git add scripts/sync_db.py scripts/prodsync
git commit -m "feat(deploy): add pull and push flows to the sync script"
```

---

### Task 7: Real pull against production, docs

**Files:**
- Create: `docs/prod-sync.md`
- Modify: `CLAUDE.md` (Development commands section — one short block)
- Modify: `.env` (local only, not committed): add `SYNC_SSH_HOST=<server>` — ask the user for the address if it is not discoverable (`gh secret` values are not readable).

- [ ] **Step 1: Configure and dry-run**

```bash
python scripts/sync_db.py pull --dry-run
```

Expected: steps 1-4 `ok`, a table split line and a prod uploads summary, then `dry run - nothing written`.

- [ ] **Step 2: Record local baseline, then pull for real**

```bash
docker exec bandms_mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM concerts; SELECT COUNT(*) FROM posts;"'
python scripts/sync_db.py pull --yes
```

Expected: every step `ok`, `.sync-state.json` written.

- [ ] **Step 3: Verify local == prod**

Compare row counts of a few tables (`concerts`, `posts`, `photos`, `users`, `website_modules`) on both sides with the same `mysql -e` command (prod via `ssh … docker exec bandms-mysql …`), and `files_summary` on both sides. Then `python scripts/sync_db.py push --content --dry-run` — expected: all checks pass (guard unchanged, migrations equal, no orphans) and `nothing written`. This proves the guard does not false-positive right after a pull.

- [ ] **Step 4: Write `docs/prod-sync.md`**

Content: the three commands; what each mode replaces and keeps (the `PROD_ONLY_TABLES` list by name); the pull-first guard and why a shop sale trips it (`stock_quantity`); the order of checks before a push; where the prod backup lands and how to restore it (link `docs/database-backup-and-recovery.md`); `.env` keys; that local admin passwords become prod's after a pull; that E2E specs then run against prod-shaped data.

- [ ] **Step 5: Add to `CLAUDE.md` under *Development commands***

```markdown
### Syncing with production — `scripts/sync_db.py`

```bash
python scripts/sync_db.py pull               # prod -> local, 1:1 (DB + storage/app/public)
python scripts/sync_db.py push --content     # local content -> prod, keeps users/orders/tickets
python scripts/sync_db.py push --full        # local -> prod, everything (recovery)
```

A push refuses when prod's content changed since your last pull (a shop sale
counts — it decrements `stock_quantity`). Pull first. Details: `docs/prod-sync.md`.
```

- [ ] **Step 6: Commit**

```bash
git add docs/prod-sync.md CLAUDE.md
git commit -m "docs: document the prod sync script"
```

- [ ] **Step 7: Hand over the first push to the user** — the agent does not run `push` without `--dry-run`.
