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
