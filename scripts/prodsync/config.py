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
