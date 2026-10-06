"""Application startup dependencies and fail-closed service wiring."""

from __future__ import annotations

from enum import StrEnum

from teddy_bud.ai.providers.cloudflare import CloudflareGatewayProvider
from teddy_bud.config.settings import AppSettings
from teddy_bud.services.ai_service import AIService
from teddy_bud.services.conversation_service import ConversationService
from teddy_bud.services.memory_service import MemoryService
from teddy_bud.security.keystore import OSKeyStore, SecureStorageUnavailable
from teddy_bud.storage.database import DatabaseUnavailable, EncryptedDatabase
from teddy_bud.storage.migrations import apply_schema
from teddy_bud.storage.repositories import ConversationRepository, MemoryRepository, SettingsRepository


class AppStatus(StrEnum):
    STARTING = "starting"
    READY = "ready"
    SENDING = "sending"
    STORAGE_UNAVAILABLE = "storage_unavailable"
    GATEWAY_UNAVAILABLE = "gateway_unavailable"
    GATEWAY_ERROR = "gateway_error"


class AppState:
    def __init__(self, settings: AppSettings):
        self.settings = settings
        self.database = None
        self.conversation_service = None
        self.conversation_id = None
        self.startup_message = None
        self.repository = None
        self.memory_service = None
        self.settings_repository = None
        self.provider = None
        self.status = AppStatus.STARTING
        self.last_error = None

    def initialize(self) -> None:
        self.status = AppStatus.STARTING
        self.last_error = None
        self.startup_message = None
        self.conversation_service = None
        self.provider = None
        try:
            database = EncryptedDatabase(self.settings.database_path, OSKeyStore())
            database.open()
            apply_schema(database)
            repository = ConversationRepository(database)
            self.database = database
            self.repository = repository
            self.memory_service = MemoryService(MemoryRepository(database))
            self.settings_repository = SettingsRepository(database)
            conversations = repository.list_conversations()
            self.conversation_id = conversations[0]["id"] if conversations else repository.create()
            if self.settings.gateway_url:
                provider = CloudflareGatewayProvider(self.settings.gateway_url)
                self.provider = provider
                self.conversation_service = ConversationService(AIService(provider), repository, fallback=True)
            else:
                self.conversation_service = ConversationService(None, repository, fallback=True)
            self.status = AppStatus.READY
        except (SecureStorageUnavailable, DatabaseUnavailable, ValueError) as exc:
            self.startup_message = str(exc)
            self.last_error = exc
            self.status = AppStatus.STORAGE_UNAVAILABLE if isinstance(exc, (SecureStorageUnavailable, DatabaseUnavailable)) else AppStatus.GATEWAY_UNAVAILABLE
        except Exception:
            # Do not expose database, keyring, or provider internals to the UI.
            self.startup_message = "Secure storage is unavailable. Sensitive data will not be saved."
            self.status = AppStatus.STORAGE_UNAVAILABLE

    def send_message(self, text: str):
        if self.conversation_service is None or self.conversation_id is None:
            raise RuntimeError(self.startup_message or "The secure conversation service is unavailable.")
        memories = []
        if self.get_setting("memory_enabled", "true") == "true" and self.memory_service is not None:
            memories = self.memory_service.relevant_to(text)
        self.status = AppStatus.SENDING
        try:
            response = self.conversation_service.send_message(
                self.conversation_id,
                text,
                memories=memories,
                response_style=self.get_setting("response_style", "balanced"),
            )
            self.status = AppStatus.READY
            self.last_error = None
            return response
        except Exception as exc:
            self.status = AppStatus.GATEWAY_ERROR
            self.last_error = exc
            raise

    def get_setting(self, key: str, default: str) -> str:
        if self.settings_repository is None:
            return default
        return self.settings_repository.get(key, default) or default

    def set_setting(self, key: str, value: str) -> None:
        if self.settings_repository is not None:
            self.settings_repository.set(key, value)

    def messages_for(self, conversation_id: str | None = None):
        if self.repository is None:
            return []
        return self.repository.messages(conversation_id or self.conversation_id)

    def conversations(self):
        return self.repository.list_conversations() if self.repository is not None else []

    def new_conversation(self) -> str:
        if self.repository is None:
            raise RuntimeError("Encrypted conversation storage is unavailable.")
        self.conversation_id = self.repository.create()
        return self.conversation_id

    def open_conversation(self, conversation_id: str) -> None:
        if self.repository is None or not any(item["id"] == conversation_id for item in self.repository.list_conversations()):
            raise ValueError("That conversation is no longer available.")
        self.conversation_id = conversation_id

    def delete_conversation(self, conversation_id: str) -> None:
        if self.repository is None:
            return
        self.repository.delete(conversation_id)
        remaining = self.repository.list_conversations()
        if conversation_id == self.conversation_id:
            self.conversation_id = remaining[0]["id"] if remaining else self.repository.create()

    def rename_conversation(self, conversation_id: str, title: str) -> None:
        if self.repository is None:
            raise RuntimeError("Encrypted conversation storage is unavailable.")
        self.repository.rename(conversation_id, title)

    def clear_conversations(self) -> None:
        if self.repository is None:
            return
        self.repository.clear()
        self.conversation_id = self.repository.create()

    def clear_memories(self) -> None:
        if self.memory_service is not None:
            self.memory_service.clear()

    def clear_local_data(self) -> None:
        database = self.database
        if database is None:
            return
        if self.provider is not None:
            self.provider.clear_credentials()
        database.close()
        database.key_store.delete_key(database.key_alias)
        for path in (database.path, database.path.with_name(database.path.name + "-wal"), database.path.with_name(database.path.name + "-shm")):
            path.unlink(missing_ok=True)
        self.database = None
        self.repository = None
        self.memory_service = None
        self.settings_repository = None
        self.conversation_id = None
        self.conversation_service = None
        self.provider = None
        self.status = AppStatus.STARTING
        self.initialize()

