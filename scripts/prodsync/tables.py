"""Which tables are band content and which only ever exist on production."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

# Rows created by visitors, customers or the runtime on prod. `push --content`
# never touches these; everything else is content. A new migration's table is
# therefore content by default - the flows print it so that is never silent.
PROD_ONLY_TABLES = frozenset({
    "users", "fan_accounts", "allowed_emails",
    "orders", "order_items", "tickets", "ticket_transfers",
    "presale_codes", "presale_code_tiers", "promo_codes",
    "newsletter_subscribers", "tech_rider_confirmations",
    "oauth_access_tokens", "oauth_auth_codes", "oauth_clients",
    "oauth_device_codes", "oauth_refresh_tokens",
    "sessions", "password_reset_tokens",
    "jobs", "job_batches", "failed_jobs",
    "cache", "cache_locks", "site_dirty_areas", "migrations",
})

_IDENTIFIER = re.compile(r"^[A-Za-z0-9_]+$")


def validate_table_name(name: str) -> str:
    """Table names end up in shell commands and SQL; allow plain identifiers only."""
    if not _IDENTIFIER.match(name):
        raise ValueError(f"refusing unexpected table name: {name!r}")
    return name


def classify(tables: Iterable[str]) -> tuple[list[str], list[str]]:
    content, prod_only = [], []
    for name in tables:
        validate_table_name(name)
        (prod_only if name in PROD_ONLY_TABLES else content).append(name)
    return sorted(content), sorted(prod_only)


def new_tables(content: Iterable[str], known: Iterable[str]) -> list[str]:
    return sorted(set(content) - set(known))


@dataclass(frozen=True)
class ForeignKey:
    table: str
    column: str
    ref_table: str
    ref_column: str


def split_cross_foreign_keys(
    fks: Iterable[ForeignKey], prod_only: Iterable[str]
) -> tuple[list[ForeignKey], list[ForeignKey]]:
    """(prod-only child -> content parent, content child -> prod-only parent)."""
    prod_only = set(prod_only)
    down, up = [], []
    for fk in fks:
        child_prod, parent_prod = fk.table in prod_only, fk.ref_table in prod_only
        if child_prod and not parent_prod:
            down.append(fk)
        elif parent_prod and not child_prod:
            up.append(fk)
    return down, up
