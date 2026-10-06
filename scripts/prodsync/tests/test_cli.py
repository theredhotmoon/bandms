import contextlib
import io
import unittest

from prodsync.cli import build_parser, options_from_args
from prodsync.flows import confirm_host, confirm_yes
from prodsync.side import SyncError


def parse(*argv):
    with contextlib.redirect_stderr(io.StringIO()):
        return options_from_args(build_parser().parse_args(list(argv)))


class ParserTest(unittest.TestCase):
    def assertUsageError(self, *argv):
        with self.assertRaises(SystemExit) as ctx:
            parse(*argv)
        self.assertEqual(ctx.exception.code, 2)

    def test_needs_a_subcommand(self):
        self.assertUsageError()

    def test_push_needs_exactly_one_mode(self):
        self.assertUsageError("push")
        self.assertUsageError("push", "--content", "--full")

    def test_flags_belong_to_their_direction(self):
        self.assertUsageError("push", "--content", "--yes")
        self.assertUsageError("pull", "--force")
        self.assertUsageError("pull", "--content")

    def test_db_only_and_files_only_exclude_each_other(self):
        self.assertUsageError("pull", "--db-only", "--files-only")

    def test_pull_defaults(self):
        o = parse("pull")
        self.assertEqual((o.command, o.mode, o.db, o.files, o.yes, o.force, o.dry_run),
                         ("pull", None, True, True, False, False, False))

    def test_push_content_files_only(self):
        o = parse("push", "--content", "--files-only", "--dry-run")
        self.assertEqual((o.command, o.mode, o.db, o.files, o.dry_run),
                         ("push", "content", False, True, True))

    def test_push_full_db_only_force(self):
        o = parse("push", "--full", "--db-only", "--force")
        self.assertEqual((o.mode, o.db, o.files, o.force), ("full", True, False, True))


class ConfirmTest(unittest.TestCase):
    def test_host_must_match_exactly(self):
        confirm_host("203.0.113.5", read=lambda _: "203.0.113.5")
        for typed in ("", "y", "203.0.113.50", " 203.0.113.5x"):
            with self.assertRaises(SyncError):
                confirm_host("203.0.113.5", read=lambda _, t=typed: t)

    def test_host_tolerates_surrounding_whitespace(self):
        confirm_host("h", read=lambda _: "  h \n")

    def test_closed_stdin_aborts_cleanly(self):
        def eof(_):
            raise EOFError
        with self.assertRaises(SyncError):
            confirm_host("h", read=eof)
        with self.assertRaises(SyncError):
            confirm_yes("?", read=eof)

    def test_yes(self):
        confirm_yes("?", read=lambda _: "Y")
        with self.assertRaises(SyncError):
            confirm_yes("?", read=lambda _: "")


if __name__ == "__main__":
    unittest.main()
