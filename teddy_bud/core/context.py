from __future__ import annotations

from teddy_bud.ai.models import AIRequest, TaskType
from teddy_bud.security.privacy import ContextLimits, minimize_memories, minimize_messages
from teddy_bud.security.redaction import redact_secrets


def build_context(task: TaskType, messages, memories=(), *, request_id=None, limits=None) -> AIRequest:
    limits = limits or ContextLimits()
    safe_messages = tuple({"role": item["role"], "content": redact_secrets(item["content"])} for item in minimize_messages(messages, limits))
    safe_memories = tuple(redact_secrets(item) for item in minimize_memories(memories, limits))
    return AIRequest(task=task, messages=safe_messages, memories=safe_memories, request_id=request_id)

