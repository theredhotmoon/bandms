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
