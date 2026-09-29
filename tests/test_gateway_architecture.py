import json
from urllib.request import Request

import pytest

from teddy_bud.ai.models import AIRequest, TaskType
from teddy_bud.ai.providers.cloudflare import CloudflareGatewayProvider
from teddy_bud.ai.registry import ModelRegistry


def test_gateway_requires_https():
    with pytest.raises(ValueError):
        CloudflareGatewayProvider("http://localhost:8787")


def test_registry_contains_tasks_without_provider_credentials():
    registry = ModelRegistry.default()
    route = registry.route_for(TaskType.CONVERSATION)
    assert route.gateway_operation == "conversation"
    assert "NVIDIA" not in repr(route)


def test_gateway_payload_contains_minimum_context(monkeypatch):
    captured = {}

    def fake_urlopen(request: Request, timeout: float):
        captured["payload"] = json.loads(request.data.decode("utf-8"))
        raise TimeoutError()

    monkeypatch.setattr("teddy_bud.ai.providers.cloudflare.urlopen", fake_urlopen)
    provider = CloudflareGatewayProvider("https://worker.example.test")
    request = AIRequest(TaskType.CONVERSATION, ({"role": "user", "content": "hello"},))
    with pytest.raises(RuntimeError):
        provider.complete(request, ModelRegistry.default().route_for(request.task))
    assert captured["payload"] == {
        "task": "conversation",
        "messages": [{"role": "user", "content": "hello"}],
        "memories": [],
    }
