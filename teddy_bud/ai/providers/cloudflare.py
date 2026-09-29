"""HTTPS client for the Cloudflare Worker AI gateway.

The Worker is the only provider visible to the application. No NVIDIA key,
model credential, or private conversation content is logged here.
"""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from teddy_bud.ai.models import AIRequest, AIResponse
from teddy_bud.ai.registry import TaskRoute


class GatewayError(RuntimeError):
    """Safe, user-facing gateway failure without upstream details."""


class CloudflareGatewayProvider:
    def __init__(self, gateway_url: str, *, timeout: float = 30.0):
        if not gateway_url or not gateway_url.lower().startswith("https://"):
            raise ValueError("TEDDY_GATEWAY_URL must be an HTTPS URL")
        self.gateway_url = gateway_url.rstrip("/")
        self.timeout = timeout

    def complete(self, request: AIRequest, route: TaskRoute) -> AIResponse:
        payload = {
            "task": route.gateway_operation,
            "messages": list(request.messages),
            "memories": list(request.memories),
        }
        if request.request_id:
            payload["request_id"] = request.request_id
        http_request = Request(
            self.gateway_url,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urlopen(http_request, timeout=self.timeout) as response:
                body = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            raise GatewayError("The conversation service is unavailable.") from exc

        text = body.get("text")
        if not isinstance(text, str) or not text.strip():
            raise GatewayError("The conversation service returned an invalid response.")
        return AIResponse(text=text, request_id=body.get("request_id"))

