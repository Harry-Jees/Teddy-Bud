"""OS-backed key storage with fail-closed behavior."""

from __future__ import annotations

from abc import ABC, abstractmethod


class SecureStorageUnavailable(RuntimeError):
    """Raised when the platform cannot provide secure key storage."""


class SecureKeyStore(ABC):
    @abstractmethod
    def get_secret(self, alias: str) -> bytes | None:
        raise NotImplementedError

    @abstractmethod
    def set_secret(self, alias: str, value: bytes) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_or_create_key(self, alias: str) -> bytes:
        raise NotImplementedError

    @abstractmethod
    def delete_key(self, alias: str) -> None:
        raise NotImplementedError


class OSKeyStore(SecureKeyStore):
    """Use the platform credential vault through the ``keyring`` package.

    There is intentionally no plaintext-file fallback. Android deployments can
    provide a platform-specific SecureKeyStore implementation later.
    """

    def __init__(self, *, service_name: str = "teddy_bud"):
        try:
            import keyring
        except ImportError as exc:
            raise SecureStorageUnavailable("OS secure storage is unavailable") from exc
        self._keyring = keyring
        self.service_name = service_name

    def get_secret(self, alias: str) -> bytes | None:
        value = self._keyring.get_password(self.service_name, alias)
        return value.encode("utf-8") if value is not None else None

    def set_secret(self, alias: str, value: bytes) -> None:
        try:
            self._keyring.set_password(self.service_name, alias, value.decode("utf-8"))
        except Exception as exc:
            raise SecureStorageUnavailable("OS secure storage could not save a credential") from exc

    def get_or_create_key(self, alias: str) -> bytes:
        value = self._keyring.get_password(self.service_name, alias)
        if value is None:
            import secrets

            value = secrets.token_urlsafe(32)
            try:
                self._keyring.set_password(self.service_name, alias, value)
            except Exception as exc:
                raise SecureStorageUnavailable("OS secure storage could not save the database key") from exc
        return value.encode("utf-8")

    def delete_key(self, alias: str) -> None:
        try:
            self._keyring.delete_password(self.service_name, alias)
        except self._keyring.errors.PasswordDeleteError:
            pass

    def delete_secret(self, alias: str) -> None:
        self.delete_key(alias)

