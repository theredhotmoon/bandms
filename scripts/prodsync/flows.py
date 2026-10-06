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
