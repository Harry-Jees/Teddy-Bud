"""Test isolation for environments whose global pytest temp root is restricted."""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture
def tmp_path():
    # This sandbox denies SQLCipher file creation in pytest-created child
    # directories. Keep the fixture isolated to a guarded, ignored filename
    # in the writable repository root instead.
    path = Path.cwd()
    generated = path / "encrypted.sqlite3"
    if generated.exists():
        raise RuntimeError(f"Refusing to reuse existing test database: {generated}")
    try:
        yield path
    finally:
        generated.unlink(missing_ok=True)
        for suffix in ("-wal", "-shm"):
            path.joinpath(f"encrypted.sqlite3{suffix}").unlink(missing_ok=True)
