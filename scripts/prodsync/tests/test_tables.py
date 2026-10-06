import unittest

from prodsync.tables import (
    PROD_ONLY_TABLES, ForeignKey, classify, new_tables,
    split_cross_foreign_keys, validate_table_name,
)


class ClassifyTest(unittest.TestCase):
    def test_splits_and_sorts(self):
        content, prod_only = classify(["posts", "users", "concerts", "orders"])
        self.assertEqual(content, ["concerts", "posts"])
        self.assertEqual(prod_only, ["orders", "users"])

    def test_tables_written_by_prod_traffic_are_prod_only(self):
        for name in ("tech_rider_confirmations", "migrations", "oauth_clients",
                     "tickets", "newsletter_subscribers", "site_dirty_areas"):
            self.assertIn(name, PROD_ONLY_TABLES)

    def test_unknown_table_defaults_to_content(self):
        content, _ = classify(["brand_new_table"])
        self.assertEqual(content, ["brand_new_table"])

    def test_new_tables(self):
        self.assertEqual(new_tables(["a", "b", "c"], {"a": "1", "b": "2"}), ["c"])


class ValidateTableNameTest(unittest.TestCase):
    def test_accepts_identifiers(self):
        self.assertEqual(validate_table_name("post_blocks"), "post_blocks")

    def test_rejects_anything_else(self):
        for bad in ("posts`; DROP", "a b", "", "x;y", "$(id)"):
            with self.assertRaises(ValueError):
                validate_table_name(bad)

    def test_classify_validates(self):
        with self.assertRaises(ValueError):
            classify(["ok", "not ok"])


class SplitForeignKeysTest(unittest.TestCase):
    def test_only_cross_boundary_keys(self):
        fks = [
            ForeignKey("tickets", "concert_id", "concerts", "id"),     # prod-only -> content
            ForeignKey("posts", "user_id", "users", "id"),             # content -> prod-only
            ForeignKey("post_blocks", "post_id", "posts", "id"),       # content -> content
            ForeignKey("order_items", "order_id", "orders", "id"),     # prod-only -> prod-only
        ]
        down, up = split_cross_foreign_keys(fks, PROD_ONLY_TABLES)
        self.assertEqual([f.table for f in down], ["tickets"])
        self.assertEqual([f.table for f in up], ["posts"])


if __name__ == "__main__":
    unittest.main()
