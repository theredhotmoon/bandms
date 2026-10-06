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
