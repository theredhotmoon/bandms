import shlex
import unittest

from prodsync.ops import upload_backup_script


class UploadBackupScriptTest(unittest.TestCase):
    script = upload_backup_script("bandms-backend", "/opt/band ms/backups/sync", 5, "20261007-101500")

    def test_streams_only_storage_app_public_out_of_the_backend_container(self):
        self.assertIn("docker exec bandms-backend tar -C /var/www/html/storage/app -czf - public",
                      self.script)

    def test_writes_partial_then_verifies_before_keeping(self):
        partial = self.script.index(".partial")
        verify = self.script.index("tar -tzf")
        keep = self.script.index("mv ")
        self.assertLess(partial, verify)
        self.assertLess(verify, keep)
        self.assertIn("set -e", self.script)

    def test_names_the_archive_by_stamp_and_reports_it(self):
        self.assertIn("uploads-20261007-101500.tar.gz", self.script)
        self.assertIn("verified: ", self.script)

    def test_keeps_only_the_newest_n_archives(self):
        self.assertIn("tail -n +6", self.script)
        self.assertIn("uploads-*.tar.gz", self.script)

    def test_quotes_the_directory(self):
        self.assertIn(shlex.quote("/opt/band ms/backups/sync"), self.script)

    def test_refuses_to_archive_without_room_to_spare(self):
        # the archive shares the disk with MySQL and deploys; leave a margin
        script = upload_backup_script("c", "/d", 5, "s", min_free_kb=12345)
        check = script.index("df -Pk")
        self.assertLess(check, script.index("docker exec c tar"))
        self.assertIn("du -sk", script)
        self.assertIn("+ 12345", script)
        self.assertIn("exit 1", script)

    def test_default_margin_is_two_gigabytes(self):
        self.assertIn(f"+ {2 * 1024 * 1024}", self.script)


class RestoreScriptTest(unittest.TestCase):
    def test_restore_swaps_in_the_archive_instead_of_deleting_first(self):
        from prodsync.ops import UNPACK
        # extract beside the live folder; only a complete extract replaces it
        self.assertLess(UNPACK.index("tar -xzf - -C .sync-incoming"), UNPACK.index("mv public .sync-old"))
        self.assertNotIn("rm -rf public", UNPACK)


if __name__ == "__main__":
    unittest.main()
