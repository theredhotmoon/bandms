"""Database and upload operations against one Side (local or prod)."""
from __future__ import annotations

import gzip
import re
import shlex
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


def upload_backup_script(container: str, backup_dir: str, keep: int, stamp: str) -> str:
    """Host-side script: archive `container`'s storage/app/public into backup_dir.

    Written to .partial and listed with `tar -tzf` before it is kept, so a
    dropped stream cannot leave a plausible-looking archive. Rotation keeps the
    newest `keep` uploads-*.tar.gz; prod-backup-db.sh's own rotation only
    counts <db>-*.sql.gz, so the two never touch each other's files.
    """
    d = shlex.quote(backup_dir)
    name = f"uploads-{stamp}.tar.gz"
    return (
        f"set -e; mkdir -p {d}; f={d}/{name}; trap 'rm -f \"$f.partial\"' EXIT; "
        f"docker exec {shlex.quote(container)} {PACK} > \"$f.partial\"; "
        "tar -tzf \"$f.partial\" > /dev/null; "
        "mv \"$f.partial\" \"$f\"; "
        f"ls -1t {d}/uploads-*.tar.gz | tail -n +{keep + 1} | xargs -r rm -f --; "
        f"echo \"verified: {name}\""
    )


def backup_uploads(side: Side, backup_dir: str, keep: int, stamp: str) -> str | None:
    """Archive the side's uploads on its host; the archive's name, or None if unverified."""
    script = upload_backup_script(side.container("backend"), backup_dir, keep, stamp)
    out = run(side.shell_argv(f"sh -c {shlex.quote(script)}"))
    match = re.search(r"verified: (\S+)", out)
    return match.group(1) if match else None


def mirror_files(src: Side, dst: Side) -> None:
    pipe(src.exec_argv("backend", PACK), dst.exec_argv("backend", UNPACK, stdin=True),
         src_cwd=src.cwd, dst_cwd=dst.cwd)


def files_summary(side: Side) -> str:
    out = run(side.exec_argv("backend", f"cd {STORAGE_APP} && du -sh public | cut -f1 && "
                                        "find public -type f | wc -l"), cwd=side.cwd)
    size, count = (out.split() + ["?", "?"])[:2]
    return f"{count} files, {size}"
