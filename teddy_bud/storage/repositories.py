"""Small repository layer; UI and services never execute SQL directly."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from .database import EncryptedDatabase


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ConversationRepository:
    def __init__(self, database: EncryptedDatabase):
        self.database = database

    def create(self, title: str = "New conversation") -> str:
        conversation_id = str(uuid4())
        now = _now()
        self.database.execute("INSERT INTO conversations VALUES (?, ?, ?, ?)", (conversation_id, title, now, now))
        self.database.connection.commit()
        return conversation_id

    def add_message(self, conversation_id: str, role: str, content: str) -> str:
        message_id = str(uuid4())
        self.database.execute("INSERT INTO messages VALUES (?, ?, ?, ?, ?)", (message_id, conversation_id, role, content, _now()))
        self.database.connection.commit()
        return message_id

    def recent_messages(self, conversation_id: str, limit: int = 12) -> list[dict[str, str]]:
        rows = self.database.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
            (conversation_id, limit),
        ).fetchall()
        return [{"role": row[0], "content": row[1]} for row in reversed(rows)]

