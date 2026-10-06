import base64

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from teddy_bud.security.credentials import DeviceAuthenticator
from teddy_bud.security.transport import GatewayTransport


class MemoryKeyStore:
    def __init__(self):
        self.values = {}

    def get_secret(self, alias):
        return self.values.get(alias)

    def set_secret(self, alias, value):
        self.values[alias] = value

    def get_or_create_key(self, alias):
        return self.values[alias]

    def delete_key(self, alias):
        self.values.pop(alias, None)


class FakeTransport:
    def __init__(self):
        self.register_payload = None
        self.verify_payload = None

    def post_json(self, path, payload):
        if path == "/auth/register":
            self.register_payload = payload
            return {"accessToken": "device-jwt"}
        self.verify_payload = payload
        return {"accessToken": "refreshed-jwt"}


def test_device_registration_and_signed_verification_payload():
    store = MemoryKeyStore()
    auth = DeviceAuthenticator(store)
    transport = FakeTransport()
    assert auth.register(transport) == "device-jwt"
    assert auth.jwt() == "device-jwt"
    assert set(transport.register_payload) == {"deviceId", "publicKey"}
    public_key = Ed25519PublicKey.from_public_bytes(base64.urlsafe_b64decode(transport.register_payload["publicKey"] + "=="))
    assert public_key
    assert auth.verify(transport) == "refreshed-jwt"
    assert isinstance(transport.verify_payload["timestamp"], int)
    message = f"{transport.verify_payload['deviceId']}:{transport.verify_payload['timestamp']}".encode()
    signature = base64.urlsafe_b64decode(transport.verify_payload["signature"] + "==")
    public_key.verify(signature, message)


def test_gateway_transport_identifies_native_client(monkeypatch):
    captured = {}

    def fake_urlopen(request, timeout):
        captured["request"] = request
        return object()

    monkeypatch.setattr("teddy_bud.security.transport.urlopen", fake_urlopen)
    GatewayTransport("https://worker.example.test").request("GET", "/health")

    assert captured["request"].get_header("User-agent") == "TeddyBud"
