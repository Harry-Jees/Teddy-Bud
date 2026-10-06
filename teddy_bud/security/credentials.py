"""Device identity and JWT lifecycle for the Cloudflare Worker gateway."""

from __future__ import annotations

import base64
import time
import uuid
from dataclasses import dataclass

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from .keystore import SecureKeyStore, SecureStorageUnavailable


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


@dataclass(frozen=True, slots=True)
class DeviceIdentity:
    device_id: str
    private_key: Ed25519PrivateKey


class DeviceAuthenticator:
    DEVICE_ID = "device_id"
    PRIVATE_KEY = "device_ed25519_private_key"
    JWT = "device_jwt"

    def __init__(self, key_store: SecureKeyStore):
        self.key_store = key_store

    def load_identity(self) -> DeviceIdentity | None:
        device_id = self.key_store.get_secret(self.DEVICE_ID)
        private_bytes = self.key_store.get_secret(self.PRIVATE_KEY)
        if not device_id or not private_bytes:
            return None
        try:
            return DeviceIdentity(device_id.decode("utf-8"), Ed25519PrivateKey.from_private_bytes(private_bytes))
        except (ValueError, UnicodeDecodeError) as exc:
            raise SecureStorageUnavailable("Stored device identity is invalid") from exc

    def ensure_identity(self) -> DeviceIdentity:
        existing = self.load_identity()
        if existing:
            return existing
        identity = DeviceIdentity(str(uuid.uuid4()), Ed25519PrivateKey.generate())
        private_bytes = identity.private_key.private_bytes_raw()
        self.key_store.set_secret(self.DEVICE_ID, identity.device_id.encode("utf-8"))
        self.key_store.set_secret(self.PRIVATE_KEY, private_bytes)
        return identity

    def jwt(self) -> str | None:
        value = self.key_store.get_secret(self.JWT)
        return value.decode("utf-8") if value else None

    def _set_jwt(self, value: str) -> str:
        if not value or not isinstance(value, str):
            raise SecureStorageUnavailable("Gateway authentication returned no device token")
        self.key_store.set_secret(self.JWT, value.encode("utf-8"))
        return value

    def register(self, transport) -> str:
        identity = self.ensure_identity()
        public_key = _b64(identity.private_key.public_key().public_bytes_raw())
        body = transport.post_json("/auth/register", {"deviceId": identity.device_id, "publicKey": public_key})
        return self._set_jwt(body.get("accessToken") or body.get("token") or body.get("access_token") or body.get("jwt"))

    def verify(self, transport) -> str:
        identity = self.ensure_identity()
        timestamp = int(time.time())
        message = f"{identity.device_id}:{timestamp}".encode("utf-8")
        signature = _b64(identity.private_key.sign(message))
        body = transport.post_json("/auth/verify", {"deviceId": identity.device_id, "timestamp": timestamp, "signature": signature})
        return self._set_jwt(body.get("accessToken") or body.get("token") or body.get("access_token") or body.get("jwt"))

    def access_token(self, transport) -> str:
        token = self.jwt()
        if token:
            return token
        return self.register(transport)

    def clear(self) -> None:
        for alias in (self.DEVICE_ID, self.PRIVATE_KEY, self.JWT):
            self.key_store.delete_key(alias)

