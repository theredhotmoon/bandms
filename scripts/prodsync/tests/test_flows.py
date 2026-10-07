"""push() ordering and safety, with ops and subprocess calls mocked out."""
import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from prodsync import flows
from prodsync.config import Options, config_from_env
from prodsync.side import SyncError

FP = {"posts": "1"}
FP_CHANGED = {"posts": "2"}
FP_AFTER = {"posts": "3"}


def options(**kw):
    base = dict(command="push", mode="content", dry_run=False, db=True, files=False,
                yes=False, force=False)
    base.update(kw)
    return Options(**base)


class PushTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cfg = config_from_env({"SYNC_SSH_HOST": "h"}, Path(self.tmp.name))
        self.parent = mock.MagicMock()
        self.ops = mock.MagicMock()
        self.run = mock.MagicMock(side_effect=self._run)
        self.parent.attach_mock(self.ops, "ops")
        self.parent.attach_mock(self.run, "run")
        self.ops.list_tables.return_value = ["posts", "users"]
        self.ops.migrations.return_value = ["m1"]
        self.ops.orphan_problems.return_value = []
        self.ops.files_summary.return_value = "1 files, 4K"
        self.ops.database_name.return_value = "bandms"
        self.ops.dump_to.side_effect = lambda side, path, tables: path.write_bytes(b"x")
        self.backup_output = "[backup] verified: bandms-1.sql.gz (1M)\n"
        self.ops.backup_uploads.return_value = "uploads-1.tar.gz"
        self.saved = mock.MagicMock()
        patches = [
            mock.patch.object(flows, "ops", self.ops),
            mock.patch.object(flows, "run", self.run),
            mock.patch.object(flows, "load_state", return_value=dict(FP)),
            mock.patch.object(flows, "save_state", self.saved),
            mock.patch.object(flows, "confirm_host"),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        self.addCleanup(self.tmp.cleanup)

    def _run(self, argv, **kw):
        if "prod-backup-db.sh" in argv[-1]:
            return self.backup_output
        return ""

    def upload_backup_index(self):
        hits = [i for i, c in enumerate(self.parent.mock_calls) if c[0] == "ops.backup_uploads"]
        return hits[0] if hits else None

    def push(self, opts):
        with contextlib.redirect_stdout(io.StringIO()):
            flows.push(self.cfg, opts, flows.Reporter())

    def compose_calls(self, verb):
        """Indexes in parent.mock_calls of compose `verb backend` runs on prod."""
        found = []
        for i, call in enumerate(self.parent.mock_calls):
            if call[0] == "run" and f"{verb} backend" in call[1][0][-1]:
                found.append(i)
        return found

    def index_of(self, name, nth=0):
        hits = [i for i, c in enumerate(self.parent.mock_calls) if c[0] == name]
        return hits[nth]

    def test_guard_is_rechecked_with_backend_stopped(self):
        # unchanged at the first check, changed by the time backend is stopped
        self.ops.fingerprint.side_effect = [dict(FP), dict(FP_CHANGED)]
        with self.assertRaises(SyncError):
            self.push(options())
        self.ops.import_dump.assert_not_called()
        # nothing was written, so backend is started again
        self.assertEqual(len(self.compose_calls("start")), 1)

    def test_new_fingerprint_is_taken_before_backend_restarts(self):
        self.ops.fingerprint.side_effect = [dict(FP), dict(FP), dict(FP_AFTER)]
        self.push(options())
        after_import = self.index_of("ops.fingerprint", 2)
        self.assertGreater(after_import, self.index_of("ops.import_dump"))
        self.assertLess(after_import, self.compose_calls("start")[0])
        self.assertEqual(self.saved.call_args[0][2], FP_AFTER)

    def test_missing_backup_aborts_before_anything_is_written(self):
        self.ops.fingerprint.side_effect = [dict(FP)]
        self.backup_output = "[backup] database 'bandms' has no tables yet - nothing to back up\n"
        with self.assertRaises(SyncError):
            self.push(options(mode="full"))
        self.ops.import_dump.assert_not_called()
        self.assertEqual(self.compose_calls("stop"), [])

    def test_backup_targets_the_containers_database(self):
        self.ops.database_name.return_value = "band db"
        self.ops.fingerprint.side_effect = [dict(FP), dict(FP), dict(FP_AFTER)]
        self.push(options())
        commands = [c.args[0][-1] for c in self.run.call_args_list]
        backup = [cmd for cmd in commands if "prod-backup-db.sh" in cmd][0]
        self.assertIn("DB_DATABASE='band db'", backup)

    def test_import_failure_leaves_backend_stopped(self):
        self.ops.fingerprint.side_effect = [dict(FP), dict(FP)]
        self.ops.import_dump.side_effect = SyncError("import died")
        with self.assertRaises(SyncError):
            self.push(options(mode="full"))
        self.assertEqual(len(self.compose_calls("stop")), 1)
        self.assertEqual(self.compose_calls("start"), [])

    def test_files_only_push_still_runs_the_guard(self):
        self.ops.fingerprint.side_effect = [dict(FP_CHANGED)]
        with self.assertRaises(SyncError):
            self.push(options(db=False, files=True))
        self.ops.mirror_files.assert_not_called()

    def test_state_is_saved_once_the_database_is_loaded_even_if_a_later_step_fails(self):
        # otherwise the next push mistakes this push's own write for a prod change
        self.ops.fingerprint.side_effect = [dict(FP), dict(FP), dict(FP_AFTER)]
        self.ops.mirror_files.side_effect = SyncError("ssh dropped")
        with self.assertRaises(SyncError):
            self.push(options(files=True))
        self.assertEqual(self.saved.call_args[0][2], FP_AFTER)

    def test_migration_mismatch_is_reported_before_the_guard(self):
        # a not-yet-deployed local table must not read as "prod changed - pull first"
        self.ops.migrations.side_effect = [["m1", "m2"], ["m1"]]
        self.ops.fingerprint.side_effect = [{"posts": "1", "new_table": None}]
        with self.assertRaises(SyncError) as ctx:
            self.push(options())
        self.assertIn("different migrations", str(ctx.exception))

    def test_sync_backups_go_to_their_own_folder_under_the_remote_dir(self):
        # Own folder, own rotation: the deploy backups' rotation only counts
        # files directly in backups/, so pushes can never age those out.
        self.cfg = config_from_env({"SYNC_SSH_HOST": "h", "SYNC_REMOTE_DIR": "/srv/band"},
                                   Path(self.tmp.name))
        self.ops.fingerprint.side_effect = [dict(FP), dict(FP)]
        self.ops.import_dump.side_effect = SyncError("import died")
        out = io.StringIO()
        with self.assertRaises(SyncError), contextlib.redirect_stdout(out):
            flows.push(self.cfg, options(), flows.Reporter())
        commands = [c.args[0][-1] for c in self.run.call_args_list]
        backup = [cmd for cmd in commands if "prod-backup-db.sh" in cmd][0]
        self.assertIn("BACKUP_DIR=/srv/band/backups/sync", backup)
        self.assertIn("KEEP=5", backup)
        self.assertIn("restore /srv/band/backups/sync/bandms-1.sql.gz", out.getvalue())

    def test_push_refuses_while_a_failed_push_left_prod_backend_stopped(self):
        # Only 5 sync backups are kept: retrying (even with --force) against a
        # half-loaded database would back it up and rotate out the good copy.
        def stopped(side, services):
            if side.name == "prod":
                raise SyncError("prod containers not running: bandms-backend")
        self.ops.check_running.side_effect = stopped
        with self.assertRaises(SyncError) as ctx:
            self.push(options(force=True))
        self.assertIn("backups/sync", str(ctx.exception))
        self.ops.dump_to.assert_not_called()
        self.assertFalse(any("prod-backup-db.sh" in c.args[0][-1] for c in self.run.call_args_list))

    def test_uploads_are_backed_up_before_anything_on_prod_changes(self):
        self.ops.fingerprint.side_effect = [dict(FP), dict(FP), dict(FP_AFTER)]
        self.push(options(files=True))
        backup = self.upload_backup_index()
        self.assertIsNotNone(backup)
        self.assertLess(backup, self.compose_calls("stop")[0])
        self.assertLess(backup, self.index_of("ops.mirror_files"))
        side, backup_dir, keep, _stamp = self.parent.mock_calls[backup][1]
        self.assertEqual((side.name, backup_dir, keep), ("prod", "/opt/bandms/backups/sync", 5))

    def test_files_only_push_backs_up_uploads_too(self):
        self.ops.fingerprint.side_effect = [dict(FP), dict(FP)]
        self.push(options(db=False, files=True))
        self.assertLess(self.upload_backup_index(), self.index_of("ops.mirror_files"))

    def test_failed_upload_backup_aborts_before_anything_is_written(self):
        self.ops.fingerprint.side_effect = [dict(FP)]
        self.ops.backup_uploads.return_value = None
        with self.assertRaises(SyncError):
            self.push(options(files=True))
        self.ops.mirror_files.assert_not_called()
        self.ops.import_dump.assert_not_called()
        self.assertEqual(self.compose_calls("stop"), [])

    def test_db_only_push_does_not_archive_uploads(self):
        self.ops.fingerprint.side_effect = [dict(FP), dict(FP), dict(FP_AFTER)]
        self.push(options())
        self.assertIsNone(self.upload_backup_index())

    def test_files_only_push_keeps_the_saved_state(self):
        self.ops.fingerprint.side_effect = [dict(FP), dict(FP)]
        self.push(options(db=False, files=True))
        self.ops.mirror_files.assert_called_once()
        self.saved.assert_not_called()


if __name__ == "__main__":
    unittest.main()
