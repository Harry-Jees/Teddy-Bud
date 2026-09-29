"""SQLCipher database access that never falls back to plaintext SQLite."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from teddy_bud.security.keystore import SecureKeyStore, SecureStorageUnavailable


class DatabaseUnavailable(RuntimeError):
    pass


class EncryptedDatabase:
    def __init__(self, path: Path, key_store: SecureKeyStore, *, key_alias: str = "database"):
        self.path = path
        self.key_store = key_store
        self.key_alias = key_alias
        self.connection = None

    def open(self):
        try:
            from sqlcipher3 import dbapi2 as sqlcipher
        except ImportError as exc:
            raise DatabaseUnavailable("SQLCipher is unavailable; sensitive data will not be persisted") from exc
        try:
            existing_database = self.path.exists() and self.path.stat().st_size > 0
            self.path.parent.mkdir(parents=True, exist_ok=True)
            key = self.key_store.get_or_create_key(self.key_alias)
            connection = sqlcipher.connect(str(self.path))
            # SQLCipher does not support bound parameters for PRAGMA key.
            # The key originates only from SecureKeyStore; escape it before
            # inserting it into this single PRAGMA statement.
            escaped_key = key.decode("utf-8").replace("'", "''")
            connection.execute(f"PRAGMA key = '{escaped_key}'")
            # Force SQLCipher to decrypt a real page. PRAGMA statements alone
            # may not fail immediately when a wrong key is supplied.
            connection.execute("SELECT count(*) FROM sqlite_master").fetchone()
            if existing_database:
                check = connection.execute("PRAGMA cipher_integrity_check").fetchone()
                if not check or check[0] != "ok":
                    connection.close()
                    raise DatabaseUnavailable("Encrypted database integrity check failed")
            self.connection = connection
            return connection
        except SecureStorageUnavailable:
            raise
        except DatabaseUnavailable:
            raise
        except Exception as exc:
            raise DatabaseUnavailable("Encrypted database could not be opened") from exc

    def close(self) -> None:
        if self.connection is not None:
            self.connection.close()
            self.connection = None

    def execute(self, sql: str, parameters: tuple[Any, ...] = ()):
        if self.connection is None:
            raise DatabaseUnavailable("Database is not open")
        return self.connection.execute(sql, parameters)

