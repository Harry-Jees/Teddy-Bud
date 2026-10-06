"""Small repository layer; UI and services never execute SQL directly."""

from __future__ import annotations

from datetime import datetime, timezone
import re
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
        now = _now()
        self.database.execute("INSERT INTO messages VALUES (?, ?, ?, ?, ?)", (message_id, conversation_id, role, content, now))
        title = content.strip().replace("\n", " ")[:48] if role == "user" else None
        if title:
            self.database.execute(
                "UPDATE conversations SET title = CASE WHEN title = 'New conversation' THEN ? ELSE title END, updated_at = ? WHERE id = ?",
                (title, now, conversation_id),
            )
        else:
            self.database.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))
        self.database.connection.commit()
        return message_id

    def delete_message(self, message_id: str) -> None:
        self.database.execute("DELETE FROM messages WHERE id = ?", (message_id,))
        self.database.execute(
            "UPDATE conversations SET title = 'New conversation' "
            "WHERE id NOT IN (SELECT conversation_id FROM messages) "
            "AND title != 'New conversation'"
        )
        self.database.connection.commit()

    def recent_messages(self, conversation_id: str, limit: int = 12) -> list[dict[str, str]]:
        rows = self.database.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
            (conversation_id, limit),
        ).fetchall()
        return [{"role": row[0], "content": row[1]} for row in reversed(rows)]

    def list_conversations(self) -> list[dict[str, str]]:
        rows = self.database.execute(
            "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
        ).fetchall()
        return [dict(zip(("id", "title", "created_at", "updated_at"), row)) for row in rows]

    def messages(self, conversation_id: str) -> list[dict[str, str]]:
        rows = self.database.execute(
            "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
            (conversation_id,),
        ).fetchall()
        return [dict(zip(("id", "role", "content", "created_at"), row)) for row in rows]

    def delete(self, conversation_id: str) -> None:
        self.database.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
        self.database.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        self.database.connection.commit()

    def rename(self, conversation_id: str, title: str) -> None:
        title = title.strip()
        if not title:
            raise ValueError("Conversation title cannot be empty")
        self.database.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (title[:80], _now(), conversation_id),
        )
        self.database.connection.commit()

    def clear(self) -> None:
        self.database.execute("DELETE FROM messages")
        self.database.execute("DELETE FROM conversations")
        self.database.connection.commit()


class MemoryRepository:
    def __init__(self, database: EncryptedDatabase):
        self.database = database

    def list(self) -> list[dict[str, str | None]]:
        rows = self.database.execute(
            "SELECT id, content, memory_type, created_at, updated_at, expires_at FROM memories "
            "WHERE expires_at IS NULL OR expires_at > ? ORDER BY updated_at DESC",
            (_now(),),
        ).fetchall()
        return [dict(zip(("id", "content", "memory_type", "created_at", "updated_at", "expires_at"), row)) for row in rows]

    def create(self, content: str, memory_type: str = "user") -> str:
        memory_id = str(uuid4())
        now = _now()
        self.database.execute(
            "INSERT INTO memories (id, content, memory_type, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, NULL)",
            (memory_id, content, memory_type, now, now),
        )
        self.database.connection.commit()
        return memory_id

    def update(self, memory_id: str, content: str) -> None:
        self.database.execute("UPDATE memories SET content = ?, updated_at = ? WHERE id = ?", (content, _now(), memory_id))
        self.database.connection.commit()

    def delete(self, memory_id: str) -> None:
        self.database.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        self.database.connection.commit()

    def clear(self) -> None:
        self.database.execute("DELETE FROM memories")
        self.database.connection.commit()


class SettingsRepository:
    def __init__(self, database: EncryptedDatabase):
        self.database = database

    def get(self, key: str, default: str | None = None) -> str | None:
        row = self.database.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
        return row[0] if row else default

    def set(self, key: str, value: str) -> None:
        self.database.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            (key, value, _now()),
        )
        self.database.connection.commit()

    def clear(self) -> None:
        self.database.execute("DELETE FROM app_settings")
        self.database.connection.commit()

