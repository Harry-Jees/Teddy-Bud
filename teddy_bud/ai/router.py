"""Deterministic task router for the gateway-backed AI service."""

from __future__ import annotations

from .models import AIRequest, TaskType
from .registry import ModelRegistry, TaskRoute


class AIRouter:
    def __init__(self, registry: ModelRegistry | None = None):
        self.registry = registry or ModelRegistry.default()

    def route(self, request: AIRequest) -> TaskRoute:
        return self.registry.route_for(request.task)

    def conversation(self, messages, *, memories=(), request_id=None) -> AIRequest:
        return AIRequest(TaskType.CONVERSATION, tuple(messages), tuple(memories), request_id)

