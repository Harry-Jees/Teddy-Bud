"""Cloudflare Worker provider adapter.

The adapter knows only the Worker URL and device-authenticated client. NVIDIA
credentials never enter this process.
"""

from __future__ import annotations

from teddy_bud.ai.client import AIClient
from teddy_bud.ai.models import AIRequest, AIResponse
from teddy_bud.ai.registry import ModelRegistry, TaskRoute
from teddy_bud.security.credentials import DeviceAuthenticator
from teddy_bud.security.keystore import OSKeyStore, SecureKeyStore
from teddy_bud.security.transport import GatewayTransport


class GatewayError(RuntimeError):
    pass


class CloudflareGatewayProvider:
    def __init__(self, gateway_url: str, *, timeout: float = 30.0, key_store: SecureKeyStore | None = None, client: AIClient | None = None):
        self.client = client or AIClient(GatewayTransport(gateway_url, timeout=timeout), DeviceAuthenticator(key_store or OSKeyStore()))
        self.registry = ModelRegistry.default()

    def complete(self, request: AIRequest, route: TaskRoute) -> AIResponse:
        model_id = request.model_id or self.registry.model_for(route.purpose).model_id
        try:
            body = self.client.chat(model=model_id, messages=request.messages, stream=False)
        except Exception as exc:
            raise GatewayError("The conversation service is unavailable.") from exc
        text = body.get("response") if isinstance(body, dict) else None
        if not isinstance(text, str):
            choices = body.get("choices", []) if isinstance(body, dict) else []
            if choices:
                text = choices[0].get("message", {}).get("content")
        if not isinstance(text, str) or not text.strip():
            raise GatewayError("The conversation service returned an invalid response.")
        return AIResponse(text=text, request_id=request.request_id, model_id=model_id)

    def stream(self, request: AIRequest, route: TaskRoute):
        model_id = request.model_id or self.registry.model_for(route.purpose).model_id
        try:
            yield from self.client.stream_chat(model=model_id, messages=request.messages)
        except Exception as exc:
            raise GatewayError("The conversation stream is unavailable.") from exc
