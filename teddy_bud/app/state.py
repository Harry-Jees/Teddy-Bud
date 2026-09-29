"""Application startup dependencies and fail-closed service wiring."""

from __future__ import annotations

from teddy_bud.ai.providers.cloudflare import CloudflareGatewayProvider
from teddy_bud.config.settings import AppSettings
from teddy_bud.services.ai_service import AIService
from teddy_bud.services.conversation_service import ConversationService
from teddy_bud.security.keystore import OSKeyStore, SecureStorageUnavailable
from teddy_bud.storage.database import DatabaseUnavailable, EncryptedDatabase
from teddy_bud.storage.migrations import apply_schema
from teddy_bud.storage.repositories import ConversationRepository


class AppState:
    def __init__(self, settings: AppSettings):
        self.settings = settings
        self.database = None
        self.conversation_service = None
        self.conversation_id = None
        self.startup_message = None

    def initialize(self) -> None:
        try:
            database = EncryptedDatabase(self.settings.database_path, OSKeyStore())
            database.open()
            apply_schema(database)
            repository = ConversationRepository(database)
            self.database = database
            self.conversation_id = repository.create()
            if self.settings.gateway_url:
                provider = CloudflareGatewayProvider(self.settings.gateway_url)
                self.conversation_service = ConversationService(AIService(provider), repository)
            else:
                self.startup_message = "The secure conversation gateway is not configured."
        except (SecureStorageUnavailable, DatabaseUnavailable, ValueError) as exc:
            self.startup_message = str(exc)
        except Exception:
            # Do not expose database, keyring, or provider internals to the UI.
            self.startup_message = "Secure storage is unavailable. Sensitive data will not be saved."

    def send_message(self, text: str):
        if self.conversation_service is None or self.conversation_id is None:
            raise RuntimeError(self.startup_message or "The secure conversation service is unavailable.")
        return self.conversation_service.send_message(self.conversation_id, text)

