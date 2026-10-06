"""Authenticated client for the deployed Cloudflare Worker gateway."""

from __future__ import annotations

from .streaming import parse_sse_lines
from teddy_bud.security.credentials import DeviceAuthenticator
from teddy_bud.security.transport import AuthenticationError, GatewayResponseError, GatewayTransport


class AIClient:
    def __init__(self, transport: GatewayTransport, authenticator: DeviceAuthenticator):
        self.transport = transport
        self.authenticator = authenticator

    def register_device(self) -> str:
        return self.authenticator.register(self.transport)

    def verify_device(self) -> str:
        return self.authenticator.verify(self.transport)

    def _token(self) -> str:
        return self.authenticator.access_token(self.transport)

    def _authenticated_json(self, method: str, path: str, payload=None):
        token = self._token()
        try:
            response = self.transport.request(method, path, payload=payload, token=token)
            import json

            with response:
                body = json.loads(response.read().decode("utf-8"))
                if not isinstance(body, dict):
                    raise GatewayResponseError("The gateway returned an invalid JSON response")
                return body
        except AuthenticationError:
            token = self.verify_device()
            response = self.transport.request(method, path, payload=payload, token=token)
            import json

            with response:
                body = json.loads(response.read().decode("utf-8"))
                if not isinstance(body, dict):
                    raise GatewayResponseError("The gateway returned an invalid JSON response")
                return body

    def health(self) -> dict:
        return self.transport.get_json("/health")

    def models(self) -> dict:
        return self._authenticated_json("GET", "/v1/models")

    def refresh_registry(self, registry) -> None:
        body = self.models()
        entries = body.get("data") or body.get("models") or []
        if isinstance(entries, list):
            registry.update_from_gateway(entries)

    def chat(self, *, model: str, messages, stream: bool = False) -> dict:
        return self._authenticated_json("POST", "/v1/chat/completions", {"model": model, "messages": list(messages), "stream": stream})

    def stream_chat(self, *, model: str, messages):
        token = self._token()
        payload = {"model": model, "messages": list(messages), "stream": True}
        try:
            response = self.transport.request("POST", "/v1/chat/completions", payload=payload, token=token)
        except AuthenticationError:
            response = self.transport.request("POST", "/v1/chat/completions", payload=payload, token=self.verify_device())
        try:
            yield from parse_sse_lines(response)
        finally:
            response.close()

