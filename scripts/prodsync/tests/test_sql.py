import unittest

from prodsync.sql import (
    checksum_sql, children_missing_parent_sql, distinct_values_sql, dump_completed,
    dump_script, parents_missing_sql, parse_checksums, parse_foreign_keys,
    quote_value, recreate_database_sql,
)
from prodsync.tables import ForeignKey


class ChecksumTest(unittest.TestCase):
    def test_builds_one_statement(self):
        self.assertEqual(checksum_sql(["a", "b"]), "CHECKSUM TABLE `a`, `b`;")

    def test_rejects_empty_and_bad_names(self):
        with self.assertRaises(ValueError):
            checksum_sql([])
        with self.assertRaises(ValueError):
            checksum_sql(["ok", "bad name"])

    def test_parses_values_and_null(self):
        out = "bandms.posts\t12345\nbandms.gone\tNULL\n"
        self.assertEqual(parse_checksums(out), {"posts": "12345", "gone": None})


class ForeignKeysTest(unittest.TestCase):
    def test_parse(self):
        out = "tickets\tconcert_id\tconcerts\tid\n"
        self.assertEqual(parse_foreign_keys(out),
                         [ForeignKey("tickets", "concert_id", "concerts", "id")])


class QuoteTest(unittest.TestCase):
    def test_escapes(self):
        self.assertEqual(quote_value("it's"), "'it''s'")
        self.assertEqual(quote_value(r"a\b"), r"'a\\b'")


class OrphanSqlTest(unittest.TestCase):
    fk = ForeignKey("tickets", "concert_id", "concerts", "id")

    def test_children_query_carries_values(self):
        sql = children_missing_parent_sql(self.fk, ["1", "2"])
        self.assertIn("VALUES ('1'),('2')", sql)
        self.assertIn("FROM `tickets` c", sql)
        self.assertIn("k.v IS NULL", sql)

    def test_empty_parent_set_still_valid_and_matches_everything(self):
        sql = children_missing_parent_sql(self.fk, [])
        self.assertNotIn("INSERT", sql)
        self.assertIn("CREATE TEMPORARY TABLE", sql)
        self.assertIn("k.v IS NULL", sql)

    def test_inserts_are_chunked(self):
        sql = children_missing_parent_sql(self.fk, [str(i) for i in range(2500)])
        self.assertEqual(sql.count("INSERT IGNORE"), 3)

    def test_parents_query(self):
        sql = parents_missing_sql(ForeignKey("posts", "user_id", "users", "id"), ["7"])
        self.assertIn("LEFT JOIN `users` p", sql)
        self.assertIn("p.`id` IS NULL", sql)

    def test_distinct_values(self):
        self.assertIn("SELECT DISTINCT", distinct_values_sql("concerts", "id"))
        with self.assertRaises(ValueError):
            distinct_values_sql("concerts", "id; drop")


class DumpTest(unittest.TestCase):
    def test_full_dump_has_routines_and_reads_password_in_container(self):
        script = dump_script(None)
        self.assertIn("--routines", script)
        self.assertIn('MYSQL_PWD="$MYSQL_ROOT_PASSWORD"', script)
        self.assertTrue(script.endswith("| gzip -c"))

    def test_table_dump_lists_tables(self):
        script = dump_script(["posts", "tags"])
        self.assertIn('"$MYSQL_DATABASE" posts tags |', script)
        self.assertNotIn("--routines", script)

    def test_table_dump_validates(self):
        with self.assertRaises(ValueError):
            dump_script(["posts; rm -rf /"])

    def test_completion_marker(self):
        self.assertTrue(dump_completed(b"...\n-- Dump completed on 2026-10-06 10:00:00\n"))
        self.assertFalse(dump_completed(b"INSERT INTO posts VALUES (1"))

    def test_recreate(self):
        sql = recreate_database_sql("bandms", "utf8mb4", "utf8mb4_unicode_ci")
        self.assertIn("DROP DATABASE IF EXISTS `bandms`", sql)
        self.assertIn("CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", sql)


if __name__ == "__main__":
    unittest.main()
