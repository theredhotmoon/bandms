import shlex
import sys
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
        with self.assertRaises(CommandFailed) as ctx:
            run([sys.executable, "-c", "import sys; sys.stderr.write('boom'); sys.exit(3)"])
        self.assertIn("boom", str(ctx.exception))
        self.assertIn("exit 3", str(ctx.exception))

    def test_success_returns_stdout(self):
        self.assertEqual(run([sys.executable, "-c", "print('ok')"]).strip(), "ok")


if __name__ == "__main__":
    unittest.main()
