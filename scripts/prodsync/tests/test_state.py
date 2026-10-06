import json
import tempfile
import unittest
from pathlib import Path

from prodsync.state import (
    diff_fingerprints, guard_problem, load_state, migration_problem,
    parse_backup_name, save_state,
)


class DiffTest(unittest.TestCase):
    def test_changed_added_removed(self):
        saved = {"a": "1", "b": "2", "c": "3"}
        current = {"a": "1", "b": "9", "d": "4"}
        self.assertEqual(diff_fingerprints(saved, current), ["b", "c", "d"])

    def test_identical(self):
        self.assertEqual(diff_fingerprints({"a": None}, {"a": None}), [])


class StateFileTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = Path(self.dir.name) / ".sync-state.json"

    def tearDown(self):
        self.dir.cleanup()

    def test_roundtrip(self):
        save_state(self.path, "prod.example", {"posts": "12"})
        self.assertEqual(load_state(self.path, "prod.example"), {"posts": "12"})

    def test_other_host_counts_as_missing(self):
        save_state(self.path, "prod.example", {"posts": "12"})
        self.assertIsNone(load_state(self.path, "staging.example"))

    def test_missing_or_corrupt_counts_as_missing(self):
        self.assertIsNone(load_state(self.path, "h"))
        self.path.write_text("{not json", encoding="utf-8")
        self.assertIsNone(load_state(self.path, "h"))
        self.path.write_text(json.dumps({"host": "h", "fingerprint": []}), encoding="utf-8")
        self.assertIsNone(load_state(self.path, "h"))


class GuardTest(unittest.TestCase):
    def test_no_state(self):
        self.assertIn("run pull first", guard_problem(None, {"a": "1"}, "h"))

    def test_changed_tables_are_named(self):
        msg = guard_problem({"shop_items": "1", "posts": "2"},
                            {"shop_items": "5", "posts": "2"}, "h")
        self.assertIn("shop_items", msg)
        self.assertNotIn("posts", msg)

    def test_unchanged(self):
        self.assertIsNone(guard_problem({"a": "1"}, {"a": "1"}, "h"))


class MigrationTest(unittest.TestCase):
    def test_equal_sets(self):
        self.assertIsNone(migration_problem(["m1", "m2"], ["m2", "m1"]))

    def test_reports_both_directions(self):
        msg = migration_problem(["m1", "m3"], ["m1", "m2"])
        self.assertIn("m3", msg)
        self.assertIn("m2", msg)


class BackupNameTest(unittest.TestCase):
    def test_parses_verified_line(self):
        out = "[backup] dumping\n[backup] verified: bandms-20261006-101500.sql.gz (1.2M)\n"
        self.assertEqual(parse_backup_name(out), "bandms-20261006-101500.sql.gz")

    def test_nothing_backed_up(self):
        self.assertIsNone(parse_backup_name("[backup] database 'bandms' has no tables yet\n"))


if __name__ == "__main__":
    unittest.main()
