"""pull and push, composed from ops. Every write is preceded by every check."""
from __future__ import annotations

import shlex
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

_REFUSE_HINT = "\n    run pull first (or pass --force to overwrite anyway)"


class _NothingWritten(SyncError):
    """Raised while backend is stopped but before anything was written."""


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


def _ask(read: Callable[[str], str], prompt: str) -> str:
    try:
        return read(prompt)
    except EOFError:
        raise SyncError("no answer on stdin - aborted, nothing was changed") from None


def confirm_yes(prompt: str, read: Callable[[str], str] = input) -> None:
    if _ask(read, prompt).strip().lower() not in ("y", "yes"):
        raise SyncError("aborted - nothing was changed")


def confirm_host(host: str, read: Callable[[str], str] = input) -> None:
    if _ask(read, f"Type the server host ({host}) to continue: ").strip() != host:
        raise SyncError("host did not match - aborted, nothing was changed")


def _preflight(rep: Reporter, local: Side, prod: Side) -> None:
    with rep.step("check prod is reachable and its containers are running"):
        ops.check_running(prod, ["mysql", "backend", "web"])
    with rep.step("check local containers are running"):
        ops.check_running(local, ["mysql", "backend", "web"])


def _start_backend(rep: Reporter, side: Side) -> None:
    with rep.step(f"start {side.name} backend"):
        run(side.compose_argv("start", "backend"), cwd=side.cwd)
        ops.wait_healthy(side, "backend")


def _with_backend_stopped(rep: Reporter, side: Side, action: Callable[[], None], if_failed: str) -> None:
    """Stop backend, run `action`, start backend again.

    If `action` fails part-way, backend is left STOPPED: its entrypoint runs
    `migrate` and, on an empty band_profiles, `db:seed` - starting it on a
    half-loaded database would turn it into a freshly seeded default site.
    """
    with rep.step(f"stop {side.name} backend"):
        run(side.compose_argv("stop", "backend"), cwd=side.cwd)
    try:
        action()
    except _NothingWritten:
        _start_backend(rep, side)
        raise
    except BaseException:
        rep.info(f"{side.name} backend left STOPPED on purpose - {if_failed}")
        raise
    _start_backend(rep, side)


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
            rep.info(f"dump: {dump.stat().st_size / 1e3:.0f} KB")

            def load() -> None:
                with rep.step("replace local database"):
                    ops.import_dump(local, dump, recreate=charset)
            _with_backend_stopped(rep, local, load,
                                  "re-run pull, or `docker compose start backend` once the database is sound")
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

    with rep.step("read local tables"):
        content, prod_only = classify(ops.list_tables(local))
    saved = load_state(cfg.state_path, cfg.ssh_host)

    # Before the guard: a table from a not-yet-deployed migration has no
    # checksum on prod, and would otherwise read as "prod changed - pull
    # first", advice that wipes the local migration.
    with rep.step("compare migrations"):
        problem = migration_problem(ops.migrations(local), ops.migrations(prod))
    if problem:
        raise SyncError(problem)

    def guard() -> str | None:
        return guard_problem(saved, ops.fingerprint(prod, content), cfg.ssh_host)

    # Uploads are guarded too: a files-only push would otherwise delete images
    # added in the prod admin, and those images' rows are content.
    with rep.step("check prod has not changed since the last pull"):
        problem = guard()
    if problem and not opts.force:
        raise SyncError(problem + _REFUSE_HINT)
    if problem:
        rep.info(f"WARNING (--force): {problem}")
    for name in (new_tables(content, saved) if saved else []):
        rep.info(f"new table -> treated as content: {name}")
    if opts.db:
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

    def recheck() -> None:
        # The first check ran before the prompt, the dump and the backup; a
        # sale in that window would otherwise be overwritten silently.
        if opts.force:
            return
        with rep.step("re-check prod has not changed"):
            problem = guard()
        if problem:
            raise _NothingWritten(problem + _REFUSE_HINT)

    new_fp: dict | None = None
    with tempfile.TemporaryDirectory(prefix="bandms-sync-") as tmp:
        if opts.db:
            dump = Path(tmp) / "local.sql.gz"
            with rep.step("dump local database"):
                ops.dump_to(local, dump, None if opts.mode == "full" else content)
                charset = ops.schema_charset(local) if opts.mode == "full" else None
            rep.info(f"dump: {dump.stat().st_size / 1e3:.0f} KB")
            backup_dir = f"{cfg.remote_dir}/backups"
            with rep.step("back up prod database"):
                # Name the database and directory explicitly: the script
                # otherwise reads DB_DATABASE from the deploy user's shell and
                # writes to a fixed /opt/bandms/backups, neither of which need
                # match this push - and the restore hint below must be right.
                out = run(prod.shell_argv(
                    f"cd {shlex.quote(cfg.remote_dir)} && "
                    f"DB_DATABASE={shlex.quote(ops.database_name(prod))} "
                    f"BACKUP_DIR={shlex.quote(backup_dir)} ./scripts/prod-backup-db.sh"))
            backup = parse_backup_name(out)
            if not backup:
                raise SyncError("prod-backup-db.sh finished without a verified backup - "
                                "refusing to write to prod. Its output:\n"
                                + "\n".join(f"    {l}" for l in out.strip().splitlines()))
            backup_path = f"{backup_dir}/{backup}"
            rep.info(f"prod backup: {backup_path}")

            def load() -> None:
                nonlocal new_fp
                recheck()
                with rep.step("load into prod database"):
                    ops.import_dump(prod, dump, recreate=charset)
                # Taken while backend is still stopped, so no sale can slip
                # into the state as "already pulled".
                with rep.step("fingerprint new prod content"):
                    new_fp = ops.fingerprint(prod, content)
            _with_backend_stopped(rep, prod, load,
                                  f"restore {backup_path} (docs/database-backup-and-recovery.md), then start it")
            # Saved now, not at the end: if the upload copy or the rebuild
            # fails, the next push must not mistake this write for a prod change.
            save_state(cfg.state_path, cfg.ssh_host, new_fp)
            rep.info(f"recorded new prod fingerprint in {cfg.state_path.name}")
        else:
            recheck()
        if opts.files:
            with rep.step("mirror uploads local -> prod"):
                ops.mirror_files(local, prod)

    _publish(rep, prod)
    print("\npush complete.")
