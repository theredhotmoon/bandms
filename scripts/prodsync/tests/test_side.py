import shlex
import sys
import unittest
from pathlib import Path

from prodsync.config import config_from_env
from prodsync.side import CommandFailed, local_side, pipe, remote_side, run
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
        with self.assertRaises(CommandFailed) as ctx:
            run([sys.executable, "-c", "import sys; sys.stderr.write('boom'); sys.exit(3)"])
        self.assertIn("boom", str(ctx.exception))
        self.assertIn("exit 3", str(ctx.exception))

    def test_pipe_reports_the_receiving_side_when_it_fails(self):
        # the sender then dies of a broken pipe; that is a symptom, not the cause
        src = [sys.executable, "-c",
               "import sys\nfor _ in range(4000): sys.stdout.write('x' * 1024)"]
        dst = [sys.executable, "-c",
               "import sys; sys.stderr.write('No space left on device'); sys.exit(5)"]
        with self.assertRaises(CommandFailed) as ctx:
            pipe(src, dst)
        self.assertIn("No space left on device", str(ctx.exception))

    def test_child_commands_do_not_consume_the_scripts_stdin(self):
        # ssh reads stdin even when the remote command does not, which ate the
        # host the user typed (or piped) for the push confirmation.
        import subprocess
        scripts = Path(__file__).resolve().parents[2]
        probe = ("import sys\n"
                 "from prodsync.side import run\n"
                 "run([sys.executable, '-c', 'import sys; sys.stdin.read()'])\n"
                 "print(sys.stdin.read())")
        out = subprocess.run([sys.executable, "-c", probe], input=b"203.0.113.5",
                             cwd=scripts, capture_output=True, check=True).stdout
        self.assertEqual(out.decode().strip(), "203.0.113.5")

    def test_success_returns_stdout(self):
        self.assertEqual(run([sys.executable, "-c", "print('ok')"]).strip(), "ok")


if __name__ == "__main__":
    unittest.main()
