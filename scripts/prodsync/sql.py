"""SQL and container shell scripts, built as strings; no I/O here."""
from __future__ import annotations

from typing import Iterable

from .tables import ForeignKey, validate_table_name

# Every MySQL call runs inside the mysql container and takes the password and
# database name from the container's own environment, so neither ever crosses
# a command line or the SSH connection.
_AUTH = 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD"'
MYSQL_CLIENT = f'{_AUTH} exec mysql -uroot -N -B "$MYSQL_DATABASE"'
IMPORT_SCRIPT = f'gzip -dc | {_AUTH} mysql -uroot "$MYSQL_DATABASE"'

LIST_TABLES = ("SELECT TABLE_NAME FROM information_schema.TABLES "
               "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' "
               "ORDER BY TABLE_NAME;")
LIST_MIGRATIONS = "SELECT migration FROM migrations ORDER BY migration;"
LIST_FOREIGN_KEYS = ("SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME "
                     "FROM information_schema.KEY_COLUMN_USAGE "
                     "WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL "
                     "ORDER BY TABLE_NAME, COLUMN_NAME;")
SCHEMA_CHARSET = ("SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME "
                  "FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE();")

_CHUNK = 1000
# Ids are compared as binary strings on both sides: an explicit COLLATE wins
# coercibility, so a temp table and a column with different default collations
# cannot raise "Illegal mix of collations".
_AS_KEY = "CAST({} AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_bin"


def quote_ident(name: str) -> str:
    return f"`{validate_table_name(name)}`"


def quote_value(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def checksum_sql(tables: Iterable[str]) -> str:
    names = [quote_ident(t) for t in tables]
    if not names:
        raise ValueError("no tables to checksum")
    return f"CHECKSUM TABLE {', '.join(names)};"


def parse_rows(output: str) -> list[list[str]]:
    return [line.split("\t") for line in output.splitlines() if line.strip()]


def parse_checksums(output: str) -> dict[str, str | None]:
    result: dict[str, str | None] = {}
    for qualified, value in parse_rows(output):
        result[qualified.split(".", 1)[-1]] = None if value == "NULL" else value
    return result


def parse_foreign_keys(output: str) -> list[ForeignKey]:
    return [ForeignKey(*row) for row in parse_rows(output)]


def distinct_values_sql(table: str, column: str) -> str:
    col = quote_ident(column)
    return f"SELECT DISTINCT CAST({col} AS CHAR) FROM {quote_ident(table)} WHERE {col} IS NOT NULL;"


def _values_table(values: list[str]) -> str:
    parts = [
        "DROP TEMPORARY TABLE IF EXISTS _sync_keep;",
        "CREATE TEMPORARY TABLE _sync_keep "
        "(v VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY);",
    ]
    for start in range(0, len(values), _CHUNK):
        chunk = values[start:start + _CHUNK]
        rows = ",".join(f"({quote_value(v)})" for v in chunk)
        parts.append(f"INSERT IGNORE INTO _sync_keep (v) VALUES {rows};")
    return "\n".join(parts)


def children_missing_parent_sql(fk: ForeignKey, parent_values: list[str]) -> str:
    """Rows of prod-only fk.table whose parent id is absent from `parent_values`.

    Output columns: table, column, missing value, row count.
    """
    col = f"c.{quote_ident(fk.column)}"
    return _values_table(parent_values) + (
        f"\nSELECT {quote_value(fk.table)}, {quote_value(fk.column)}, CAST({col} AS CHAR), COUNT(*) "
        f"FROM {quote_ident(fk.table)} c "
        f"LEFT JOIN _sync_keep k ON k.v = {_AS_KEY.format(col)} "
        f"WHERE {col} IS NOT NULL AND k.v IS NULL GROUP BY {col};"
    )


def parents_missing_sql(fk: ForeignKey, child_values: list[str]) -> str:
    """Values of content fk.table.fk.column with no row in prod-only fk.ref_table.

    Output columns: table, column, missing value.
    """
    ref = f"p.{quote_ident(fk.ref_column)}"
    return _values_table(child_values) + (
        f"\nSELECT {quote_value(fk.table)}, {quote_value(fk.column)}, k.v FROM _sync_keep k "
        f"LEFT JOIN {quote_ident(fk.ref_table)} p ON {_AS_KEY.format(ref)} = k.v "
        f"WHERE {ref} IS NULL;"
    )


def recreate_database_sql(database: str, charset: str, collation: str) -> str:
    db = quote_ident(database)
    return (f"DROP DATABASE IF EXISTS {db};\n"
            f"CREATE DATABASE {db} CHARACTER SET {validate_table_name(charset)} "
            f"COLLATE {validate_table_name(collation)};")


def dump_script(tables: list[str] | None) -> str:
    """mysqldump of the whole database (None) or of the given tables, gzipped to stdout."""
    flags = "--single-transaction --no-tablespaces --triggers"
    if tables is None:
        flags += " --routines --events"
        names = ""
    else:
        names = " " + " ".join(validate_table_name(t) for t in tables)
    return f'{_AUTH} mysqldump -uroot {flags} "$MYSQL_DATABASE"{names} | gzip -c'


def dump_completed(tail: bytes) -> bool:
    # mysqldump writes this as its last line; a dump that died part-way is
    # still a valid gzip, so this marker is what proves it ran to the end.
    return b"-- Dump completed" in tail
