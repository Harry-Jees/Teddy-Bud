from __future__ import annotations

from pathlib import Path

from .database import EncryptedDatabase


def apply_schema(database: EncryptedDatabase) -> None:
    schema = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
    database.connection.executescript(schema)
    database.connection.commit()

