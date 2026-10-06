#!/usr/bin/env python3
"""Sync the database and uploads between production and the local stack.

    python scripts/sync_db.py pull
    python scripts/sync_db.py push --content
    python scripts/sync_db.py push --full

See docs/prod-sync.md.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prodsync.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
