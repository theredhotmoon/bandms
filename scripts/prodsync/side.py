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
