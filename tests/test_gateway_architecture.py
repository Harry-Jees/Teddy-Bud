import json
from urllib.request import Request

import pytest

from teddy_bud.ai.models import AIRequest, ModelPurpose, TaskType
from teddy_bud.ai.providers.cloudflare import CloudflareGatewayProvider
from teddy_bud.ai.registry import ModelRegistry


def test_gateway_requires_https():
    with pytest.raises(ValueError):
        CloudflareGatewayProvider("http://localhost:8787")


def test_registry_contains_tasks_without_provider_credentials():
    registry = ModelRegistry.default()
    route = registry.route_for(TaskType.CONVERSATION)
    assert route.gateway_operation == "chat_completions"
    assert registry.model_for(ModelPurpose.EMOTIONAL_CONVERSATION).model_id == "nvidia/llama-3.1-nemotron-70b-instruct"


def test_gateway_provider_uses_worker_client_without_credentials():
    class FakeClient:
        def chat(self, **kwargs):
            self.kwargs = kwargs
            return {"choices": [{"message": {"content": "hello"}}]}

    client = FakeClient()
    provider = CloudflareGatewayProvider("https://worker.example.test", client=client)
    request = AIRequest(TaskType.CONVERSATION, ({"role": "user", "content": "hello"},))
    response = provider.complete(request, ModelRegistry.default().route_for(request.task))
    assert response.text == "hello"
    assert client.kwargs["model"] == "nvidia/llama-3.1-nemotron-70b-instruct"
